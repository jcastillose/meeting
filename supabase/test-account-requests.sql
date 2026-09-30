begin;
set local role service_role;
do $$
declare u uuid; rid uuid; address text:=gen_random_uuid()::text||'@example.invalid'; own text:='p_'||replace(gen_random_uuid()::text,'-',''); other text:='p_'||replace(gen_random_uuid()::text,'-',''); denied boolean:=false;
begin
 select user_id into u from public.meeting_accounts where role='admin' limit 1;
 if u is null then raise exception 'Admin fixture required';end if;
 perform public.meeting_request_account('Fixture',address,'Test');
 perform public.meeting_request_account('Duplicate',address,'Test');
 if (select count(*) from public.meeting_account_requests where email=address)<>1 then raise exception 'Duplicate request';end if;
 select id into rid from public.meeting_account_requests where email=address;
 update public.meeting_accounts set role='manager' where user_id=u;
 begin perform public.meeting_review_request(u,rid,'approve','admin',repeat('a',64)); exception when others then denied:=true;end;
 if not denied then raise exception 'Manager approved request';end if;
 insert into public.polls(id,data) values(own,jsonb_build_object('ownerId',u)::text),(other,jsonb_build_object('ownerId',gen_random_uuid())::text);
 insert into public.votes(id,poll_id,edit_hash,data) values(own,own,'fixture','{}');
 if public.meeting_account_delete_poll(u,other) then raise exception 'Foreign deletion allowed';end if;
 if not public.meeting_account_delete_poll(u,own) then raise exception 'Own deletion denied';end if;
 if exists(select 1 from public.votes where poll_id=own) then raise exception 'Orphan votes';end if;
 update public.meeting_accounts set role='admin' where user_id=u;
 if public.meeting_review_request(u,rid,'approve','manager',repeat('a',64)) is null then raise exception 'Approval failed';end if;
 if not exists(select 1 from public.meeting_admin_invitations where email=address and role='manager') then raise exception 'Invitation role incorrect';end if;
 if public.meeting_review_request(u,rid,'approve','admin',repeat('b',64)) is not null then raise exception 'Double approval';end if;
 if not public.meeting_account_delete_poll(u,other) then raise exception 'Admin deletion denied';end if;
end $$;
rollback;
select 'PASS: service_role duplicate prevention, admin approval, assigned role, manager own-only deletion, dependent votes; rolled back' as result;
