-- Administración por invitación. Ejecutar después de schema.sql.
create table if not exists public.meeting_admin_invitations (
  token_hash text primary key,
  email text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  claim_id uuid
);
create index if not exists meeting_invites_creator on public.meeting_admin_invitations(created_by);
create table if not exists public.meeting_admin_sessions (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '8 hours'
);
create index if not exists meeting_sessions_user on public.meeting_admin_sessions(user_id);
alter table public.meeting_admin_invitations enable row level security;
alter table public.meeting_admin_sessions enable row level security;
revoke all on public.meeting_admin_invitations, public.meeting_admin_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.meeting_admin_invitations, public.meeting_admin_sessions to service_role;
create index if not exists meeting_polls_created on public.polls ((data::jsonb->>'created') desc, id desc);

create or replace function public.meeting_claim_invitation(p_hash text, p_claim uuid)
returns table(email text) language sql security invoker set search_path = '' as $$
  update public.meeting_admin_invitations
  set used_at=now(), claim_id=p_claim
  where token_hash=p_hash and used_at is null and expires_at>now()
  returning email;
$$;
revoke all on function public.meeting_claim_invitation(text,uuid) from public, anon, authenticated;
grant execute on function public.meeting_claim_invitation(text,uuid) to service_role;

create or replace function public.meeting_history(p_offset integer default 0, p_search text default '')
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'total', (select count(*) from public.polls where strpos(lower(data::jsonb->>'title'),lower(left(p_search,120)))>0),
    'polls', coalesce((select jsonb_agg(x.item order by x.created desc,x.id desc) from (
      select p.id, p.data::jsonb->>'created' as created,
        jsonb_build_object('poll',p.data::jsonb,'responseCount',(select count(*) from public.votes v where v.poll_id=p.id)) as item
      from public.polls p
      where strpos(lower(p.data::jsonb->>'title'),lower(left(p_search,120)))>0
      order by p.data::jsonb->>'created' desc,p.id desc
      limit 25 offset greatest(p_offset,0)
    ) x),'[]'::jsonb)
  );
$$;
revoke all on function public.meeting_history(integer,text) from public, anon, authenticated;
grant execute on function public.meeting_history(integer,text) to service_role;
