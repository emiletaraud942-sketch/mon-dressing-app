-- Entraide entre voisins : PROJET SUPABASE DÉDIÉ (distinct de la synchro privée, voir docs/ENTRAIDE.md).
-- Idempotente : peut être rejouée sans erreur.
-- Principes : RLS sur chaque table, politiques par (select auth.uid()), droits au plus juste (colonnes comprises),
-- aucune adresse ni coordonnée exacte (cellule de ~1 km, arrondie à 0,01° par déclencheur).

-- ============================================================
-- 1. Tables
-- ============================================================

-- Profil public : un pseudo et le quartier. Rien d'autre (pas d'e-mail, pas d'adresse).
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  pseudo     text not null,                    -- contrainte profiles_pseudo_check ajoutée plus bas (rejouable)
  cell_lat   numeric(6, 2) not null check (cell_lat between -90 and 90),
  cell_lon   numeric(7, 2) not null check (cell_lon between -180 and 180),
  banned_at  timestamptz,                      -- posé par l'éditeur seulement (aucun droit client sur cette colonne)
  created_at timestamptz not null default now()
);
-- Pseudo : 3 à 24 caractères, ni invisibles ni de direction (usurpation visuelle), au moins une lettre ou un chiffre.
alter table public.profiles drop constraint if exists profiles_pseudo_check;
alter table public.profiles add constraint profiles_pseudo_check check (
  char_length(pseudo) between 3 and 24 and pseudo = btrim(pseudo)
  and pseudo !~ '[[:cntrl:]<>]'
  and pseudo !~ '[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\u3164\ufeff\uffa0]'
  and pseudo ~ '[[:alnum:]]'
) not valid;
create unique index if not exists profiles_pseudo_key on public.profiles (lower(pseudo));

-- Annonces : don, échange, prêt, question.
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles (user_id) on delete cascade,
  kind       text not null check (kind in ('don', 'echange', 'pret', 'question')),
  title      text not null check (char_length(btrim(title)) between 1 and 80),
  body       text not null default '' check (char_length(body) <= 1000),
  species_id text check (species_id is null or char_length(species_id) between 1 and 128),
  -- Photo : toujours dans le dossier de l'auteur du bucket « neighbors-photos ».
  photo_path text check (photo_path is null or (char_length(photo_path) <= 200 and photo_path !~ '\.\.' and photo_path like author::text || '/%')),
  status     text not null default 'open' check (status in ('open', 'closed', 'hidden')),
  cell_lat   numeric(6, 2) not null,          -- recopié du profil par déclencheur
  cell_lon   numeric(7, 2) not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 days'
);

