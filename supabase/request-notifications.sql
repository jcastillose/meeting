begin;
alter table public.meeting_account_requests
 add column notification_done boolean not null default false,
 add column notification_claim uuid,
 add column notification_lease_until timestamptz,
 add column notification_attempts integer not null default 0,
 add column notification_started_at timestamptz,
 add column delivered_emails text[] not null default '{}';
create index meeting_requests_notice_pending on public.meeting_account_requests(created_at,id) where status='pending' and not notification_done;
create function public.meeting_claim_request_notice(p_email text,p_claim uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.meeting_account_requests;
begin
 select * into r from public.meeting_account_requests
 where status='pending' and not notification_done and notification_attempts<6
 and (p_email is null or email=p_email)
 and (notification_lease_until is null or notification_lease_until<now())
 and (notification_started_at is null or notification_started_at>now()-interval '23 hours')
 order by created_at,id limit 1 for update skip locked;
 if not found then return null;end if;
 update public.meeting_account_requests set notification_claim=p_claim,notification_lease_until=now()+interval '5 minutes',notification_attempts=notification_attempts+1,notification_started_at=coalesce(notification_started_at,now()) where id=r.id;
 return jsonb_build_object('id',r.id,'name',r.name,'email',r.email,'message',r.message,'delivered_emails',r.delivered_emails);
end $$;
create function public.meeting_ack_request_notice(p_id uuid,p_claim uuid,p_email text,p_done boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
 update public.meeting_account_requests set delivered_emails=case when p_email is not null and not(p_email=any(delivered_emails)) then array_append(delivered_emails,p_email) else delivered_emails end,
 notification_done=p_done,notification_lease_until=case when p_done then null else notification_lease_until end
 where id=p_id and notification_claim=p_claim;
end $$;
revoke execute on function public.meeting_claim_request_notice(text,uuid),public.meeting_ack_request_notice(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.meeting_claim_request_notice(text,uuid),public.meeting_ack_request_notice(uuid,uuid,text,boolean) to service_role;
commit;
