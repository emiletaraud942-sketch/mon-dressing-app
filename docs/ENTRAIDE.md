# Entraide entre voisins

Fonction facultative : annonces de don, échange, prêt et questions entre jardiniers d'un même quartier.
Elle repose sur un **projet Supabase dédié**, distinct de la synchro privée (`src/lib/sync.ts`, inchangée).
Sans `VITE_NEIGHBORS_SUPABASE_URL` et `VITE_NEIGHBORS_SUPABASE_ANON_KEY`, la fonction est masquée et l'appli marche comme avant.

Code : `src/lib/neighbors/{types,cell,client,api}.ts`. Base : `supabase/neighbors/migrations/20261023000000_neighbors.sql`.

## Vie privée

- Aucune adresse, aucune coordonnée exacte. Le quartier est une **cellule arrondie à 0,01°** (~1 km), arrondie par l'appli puis **de nouveau par un déclencheur SQL**.
- Les annonces recopient la cellule du profil (le client ne peut pas l'envoyer : pas de droit sur ces colonnes).
- Le profil public ne contient qu'un pseudo et le quartier. L'adresse e-mail reste dans `auth.users`, illisible par l'API.
- Les photos sont redessinées dans le navigateur (EXIF et GPS supprimés), réduites sous 1 Mo, puis vérifiées (`jpegMetadataSegments`) avant envoi.
- Les annonces expirent après 60 jours. Suppression de compte : `deleteMyAccount()` (photos, puis cascade SQL).

## Schéma

| Table | Contenu | Points clés |
| --- | --- | --- |
| `profiles` | `user_id`, `pseudo` (3 à 24 car., unique sans casse), `cell_lat`, `cell_lon`, `banned_at` | Cellule arrondie par trigger. `banned_at` : aucun droit client. |
| `posts` | `kind` (don, echange, pret, question), `title` ≤ 80, `body` ≤ 1000, `species_id`, `photo_path`, `status` (open, closed, hidden), cellule, `expires_at` | Cellule, statut et expiration posés par trigger. `photo_path` doit être dans le dossier de l'auteur. |
| `replies` | réponses publiques, questions ouvertes seulement | `status` open ou hidden. |
| `threads` / `messages` | conversation privée à deux, message ≤ 1000 | `user_a < user_b` : une conversation par paire. |
| `reports` | un signalement par utilisateur et par cible | Cibles : post, reply, profile, message. Ni modification ni suppression. |
| `blocks` | blocages | Garde le pseudo bloqué pour l'afficher dans la liste. |
| `quotas` | compteurs par jour | Jamais décrémentés. Aucun accès par l'API. |

Bucket de stockage `neighbors-photos` : privé, 1 Mo, JPEG/PNG/WebP, chemin `<user_id>/<uuid>.jpg`.

## Règles d'accès (RLS partout, `(select auth.uid())`)

- **Annonces** : lisibles par les membres (connecté avec un profil non banni) si ouvertes, non expirées, et sans blocage dans un sens ou dans l'autre. L'auteur voit toujours les siennes.
- **Écriture** : seul l'auteur crée, passe `open` <-> `closed` (colonne `status` seule) et supprime. Une annonce masquée ne peut plus être modifiée par son auteur.
- **Réponses** : visibles si l'annonce l'est ; créées sur une question ouverte ; supprimées par leur auteur ou par l'auteur de la question.
- **Conversations et messages** : visibles des seuls deux participants, masqués en cas de blocage. Envoi en son nom uniquement.
- **Signalements** : on ne voit que les siens. Pas d'auto-signalement. Un message ne se signale que si l'on est dans la conversation.
- **Masquage automatique** : 3 signalements de personnes distinctes sur une annonce ou une réponse la passent en `hidden`.
- **Quotas par jour (UTC)** : 5 annonces, 30 réponses, 200 messages, 10 nouvelles conversations, 20 signalements, 50 blocages. Ils sont comptés par trigger dans `quotas` : supprimer une annonce ne rend pas le quota.
- **Droits** : `revoke all` puis `grant` colonne par colonne. Les fonctions `security definer` ont `search_path = ''`, sont inaccessibles à `anon`, et seules `neighbors_is_member`, `neighbors_is_blocked` et `delete_my_account` sont appelables par les connectés.

### Attaques considérées

| Attaque | Défense |
| --- | --- |
| Lire les messages d'un tiers | `messages_select` exige d'être participant du fil (et le fil lui-même est filtré par RLS). |
| Usurper l'auteur | `author`/`sender`/`reporter`/`blocker` doivent égaler `auth.uid()` (`with check`) ; `update` limité à `status`. |
| Publier avec une cellule falsifiée | Pas de droit `insert` sur `cell_*` (erreur de permission) et le trigger les écrase par celles du profil. |
| Contourner les quotas | Trigger `before insert` incontournable, compteur atomique (un seul upsert), jamais décrémenté, table inaccessible. |
| Démasquer une annonce masquée | `using` de `posts_update` exige `status` open ou closed. |
| Se donner des droits | `banned_at` n'a aucun droit client. |

### Limites connues

- Un quartier est **déclaré** : rien n'empêche de choisir une autre cellule. La lecture n'est pas limitée géographiquement côté serveur (le rayon est filtré par l'appli). Les cellules étant publiques par conception, c'est accepté.
- Trois faux comptes peuvent masquer une annonce. Surveillez les masquages (requêtes ci-dessous). Le lien magique et les quotas ralentissent cela.
- Si vous souhaitez limiter les inscriptions, activez un CAPTCHA dans Auth.

## Modération par l'éditeur

À exécuter dans le SQL Editor du projet dédié (rôle `postgres`, qui ignore la RLS).

```sql
-- Signalements récents, regroupés par cible
select target_kind, target_id, count(*) as nb, array_agg(distinct reason) as motifs, max(created_at) as dernier
from public.reports group by 1, 2 order by dernier desc limit 50;

-- Voir le contenu d'une annonce signalée et son auteur
select p.id, p.title, p.body, p.status, pr.pseudo, p.author
from public.posts p join public.profiles pr on pr.user_id = p.author where p.id = '<id>';

-- Masquer / rétablir une annonce ou une réponse
update public.posts   set status = 'hidden' where id = '<id>';
update public.posts   set status = 'open'   where id = '<id>';
update public.replies set status = 'hidden' where id = '<id>';

-- Lire un message signalé et sa conversation (seulement pour traiter un signalement)
select m.created_at, m.sender, m.body from public.messages m
where m.thread_id = (select thread_id from public.messages where id = '<id_message>') order by m.created_at;

-- Bannir : plus aucune écriture ni lecture, et masquage de tout ce qu'il a publié
update public.profiles set banned_at = now() where user_id = '<user_id>';
update public.posts    set status = 'hidden'  where author = '<user_id>';
update public.replies  set status = 'hidden'  where author = '<user_id>';
-- Lever le bannissement
update public.profiles set banned_at = null where user_id = '<user_id>';

-- Suppression définitive d'un compte (cascade). Supprimez d'abord ses fichiers : Storage > neighbors-photos > dossier <user_id>
delete from auth.users where id = '<user_id>';

-- Entretien : annonces expirées depuis plus de 7 jours, anciens compteurs
select public.neighbors_purge_expired();
```

Un banni peut recréer un compte avec une autre adresse : le bannissement freine, il n'empêche pas.
Les fichiers de photos d'annonces supprimées par SQL restent dans le Storage : supprimez-les depuis le tableau de bord.
Planifiez `neighbors_purge_expired()` avec l'extension `pg_cron` (une fois par jour), ou lancez-la à la main.

## Étapes pour le propriétaire

1. Créer un **nouveau projet Supabase** (ne pas réutiliser celui de la synchro). Région UE.
2. Appliquer la migration : SQL Editor, coller `supabase/neighbors/migrations/20261023000000_neighbors.sql`, exécuter (rejouable). Ou `supabase db push` depuis un dossier lié au projet dédié.
3. **Authentication > URL Configuration** : Site URL = adresse de production. Redirect URLs : `https://<production>/**` et `http://localhost:5173/**`.
4. **Authentication > Providers** : garder Email (lien magique). Désactiver « Confirm email » n'est pas nécessaire. Vérifier que Phone et OAuth sont désactivés.
5. **SMTP** : le service d'e-mail par défaut de Supabase est limité à quelques messages par heure. Configurez un SMTP (Resend, Brevo, Mailjet…) dans Project Settings > Authentication > SMTP, avec un expéditeur de votre domaine. Adaptez le modèle d'e-mail « Magic Link » en français.
6. Vérifier le bucket `neighbors-photos` (Storage) : privé, limite 1 Mo.
7. **Variables Vercel** (Production et Preview) : `VITE_NEIGHBORS_SUPABASE_URL` et `VITE_NEIGHBORS_SUPABASE_ANON_KEY` (clé « anon » / publishable, publique par conception). Ne mettez **jamais** la clé `service_role` dans le navigateur ni dans une variable `VITE_*`. Redéployer.
8. La CSP de `vercel.json` autorise déjà `https://*.supabase.co` et `wss://*.supabase.co` : rien à changer.
9. Mettre à jour `docs/CONFIDENTIALITE.md` et les CGU (pseudo, quartier, annonces, messages, durée de 60 jours, modération) avant l'ouverture.
10. Le retour du lien magique est identifié par `?entraide=1` : `main.tsx` doit appeler `initNeighbors()` **avant** `initSync()`.
