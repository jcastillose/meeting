begin;
set local role service_role;
do $$
declare uid uuid;own text:='p_'||replace(gen_random_uuid()::text,'-','');foreign_id text:='p_'||replace(gen_random_uuid()::text,'-','');d jsonb;result jsonb;c uuid:=gen_random_uuid();notice jsonb;
begin
 select user_id into uid from public.meeting_accounts where role='admin' limit 1;
 if uid is null then raise exception 'Existing admin needed';end if;
 update public.meeting_accounts set role='manager' where user_id=uid;
 d:=jsonb_build_object('id',own,'title','Rollback schedule test','ownerId',uid,'mode','dates','start','2026-10-01','end','2026-10-01','from',540,'to',660,'step',30,'duration',60,'timezone','America/Santiago','created',now(),'closed',true,'selectedSlot','2026-10-01@540','manageHash','private');
 insert into public.polls(id,data) values(own,d::text),(foreign_id,(d||jsonb_build_object('id',foreign_id,'ownerId',gen_random_uuid(),'closed',false))::text);
 insert into public.votes(id,poll_id,edit_hash,data) values(own,own,'fixture',jsonb_build_object('id',own,'name','Fixture','email','fixture@example.invalid','slots',jsonb_build_object('2026-10-01@540','yes','2026-10-01@600','maybe'))::text);
 if public.meeting_edit_schedule(uid,foreign_id,0,'{"from":600,"to":720}',array['2026-10-01@600'],true,true) is not null then raise exception 'Foreign edit allowed';end if;
 result:=public.meeting_edit_schedule(uid,own,0,'{"from":600,"to":720}',array['2026-10-01@600','2026-10-01@630','2026-10-01@660','2026-10-01@690'],true,true);
 if (result->>'scheduleRevision')::int<>1 or (result->>'closed')::boolean or result?'selectedSlot' or result?'manageHash' then raise exception 'Edit/reopen failed';end if;
 if (select data::jsonb->'slots'->>'2026-10-01@600' from public.votes where poll_id=own)<>'maybe' then raise exception 'Unchanged preference lost';end if;
 if (select data::jsonb->'slots'?'2026-10-01@540' from public.votes where poll_id=own) then raise exception 'Removed preference remains active';end if;
 if not exists(select 1 from public.meeting_schedule_changes where poll_id=own and votes_before->0->'slots'?'2026-10-01@540') then raise exception 'Archive lost';end if;
 if public.meeting_edit_schedule(uid,own,0,'{"to":780}',array['2026-10-01@600'],true,false) is not null then raise exception 'Stale edit allowed';end if;
 notice:=public.meeting_claim_schedule_notice(own,c);
 if notice is null or notice->'emails'->>0<>'fixture@example.invalid' then raise exception 'Notice not queued';end if;
 if public.meeting_claim_schedule_notice(own,gen_random_uuid()) is not null then raise exception 'Concurrent claim allowed';end if;
 perform public.meeting_ack_schedule_notice((notice->>'id')::uuid,c,'fixture@example.invalid',false);
 perform public.meeting_ack_schedule_notice((notice->>'id')::uuid,c,null,true);
 if public.meeting_claim_schedule_notice(own,gen_random_uuid()) is not null then raise exception 'Completed notice replay';end if;
 update public.meeting_accounts set role='admin' where user_id=uid;
 if public.meeting_edit_schedule(uid,foreign_id,0,'{"to":720}',array['2026-10-01@600'],false,false) is null then raise exception 'Admin denied';end if;
end $$;
select 'PASS: ownership, admin editing, reopening, preserved preferences, archive, conflict and queued notice' as result;
rollback;
