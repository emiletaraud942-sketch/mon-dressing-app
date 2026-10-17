---
name: deployer
description: Déployer PermaJardin sur Vercel et vérifier que la production fonctionne. Utiliser quand l'utilisateur demande de mettre en ligne, publier ou déployer.
---
1. `npm run typecheck && npm test && npm run build` : tout doit passer.
2. Pousser la branche ; le projet Vercel `permajardin` est relié au dépôt GitHub et déploie automatiquement (la branche de production est `main`).
3. Vérifier : la page d'accueil s'affiche, `/ext/geopf/geocodage/search?q=nantes&limit=1` renvoie du JSON, `POST /api/identify` répond.
4. Variables : `PLANTNET_API_KEY` (identification photo), `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (synchronisation, optionnelle). Redéployer après tout changement de variable `VITE_*`.
