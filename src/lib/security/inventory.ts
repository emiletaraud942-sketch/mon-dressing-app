// Inventaire des données personnelles et des permissions de PermaJardin.
// Source unique pour la page « Confidentialité » (l'interface l'affiche) et pour docs/CONFIDENTIALITE.md.
// Tout changement de flux de données (nouvel appel réseau, nouvelle clé de stockage) doit modifier ce fichier.

export type LegalBasis = 'execution' | 'consentement' | 'interet-legitime'

export interface DataItem {
  id: string
  /** Quelle donnée. */
  donnee: string
  /** Où elle est stockée. */
  stockage: string
  /** Qui la reçoit en dehors de l'appareil (vide = personne). */
  destinataires: string[]
  finalite: string
  base: LegalBasis
  duree: string
  /** Comment l'utilisateur l'efface. */
  effacement: string
}

export const DATA_INVENTORY: readonly DataItem[] = [
  {
    id: 'jardins',
    donnee: 'Jardins : nom, adresse, position du centre, contour de parcelle, bâtiments, relief, plantes (position au mètre près, notes), tâches faites',
    stockage: 'IndexedDB du navigateur (clé permajardin:state:v1) ; copie « avant migration » en cas de correction au chargement',
    destinataires: [],
    finalite: 'Fournir le service : carte, 3D, calendrier d’entretien',
    base: 'execution',
    duree: 'Jusqu’à effacement par l’utilisateur (ou par le navigateur si le stockage n’est pas persistant)',
    effacement: 'Réglages > Effacer toutes mes données (eraseAllData), ou supprimer un jardin',
  },
  {
    id: 'photos',
    donnee: 'Photos de plantes (réduites à 1280 px maximum, sans EXIF ni position GPS : elles sont ré-encodées par le navigateur)',
    stockage: 'IndexedDB du navigateur (clés photo:…)',
    destinataires: [],
    finalite: 'Illustrer les plantes',
    base: 'execution',
    duree: 'Jusqu’à suppression de la plante ou effacement',
    effacement: 'Supprimer la plante, ou Effacer toutes mes données. Les photos ne sont jamais synchronisées.',
  },
  {
    id: 'identification',
    donnee: 'Photos envoyées pour identification (1 à 5 images, organe choisi)',
    stockage: 'Aucun stockage chez nous : relayées en mémoire par la fonction /api/identify',
    destinataires: ['Vercel (hébergeur de la fonction)', 'Pl@ntNet (identification ; leur politique de confidentialité s’applique)'],
    finalite: 'Identifier une plante, uniquement quand l’utilisateur clique sur « Identifier »',
    base: 'consentement',
    duree: 'Non conservées par PermaJardin. Conservation par Pl@ntNet : voir my.plantnet.org',
    effacement: 'Demande à Pl@ntNet ; rien à effacer chez PermaJardin',
  },
  {
    id: 'adresse',
    donnee: 'Adresse recherchée (texte saisi)',
    stockage: 'Dans le jardin créé (voir « jardins »)',
    destinataires: ['Vercel (proxy /ext/geopf)', 'IGN Géoplateforme (géocodage)'],
    finalite: 'Trouver l’emplacement du jardin',
    base: 'execution',
    duree: 'Non conservée par PermaJardin hors du jardin créé',
    effacement: 'Effacer toutes mes données',
  },
  {
    id: 'position',
    donnee: 'Coordonnées du jardin (parcelle, altitude, bâtiments, orthophoto, tuiles de carte)',
    stockage: 'Dans le jardin créé ; tuiles IGN dans le cache du service worker (ign-tuiles, ign-ortho-3d)',
    destinataires: ['Vercel (proxys /ext/geopf, /ext/apicarto)', 'IGN Géoplateforme et API Carto'],
    finalite: 'Afficher la carte, la parcelle, le relief et le bâti',
    base: 'execution',
    duree: 'Tuiles : 60 jours au plus dans le cache ; orthophoto 3D : 14 jours',
    effacement: 'Effacer toutes mes données (vide aussi les caches de tuiles)',
  },
  {
    id: 'meteo',
    donnee: 'Coordonnées du jardin envoyées pour la météo et le climat local',
    stockage: 'localStorage (clés pj-meteo:…, pj-climat:… : coordonnées arrondies à 3 décimales dans la clé)',
    destinataires: ['Vercel (proxys /ext/meteo, /ext/meteo-archive)', 'Open-Meteo'],
    finalite: 'Prévisions et calcul des dates de gel pour proposer les tâches',
    base: 'execution',
    duree: 'Cache de 3 h (prévisions) et 30 jours (climat)',
    effacement: 'Effacer toutes mes données',
  },
  {
    id: 'compte',
    donnee: 'Adresse e-mail du compte, instantané en ligne des jardins (sans photos), jeton de session',
    stockage: 'Supabase (table garden_snapshots, protégée par RLS) ; jeton dans le localStorage (clé sb-…-auth-token)',
    destinataires: ['Supabase (sous-traitant : hébergement et authentification)'],
    finalite: 'Sauvegarder et retrouver ses jardins sur un autre appareil. Fonction facultative.',
    base: 'consentement',
    duree: 'Jusqu’à suppression du compte ou de l’instantané',
    effacement: 'Réglages > Synchronisation : supprimer mes données en ligne (deleteRemoteSnapshot) ou supprimer mon compte (deleteMyAccount)',
  },
  {
    id: 'preferences',
    donnee: 'Préférences et repères : thème, date du dernier export, première utilisation, dernière notification, dernière synchronisation',
    stockage: 'localStorage (clés permajardin:…)',
    destinataires: [],
    finalite: 'Confort d’usage (rappel de sauvegarde, une notification par jour au plus)',
    base: 'interet-legitime',
    duree: 'Jusqu’à effacement',
    effacement: 'Effacer toutes mes données',
  },
  {
    id: 'journaux',
    donnee: 'Adresse IP, date, URL et navigateur de chaque requête (journaux techniques d’hébergement)',
    stockage: 'Vercel',
    destinataires: ['Vercel (hébergeur)'],
    finalite: 'Sécurité et exploitation du site',
    base: 'interet-legitime',
    duree: 'Selon l’offre Vercel du propriétaire (à vérifier dans le tableau de bord)',
    effacement: 'Demande à l’éditeur du site',
  },
]

