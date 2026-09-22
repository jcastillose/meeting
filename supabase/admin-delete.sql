-- El borrado es atómico y solo está disponible para las funciones del servidor.
create or replace function public.meeting_delete_poll(p_id text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_id !~ '^p_[a-f0-9]{32}$' then
    raise exception 'Identificador inválido';
  end if;
  perform 1 from public.polls where id=p_id for update;
  if not found then return false; end if;
  delete from public.votes where poll_id=p_id;
  delete from public.polls where id=p_id;
  return true;
end;
$$;
revoke all on function public.meeting_delete_poll(text) from public, anon, authenticated;
grant execute on function public.meeting_delete_poll(text) to service_role;
