/** Longueur maximale d'un nom de plante saisi à la main. */
export const CUSTOM_NAME_MAX = 60

/** Nom saisi à la main : espaces nettoyés, longueur bornée. Texte vide = pas de nom. */
export function cleanCustomName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim()
  return name.length > CUSTOM_NAME_MAX ? name.slice(0, CUSTOM_NAME_MAX).trim() : name
}

/** Espèce utilisée pour une plante absente de la liste (fiche générique, sans calendrier). */
export const UNKNOWN_SPECIES_ID = 'inconnue'
