# Politique de confidentialité de PermaJardin

> **Modèle à compléter** par l'éditeur avant publication : remplacer les passages entre crochets `[…]`, vérifier les durées et les lieux d'hébergement auprès de chaque prestataire, et faire relire le texte si l'appli est proposée à un public large. Ce texte décrit ce que fait réellement l'appli (inventaire : `src/lib/security/inventory.ts`). Dernière mise à jour : [date].

## En bref
- **Vos jardins restent sur votre appareil.** PermaJardin enregistre vos données dans votre navigateur. Il n'y a ni publicité, ni statistiques, ni cookie, ni traceur.
- Quelques services extérieurs reçoivent une partie de vos données **uniquement quand la fonction correspondante l'exige** (carte, météo, identification d'une plante, sauvegarde en ligne facultative).
- Vous pouvez tout exporter ou tout effacer à tout moment depuis les Réglages.

## Qui est responsable
[Nom ou pseudonyme de l'éditeur], [adresse e-mail de contact]. Pour toute question ou demande sur vos données : [adresse e-mail de contact].
Les données conservées uniquement sur votre appareil ne sont pas accessibles à l'éditeur.

## Quelles données, où, pourquoi, combien de temps

| Donnée | Où | Qui la reçoit | Pourquoi | Durée |
| --- | --- | --- | --- | --- |
| Jardins (nom, adresse, position, contour de parcelle, bâtiments, relief), plantes (position au mètre près, notes), tâches faites | Votre navigateur (IndexedDB) | Personne | Faire fonctionner la carte, la 3D et le calendrier | Jusqu'à ce que vous les effaciez |
| Photos de plantes | Votre navigateur | Personne (jamais synchronisées) | Illustrer vos plantes. Elles sont réduites et **leurs informations de prise de vue (GPS, appareil) sont supprimées** | Jusqu'à suppression de la plante ou effacement |
| Adresse recherchée | Dans votre jardin | IGN Géoplateforme, par l'intermédiaire de notre hébergeur | Trouver l'emplacement | Non conservée par PermaJardin en dehors de votre jardin |
| Position du jardin | Dans votre jardin ; tuiles de carte dans le cache de l'appli | IGN Géoplateforme et API Carto | Carte, parcelle cadastrale, relief, bâtiments | Cache : 60 jours au plus (tuiles) |
| Position du jardin (coordonnées) | Cache du navigateur 3 h à 30 jours | Open-Meteo, par l'intermédiaire de notre hébergeur | Prévisions météo et dates de gel | Voir la politique d'Open-Meteo |
| Photos envoyées pour identification (1 à 5) | Nulle part chez nous : relayées en mémoire | Pl@ntNet, par l'intermédiaire de notre fonction hébergée chez Vercel | Identifier une plante, **seulement si vous cliquez sur « Identifier »** | Non conservées par PermaJardin ; voir la politique de Pl@ntNet |
| Adresse e-mail, sauvegarde en ligne de vos jardins (sans photos) | Supabase, **seulement si vous créez un compte** | Supabase | Retrouver vos jardins sur un autre appareil | Jusqu'à suppression de votre compte ou de la sauvegarde |
| Préférences (thème, dates de rappel), jeton de connexion | Votre navigateur (localStorage) | Personne | Confort d'usage, connexion | Jusqu'à effacement |
| Adresse IP, date, page demandée, navigateur | Journaux techniques de l'hébergeur | Vercel | Sécurité et bon fonctionnement du site | [durée selon l'offre Vercel : à vérifier] |

Aucune de ces données n'est vendue, ni utilisée pour de la publicité ou du profilage.

## Sur quel fondement
- **Exécution du service que vous demandez** : carte, météo locale, calendrier d'entretien (RGPD art. 6.1.b).
- **Votre consentement** : identification par photo (vous cliquez), création d'un compte et sauvegarde en ligne (vous vous connectez), rappels (vous acceptez la demande du navigateur). Vous pouvez le retirer à tout moment.
- **Intérêt légitime** : journaux techniques de sécurité (art. 6.1.f).

## Prestataires (sous-traitants)
- **Vercel Inc.** : hébergement du site, relais des requêtes vers l'IGN et Open-Meteo, fonction d'identification. Vercel peut traiter des données hors de l'Union européenne ; [garanties : clauses contractuelles types / cadre de protection des données UE-États-Unis — à confirmer].
- **IGN (Géoplateforme, API Carto)** : cartes, géocodage, parcelles, altitude. Service public français.
- **Open-Meteo** : prévisions et historique météo (usage non commercial). [Localisation de l'hébergement : à vérifier.]
- **Pl@ntNet** : identification des plantes à partir des photos que vous envoyez.
- **Supabase** : compte et sauvegarde en ligne, facultatifs. [Région du projet : à préciser.]

Chaque service applique sa propre politique de confidentialité, à laquelle vous pouvez vous référer.

## Cookies et traceurs
PermaJardin **ne dépose aucun cookie** et n'utilise aucun outil de mesure d'audience ni traceur publicitaire. Le stockage de votre navigateur (IndexedDB, localStorage, cache du service worker) sert uniquement à faire fonctionner l'appli et n'exige donc pas de consentement.

## Vos droits
Vous pouvez à tout moment :
- **accéder à vos données et les emporter** (portabilité) : Réglages > Exporter une sauvegarde (fichier JSON lisible) ;
- **les corriger** : directement dans l'appli ;
- **les effacer** : Réglages > Effacer toutes mes données (appareil), avec, si vous êtes connecté, la suppression de votre sauvegarde en ligne ou de votre compte ;
- **vous opposer ou limiter** un traitement, ou retirer un consentement : en cessant d'utiliser la fonction concernée ou en nous écrivant à [adresse e-mail de contact] ;
- **introduire une réclamation** auprès de la CNIL (www.cnil.fr).

Pour les données détenues par un prestataire (par exemple Pl@ntNet pour les photos d'identification), la demande peut aussi lui être adressée directement.

## Sécurité
Connexions chiffrées (HTTPS), aucune clé secrète dans l'appli, règles d'accès strictes sur la sauvegarde en ligne (chaque compte ne voit que ses propres données), validation de tout fichier importé. Détails techniques : `docs/SECURITE.md`. Pour signaler une faille : `SECURITY.md`.

## Permissions demandées par le navigateur
- **Notifications** : seulement si vous activez les rappels (un rappel par jour au plus, affiché à l'ouverture de l'appli).
- **Stockage persistant** : pour que le navigateur n'efface pas vos jardins.
- **Photos** : vous choisissez vous-même les fichiers ; l'appli n'accède jamais à la caméra ni à votre position de façon automatique.

## Modifications
Toute modification importante de cette politique sera signalée dans l'appli. [date et version]
