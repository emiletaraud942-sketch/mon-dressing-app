---
name: verifier-api
description: Vérifier qu'un service externe (IGN Géoplateforme, API Carto, Open-Meteo, Pl@ntNet) répond toujours au format attendu. Utiliser quand une fonction de src/lib casse, quand l'IGN annonce un changement, ou avant d'ajouter un endpoint.
---
1. Le conteneur de développement peut ne pas avoir accès direct à ces hôtes : utilise un outil de lecture web (Firecrawl, Exa, WebFetch) sur l'URL complète réelle.
2. Teste sur une adresse réelle (ex. le jardin de démonstration de `src/data/demo.ts`).
3. Compare au parseur dans `src/lib/ign.ts` / `src/lib/weather.ts` ; mets à jour la fixture du test correspondant avec une réponse courte réelle.
4. `npx vitest run src/lib`.
