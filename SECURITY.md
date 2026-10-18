# Politique de sécurité

## Signaler une faille
Merci de **ne pas** ouvrir d'issue publique pour une vulnérabilité.

1. Utilisez le signalement privé de GitHub : onglet **Security** du dépôt > **Report a vulnerability**.
2. À défaut, écrivez à [adresse e-mail de contact de l'éditeur : à compléter] avec : ce que vous avez constaté, comment le reproduire, l'effet possible. N'incluez aucune donnée personnelle réelle.

Nous accusons réception sous 7 jours, indiquons une première évaluation sous 14 jours et prévenons de la correction. Un signalement de bonne foi (sans accès aux données d'autrui, sans déni de service) ne donnera lieu à aucune poursuite.

## Versions prises en charge
Seule la dernière version déployée depuis la branche `main` reçoit des correctifs de sécurité.

## Périmètre
Dans le périmètre : le site PermaJardin, la fonction `/api/identify`, les proxys `/ext/*`, la configuration Supabase du projet (règles RLS), la chaîne de build (CI).
Hors périmètre : les services tiers eux-mêmes (IGN, Open-Meteo, Pl@ntNet, Vercel, Supabase), les attaques nécessitant un appareil déjà compromis, les rapports automatisés sans démonstration.

Détails des mesures en place : [docs/SECURITE.md](docs/SECURITE.md). Données personnelles : [docs/CONFIDENTIALITE.md](docs/CONFIDENTIALITE.md).
