# PermaJardin

Votre jardin en 3D à partir de la photo aérienne et du cadastre de l'IGN, avec l'ombre réelle du soleil, vos plantes à leur place exacte, et la liste de ce qu'il faut faire cette semaine.

## Ce que fait la V1
- **Carte** : photo aérienne IGN, cadastre, parcelle et bâtiments voisins ; placement des plantes par glisser-déposer (≈ 20 cm de précision) ; envergure actuelle ou adulte.
- **3D** : relief RGE ALTI, orthophoto au sol, bâtiments extrudés (BD TOPO), arbres qui grandissent (« dans N ans »), ombres réelles selon la date et l'heure, carte d'ensoleillement.
- **Plantes** : inventaire avec photos, état, notes ; identification par photo (Pl@ntNet).
- **Entretien** : tâches de la semaine (taille, désherbage, arrosage, protection gel, récolte…) calculées à partir de 146 fiches espèces et de la météo (gel, pluie, bilan hydrique) ; calendrier de l'année ; rappels.
- **Planter** : score « quelle plante pour cet endroit » (ensoleillement simulé, pente, sol, bons et mauvais voisins, distance légale art. 671 du Code civil) ; que semer ce mois-ci selon les gelées locales.
- **Catalogue** : 146 espèces (légumes, aromatiques, fleurs, engrais verts, vivaces, petits fruits, fruitiers, arbres et haies) avec fiche d'entretien.
- **Réglages** : plusieurs jardins, sol, export/import, synchronisation Supabase optionnelle.

## Démarrer
```bash
npm install
npm run dev
```

## Variables d'environnement (toutes optionnelles)
| Variable | Où | Rôle |
| --- | --- | --- |
| `PLANTNET_API_KEY` | Vercel (serveur) | Identification par photo. Clé gratuite sur my.plantnet.org |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Vercel (build) | Synchronisation entre appareils (appliquer `supabase/migrations`) |

## Sources
IGN Géoplateforme (Licence Ouverte 2.0) · Open-Meteo (CC BY 4.0, non commercial) · Pl@ntNet · Code civil art. 671.
