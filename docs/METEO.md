# Météo : fournisseurs et licences

La météo et le climat passent par un fournisseur interchangeable (`src/lib/weatherProviders/`). `src/lib/weather.ts` garde le cache, le re-découpage par date locale et le calcul du climat.

## Fournisseurs

| Id | État | Licence | Usage commercial |
| --- | --- | --- | --- |
| `open-meteo` (défaut) | Actif | API gratuite sous CC BY 4.0, réservée à l'usage non commercial (moins de 10 000 appels/jour). Offre commerciale payante (`customer-api.open-meteo.com`). | NON |
| `meteo-france` | Squelette : lève « Fournisseur Météo-France non configuré » | À VÉRIFIER sur le portail officiel avant tout usage commercial. Le registre porte `commercialUse: true` par hypothèse. | À confirmer |

Mention exposée à l'interface : `getWeatherLicense()` renvoie `{ id, label, commercialUse, attribution, url }`. Exemple : « Météo : Open-Meteo (CC BY 4.0, usage non commercial) ». L'affichage reste à brancher côté interface.

## Changer de fournisseur

1. Définir `VITE_WEATHER_PROVIDER` (ex. `meteo-france`) dans les variables d'environnement Vercel.
2. Redéployer (la variable est lue au build).
3. Valeur absente : `open-meteo`. Valeur inconnue : repli sur `open-meteo` et `console.warn`, sans plantage.

Il n'y a PAS de bascule automatique : si un fournisseur tombe, l'appli utilise le cache expiré (`stale`) mais ne change jamais de source toute seule (licences et unités différentes).

## Confidentialité

Les coordonnées envoyées au fournisseur et utilisées dans les clés de cache sont arrondies à 2 décimales (environ 1 km), voir `docs/SECURITE.md`. Les clés de cache `pj-meteo:` et `pj-climat:` contiennent l'id du fournisseur : changer de source ne mélange pas les données.

## Météo-France : prérequis (NON VÉRIFIÉS)

Rien de ce qui suit n'a été testé ni confirmé.
- Compte sur portail-api.meteofrance.fr et abonnement à une API de prévision et à une API de données climatiques.
- Authentification (clé ou jeton) : mécanisme à vérifier.
- Endpoints, quotas, format de réponse, couverture outre-mer, disponibilité de l'évapotranspiration (`et0Mm`) : à vérifier sur une adresse réelle avant d'écrire le parseur, avec une réponse courte en fixture de test.
- Conditions de réutilisation commerciale et attribution exigée.

## Clé d'API : jamais dans le navigateur

Si le fournisseur exige une clé, l'appel passe par une fonction serveur `api/` (à écrire, comme `api/identify.ts`) qui garde la clé côté Vercel. Le navigateur n'appelle alors que cette fonction.

## Checklist pour une version commerciale

- [ ] Confirmer la licence du fournisseur visé (ou souscrire l'offre commerciale Open-Meteo).
- [ ] Implémenter `fetchForecast` et `fetchArchive` du fournisseur (retour `ForecastResult` et `ArchiveDaily[]`), avec tests sur fixtures réelles.
- [ ] Fonction serveur `api/` si clé requise.
- [ ] Nouveau préfixe `/ext/...` dans `vite.config.ts` (plus long d'abord) ET `vercel.json` (chemins exacts), mise à jour de `src/lib/security/vercel-config.test.ts` et de la CSP si besoin.
- [ ] Afficher la mention `getWeatherLicense()` dans l'interface.
- [ ] Positionner `VITE_WEATHER_PROVIDER` et redéployer.
- [ ] Mettre à jour les mentions de licence de `CLAUDE.md` et des conditions d'utilisation.
