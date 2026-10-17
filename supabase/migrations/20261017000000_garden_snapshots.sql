-- Synchronisation optionnelle de PermaJardin : un instantané JSON par utilisateur.
-- L'appli reste local-first ; ce tableau sert de sauvegarde et de partage entre appareils.
create table if not exists public.garden_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.garden_snapshots enable row level security;

create policy "lecture de son instantané" on public.garden_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "création de son instantané" on public.garden_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "mise à jour de son instantané" on public.garden_snapshots
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "suppression de son instantané" on public.garden_snapshots
  for delete to authenticated using ((select auth.uid()) = user_id);
