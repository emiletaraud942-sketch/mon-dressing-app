-- Durcissement de public.garden_snapshots (complète 20261017000000_garden_snapshots.sql, qu'on ne modifie pas).
-- Idempotente : peut être rejouée sans erreur.
--
-- À configurer aussi côté Supabase (Authentication → URL Configuration), sinon le lien magique est refusé :
--   Site URL      : l'adresse de production, ex. https://permajardin.vercel.app
--   Redirect URLs : https://permajardin.vercel.app/**
--                   http://localhost:5173/**      (développement local)
-- L'appli demande la redirection vers la racine du site (`location.origin + '/'`), puis revient seule sur #reglages.
-- Le lien doit être ouvert dans le même navigateur que celui où il a été demandé (connexion PKCE).

-- 1. Droits : seul un utilisateur connecté touche à sa ligne ; le rôle anonyme n'a aucun accès.
revoke all on public.garden_snapshots from anon;
grant select, insert, update, delete on public.garden_snapshots to authenticated;

-- 2. RLS (déjà activée par la migration initiale ; répété par sécurité).
alter table public.garden_snapshots enable row level security;

drop policy if exists "lecture de son instantané" on public.garden_snapshots;
drop policy if exists "création de son instantané" on public.garden_snapshots;
drop policy if exists "mise à jour de son instantané" on public.garden_snapshots;
drop policy if exists "suppression de son instantané" on public.garden_snapshots;

create policy "lecture de son instantané" on public.garden_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "création de son instantané" on public.garden_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "mise à jour de son instantané" on public.garden_snapshots
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "suppression de son instantané" on public.garden_snapshots
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 3. updated_at fixé par le serveur (le client ne peut ni le truquer ni l'oublier) :
--    l'appli s'en sert pour détecter qu'un autre appareil a écrit entre-temps.
create or replace function public.garden_snapshots_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists garden_snapshots_touch on public.garden_snapshots;
create trigger garden_snapshots_touch
  before insert or update on public.garden_snapshots
  for each row execute function public.garden_snapshots_touch();

-- 4. Taille maximale d'un instantané (5 Mo) : évite qu'un client abuse du quota gratuit.
alter table public.garden_snapshots drop constraint if exists garden_snapshots_data_size;
alter table public.garden_snapshots
  add constraint garden_snapshots_data_size check (pg_column_size(data) < 5000000);
