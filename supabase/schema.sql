-- Ejecutar una vez en el proyecto Supabase elegido.
create table public.polls (id text primary key, data text not null);
create table public.votes (id text primary key, poll_id text not null references public.polls(id), edit_hash text not null, data text not null);
create index idx_votes_poll on public.votes(poll_id);
alter table public.polls enable row level security;
alter table public.votes enable row level security;
-- Sin políticas públicas. Solo las funciones de servidor usan service_role.
revoke all on public.polls, public.votes from anon, authenticated;
