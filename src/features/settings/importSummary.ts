export interface Counts {
  gardens: number
  plants: number
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n > 1 ? many : one}`

export const describeCounts = (c: Counts) => `${plural(c.gardens, 'jardin')} et ${plural(c.plants, 'plante')}`

/** Phrase de confirmation d'un import : « Remplacer vos 2 jardins et 40 plantes par 1 jardin et 12 plantes ? » */
export function importQuestion(current: Counts, next: Counts): string {
  if (current.gardens === 0 && current.plants === 0) return `Importer ${describeCounts(next)} ?`
  return `Remplacer vos ${describeCounts(current)} par ${describeCounts(next)} ?`
}
