// Mesures de développement (data-* sur la racine 3D). Inactif en production, sauf avec ?debug=1 dans l'adresse.
export const DEBUG_3D: boolean =
  import.meta.env.DEV || (typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1')
