begin;
create function public.meeting_account_manage(p_user uuid,p_id text,p_action text,p_notify boolean default null,p_slot text default null,p_date text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r text; old jsonb; updated jsonb;
begin
 r:=public.meeting_account_role(p_user);if r is null then raise exception 'Forbidden';end if;
 select data::jsonb into old from public.polls where id=p_id for update;
 if old is null or (r<>'admin' and coalesce(old->>'ownerId','')<>p_user::text) then return null;end if;
 updated:=old;
 if p_action='close' then updated:=old||jsonb_build_object('closed',true,'closedAt',coalesce(old->>'closedAt',now()::text));
 elsif p_action='notifications' then updated:=jsonb_set(old,'{creator,notify}',to_jsonb(p_notify));
 elsif p_action='finalize' and p_slot is not null then updated:=old||jsonb_build_object('closed',true,'closedAt',coalesce(old->>'closedAt',now()::text),'selectedSlot',p_slot,'selectedDate',p_date);
 else raise exception 'Invalid action';end if;
 update public.polls set data=updated::text where id=p_id;
 return updated;
end $$;
revoke execute on function public.meeting_account_manage(uuid,text,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.meeting_account_manage(uuid,text,text,boolean,text,text) to service_role;
commit;
