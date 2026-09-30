-- Run after recovery-auth-boundary.sql. All changes are rolled back.
begin;
set local role service_role;
do $$
declare a public.meeting_accounts; h text:=repeat('9',64); prior_count integer;
begin
 select * into a from public.meeting_accounts where role='admin' limit 1;
 if not found then raise exception 'An existing application admin is required'; end if;
 perform public.meeting_account_history(a.user_id,0,'');
 -- Test issuance without allowing a previous real request to mask the result.
 update public.meeting_password_resets set issued_at=now()-interval '2 minutes' where user_id=a.user_id;
 if not public.meeting_issue_reset(a.email,h) then raise exception 'Issue denied for service_role'; end if;
 if public.meeting_issue_reset(a.email,h) then raise exception 'Throttle failed'; end if;
 if public.meeting_claim_reset(h) is distinct from a.user_id then raise exception 'Claim failed'; end if;
 if public.meeting_claim_reset(h) is not null then raise exception 'Replay allowed'; end if;
 if not public.meeting_issue_reset(a.email,h) then raise exception 'Reissue failed'; end if;
 update public.meeting_accounts set auth_version='changed' where user_id=a.user_id;
 if public.meeting_claim_reset(h) is not null then raise exception 'Stale reset allowed'; end if;
end $$;
rollback;
select 'PASS: service_role history, recovery, throttle, replay and stale account version; rolled back' as result;