-- Réponses publiques, seulement sur les questions.
create table if not exists public.replies (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author     uuid not null default auth.uid() references public.profiles (user_id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  status     text not null default 'open' check (status in ('open', 'hidden')),
  created_at timestamptz not null default now()
);

-- Conversations privées à deux. user_a < user_b : une seule conversation par paire.
create table if not exists public.threads (
  id              uuid primary key default gen_random_uuid(),
  user_a          uuid not null references public.profiles (user_id) on delete cascade,
  user_b          uuid not null references public.profiles (user_id) on delete cascade,
  post_id         uuid references public.posts (id) on delete set null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.threads (id) on delete cascade,
  sender     uuid not null default auth.uid() references public.profiles (user_id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- Signalements : un par utilisateur et par cible.
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter    uuid not null default auth.uid() references public.profiles (user_id) on delete cascade,
  target_kind text not null check (target_kind in ('post', 'reply', 'profile', 'message')),
  target_id   uuid not null,
  reason      text not null check (reason in ('spam', 'abus', 'dangereux', 'commerce', 'autre')),
  details     text check (details is null or char_length(details) <= 300),
  created_at  timestamptz not null default now(),
  unique (reporter, target_kind, target_id)
);

create table if not exists public.blocks (
  blocker    uuid not null default auth.uid() references public.profiles (user_id) on delete cascade,
  blocked    uuid not null references public.profiles (user_id) on delete cascade,
  blocked_pseudo text,                          -- recopié par déclencheur : permet d'afficher la liste des personnes bloquées
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

-- Compteurs de quotas par jour. Ils ne baissent JAMAIS : supprimer une annonce ne rend pas le quota.
-- Mise à niveau d'une base créée avant l'ajout de blocked_pseudo.
alter table public.blocks add column if not exists blocked_pseudo text;

create table if not exists public.quotas (
  user_id uuid not null references auth.users (id) on delete cascade,
  action  text not null,
  day     date not null,
  n       integer not null default 0,
  primary key (user_id, action, day)
);

-- ============================================================
-- 2. Index
-- ============================================================
create index if not exists posts_feed_idx     on public.posts (kind, cell_lat, cell_lon, created_at desc) where status = 'open';
create index if not exists posts_author_idx   on public.posts (author);
create index if not exists posts_photo_idx    on public.posts (photo_path) where photo_path is not null;
create index if not exists posts_expires_idx  on public.posts (expires_at);
create index if not exists replies_post_idx   on public.replies (post_id, created_at);
create index if not exists replies_author_idx on public.replies (author);
create index if not exists threads_a_idx      on public.threads (user_a);
create index if not exists threads_b_idx      on public.threads (user_b);
create index if not exists threads_post_idx   on public.threads (post_id);
create index if not exists messages_thread_idx on public.messages (thread_id, created_at);
create index if not exists messages_sender_idx on public.messages (sender);
create index if not exists reports_target_idx on public.reports (target_kind, target_id);
create index if not exists blocks_blocked_idx on public.blocks (blocked);

-- ============================================================
-- 3. Fonctions d'aide (security definer : search_path fixé, droits explicites)
-- ============================================================

-- Membre = a un profil et n'est pas banni.
create or replace function public.neighbors_is_member()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.banned_at is null);
$$;

-- Vrai si un blocage existe entre l'utilisateur courant et « other », dans un sens ou dans l'autre.
create or replace function public.neighbors_is_blocked(other uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker = (select auth.uid()) and b.blocked = other)
       or (b.blocker = other and b.blocked = (select auth.uid()))
  );
$$;

-- Lecture limitée à ~55 km autour de son propre quartier (rayon maximal de l'appli : 50 km).
-- Empêche un seul compte d'aspirer toutes les annonces, donc tous les pseudos et quartiers, du pays.
create or replace function public.neighbors_can_see_cell(lat numeric, lon numeric)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.banned_at is null
      and abs(p.cell_lat - lat) <= 0.5 and abs(p.cell_lon - lon) <= 1.5
  );
$$;

-- Nombre de fichiers de l'appelant dans le bucket. Fonction séparée : une politique de storage.objects qui lirait
-- storage.objects directement provoquerait « infinite recursion detected in policy » (constaté sur Postgres 16).
create or replace function public.neighbors_my_photo_count()
returns integer
language sql stable security definer
set search_path = ''
as $$
  select count(*)::integer from storage.objects o
  where o.bucket_id = 'neighbors-photos' and (storage.foldername(o.name))[1] = (select auth.uid())::text;
$$;

-- Garde commune : un client ne peut pas agir au nom d'un autre (et ne consomme jamais le quota d'un autre).
create or replace function public.neighbors_assert_self(who uuid)
returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and who is distinct from (select auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Prend une unité de quota du jour ; échoue au-delà du plafond. Atomique (un seul upsert).
create or replace function public.neighbors_take_quota(uid uuid, act text, max_per_day integer)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  got integer;
begin
  insert into public.quotas as q (user_id, action, day, n)
  values (uid, act, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, action, day) do update set n = q.n + 1 where q.n < max_per_day
  returning q.n into got;
  if got is null then
    raise exception 'quota_exceeded:%', act using errcode = 'P0001';
  end if;
end;
$$;

-- ============================================================
-- 4. Déclencheurs
-- ============================================================

-- Profil : cellule arrondie à 0,01° (~1 km), quoi que le client envoie.
create or replace function public.neighbors_profile_round()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.cell_lat := round(new.cell_lat, 2);
  new.cell_lon := round(new.cell_lon, 2);
  return new;
end;
$$;
drop trigger if exists neighbors_profile_round on public.profiles;
create trigger neighbors_profile_round before insert or update on public.profiles
  for each row execute function public.neighbors_profile_round();

-- Profil : changer de pseudo ou de quartier est limité à 5 fois par jour (anti-usurpation, anti-balayage de la carte).
create or replace function public.neighbors_profile_before_update()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if new.pseudo is distinct from old.pseudo or new.cell_lat is distinct from old.cell_lat or new.cell_lon is distinct from old.cell_lon then
    perform public.neighbors_assert_self(new.user_id);
    perform public.neighbors_take_quota(new.user_id, 'profile', 5);
  end if;
  return new;
end;
$$;
drop trigger if exists neighbors_profile_before_update on public.profiles;
create trigger neighbors_profile_before_update before update on public.profiles
  for each row execute function public.neighbors_profile_before_update();

-- Bannissement : tout ce que la personne a publié est masqué aussitôt (plus d'étape manuelle oubliée).
create or replace function public.neighbors_profile_after_ban()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if new.banned_at is not null and old.banned_at is null then
    update public.posts   set status = 'hidden' where author = new.user_id and status <> 'hidden';
    update public.replies set status = 'hidden' where author = new.user_id and status <> 'hidden';
  end if;
  return new;
end;
$$;
drop trigger if exists neighbors_profile_after_ban on public.profiles;
create trigger neighbors_profile_after_ban after update of banned_at on public.profiles
  for each row execute function public.neighbors_profile_after_ban();

-- Annonce : cellule recopiée du profil, expiration à +60 jours, statut « open », quota.
create or replace function public.neighbors_post_before_insert()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  p record;
begin
  perform public.neighbors_assert_self(new.author);
  select cell_lat, cell_lon, banned_at into p from public.profiles where user_id = new.author;
  if not found or p.banned_at is not null then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  new.cell_lat := p.cell_lat;
  new.cell_lon := p.cell_lon;
  new.status := 'open';
  new.created_at := now();
  new.expires_at := now() + interval '60 days';
  -- Plafond d'annonces ouvertes en même temps (volume de données).
  if (select count(*) from public.posts where author = new.author and status = 'open' and expires_at > now()) >= 30 then
    raise exception 'quota_exceeded:post_open' using errcode = 'P0001';
  end if;
  perform public.neighbors_take_quota(new.author, 'post', 5);
  return new;
end;
$$;
drop trigger if exists neighbors_post_before_insert on public.posts;
create trigger neighbors_post_before_insert before insert on public.posts
  for each row execute function public.neighbors_post_before_insert();

-- Réponse : uniquement sur une question ouverte ; quota.
create or replace function public.neighbors_reply_before_insert()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  k text;
  s text;
begin
  perform public.neighbors_assert_self(new.author);
  select kind, status into k, s from public.posts where id = new.post_id;
  if k is distinct from 'question' or s is distinct from 'open' then
    raise exception 'reply_not_allowed' using errcode = 'P0001';
  end if;
  new.status := 'open';
  new.created_at := now();
  perform public.neighbors_take_quota(new.author, 'reply', 30);
  return new;
end;
$$;
drop trigger if exists neighbors_reply_before_insert on public.replies;
create trigger neighbors_reply_before_insert before insert on public.replies
  for each row execute function public.neighbors_reply_before_insert();

-- Conversation : quota de nouvelles conversations.
create or replace function public.neighbors_thread_before_insert()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  new.last_message_at := now();
  perform public.neighbors_take_quota((select auth.uid()), 'thread', 10);
  return new;
end;
$$;
drop trigger if exists neighbors_thread_before_insert on public.threads;
create trigger neighbors_thread_before_insert before insert on public.threads
  for each row execute function public.neighbors_thread_before_insert();

-- Message : quota, puis mise à jour de la date de dernier message.
create or replace function public.neighbors_message_before_insert()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.neighbors_assert_self(new.sender);
  new.created_at := now();
  perform public.neighbors_take_quota(new.sender, 'message', 200);
  return new;
end;
$$;
drop trigger if exists neighbors_message_before_insert on public.messages;
create trigger neighbors_message_before_insert before insert on public.messages
  for each row execute function public.neighbors_message_before_insert();

create or replace function public.neighbors_message_after_insert()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  update public.threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;
drop trigger if exists neighbors_message_after_insert on public.messages;
create trigger neighbors_message_after_insert after insert on public.messages
  for each row execute function public.neighbors_message_after_insert();

-- Blocage : mémorise le pseudo de la personne bloquée (son profil n'est plus lisible une fois bloquée).
create or replace function public.neighbors_block_before_insert()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.neighbors_assert_self(new.blocker);
  select pseudo into new.blocked_pseudo from public.profiles where user_id = new.blocked;
  new.created_at := now();
  perform public.neighbors_take_quota(new.blocker, 'block', 50);
  return new;
end;
$$;
drop trigger if exists neighbors_block_before_insert on public.blocks;
create trigger neighbors_block_before_insert before insert on public.blocks
  for each row execute function public.neighbors_block_before_insert();

-- Signalement : cible existante, pas d'auto-signalement, message visible du signaleur, quota.
create or replace function public.neighbors_report_before_insert()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  target_owner uuid;
begin
  perform public.neighbors_assert_self(new.reporter);
  if new.target_kind = 'post' then
    select author into target_owner from public.posts where id = new.target_id;
  elsif new.target_kind = 'reply' then
    select author into target_owner from public.replies where id = new.target_id;
  elsif new.target_kind = 'profile' then
    select user_id into target_owner from public.profiles where user_id = new.target_id;
  else
    -- Message : le signaleur doit être l'un des deux participants, et pas l'expéditeur.
    select m.sender into target_owner
    from public.messages m join public.threads t on t.id = m.thread_id
    where m.id = new.target_id and new.reporter in (t.user_a, t.user_b);
  end if;
  if target_owner is null then
    raise exception 'report_target_not_found' using errcode = 'P0001';
  end if;
  if target_owner = new.reporter then
    raise exception 'report_self' using errcode = 'P0001';
  end if;
  new.created_at := now();
  perform public.neighbors_take_quota(new.reporter, 'report', 20);
  return new;
end;
$$;
drop trigger if exists neighbors_report_before_insert on public.reports;
create trigger neighbors_report_before_insert before insert on public.reports
  for each row execute function public.neighbors_report_before_insert();

-- Masquage automatique : 3 signalements de personnes distinctes.
create or replace function public.neighbors_report_after_insert()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  n integer;
begin
  -- Seuls comptent les signalements de comptes de plus de 24 h et non bannis (freine les faux comptes jetables).
  select count(distinct r.reporter) into n
  from public.reports r join public.profiles p on p.user_id = r.reporter
  where r.target_kind = new.target_kind and r.target_id = new.target_id
    and p.banned_at is null and p.created_at < now() - interval '24 hours';
  if n >= 3 then
    if new.target_kind = 'post' then
      update public.posts set status = 'hidden' where id = new.target_id and status <> 'hidden';
    elsif new.target_kind = 'reply' then
      update public.replies set status = 'hidden' where id = new.target_id and status <> 'hidden';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists neighbors_report_after_insert on public.reports;
create trigger neighbors_report_after_insert after insert on public.reports
  for each row execute function public.neighbors_report_after_insert();

-- Les fonctions de déclencheur ne sont pas appelables par l'API.
revoke all on function public.neighbors_profile_round() from public, anon, authenticated;
revoke all on function public.neighbors_profile_before_update() from public, anon, authenticated;
revoke all on function public.neighbors_profile_after_ban() from public, anon, authenticated;
revoke all on function public.neighbors_assert_self(uuid) from public, anon, authenticated;
revoke all on function public.neighbors_post_before_insert() from public, anon, authenticated;
revoke all on function public.neighbors_reply_before_insert() from public, anon, authenticated;
revoke all on function public.neighbors_thread_before_insert() from public, anon, authenticated;
revoke all on function public.neighbors_message_before_insert() from public, anon, authenticated;
revoke all on function public.neighbors_message_after_insert() from public, anon, authenticated;
revoke all on function public.neighbors_block_before_insert() from public, anon, authenticated;
revoke all on function public.neighbors_report_before_insert() from public, anon, authenticated;
revoke all on function public.neighbors_report_after_insert() from public, anon, authenticated;
revoke all on function public.neighbors_take_quota(uuid, text, integer) from public, anon, authenticated;
-- Les aides de politiques sont appelées par les politiques RLS, donc exécutables par les connectés.
revoke all on function public.neighbors_is_member() from public, anon;
revoke all on function public.neighbors_is_blocked(uuid) from public, anon;
revoke all on function public.neighbors_can_see_cell(numeric, numeric) from public, anon;
grant execute on function public.neighbors_can_see_cell(numeric, numeric) to authenticated;
revoke all on function public.neighbors_my_photo_count() from public, anon;
grant execute on function public.neighbors_my_photo_count() to authenticated;
grant execute on function public.neighbors_is_member() to authenticated;
grant execute on function public.neighbors_is_blocked(uuid) to authenticated;

-- ============================================================
-- 5. Droits (au plus juste, colonne par colonne pour l'écriture)
-- ============================================================
revoke all on public.profiles, public.posts, public.replies, public.threads, public.messages,
              public.reports, public.blocks, public.quotas from public, anon, authenticated;

grant insert (user_id, pseudo, cell_lat, cell_lon) on public.profiles to authenticated;
grant update (pseudo, cell_lat, cell_lon) on public.profiles to authenticated;
-- banned_at : aucun droit client, ni en lecture ni en écriture.
grant select (user_id, pseudo, cell_lat, cell_lon, created_at) on public.profiles to authenticated;

grant select, delete on public.posts to authenticated;
grant insert (author, kind, title, body, species_id, photo_path) on public.posts to authenticated;
grant update (status) on public.posts to authenticated;     -- fermer ou rouvrir sa propre annonce

grant select, delete on public.replies to authenticated;
grant insert (post_id, author, body) on public.replies to authenticated;

grant select on public.threads to authenticated;
grant insert (user_a, user_b, post_id) on public.threads to authenticated;

grant select on public.messages to authenticated;
grant insert (thread_id, sender, body) on public.messages to authenticated;

grant select on public.reports to authenticated;
grant insert (reporter, target_kind, target_id, reason, details) on public.reports to authenticated;

grant select, delete on public.blocks to authenticated;
grant insert (blocker, blocked) on public.blocks to authenticated;
-- quotas : aucun droit (seules les fonctions security definer y écrivent).

-- ============================================================
-- 6. RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.posts    enable row level security;
alter table public.replies  enable row level security;
alter table public.threads  enable row level security;
alter table public.messages enable row level security;
alter table public.reports  enable row level security;
alter table public.blocks   enable row level security;
alter table public.quotas   enable row level security;   -- sans politique : inaccessible à l'API

-- profiles : le sien, ou celui d'une personne dont on voit déjà une annonce, une réponse ou une conversation (hors blocage).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  user_id = (select auth.uid())
  or (
    (select public.neighbors_is_member())
    and not public.neighbors_is_blocked(user_id)
    and (
      exists (select 1 from public.posts p where p.author = profiles.user_id)
      or exists (select 1 from public.replies r where r.author = profiles.user_id)
      or exists (select 1 from public.threads t where t.user_a = profiles.user_id or t.user_b = profiles.user_id)
    )
  )
);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid()) and (select public.neighbors_is_member()))
  with check (user_id = (select auth.uid()));

-- posts
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated using (
  author = (select auth.uid())
  or (
    status = 'open' and expires_at > now()
    and public.neighbors_can_see_cell(cell_lat, cell_lon)   -- membre non banni, dans ~55 km
    and not public.neighbors_is_blocked(author)
  )
);
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated
  with check (author = (select auth.uid()) and (select public.neighbors_is_member()));
-- L'auteur ne peut ni démasquer une annonce masquée, ni la masquer lui-même : open <-> closed seulement.
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (author = (select auth.uid()) and status in ('open', 'closed'))
  with check (author = (select auth.uid()) and status in ('open', 'closed'));
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated
  using (author = (select auth.uid()));

-- replies : visibles si l'annonce l'est (la sous-requête applique la RLS de posts, blocages compris).
drop policy if exists replies_select on public.replies;
create policy replies_select on public.replies for select to authenticated using (
  exists (select 1 from public.posts p where p.id = replies.post_id)
  and (
    author = (select auth.uid())
    or (status = 'open' and not public.neighbors_is_blocked(author))
  )
);
drop policy if exists replies_insert on public.replies;
create policy replies_insert on public.replies for insert to authenticated with check (
  author = (select auth.uid())
  and (select public.neighbors_is_member())
  and exists (select 1 from public.posts p where p.id = replies.post_id and p.kind = 'question' and p.status = 'open')
);
-- Supprime sa réponse, ou n'importe quelle réponse sous sa propre question.
drop policy if exists replies_delete on public.replies;
create policy replies_delete on public.replies for delete to authenticated using (
  author = (select auth.uid())
  or exists (select 1 from public.posts p where p.id = replies.post_id and p.author = (select auth.uid()))
);

-- threads : participants seulement, hors blocage.
drop policy if exists threads_select on public.threads;
create policy threads_select on public.threads for select to authenticated using (
  (select auth.uid()) in (user_a, user_b)
  and not public.neighbors_is_blocked(case when user_a = (select auth.uid()) then user_b else user_a end)
);
drop policy if exists threads_insert on public.threads;
create policy threads_insert on public.threads for insert to authenticated with check (
  (select auth.uid()) in (user_a, user_b)
  and (select public.neighbors_is_member())
  and not public.neighbors_is_blocked(case when user_a = (select auth.uid()) then user_b else user_a end)
  and (post_id is null or exists (select 1 from public.posts p where p.id = threads.post_id))   -- annonce visible de l'appelant
);

-- messages : lisibles des seuls participants ; envoi par un participant, en son nom.
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated using (
  exists (select 1 from public.threads t where t.id = messages.thread_id and (select auth.uid()) in (t.user_a, t.user_b))
);
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (
  sender = (select auth.uid())
  and (select public.neighbors_is_member())
  and exists (select 1 from public.threads t where t.id = messages.thread_id and (select auth.uid()) in (t.user_a, t.user_b))
);

-- reports : on ne voit et n'ajoute que les siens. Pas de modification ni de suppression.
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select to authenticated using (reporter = (select auth.uid()));
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (
    reporter = (select auth.uid()) and (select public.neighbors_is_member())
    -- On ne signale que ce que l'on peut voir (sous-requêtes soumises à la RLS de l'appelant).
    and case reports.target_kind
      when 'post'  then exists (select 1 from public.posts p where p.id = reports.target_id)
      when 'reply' then exists (select 1 from public.replies r where r.id = reports.target_id)
      else true
    end
  );

