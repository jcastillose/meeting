-- Apply only to the public schema after account roles exist.
-- Preserves votes while recording an explicit closure without an agreed time.
begin;
create or replace function public.meeting_account_manage(p_user uuid,p_id text,p_action text,p_notify boolean default null,p_slot text default null,p_date text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r text; old jsonb; updated jsonb;
begin
 r:=public.meeting_account_role(p_user);if r is null then raise exception 'Forbidden';end if;
 select data::jsonb into old from public.polls where id=p_id for update;
 if old is null or (r<>'admin' and coalesce(old->>'ownerId','')<>p_user::text) then return null;end if;
 updated:=old;
 if p_action='close' then updated:=old||jsonb_build_object('closed',true,'closedAt',coalesce(old->>'closedAt',now()::text));
 elsif p_action='close_no_agreement' then
  if old->>'selectedSlot' is not null then return null;end if;
  updated:=(old-'selectedSlot'-'selectedDate')||jsonb_build_object('closed',true,'closedAt',coalesce(old->>'closedAt',now()::text),'closureOutcome','no_agreement');
 elsif p_action='reopen' then
  if not coalesce((old->>'closed')::boolean,false) then return old;end if;
  updated:=(old-'closedAt'-'selectedSlot'-'selectedDate'-'closureOutcome')||jsonb_build_object('closed',false,'reopenedAt',now(),'updated',now(),'scheduleRevision',coalesce((old->>'scheduleRevision')::integer,0)+1);
 elsif p_action='notifications' then updated:=jsonb_set(old,'{creator,notify}',to_jsonb(p_notify));
 elsif p_action='finalize' and p_slot is not null then
  if old->>'closureOutcome'='no_agreement' then return null;end if;
  updated:=(old-'closureOutcome')||jsonb_build_object('closed',true,'closedAt',coalesce(old->>'closedAt',now()::text),'selectedSlot',p_slot,'selectedDate',p_date);
 else raise exception 'Invalid action';end if;
 update public.polls set data=updated::text where id=p_id;
 return updated;
end $$;
revoke execute on function public.meeting_account_manage(uuid,text,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.meeting_account_manage(uuid,text,text,boolean,text,text) to service_role;
create or replace function public.meeting_manage_poll(p_id text,p_hash text,p_action text,p_notify boolean default null)
returns text language plpgsql security invoker set search_path='' as $$
declare document jsonb;
begin
 select data::jsonb into document from public.polls where id=p_id for update;
 if document is null or document->>'manageHash' is distinct from p_hash then return null; end if;
 if p_action='close' then document=document||jsonb_build_object('closed',true,'closedAt',coalesce(document->>'closedAt',to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')));
 elsif p_action='close_no_agreement' then
  if document->>'selectedSlot' is not null then return null;end if;
  document:=(document-'selectedSlot'-'selectedDate')||jsonb_build_object('closed',true,'closedAt',coalesce(document->>'closedAt',to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')),'closureOutcome','no_agreement');
 elsif p_action='notifications' and p_notify is not null then document=jsonb_set(document,'{creator,notify}',to_jsonb(p_notify));
 else return null; end if;
 update public.polls set data=document::text where id=p_id;
 return document::text;
end $$;
revoke execute on function public.meeting_manage_poll(text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.meeting_manage_poll(text,text,text,boolean) to service_role;
create or replace function public.meeting_edit_schedule(p_user uuid,p_id text,p_revision integer,p_patch jsonb,p_keys text[],p_notify boolean,p_reopen boolean) returns jsonb
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
 updated:=(old-'selectedSlot'-'selectedDate'-'closedAt'-'closureOutcome')||p_patch||jsonb_build_object('scheduleRevision',p_revision+1,'updated',now(),'closed',false);
 update public.meeting_schedule_changes set notification_done=true where poll_id=p_id and not notification_done;
 insert into public.meeting_schedule_changes(poll_id,revision,changed_by,before_data,after_data,votes_before,emails,notification_done)
 values(p_id,p_revision+1,p_user,old-'manageHash',updated-'manageHash',previous,recipients,not coalesce(p_notify,true) or cardinality(recipients)=0);
 -- Keep unchanged cells and archive the original answers in the private change record.
 update public.votes v set data=jsonb_set(v.data::jsonb,'{slots}',coalesce((select jsonb_object_agg(k,value) from jsonb_each(v.data::jsonb->'slots') as s(k,value) where k=any(p_keys)),'{}'::jsonb))::text where poll_id=p_id;
 update public.polls set data=updated::text where id=p_id;
 return updated-'manageHash';
end $$;
commit;
