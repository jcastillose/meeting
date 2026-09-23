-- Server-only operations; serialize closure and response writes on the poll row.
create or replace function public.meeting_save_vote(p_id text,p_poll_id text,p_edit_hash text,p_data text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare document jsonb;
begin
 select data::jsonb into document from public.polls where id=p_poll_id for update;
 if document is null or coalesce((document->>'closed')::boolean,false) then return false; end if;
 if not exists(select 1 from public.votes where id=p_id) and (select count(*) from public.votes where poll_id=p_poll_id)>=200 then return false; end if;
 insert into public.votes(id,poll_id,edit_hash,data) values(p_id,p_poll_id,p_edit_hash,p_data)
 on conflict(id) do update set data=excluded.data where votes.edit_hash=excluded.edit_hash and votes.poll_id=excluded.poll_id;
 return found;
end $$;
create or replace function public.meeting_manage_poll(p_id text,p_hash text,p_action text,p_notify boolean default null)
returns text language plpgsql security invoker set search_path='' as $$
declare document jsonb;
begin
 select data::jsonb into document from public.polls where id=p_id for update;
 if document is null or document->>'manageHash' is distinct from p_hash then return null; end if;
 if p_action='close' then document=document||jsonb_build_object('closed',true,'closedAt',coalesce(document->>'closedAt',to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"')));
 elsif p_action='notifications' and p_notify is not null then document=jsonb_set(document,'{creator,notify}',to_jsonb(p_notify));
 else return null; end if;
 update public.polls set data=document::text where id=p_id;
 return document::text;
end $$;
create or replace function public.meeting_creator_access(p_id text,p_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare document jsonb;
begin
 select data::jsonb into document from public.polls where id=p_id for update;
 if document is null or document#>>'{creator,email}' is null then return false; end if;
 if document->>'accessRequestedAt' is not null and (document->>'accessRequestedAt')::timestamptz>now()-interval '5 minutes' then return false; end if;
 update public.polls set data=(document||jsonb_build_object('manageHash',p_hash,'accessRequestedAt',now()))::text where id=p_id;
 return true;
end $$;
revoke all on function public.meeting_save_vote(text,text,text,text),public.meeting_manage_poll(text,text,text,boolean),public.meeting_creator_access(text,text) from public,anon,authenticated;
grant execute on function public.meeting_save_vote(text,text,text,text),public.meeting_manage_poll(text,text,text,boolean),public.meeting_creator_access(text,text) to service_role;
