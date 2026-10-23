# Politique de confidentialité

> **BROUILLON À FAIRE VALIDER PAR UN PROFESSIONNEL.** Texte provisoire, à faire valider par un professionnel avant publication. Il ne constitue pas un avis juridique.
> Version 1.0 · Dernière mise à jour : 23 octobre 2026.

## En bref

- Vos jardins, plantes et photos restent sur votre appareil, dans votre navigateur.
- Pas de compte obligatoire, pas de publicité, pas de cookie, pas de traceur.
- Quelques services extérieurs reçoivent une partie de vos données uniquement quand la fonction l’exige : carte, météo, identification d’une plante, sauvegarde en ligne facultative.
- Vous pouvez tout exporter ou tout effacer à tout moment depuis les Réglages.

## Qui est responsable

Éditeur et responsable du traitement : [à compléter] ([à compléter]), [à compléter]. Contact : [à compléter].

Les données conservées uniquement sur votre appareil ne sont pas accessibles à l’éditeur.

## Données, finalités, destinataires et durées

Pour chaque donnée : où elle est stockée, qui la reçoit, pourquoi, sur quelle base et combien de temps.

- Jardins : nom, adresse, position du centre, contour de parcelle, bâtiments, relief, plantes (position au mètre près, notes), tâches faites. Stockage : IndexedDB du navigateur (clé permajardin:state:v1) ; copie « avant migration » en cas de correction au chargement. Aucun destinataire extérieur. Finalité : Fournir le service : carte, 3D, calendrier d’entretien. Base : exécution du service demandé. Durée : Jusqu’à effacement par l’utilisateur (ou par le navigateur si le stockage n’est pas persistant). Effacement : Réglages > Effacer toutes mes données (eraseAllData), ou supprimer un jardin.
- Photos de plantes (réduites à 1280 px maximum, sans EXIF ni position GPS : elles sont ré-encodées par le navigateur). Stockage : IndexedDB du navigateur (clés photo:…). Aucun destinataire extérieur. Finalité : Illustrer les plantes. Base : exécution du service demandé. Durée : Jusqu’à suppression de la plante ou effacement. Effacement : Supprimer la plante, ou Effacer toutes mes données. Les photos ne sont jamais synchronisées..
- Photos envoyées pour identification (1 à 5 images, organe choisi). Stockage : Aucun stockage chez nous : relayées en mémoire par la fonction /api/identify. Destinataires : Vercel (hébergeur de la fonction) ; Pl@ntNet (identification ; leur politique de confidentialité s’applique). Finalité : Identifier une plante, uniquement quand l’utilisateur clique sur « Identifier ». Base : votre consentement. Durée : Non conservées par PermaJardin. Conservation par Pl@ntNet : voir my.plantnet.org. Effacement : Demande à Pl@ntNet ; rien à effacer chez PermaJardin.
- Adresse recherchée (texte saisi). Stockage : Dans le jardin créé (voir « jardins »). Destinataires : Vercel (proxy /ext/geopf) ; IGN Géoplateforme (géocodage). Finalité : Trouver l’emplacement du jardin. Base : exécution du service demandé. Durée : Non conservée par PermaJardin hors du jardin créé. Effacement : Effacer toutes mes données.
- Coordonnées du jardin (parcelle, altitude, bâtiments, orthophoto, tuiles de carte). Stockage : Dans le jardin créé ; tuiles IGN dans le cache du service worker (ign-tuiles, ign-ortho-3d). Destinataires : Vercel (proxys /ext/geopf, /ext/apicarto) ; IGN Géoplateforme et API Carto. Finalité : Afficher la carte, la parcelle, le relief et le bâti. Base : exécution du service demandé. Durée : Tuiles : 60 jours au plus dans le cache ; orthophoto 3D : 14 jours. Effacement : Effacer toutes mes données (vide aussi les caches de tuiles).
- Coordonnées du jardin envoyées pour la météo et le climat local. Stockage : localStorage (clés pj-meteo:…, pj-climat:… : coordonnées arrondies à 3 décimales dans la clé). Destinataires : Vercel (proxys /ext/meteo, /ext/meteo-archive) ; Open-Meteo. Finalité : Prévisions et calcul des dates de gel pour proposer les tâches. Base : exécution du service demandé. Durée : Cache de 3 h (prévisions) et 30 jours (climat). Effacement : Effacer toutes mes données.
- Adresse e-mail du compte, instantané en ligne des jardins (sans photos), jeton de session. Stockage : Supabase (table garden_snapshots, protégée par RLS) ; jeton dans le localStorage (clé sb-…-auth-token). Destinataires : Supabase (sous-traitant : hébergement et authentification). Finalité : Sauvegarder et retrouver ses jardins sur un autre appareil. Fonction facultative.. Base : votre consentement. Durée : Jusqu’à suppression du compte ou de l’instantané. Effacement : Réglages > Synchronisation : supprimer mes données en ligne (deleteRemoteSnapshot) ou supprimer mon compte (deleteMyAccount).
- Préférences et repères : thème, date du dernier export, première utilisation, dernière notification, dernière synchronisation. Stockage : localStorage (clés permajardin:…). Aucun destinataire extérieur. Finalité : Confort d’usage (rappel de sauvegarde, une notification par jour au plus). Base : intérêt légitime (sécurité, confort d’usage). Durée : Jusqu’à effacement. Effacement : Effacer toutes mes données.
- Adresse IP, date, URL et navigateur de chaque requête (journaux techniques d’hébergement). Stockage : Vercel. Destinataires : Vercel (hébergeur). Finalité : Sécurité et exploitation du site. Base : intérêt légitime (sécurité, confort d’usage). Durée : Selon l’offre Vercel du propriétaire (à vérifier dans le tableau de bord). Effacement : Demande à l’éditeur du site.

