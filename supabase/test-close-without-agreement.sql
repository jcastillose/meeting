-- Transactional production-safe check. All fixture data and role changes roll back.
begin;
set local role service_role;
do $$
declare uid uuid; own text:='p_'||replace(gen_random_uuid()::text,'-',''); other_id text:='p_'||replace(gen_random_uuid()::text,'-',''); source jsonb; result jsonb; before_vote text;
begin
 select user_id into uid from public.meeting_accounts where role='admin' limit 1;
 if uid is null then raise exception 'Existing admin needed';end if;
 update public.meeting_accounts set role='manager' where user_id=uid;
 source:=jsonb_build_object('id',own,'title','Rollback no-agreement test','ownerId',uid,'mode','dates','start','2026-10-27','end','2026-10-27','from',540,'to',660,'step',60,'duration',60,'timezone','America/Santiago','created',now(),'closed',false,'manageHash','fixture-hash','scheduleRevision',0);
 insert into public.polls(id,data) values(own,source::text),(other_id,(source||jsonb_build_object('id',other_id,'ownerId',gen_random_uuid()))::text);
 insert into public.votes(id,poll_id,edit_hash,data) values(own,own,'fixture',jsonb_build_object('id',own,'name','Fixture','slots',jsonb_build_object('2026-10-27@540','yes'))::text);
 select data into before_vote from public.votes where id=own;
 if public.meeting_account_manage(uid,other_id,'close_no_agreement') is not null then raise exception 'Foreign manager closed poll';end if;
 result:=public.meeting_account_manage(uid,own,'close_no_agreement');
 if result is null or not (result->>'closed')::boolean or result->>'closureOutcome'<>'no_agreement' or result?'selectedSlot' then raise exception 'No-agreement closure failed';end if;
 if public.meeting_save_vote('late-'||own,own,'fixture',jsonb_build_object('id','late-'||own,'slots','{}'::jsonb)::text) then raise exception 'Late vote saved';end if;
 if (select data from public.votes where id=own)<>before_vote then raise exception 'Responses changed';end if;
 if public.meeting_account_manage(uid,own,'finalize',null,'2026-10-27@540','2026-10-27') is not null then raise exception 'Closed poll finalized without reopening';end if;
 result:=public.meeting_account_manage(uid,own,'reopen');
 if (result->>'closed')::boolean or result?'closureOutcome' then raise exception 'Outcome survived reopening';end if;
 result:=public.meeting_manage_poll(own,'fixture-hash','close_no_agreement')::jsonb;
 if result->>'closureOutcome'<>'no_agreement' then raise exception 'Private closure failed';end if;
 if public.meeting_manage_poll(own,'wrong-hash','close_no_agreement') is not null then raise exception 'Invalid private token accepted';end if;
 result:=public.meeting_edit_schedule(uid,own,1,jsonb_build_object('from',600,'to',720),array['2026-10-27@600'],false,true);
 if result is null or result?'closureOutcome' or (result->>'closed')::boolean then raise exception 'Schedule edit retained no-agreement outcome';end if;
 if has_function_privilege('anon','public.meeting_account_manage(uuid,text,text,boolean,text,text)','execute') or has_function_privilege('anon','public.meeting_manage_poll(text,text,text,boolean)','execute') then raise exception 'Public execution allowed';end if;
end $$;
select 'PASS: owner restriction, no-agreement closure, blocked late votes, preserved answers, reopen, private token, edited schedule and service-only access' as result;
rollback;