export interface PermissionInfo {
  permission: string
  ou: string
  pourquoi: string
  siRefusee: string
}

/** Permissions du navigateur utilisées (ou volontairement non utilisées). */
export const PERMISSIONS: readonly PermissionInfo[] = [
  {
    permission: 'Notifications',
    ou: 'Tâches > « Activer les rappels » (clic uniquement, jamais au chargement)',
    pourquoi: 'Un rappel local par jour au plus quand des tâches urgentes existent. Aucune notification poussée par un serveur.',
    siRefusee: 'Aucun rappel ; tout le reste fonctionne.',
  },
  {
    permission: 'Photos (choix d’un fichier ou prise de vue)',
    ou: 'Fiche d’une plante > Ajouter une photo ; Identifier une plante (sélecteur de fichier du système, pas d’accès direct à la caméra)',
    pourquoi: 'Choisir une photo vous-même. Le navigateur ne donne accès qu’aux fichiers que vous sélectionnez.',
    siRefusee: 'Pas de photo ; la plante se place quand même.',
  },
  {
    permission: 'Stockage persistant',
    ou: 'Au démarrage (navigator.storage.persist) ; Firefox peut afficher une demande',
    pourquoi: 'Éviter que le navigateur efface vos jardins si l’espace manque.',
    siRefusee: 'Les données restent, mais peuvent être effacées par le navigateur : exportez une sauvegarde (Réglages).',
  },
  {
    permission: 'Géolocalisation',
    ou: 'Non utilisée : l’emplacement du jardin vient de l’adresse saisie',
    pourquoi: 'Aucune. Autorisée par la politique des permissions (geolocation=(self)) mais jamais demandée.',
    siRefusee: 'Sans objet.',
  },
  {
    permission: 'Caméra et microphone',
    ou: 'Non utilisés (pas de getUserMedia)',
    pourquoi: 'Aucune. camera=(self) permet seulement au sélecteur de fichiers de proposer l’appareil photo du système.',
    siRefusee: 'Sans objet.',
  },
]

/** Clés localStorage effacées par « Effacer toutes mes données ». */
export const ERASABLE_LOCAL_KEY = /^(permajardin:|pj-|sb-)/
/** Caches du service worker contenant des lieux consultés. Les caches du code de l’appli sont conservés. */
export const ERASABLE_CACHE = /^ign-/

/** Inventaire des données personnelles (pur, sans effet de bord). */
export function getDataInventory(): readonly DataItem[] {
  return DATA_INVENTORY
}
