import type { Tab } from './ui'

// Textes de l'aide contextuelle (bouton « ? »). Données pures : un contenu par écran.

export interface HelpContent {
  title: string
  /** 3 à 6 étapes, une phrase courte chacune. */
  steps: string[]
}

export const HELP: Record<Tab, HelpContent> = {
  carte: {
    title: 'La carte',
    steps: [
      'Touchez « Placer une plante » et choisissez une espèce.',
      "Touchez la carte à l'endroit exact où elle pousse.",
      'Glissez un point pour corriger sa position.',
      'Touchez un point pour ouvrir sa fiche : état, photos, tâches.',
      'La parcelle est facultative : vous pouvez placer vos plantes sans elle.',
    ],
  },
  '3d': {
    title: 'La vue 3D',
    steps: [
      'Faites tourner la vue à deux doigts ou à la souris.',
      "Choisissez une carte d'ensoleillement : aujourd'hui, été ou hiver.",
      'Le curseur « dans N ans » montre vos arbres adultes et leur ombre.',
      '« Promenade » vous place à hauteur d’yeux dans le jardin.',
      'Glissez une plante pour la déplacer.',
    ],
  },
  plantes: {
    title: 'Mes plantes',
    steps: [
      'Toutes vos plantes sont rangées par catégorie.',
      '« Ajouter » vous fait choisir une espèce, puis la placer.',
      '« Identifier » reconnaît une plante à partir d’une photo.',
      'Touchez une plante pour voir sa fiche et ajouter des photos.',
      '« Voir sur la carte » la centre à l’écran.',
    ],
  },
  entretien: {
    title: 'Entretien',
    steps: [
      'La liste dit quoi faire cette semaine : tailler, désherber, arroser, récolter.',
      'Chaque tâche tient compte de la météo et de la saison.',
      'Cochez une tâche faite. « Annuler » la remet dans la liste.',
      '« 📍 plante » vous montre la plante sur la carte.',
      "Le calendrier de l'année prévoit les mois à venir.",
    ],
  },
  planter: {
    title: 'Choisir et planter',
    steps: [
      'Touchez un emplacement sur la carte.',
      "L'appli calcule son soleil réel, sa pente et ses voisins.",
      'Les espèces sont classées de la plus adaptée à la moins adaptée.',
      '« Planter ici » ajoute la plante en projet.',
      'Plus bas, voyez quoi semer ou planter ce mois-ci.',
    ],
  },
  catalogue: {
    title: 'Le catalogue',
    steps: [
      'Cherchez une espèce par son nom ou sa catégorie.',
      'Sa fiche donne soleil, eau, sol, compagnons et entretien.',
      'Le calendrier de la fiche montre semis, plantation et récolte.',
      '« Placer dans mon jardin » ouvre la carte pour la poser.',
    ],
  },
  reglages: {
    title: 'Réglages',
    steps: [
      'Renseignez la nature du sol : les conseils en tiennent compte.',
      'Réessayez ici les données IGN qui manquent.',
      'Exportez une sauvegarde de vos données de temps en temps.',
      "Choisissez l'apparence : clair, sombre ou automatique.",
      'Créez un autre jardin avec « Nouveau jardin ».',
    ],
  },
  voisins: {
    title: 'L’entraide entre voisins',
    steps: [
      'Connectez-vous avec votre e-mail : un lien arrive, ouvrez-le dans ce navigateur.',
      'Choisissez un pseudo et votre quartier (arrondi à ~1 km, jamais votre adresse).',
      'Le fil montre les dons, échanges, prêts et questions autour de vous. Réglez le rayon.',
      '« Publier » crée une annonce. « Écrire en privé » ouvre une conversation.',
      '« Signaler » et « Bloquer » protègent le groupe. Rien ne se vend ici.',
      'Dans Profil : supprimez votre compte et toutes vos annonces quand vous voulez.',
    ],
  },
}

export const HELP_SCREENS = Object.keys(HELP) as Tab[]

export const MODES_HELP = {
  title: 'À quoi servent les 3 modes ?',
  intro: "Le sélecteur sous l'en-tête n'affiche que ce qui sert à votre étape. Rien n'est bloqué : changez de mode quand vous voulez.",
  modes: [
    { name: 'Mon jardin', text: 'Dessiner votre jardin réel : parcelle, bâtiments, plantes à leur place exacte, photos.' },
    { name: 'Entretenir', text: 'Savoir quoi faire cette semaine : tailler, désherber, arroser, récolter.' },
    { name: 'Planifier', text: 'Choisir quoi planter où, et voir le jardin grandir en 3D avec le soleil.' },
  ],
  optional: 'Modéliser le jardin est facultatif : vous pouvez passer directement à Entretenir ou Planifier.',
}

export function helpFor(tab: Tab): HelpContent {
  return HELP[tab]
}