Aucune de ces données n’est vendue, ni utilisée pour de la publicité ou du profilage.

## Bases légales

- Exécution du service que vous demandez : carte, météo locale, calendrier d’entretien (RGPD, art. 6.1.b).
- Votre consentement : envoi d’une photo à Pl@ntNet pour l’identification, et sauvegarde en ligne. Il est demandé avant le premier envoi et vous pouvez le retirer à tout moment dans Réglages > Vie privée (art. 6.1.a).
- Intérêt légitime : journaux techniques de sécurité de l’hébergeur et préférences d’usage (art. 6.1.f).

Information sans blocage : pour afficher la carte et la météo, les coordonnées de votre jardin sont envoyées à l’IGN (Géoplateforme, API Carto) et à Open-Meteo, par l’intermédiaire de notre hébergeur. Ces envois ne contiennent ni votre nom ni votre e-mail.

## Destinataires

- Vercel Inc. (États-Unis) : hébergement du site, relais des requêtes vers l’IGN et Open-Meteo, fonction d’identification.
- IGN Géoplateforme et API Carto : cartes, géocodage, parcelles, altitude.
- Open-Meteo : prévisions et historique météo.
- Pl@ntNet (Cirad, INRAE, Inria, IRD) : identification des plantes à partir des photos que vous envoyez.
- Supabase : compte et sauvegarde en ligne, seulement si vous activez la synchronisation.

Chaque service applique sa propre politique de confidentialité.

## Transferts hors Union européenne

Vercel est une société américaine : des données techniques (adresse IP, requêtes) peuvent être traitées aux États-Unis. Les garanties applicables (clauses contractuelles types ou cadre de protection des données UE-États-Unis) sont à confirmer par l’éditeur auprès de Vercel.

Le lieu d’hébergement du projet Supabase et d’Open-Meteo est également à confirmer.

## Cookies et traceurs

PermaJardin ne dépose aucun cookie et n’utilise ni mesure d’audience ni traceur publicitaire. Le stockage du navigateur (IndexedDB, localStorage, cache de l’appli) sert uniquement à faire fonctionner l’appli.

## Vos droits

- Accès et portabilité : Réglages > Sauvegarde > Exporter (fichier JSON lisible).
- Rectification : directement dans l’appli.
- Effacement : Réglages > Vie privée > Effacer toutes mes données, avec suppression de la sauvegarde en ligne si vous êtes connecté.
- Opposition, limitation et retrait du consentement : Réglages > Vie privée > Retirer mon consentement, ou par e-mail à l’éditeur.
- Réclamation : auprès de la CNIL (www.cnil.fr).

Pour toute demande : [à compléter]. Pour les données détenues par un prestataire (par exemple Pl@ntNet), vous pouvez aussi vous adresser à lui.

## Sécurité

Connexions chiffrées (HTTPS), aucune clé secrète dans l’appli, accès à la sauvegarde en ligne limité à son propriétaire, validation de tout fichier importé.

## Modifications

Toute modification importante de cette politique sera signalée dans l’appli. La date de dernière mise à jour figure en haut de la page.
