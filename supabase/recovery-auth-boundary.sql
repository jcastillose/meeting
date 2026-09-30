begin;
-- Application-only directory. Auth identities and current roles are verified
-- through the Auth Admin API by the server before synchronizing this record.
create table public.meeting_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text unique not null, role text check(role in ('admin','manager')),
 auth_version text not null
);
alter table public.meeting_accounts enable row level security;
revoke all on public.meeting_accounts from public,anon,authenticated;
grant select,insert,update,delete on public.meeting_accounts to service_role;
insert into public.meeting_accounts(user_id,email,role,auth_version)
select id,lower(email),case when raw_app_meta_data->>'meeting_admin'='true' then 'admin' when raw_app_meta_data->>'meeting_role'='manager' then 'manager' end,coalesce(updated_at::text,'')
from auth.users where raw_app_meta_data->>'meeting_admin'='true' or raw_app_meta_data->>'meeting_role'='manager';
create function public.meeting_sync_account(p_user uuid,p_email text,p_role text,p_version text) returns void
language sql security invoker set search_path='' as $$
 insert into public.meeting_accounts(user_id,email,role,auth_version) values(p_user,lower(p_email),p_role,p_version)
 on conflict(user_id) do update set email=excluded.email,role=excluded.role,auth_version=excluded.auth_version;
$$;
revoke execute on function public.meeting_sync_account(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.meeting_sync_account(uuid,text,text,text) to service_role;
create or replace function public.meeting_account_role(p_user uuid) returns text language sql stable security invoker set search_path='' as $$
 select role from public.meeting_accounts where user_id=p_user;
$$;
create or replace function public.meeting_issue_reset(p_email text,p_hash text) returns boolean language plpgsql security invoker set search_path='' as $$
declare a public.meeting_accounts;
begin
 select * into a from public.meeting_accounts where email=lower(trim(p_email)) for update;
 if not found or a.role is null then return false; end if;
 if exists(select 1 from public.meeting_password_resets where user_id=a.user_id and issued_at>now()-interval '60 seconds') then return false; end if;
 insert into public.meeting_password_resets(user_id,token_hash,password_snapshot) values(a.user_id,p_hash,a.auth_version)
 on conflict(user_id) do update set token_hash=excluded.token_hash,password_snapshot=excluded.password_snapshot,issued_at=now(),expires_at=now()+interval '30 minutes';
 return true;
end $$;
create or replace function public.meeting_claim_reset(p_hash text) returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 delete from public.meeting_password_resets r using public.meeting_accounts a where r.user_id=a.user_id and r.token_hash=p_hash and r.expires_at>now() and r.password_snapshot=a.auth_version and a.role is not null returning r.user_id into result;
 return result;
end $$;
commit;
