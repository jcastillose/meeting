-- Additive account roles and schedule extension. Only public application objects.
begin;
alter table public.meeting_admin_invitations add column role text not null default 'admin' check(role in ('admin','manager'));
create function public.meeting_account_role(p_user uuid) returns text language sql stable security invoker set search_path='' as $$ select case when raw_app_meta_data->>'meeting_admin'='true' then 'admin' when raw_app_meta_data->>'meeting_role'='manager' then 'manager' end from auth.users where id=p_user; $$;
create index meeting_polls_owner on public.polls ((data::jsonb->>'ownerId'));
create function public.meeting_account_history(p_user uuid,p_offset integer default 0,p_search text default '') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare r text; result jsonb;
begin
 r:=public.meeting_account_role(p_user); if r is null then raise exception 'Forbidden'; end if;
 with allowed as (select p.* from public.polls p where (r='admin' or p.data::jsonb->>'ownerId'=p_user::text) and strpos(lower(p.data::jsonb->>'title'),lower(left(p_search,120)))>0),
 page as (select * from allowed order by data::jsonb->>'created' desc,id desc limit 25 offset greatest(p_offset,0))
 select jsonb_build_object('total',(select count(*) from allowed),'polls',coalesce((select jsonb_agg(jsonb_build_object('poll',p.data::jsonb-'manageHash','responseCount',(select count(*) from public.votes v where v.poll_id=p.id)) order by p.data::jsonb->>'created' desc,p.id desc) from page p),'[]'::jsonb)) into result;
 return result;
end $$;
create function public.meeting_extend_poll(p_user uuid,p_id text,p_revision integer,p_patch jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r text; old jsonb; updated jsonb;
begin
 r:=public.meeting_account_role(p_user); if r is null then raise exception 'Forbidden'; end if;
 select data::jsonb into old from public.polls where id=p_id for update;
 if old is null or (r<>'admin' and coalesce(old->>'ownerId','')<>p_user::text) then return null; end if;
 if coalesce((old->>'scheduleRevision')::integer,0)<>p_revision then raise exception 'Schedule changed'; end if;
 if exists(select 1 from jsonb_object_keys(p_patch) as k where k not in ('start','end','from','to','dailyRanges')) then raise exception 'Invalid patch'; end if;
 updated:=old||p_patch||jsonb_build_object('scheduleRevision',p_revision+1,'updated',now());
 update public.polls set data=updated::text where id=p_id;
 return updated-'manageHash';
end $$;
create function public.meeting_claim_account_invitation(p_hash text,p_claim uuid)
returns table(email text,role text) language sql security invoker set search_path='' as $$
 update public.meeting_admin_invitations set used_at=now(),claim_id=p_claim where token_hash=p_hash and used_at is null and expires_at>now() returning email,role;
$$;
create table public.meeting_password_resets(user_id uuid primary key references auth.users(id) on delete cascade,token_hash text unique not null,password_snapshot text not null,issued_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 minutes');
alter table public.meeting_password_resets enable row level security;
revoke all on public.meeting_password_resets from public,anon,authenticated;
grant select,insert,update,delete on public.meeting_password_resets to service_role;
create function public.meeting_issue_reset(p_email text,p_hash text) returns boolean language plpgsql security invoker set search_path='' as $$
declare a auth.users;
begin
 select * into a from auth.users where lower(email)=lower(trim(p_email)) for update;
 if not found or public.meeting_account_role(a.id) is null then return false; end if;
 if exists(select 1 from public.meeting_password_resets where user_id=a.id and issued_at>now()-interval '60 seconds') then return false; end if;
 insert into public.meeting_password_resets(user_id,token_hash,password_snapshot) values(a.id,p_hash,a.encrypted_password)
 on conflict(user_id) do update set token_hash=excluded.token_hash,password_snapshot=excluded.password_snapshot,issued_at=now(),expires_at=now()+interval '30 minutes';
 return true;
end $$;
create function public.meeting_claim_reset(p_hash text) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 delete from public.meeting_password_resets r using auth.users u where r.user_id=u.id and r.token_hash=p_hash and r.expires_at>now() and r.password_snapshot=u.encrypted_password and public.meeting_account_role(u.id) is not null returning r.user_id into result;
 return result;
end $$;
revoke execute on function public.meeting_claim_account_invitation(text,uuid),public.meeting_issue_reset(text,text),public.meeting_claim_reset(text) from public,anon,authenticated;
grant execute on function public.meeting_claim_account_invitation(text,uuid),public.meeting_issue_reset(text,text),public.meeting_claim_reset(text) to service_role;
revoke execute on function public.meeting_account_role(uuid),public.meeting_account_history(uuid,integer,text),public.meeting_extend_poll(uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.meeting_account_role(uuid),public.meeting_account_history(uuid,integer,text),public.meeting_extend_poll(uuid,text,integer,jsonb) to service_role;
commit;
