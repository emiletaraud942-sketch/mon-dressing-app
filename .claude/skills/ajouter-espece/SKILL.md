---
name: ajouter-espece
description: Ajouter ou corriger une espèce dans le catalogue PermaJardin (src/data/species). Utiliser quand l'utilisateur demande d'ajouter une plante, de corriger un calendrier, une règle de taille ou une association.
---
1. Choisis le fichier selon la catégorie : legumes, aromatiques, fleurs (fleurs + engrais verts), vivaces, petits-fruits, fruitiers, arbres-haies.
2. Id = slug minuscule sans accent (`groseillier-maquereau`). Vérifie qu'il n'existe pas : `grep -rn "id: '<slug>'" src/data/species`.
3. Remplis tous les champs obligatoires du type `Species` (src/types/index.ts). Pour la taille, précise la fenêtre et la condition (`hors-gel`, `temps-sec`, `apres-recolte`).
4. Ajoute l'espèce dans les `compagnons`/`antagonistes` des espèces concernées si l'association est réciproque.
5. `npx vitest run src/data` doit passer.
