-- Durcissement n° 2 de public.garden_snapshots (complète 20261017000000 et 20261018000000, qu'on ne modifie pas).
-- Idempotente : peut être rejouée sans erreur. Preuves : docs/securite-rls-test.sql (exécuté sur un Postgres local jetable).

-- 1. Droits au plus juste.
--    Supabase accorde par défaut TOUS les droits (dont TRUNCATE, qui ignore la RLS) aux rôles de l'API sur les nouvelles tables.
--    Un utilisateur connecté n'a besoin que de lire, créer, modifier et supprimer SA ligne.
revoke all on public.garden_snapshots from public;
revoke all on public.garden_snapshots from anon;
revoke truncate, references, trigger on public.garden_snapshots from authenticated;
grant select, insert, update, delete on public.garden_snapshots to authenticated;

-- 2. Le contenu doit être un objet JSON (pas un tableau, un nombre, null JSON…).
--    « not valid » : contrôle les écritures futures sans faire échouer la migration si une ancienne ligne était étrange.
alter table public.garden_snapshots drop constraint if exists garden_snapshots_data_is_object;
alter table public.garden_snapshots
  add constraint garden_snapshots_data_is_object check (jsonb_typeof(data) = 'object') not valid;

-- 3. La fonction du déclencheur n'a pas à être appelable par l'API.
revoke all on function public.garden_snapshots_touch() from public, anon, authenticated;

-- 4. Droit à l'effacement (RGPD art. 17) : un utilisateur connecté supprime SON compte (adresse e-mail) et, par
--    « on delete cascade », son instantané. SECURITY DEFINER est ici nécessaire (le rôle « authenticated » n'a aucun
--    droit sur auth.users) et sûr : la fonction ne prend aucun argument et n'efface que la ligne de auth.uid().
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'authentification requise' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 5. Documentation de la donnée personnelle stockée.
comment on table public.garden_snapshots is
  'Sauvegarde facultative des jardins d''un utilisateur (adresse, position, plantes ; sans photos). Donnée personnelle : une ligne par utilisateur, effaçable via public.delete_my_account() ou par suppression de la ligne.';
