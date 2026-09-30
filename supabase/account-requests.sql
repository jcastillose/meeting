begin;
create table public.meeting_account_requests(
 id uuid primary key default gen_random_uuid(), email text unique not null,
 name text not null check(length(name) between 2 and 120), message text not null default '' check(length(message)<=1000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 assigned_role text check(assigned_role in ('admin','manager')),created_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid
);
create index meeting_requests_pending on public.meeting_account_requests(created_at,id) where status='pending';
alter table public.meeting_account_requests enable row level security;
revoke all on public.meeting_account_requests from public,anon,authenticated;
grant select,insert,update,delete on public.meeting_account_requests to service_role;
create function public.meeting_request_account(p_name text,p_email text,p_message text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 -- Serialize submissions to enforce a bounded pending queue and avoid duplicates.
 perform pg_advisory_xact_lock(hashtext('public.account_requests'));
 if length(p_email)>254 or length(trim(p_name))<2 or length(p_name)>120 or length(p_message)>1000 then raise exception 'Invalid input';end if;
 if exists(select 1 from public.meeting_accounts where email=lower(trim(p_email))) then return;end if;
 if (select count(*) from public.meeting_account_requests where status='pending')>=1000 then raise exception 'Request queue full';end if;
 insert into public.meeting_account_requests(name,email,message) values(trim(p_name),lower(trim(p_email)),p_message) on conflict(email) do nothing;
end $$;
create function public.meeting_review_request(p_user uuid,p_id uuid,p_decision text,p_role text,p_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.meeting_account_requests;
begin
 if public.meeting_account_role(p_user) is distinct from 'admin' then raise exception 'Forbidden';end if;
 select * into r from public.meeting_account_requests where id=p_id and status='pending' for update;
 if not found then return null;end if;
 if p_decision='approve' then
  if p_role not in ('manager','admin') or p_role is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid approval';end if;
  if exists(select 1 from public.meeting_accounts where email=r.email) then return null;end if;
  insert into public.meeting_admin_invitations(token_hash,email,role,created_by) values(p_hash,r.email,p_role,p_user);
 elsif p_decision<>'reject' or p_decision is null then raise exception 'Invalid decision';end if;
 update public.meeting_account_requests set status=case when p_decision='approve' then 'approved' else 'rejected' end,assigned_role=case when p_decision='approve' then p_role else null end,reviewed_by=p_user,reviewed_at=now() where id=r.id;
 return jsonb_build_object('email',r.email);
end $$;
create function public.meeting_account_delete_poll(p_user uuid,p_id text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare r text; d jsonb;
begin
 r:=public.meeting_account_role(p_user);
 if r is null then return false;end if;
 select data::jsonb into d from public.polls where id=p_id for update;
 if d is null or (r<>'admin' and coalesce(d->>'ownerId','')<>p_user::text) then return false;end if;
 delete from public.votes where poll_id=p_id;
 delete from public.polls where id=p_id;
 return true;
end $$;
revoke execute on function public.meeting_request_account(text,text,text),public.meeting_review_request(uuid,uuid,text,text,text),public.meeting_account_delete_poll(uuid,text) from public,anon,authenticated;
grant execute on function public.meeting_request_account(text,text,text),public.meeting_review_request(uuid,uuid,text,text,text),public.meeting_account_delete_poll(uuid,text) to service_role;
commit;