-- blocks : les siens seulement.
drop policy if exists blocks_select on public.blocks;
create policy blocks_select on public.blocks for select to authenticated using (blocker = (select auth.uid()));
drop policy if exists blocks_insert on public.blocks;
create policy blocks_insert on public.blocks for insert to authenticated
  with check (blocker = (select auth.uid()));
drop policy if exists blocks_delete on public.blocks;
create policy blocks_delete on public.blocks for delete to authenticated using (blocker = (select auth.uid()));

-- ============================================================
-- 7. Stockage des photos (privé, 1 Mo, images seulement)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('neighbors-photos', 'neighbors-photos', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Lecture : ses propres photos, ou la photo d'une annonce que l'on peut voir (la RLS de posts s'applique : blocages,
-- masquage, expiration, zone). Un membre ne peut donc ni lister les dossiers des autres ni deviner un chemin.
drop policy if exists neighbors_photos_select on storage.objects;
create policy neighbors_photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'neighbors-photos'
    and (select public.neighbors_is_member())
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.posts p where p.photo_path = objects.name)
    )
  );
-- Écriture : uniquement « <user_id>/<uuid>.jpg », au plus 20 fichiers par personne (volume de stockage).
drop policy if exists neighbors_photos_insert on storage.objects;
create policy neighbors_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'neighbors-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
    and (select public.neighbors_is_member())
    and (select public.neighbors_my_photo_count()) < 20
  );
