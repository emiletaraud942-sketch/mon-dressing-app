# PermaJardin

PWA française pour cartographier son jardin en 3D (données IGN), placer ses plantes au mètre près, choisir quoi planter où et savoir quand tailler, désherber, arroser, récolter. Budget : 0 €.

## Commandes
- `npm run dev` : serveur local (proxy des API externes inclus)
- `npm run typecheck` · `npm test` (vitest) · `npm run build`

## Architecture
- React 18 + TypeScript + Vite, PWA (vite-plugin-pwa), MapLibre (carte 2D), Three.js / React Three Fiber (3D), SunCalc.
- **Local-first** : état dans IndexedDB (`src/lib/store.ts`), photos dans IndexedDB (`src/lib/photos.ts`). Supabase optionnel (`src/lib/sync.ts`, `supabase/migrations`).
- **Proxy** : le navigateur n'appelle que `/ext/geopf`, `/ext/apicarto`, `/ext/meteo`, `/ext/meteo-archive` (vite.config.ts en dev, rewrites de vercel.json en prod).
- **Fonction serveur** : `api/identify.ts` relaie Pl@ntNet (clé `PLANTNET_API_KEY` côté Vercel).
- **Repère** : coordonnées locales en mètres, x = est, y = nord, origine = centre du jardin (`src/lib/geo.ts`). En Three.js, Z = -nord.
- **Contrat de données** : `src/types/index.ts`. Ne change pas le format stocké sans migration.

## Qui possède quoi (équipe d'agents dans `.claude/agents/`)
| Domaine | Fichiers | Agent |
| --- | --- | --- |
| Fiches espèces (146) | `src/data/species/*` | agronome-permaculture |
| IGN, météo, géo | `src/lib/{ign,weather,geo,terrain}.ts` | dev-cartographie-ign |
| Scène 3D | `src/features/garden3d/*` | dev-3d |
| Règles métier | `src/engine/*` | dev-moteur-regles |
| Écrans, PWA | `src/App.tsx`, `src/features/*`, `src/components`, `src/styles` | dev-frontend-pwa |
| Supabase, /api | `supabase/`, `src/lib/sync.ts`, `api/` | dev-backend-supabase |
| Tests navigateur | — | qa-testeur |
| Déploiement | `vercel.json` | devops-vercel |

Orchestration : agent `chef-de-projet`. Skills : `ajouter-espece`, `deployer`, `verifier-api`.

## Conventions
- Interface et commentaires en français ; phrases courtes.
- Couleurs uniquement via les variables CSS de `:root` (thème clair et sombre).
- Moteurs (`src/engine`) purs et testés ; ils reçoivent `speciesById` en paramètre.
- Licences : IGN Licence Ouverte (commercial OK) ; Open-Meteo non commercial ; Pl@ntNet 500 identifications/jour partagées.
