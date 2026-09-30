-- Rollback-only fixtures: no accounts, mail or persistent data are created.
begin;
create or replace function public.meeting_account_role(p_user uuid) returns text language sql stable security invoker set search_path='' as $$
 select case p_user::text when '00000000-0000-4000-8000-000000000001' then 'manager' when '00000000-0000-4000-8000-000000000002' then 'admin' end;
$$;
do $$
declare own text:='p_'||replace(gen_random_uuid()::text,'-',''); foreign_id text:='p_'||replace(gen_random_uuid()::text,'-',''); manager_id uuid:='00000000-0000-4000-8000-000000000001'; admin_id uuid:='00000000-0000-4000-8000-000000000002'; result jsonb; conflicted boolean:=false;
begin
 insert into public.polls(id,data) values(own,jsonb_build_object('id',own,'title','Role test','created',now(),'ownerId',manager_id,'from',540,'to',600,'manageHash','private-fixture')::text),(foreign_id,jsonb_build_object('id',foreign_id,'title','Role test','created',now(),'ownerId',admin_id,'from',540,'to',600)::text);
 insert into public.votes(id,poll_id,edit_hash,data) values(own,own,'test','{"name":"Fixture","slots":{"w0@540":"yes"}}');
 result:=public.meeting_account_history(manager_id,0,'');
 if (result->>'total')::integer<>1 or result->'polls'->0->'poll' ? 'manageHash' then raise exception 'History isolation failed'; end if;
 if public.meeting_extend_poll(manager_id,foreign_id,0,'{"to":660}') is not null then raise exception 'Foreign edit allowed'; end if;
 result:=public.meeting_extend_poll(manager_id,own,0,'{"to":660}');
 if (result->>'scheduleRevision')::integer<>1 or result->>'ownerId'<>manager_id::text then raise exception 'Own extension failed'; end if;
 if (select count(*) from public.votes where poll_id=own)<>1 then raise exception 'Votes lost'; end if;
 begin perform public.meeting_extend_poll(manager_id,own,0,'{"to":720}'); exception when others then conflicted:=true; end;
 if not conflicted then raise exception 'Concurrent edit not detected'; end if;
 if public.meeting_extend_poll(admin_id,foreign_id,0,'{"to":720}') is null then raise exception 'Admin edit denied'; end if;
 if public.meeting_account_manage(manager_id,foreign_id,'close') is not null then raise exception 'Foreign management allowed'; end if;
 result:=public.meeting_account_manage(manager_id,own,'finalize',null,'w0@540','2026-10-05');
 if result->>'selectedSlot'<>'w0@540' or result->>'selectedDate'<>'2026-10-05' or not (result->>'closed')::boolean then raise exception 'Final selection failed'; end if;
 if public.meeting_account_manage(admin_id,foreign_id,'close') is null then raise exception 'Admin management denied'; end if;
end $$;
rollback;
select 'PASS: scoped history, owner checks, admin access, preserved votes and revision conflict; rolled back' as result;