drop policy if exists neighbors_photos_delete on storage.objects;
create policy neighbors_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'neighbors-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Aucune politique update : pas d'écrasement (upsert) d'un fichier existant.

-- ============================================================
-- 8. Suppression de compte et nettoyage
-- ============================================================

-- Droit à l'effacement : supprime le compte ; tout le reste part en cascade (profil, annonces, réponses,
-- conversations, messages, signalements, blocages, quotas). Les fichiers du bucket doivent être supprimés
-- AVANT par l'API Storage (le client le fait) : effacer les lignes en SQL laisserait les fichiers.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer
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

-- Purge quotidienne (éditeur ou pg_cron ; aucun droit client) : annonces expirées, vieux compteurs, signalements de
-- plus de 12 mois. Renvoie les chemins de photos des annonces supprimées : à effacer ensuite par l'API Storage
-- (un DELETE SQL sur storage.objects laisserait les fichiers ; voir docs/ENTRAIDE.md).
drop function if exists public.neighbors_purge_expired();
create or replace function public.neighbors_purge_expired()
returns setof text
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.quotas where day < (now() at time zone 'utc')::date - 7;
  delete from public.reports where created_at < now() - interval '12 months';
  return query delete from public.posts where expires_at < now() returning photo_path;
end;
$$;
revoke all on function public.neighbors_purge_expired() from public, anon, authenticated;

-- Fichiers à effacer : photos qu'aucune annonce ne référence (annonce supprimée ou expirée, compte supprimé, envoi sans
-- publication) depuis plus d'un jour. À effacer par l'API Storage.
create or replace function public.neighbors_orphan_photos()
returns setof text
language sql stable security definer
set search_path = ''
as $$
  select o.name from storage.objects o
  where o.bucket_id = 'neighbors-photos'
    and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.posts p where p.photo_path = o.name);
$$;
revoke all on function public.neighbors_orphan_photos() from public, anon, authenticated;

comment on table public.profiles is 'Profil public d''entraide : pseudo et quartier (cellule de 0,01°). Donnée personnelle, effaçable via delete_my_account().';
comment on table public.posts is 'Annonces d''entraide. Cellule recopiée du profil par déclencheur ; expire après 60 jours.';
comment on table public.quotas is 'Quotas journaliers anti-abus. Jamais décrémentés. Aucun accès par l''API.';
