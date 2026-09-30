begin;
create table public.meeting_schedule_changes(
 id uuid primary key default gen_random_uuid(),poll_id text not null references public.polls(id) on delete cascade,
 revision integer not null,changed_by uuid not null,created_at timestamptz not null default now(),
 before_data jsonb not null,after_data jsonb not null,votes_before jsonb not null,
 emails text[] not null default '{}',delivered_emails text[] not null default '{}',
 notification_done boolean not null default false,notification_claim uuid,notification_lease_until timestamptz,notification_attempts integer not null default 0,notification_started_at timestamptz,
 unique(poll_id,revision)
);
alter table public.meeting_schedule_changes enable row level security;
revoke all on public.meeting_schedule_changes from public,anon,authenticated;
grant select,insert,update,delete on public.meeting_schedule_changes to service_role;
create index meeting_schedule_notice_pending on public.meeting_schedule_changes(created_at,id) where not notification_done;
create function public.meeting_edit_schedule(p_user uuid,p_id text,p_revision integer,p_patch jsonb,p_keys text[],p_notify boolean,p_reopen boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r text;old jsonb;updated jsonb;previous jsonb;recipients text[];
begin
 r:=public.meeting_account_role(p_user);if r is null then raise exception 'Forbidden';end if;
 select data::jsonb into old from public.polls where id=p_id for update;
 if old is null or (r<>'admin' and coalesce(old->>'ownerId','')<>p_user::text) then return null;end if;
 if coalesce((old->>'scheduleRevision')::integer,0)<>p_revision then return null;end if;
 if coalesce((old->>'closed')::boolean,false) and not coalesce(p_reopen,false) then raise exception 'Reopen required';end if;
 if p_keys is null or cardinality(p_keys)<1 or cardinality(p_keys)>3000 or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('start','end','from','to','dailyRanges')) then raise exception 'Invalid patch';end if;
 select coalesce(jsonb_agg(data::jsonb),'[]'::jsonb),coalesce(array_agg(distinct lower(trim(data::jsonb->>'email'))) filter(where data::jsonb->>'email' ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),'{}'::text[]) into previous,recipients from public.votes where poll_id=p_id;
 updated:=(old-'selectedSlot'-'selectedDate'-'closedAt')||p_patch||jsonb_build_object('scheduleRevision',p_revision+1,'updated',now(),'closed',false);
 update public.meeting_schedule_changes set notification_done=true where poll_id=p_id and not notification_done;
 insert into public.meeting_schedule_changes(poll_id,revision,changed_by,before_data,after_data,votes_before,emails,notification_done)
 values(p_id,p_revision+1,p_user,old-'manageHash',updated-'manageHash',previous,recipients,not coalesce(p_notify,true) or cardinality(recipients)=0);
 -- Keep unchanged cells and archive the original answers in the private change record.
 update public.votes v set data=jsonb_set(v.data::jsonb,'{slots}',coalesce((select jsonb_object_agg(k,value) from jsonb_each(v.data::jsonb->'slots') as s(k,value) where k=any(p_keys)),'{}'::jsonb))::text where poll_id=p_id;
 update public.polls set data=updated::text where id=p_id;
 return updated-'manageHash';
end $$;
create function public.meeting_claim_schedule_notice(p_id text,p_claim uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.meeting_schedule_changes;
begin
 select * into r from public.meeting_schedule_changes where not notification_done and notification_attempts<6
 and (p_id is null or poll_id=p_id) and (notification_lease_until is null or notification_lease_until<now())
 and (notification_started_at is null or notification_started_at>now()-interval '23 hours') order by created_at,id limit 1 for update skip locked;
 if not found then return null;end if;
 update public.meeting_schedule_changes set notification_claim=p_claim,notification_lease_until=now()+interval '5 minutes',notification_attempts=notification_attempts+1,notification_started_at=coalesce(notification_started_at,now()) where id=r.id;
 return jsonb_build_object('id',r.id,'after_data',r.after_data,'emails',r.emails,'delivered_emails',r.delivered_emails);
end $$;
create function public.meeting_ack_schedule_notice(p_id uuid,p_claim uuid,p_email text,p_done boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
 update public.meeting_schedule_changes set delivered_emails=case when p_email is not null and not(p_email=any(delivered_emails)) then array_append(delivered_emails,p_email) else delivered_emails end,notification_done=notification_done or p_done,notification_lease_until=case when p_done then null else notification_lease_until end where id=p_id and notification_claim=p_claim;
end $$;
revoke execute on function public.meeting_edit_schedule(uuid,text,integer,jsonb,text[],boolean,boolean),public.meeting_claim_schedule_notice(text,uuid),public.meeting_ack_schedule_notice(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.meeting_edit_schedule(uuid,text,integer,jsonb,text[],boolean,boolean),public.meeting_claim_schedule_notice(text,uuid),public.meeting_ack_schedule_notice(uuid,uuid,text,boolean) to service_role;
commit;
