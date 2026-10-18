# Sécurité et protection des données

Référence tenue par l'agent `securite-donnees`. Tout durcissement a un test (vitest, ou script SQL) et une ligne dans le tableau « Menace → mesure → fichier ». Dernier audit : 18 octobre 2026.

Données sensibles de l'appli : adresse et position du domicile (jardin), photos, jeton de connexion Supabase, clé Pl@ntNet.
Principes : moindre privilège, aucune donnée personnelle superflue, aucun secret hors variables d'environnement serveur, local d'abord (rien ne quitte l'appareil sans action de l'utilisateur).

## 1. Menace → mesure → fichier

| Menace | Mesure | Fichier(s) · test |
| --- | --- | --- |
| Appel de `/api/identify` depuis un autre site (CSRF, consommation du quota Pl@ntNet) | Refus si `Sec-Fetch-Site: cross-site`, ou `Origin`/`Referer` ≠ hôte ; `Content-Type: application/json` obligatoire (415) ; aucun en-tête CORS ; méthode POST seulement (`Allow: POST`) | `api/identify.ts` · `api/_tests/identify.test.ts` |
| Contournement de la limite de débit par `X-Forwarded-For` falsifié | IP lue dans `x-vercel-forwarded-for`, puis `x-real-ip` (posés par Vercel), sinon DERNIÈRE valeur de `x-forwarded-for` (jamais la première) | `clientIp` · tests « clientIp » et « IP falsifiée » |
| Saturation mémoire/CPU du limiteur (preuve avant correctif : 30 000 clés = 12 s de CPU, boucle O(n²)) | Mémoire bornée à 10 000 clés, éviction d'une seule entrée par requête (coût constant) ; test 50 000 clés < 1,5 s | `createRateLimiter` · test « mémoire bornée » |
| Épuisement du quota Pl@ntNet (500/jour) par de nombreuses adresses | Plafond global de 150 requêtes / 10 min par instance, en plus des 20 / 10 min par IP (garde-fou par instance : voir §6 pour la vraie limite partagée) | `api/identify.ts` |
| Image piégée : fichier qui n'est pas une image, base64 invalide, « bombe de décompression » (30 000 × 30 000 px) | Base64 strict, type d'après les octets magiques, dimensions lues dans l'en-tête (≤ 8 000 px par côté et 40 Mpx), en-tête tronqué refusé, 5 images et 4,2 Mo au plus | `detectImageMime`, `imageSize`, `decodeBase64Image` · tests « bombe », « base64 strict » |
| Fuite de la clé Pl@ntNet (elle est dans l'URL sortante) | Erreurs nettoyées (`scrubError`), `redirect: 'error'` (jamais de redirection avec la clé), aucune IP ni image dans les journaux, 500 générique, réponses amont plafonnées à 1 Mo | `api/identify.ts` · tests « ne divulgue ni la clé ni l'URL », « erreur inattendue », « journaux » |
| Corps JSON invalide (`req.body` lève une exception à la lecture) | Lecture protégée → 400 JSON ; filet global → 500 générique | `api/identify.ts` · test « JSON invalide » |
| Mise en cache ou interprétation de la réponse de l'API | `Cache-Control: no-store`, `nosniff`, CSP `default-src 'none'`, `Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: no-referrer` | `api/identify.ts` · test « en-têtes de sécurité » |
| Les proxys `/ext/*` atteignent d'autres chemins de l'hôte distant (`/ext/geopf/:path*`) | 8 rewrites à chemin EXACT, un par appel réel de l'appli ; tout autre `/ext/*` répond 404. Les hôtes de destination sont fixes (aucun paramètre ne peut les changer) | `vercel.json` · `src/lib/security/vercel-config.test.ts` (couverture des appels du code source, chemins d'évasion `..`, `//`, `@`, `%2e%2e`) |
| XSS, clickjacking, fuite de position, détournement de capteurs | CSP stricte (`script-src 'self'`, `connect-src` = soi + Supabase, `frame-src 'none'`, `upgrade-insecure-requests`…), HSTS 2 ans, COOP/CORP `same-origin`, `X-Frame-Options: DENY`, `X-DNS-Prefetch-Control: off`, Permissions-Policy minimale (seules `camera` et `geolocation` pour notre origine) | `vercel.json` · `vercel-config.test.ts` + vérification navigateur (§5) |
| Import JSON hostile : pollution de prototype (`__proto__`, `constructor`), fichier géant, textes géants, volumes, nombres non finis | Fichier > 10 Mo refusé avant lecture ; clés dangereuses retirées partout (champs connus validés un à un, champs inconnus copiés nettoyés) ; 50 jardins, 20 000 plantes, 50 000 tâches ; noms/adresses 500 caractères, notes 5 000 ; contours ≤ 5 000 points, 1 000 bâtiments, relief ≤ 129 × 129 ; coordonnées ≤ 1 000 km ; identifiants ≤ 128 caractères et jamais `__proto__` | `src/lib/migrate.ts`, `src/lib/security/{limits,sanitize,import}.ts` · `security.test.ts` |
| Identifiant de photo forgé dans un import (`getPhoto('permajardin:state:v1')` lisait l'état, `deletePhoto` pouvait l'effacer) | Seul `photo:` + alphanumérique est accepté, à l'import (filtré, 20 par plante) ET dans `getPhoto`/`deletePhoto`/`listPhotoIds` | `src/lib/photos.ts`, `sanitize.ts` · tests « photos : identifiants forgés » |
| Photo piégée côté navigateur (saturation mémoire au décodage) | Fichier ≤ 40 Mo, en-tête lu avant décodage (≤ 16 000 px et 120 Mpx), bitmap contrôlé | `src/lib/photos.ts` · tests « bombe de décompression » |
| Fuite de position GPS dans les photos | Toute photo est redessinée sur un canvas puis ré-encodée en JPEG avant stockage et avant envoi à Pl@ntNet : EXIF, GPS, XMP, miniature disparaissent. **Prouvé** dans Chromium (§5) | `src/lib/photos.ts`, `security/image.ts` (`jpegMetadataSegments`) |
| Droit à l'effacement (RGPD art. 17) | `eraseAllData()` : IndexedDB (état, copie avant migration, photos), `localStorage` (`permajardin:*`, `pj-*`, `sb-*`), caches de tuiles `ign-*`, instantané ou compte Supabase, déconnexion locale ; rapport par étape ; les autres onglets sont vidés (message `erased`) | `src/lib/security/erase.ts`, `store.ts` (`wipeLocalData`), `sync.ts` · `security.test.ts`, `store.test.ts`, `sync.test.ts` |
| Un autre onglet réécrit l'ancien état après l'effacement | Message `erased` sur le `BroadcastChannel` : l'onglet vide sa mémoire et annule ses écritures en attente | `store.ts` · test « un autre onglet vide aussi sa mémoire » |
| Fuite entre utilisateurs, accès anonyme, `TRUNCATE` (ignore la RLS) | RLS + politiques `to authenticated` par `(select auth.uid())` ; `revoke` des droits `anon`/`public` et de `truncate, references, trigger` ; contrainte « data est un objet JSON » ; fonction de déclencheur non appelable. **Prouvé** sur Postgres (§3) | `supabase/migrations/20261019000000_security_hardening.sql`, `docs/securite-rls-test.sql` |
| Compte et adresse e-mail impossibles à supprimer | `delete_my_account()` (SECURITY DEFINER sans argument, n'efface que `auth.uid()`, réservée aux connectés) ; `deleteMyAccount()` côté client | migration ci-dessus, `sync.ts` |
| Saisie d'adresse e-mail abusive envoyée à Supabase | Adresse validée et rognée avant l'appel ; `emailRedirectTo` construit sur notre propre origine (la liste blanche de redirections est côté Supabase, §6) | `sync.ts` · test « sendMagicLink refuse une adresse invalide » |
| Dépendances vulnérables, workflow CI compromis | Dependabot hebdomadaire (npm + actions), CI en lecture seule sans secret ni `pull_request_target`, `npm ci --ignore-scripts`, audit de production | `.github/dependabot.yml`, `.github/workflows/ci.yml` |

## 2. Constats de l'audit (honnêtes)

- **Secrets** : `git log -p --all` et l'arbre de travail ne contiennent aucune clé (`sk-`, `eyJ…`, `api-key=…`, PEM, `service_role`, URL Supabase réelle). `.env*` est ignoré (sauf `.env.example`, vide). `.claude/` ne contient aucun secret. La clé `anon` est publique par conception ; `service_role` n'apparaît nulle part.
- **Code de l'interface** (lu et recherché) : ni `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write`, `window.open`, `javascript:`, ni lien externe, ni `postMessage` hors `BroadcastChannel` du même site. Les étiquettes 3D (`drei Html`) affichent du texte React (échappé). MapLibre : `attributionControl: false`, aucun `Popup`/`setHTML`.
- **Dépendances** : `npm ci` cohérent avec le lockfile ; un seul script d'installation (`esbuild`). `npm audit --omit=dev` : **1 critique** — `maplibre-gl` ≤ 6.4.0, XSS dans `DOM.sanitize()` de l'attribution (GHSA-jrc7-96c5-q579). **Non exploitable ici** (le contrôle d'attribution est désactivé, aucun texte venant de l'utilisateur n'y est injecté, la fonction fautive n'existe pas dans la 4.7.1 installée), mais le correctif exige une montée de version majeure (6.x) à planifier avec l'agent cartographie. `npm audit` complet : 23 alertes, toutes hors production (outils de build et de test : `vite` 5, `vitest`/`tinypool`, `@vercel/node`/`tar`, `vite-plugin-pwa`) ; elles concernent le serveur de développement et l'installation, pas le site déployé.
- **Les 4 proxys** : l'hôte de destination est fixe ; aucun paramètre de chemin ne peut le changer. Le point faible était l'accès à *tous* les chemins de l'hôte distant (corrigé). Les paramètres de requête sont transmis tels quels : un tiers peut utiliser le proxy comme relais de bande passante vers l'IGN/Open-Meteo (ex. `WIDTH=2048` en WMS). Non corrigeable dans `vercel.json` sans risque de casser des navigateurs : voir §6 (règle de limitation du pare-feu Vercel).
- **Cookies et en-têtes de l'utilisateur** : l'appli ne pose aucun cookie (`document.cookie` vide, aucun cookie dans le contexte de test, aucune requête `/ext/*` avec cookie). Si Vercel transmet les en-têtes du navigateur aux hôtes distants lors d'un rewrite externe, il n'y a donc rien de sensible à transmettre. Le comportement exact de Vercel n'a pas pu être vérifié sans déploiement.
- **Coordonnées envoyées à Open-Meteo : 4 décimales (≈ 11 m)** (`src/lib/weather.ts`, constaté dans les requêtes). 2 décimales (≈ 1 km) suffisent pour la météo et le climat. Recommandation pour l'agent cartographie ; la clé de cache `pj-meteo:` utilise déjà 3 décimales.
- **Import JSON de l'interface** : `SettingsPage.tsx` lit encore le fichier avec `JSON.parse(await file.text())` sans limite de taille. `migrateState` est durci quoi qu'il arrive (les volumes et clés dangereuses sont traités), mais un fichier de plusieurs centaines de Mo serait lu en mémoire : brancher `readBackupFile` (voir §7).
- **Stockage persistant** : `navigator.storage.persist()` est appelé au chargement (comportement conservé). Chrome décide sans demander ; Firefox affiche une fenêtre de permission dès la première visite, sans contexte. À reconsidérer côté interface (le demander après la création du premier jardin).
- **Message 503 de l'API** : il indique publiquement que la clé Pl@ntNet manque (et comment la configurer). Info faible, utile au propriétaire ; à rendre générique si l'appli devient publique.

## 3. Supabase

- RLS activée, politiques `select/insert/update/delete` `to authenticated` avec `(select auth.uid()) = user_id`, aucun droit à `anon`, déclencheur `updated_at` serveur, contrainte de taille (5 Mo) et de forme (objet JSON).
- **Test des règles** : `docs/securite-rls-test.sql` (base LOCALE jetable uniquement). Cas : A ne lit, n'insère pour B, ne modifie, ne supprime, ne réaffecte rien de B ; `anon` n'accède à rien ; `TRUNCATE` refusé ; `updated_at` non falsifiable ; `delete_my_account()` n'efface que le compte appelant. Exécuté ici sur PGlite (Postgres 16 en WebAssembly) avec un environnement imitant Supabase (rôles `anon`/`authenticated`, `auth.uid()`, privilèges par défaut `ALL`). Sans la migration n° 3 le test échoue (« tableau JSON accepté », « A a pu TRUNCATE ») ; avec elle il passe, y compris rejoué deux fois. Il n'a PAS été exécuté sur un vrai projet Supabase (consigne : rien n'est exécuté sur un projet réel).
- **Jetons** : `supabase-js` garde la session dans `localStorage` (`sb-<ref>-auth-token`). Un script injecté pourrait la lire ; la CSP (`script-src 'self'`, pas d'`unsafe-inline` pour les scripts) est la parade. Flux PKCE, jeton jamais dans l'URL après nettoyage (`history.replaceState`).
- **Redirection** : `emailRedirectTo = location.origin + '/'` : pas de redirection ouverte côté appli, car la valeur est notre propre origine ; c'est la liste « Redirect URLs » de Supabase qui fait foi (§6 : pas de joker `*.vercel.app`).
- **Énumération d'e-mails** : `signInWithOtp` répond de la même façon que le compte existe ou non tant que la création de compte (`shouldCreateUser`, par défaut vrai) est autorisée. Ne pas désactiver les inscriptions sans revoir ce point.
- Limites d'envoi de liens magiques et CAPTCHA : réglages du tableau de bord, voir §6.

## 4. Permissions du navigateur

| Permission | Où demandée | Pourquoi | Si refusée |
| --- | --- | --- | --- |
| Notifications | Tâches > « Activer les rappels », sur clic uniquement (jamais au chargement) | Un rappel local par jour au plus | Aucun rappel, le reste fonctionne |
| Photos | `<input type=file accept=image/*>` (fiche plante, identification) : sélecteur du système, **pas** de `getUserMedia` | Choisir une photo | Pas de photo |
| Stockage persistant | Au chargement (`navigator.storage.persist`) | Éviter l'effacement par le navigateur | Données conservées mais effaçables : message de sauvegarde |
| Géolocalisation | **Jamais demandée** (aucun appel à `navigator.geolocation`) ; `geolocation=(self)` seulement dans la Permissions-Policy | — | Sans objet |
| Caméra, micro | **Jamais demandés** ; `camera=(self)` laisse le sélecteur de fichiers proposer l'appareil photo | — | Sans objet |

Service worker : portée `/`, `navigateFallbackDenylist` pour `/api/` et `/ext/`. Mis en cache : le code (précache), le chunk 3D, les tuiles IGN (`ign-tuiles`, `ign-ortho-3d`). Jamais en cache : `/api/*`, `/ext/meteo*`, le géocodage, aucun jeton. Les caches de tuiles révèlent les lieux consultés : ils sont vidés par `eraseAllData()`.

`localStorage` (aucune donnée sensible hors position arrondie) : `permajardin:theme`, `permajardin:last-export`, `permajardin:last-export-reminder`, `permajardin:first-use`, `permajardin:last-notification`, `permajardin:offline-ready-shown`, `permajardin:last-synced:<id utilisateur>`, `pj-meteo:<lat>,<lon>` et `pj-climat:<lat>,<lon>` (3 décimales), `sb-<ref>-auth-token` (Supabase). Un test (`security.test.ts`) vérifie que toute clé écrite par le code est couverte par l'effacement.

## 5. Vérification en navigateur (rejouable)

1. `npx vite build --outDir <dossier-temporaire>` (sans `typecheck`, dossier hors dépôt).
2. Petit serveur Node qui sert ce dossier avec les en-têtes et rewrites de `vercel.json` et des réponses factices pour `/ext/*` (`vite preview` n'applique pas `vercel.json`).
3. Playwright/Chromium : jardin de test écrit dans IndexedDB, rechargement, parcours Carte, 3D, Plantes, Entretien, Planter, Réglages, Catalogue, ajout d'une photo contenant EXIF + GPS + XMP.

Résultats du 18/10/2026 : tous les en-têtes présents ; **aucune violation CSP** (événements `securitypolicyviolation` et console) ; carte MapLibre et canvas 3D affichés ; service worker enregistré (`upgrade-insecure-requests`, COOP et CORP n'ont rien cassé) ; `document.cookie` vide ; `/ext/geopf/autre` et `/ext/geopf/wmts/../apicarto` → 404 ; photo d'origine avec `GPSLatitude`, `Exif`, XMP → photo stockée **sans** aucun de ces segments (seuls JFIF, ICC et tables JPEG restent). `Permissions-Policy` : le nom `bluetooth` est inconnu de Chromium (avertissement) : retiré. Ce banc n'a pas pu tester Safari/Firefox ni le vrai Vercel.

## 6. Réglages à faire par le propriétaire

**Vercel**
- `PLANTNET_API_KEY` : portée *Production* seulement (pas Preview/Development), variable *Sensitive*. Jamais une variable `VITE_*` pour un secret (elles sont publiques dans le JavaScript).
- Pare-feu (Security > Firewall) : règle de limitation de débit sur `/api/identify` (ex. 10 par minute et par IP) et sur `/ext/*` ; c'est le seul limiteur réellement partagé entre instances (celui du code est un garde-fou par instance). Activer « Attack Challenge Mode » seulement en cas d'attaque.
- Settings > Deployment Protection : protéger les prévisualisations ; la production reste publique.
- 2FA sur le compte, droits minimaux dans l'équipe, accès journaux limité. Les journaux Vercel contiennent adresses IP et URL (durée selon l'offre).
- Si un domaine personnalisé est utilisé : `includeSubDomains` (HSTS) impose HTTPS sur tous ses sous-domaines.

**Supabase** (Authentication)
- URL Configuration : *Site URL* = domaine de production ; *Redirect URLs* = `https://<domaine>/**` et `http://localhost:5173/**`, **sans** joker de type `https://*.vercel.app/**`.
- Rate Limits : limiter les e-mails envoyés par heure ; activer CAPTCHA (Turnstile/hCaptcha) pour les liens magiques dès que l'appli est publique (demande une adaptation du client : `captchaToken`).
- Expiration du lien (OTP expiry) courte (≤ 1 h). SMTP personnalisé si le volume augmente.
- Appliquer la migration `20261019000000_security_hardening.sql`. Activer les sauvegardes selon l'offre ; vérifier le conseiller « Security Advisor » du tableau de bord.
- Ne jamais exposer `service_role` (ni en `VITE_*`, ni dans le dépôt).

**GitHub**
- Protection de la branche `main` : pull request obligatoire, au moins 1 relecture, vérification d'état « CI » requise, branche à jour, pas de force-push ni de suppression, historique linéaire, conversations résolues.
- 2FA obligatoire ; *Secret scanning* et *Push protection* activés ; *Dependabot alerts* et *security updates* activés ; *Private vulnerability reporting* activé (Settings > Code security) ; Actions : « Read repository contents » par défaut, `GITHUB_TOKEN` en lecture seule.
- Limiter les accès en écriture au strict nécessaire.

## 7. Ce que l'interface doit brancher

Déjà fait (`PrivacyCard.tsx`) : `eraseAllData({ remote: 'none' | 'snapshot' })`, `DATA_INVENTORY`, `PERMISSIONS`.

Reste à faire :
1. **Réglages > Sauvegarde > Importer** : remplacer `JSON.parse(await file.text())` + `migrateState` (`SettingsPage.tsx`, ligne ~188) par `readBackupFile(file)` (`lib/security/import`) ; afficher `r.error` en cas d'échec. Sans cela, la taille du fichier n'est pas limitée avant lecture.
2. **Suppression du compte** : proposer `remote: 'account'` dans l'effacement, et dans Synchronisation les boutons « Supprimer mes données en ligne » (`deleteRemoteSnapshot()`) et « Supprimer mon compte » (`deleteMyAccount()`) de `lib/sync`. Gérer l'erreur `Adresse e-mail invalide.` de `sendMagicLink`.
3. **Confidentialité** : afficher aussi le texte de `docs/CONFIDENTIALITE.md` (une fois complété) ; lien depuis l'écran d'accueil.
4. **Consentements** : avant le premier envoi de photo à l'identification (« vos photos sont envoyées à Pl@ntNet via notre serveur ; PermaJardin ne les conserve pas ») et avant la première synchronisation (adresse et position envoyées à Supabase).
5. Message d'erreur de `savePhoto` : « Cette photo est trop grande… » (nouveau cas).
