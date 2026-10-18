// Carte d'ensoleillement : correspondance entre la grille de `sunHoursGrid` et la texture.
// sunHoursGrid échantillonne sur les NŒUDS : x = -h + i·2h/(n-1), i = 0…n-1 (bords inclus).
// Une DataTexture n×n a ses texels centrés en (i + 0,5)/n. Sans correction, la carte serait décalée
// d'un demi-texel (0,5·2h/n) et légèrement dilatée. On applique donc un repeat/offset à la texture.

/** Coordonnée UV (0…1) du centre du texel i d'une texture de n texels. */
export function texelCenterU(i: number, n: number): number {
  return (i + 0.5) / n
}

/** Abscisse locale (m) du nœud i parmi n répartis sur [-halfSizeM, +halfSizeM]. */
export function nodeToTexelCoord(i: number, n: number, halfSizeM: number): number {
  return n > 1 ? -halfSizeM + (i * 2 * halfSizeM) / (n - 1) : 0
}

/**
 * `texture.repeat` / `texture.offset` (identiques sur u et v) qui envoient l'UV du nœud i (= i/(n-1))
 * sur le centre du texel i : u_tex = u·(n-1)/n + 0,5/n. La texture est ensuite interpolée linéairement
 * entre nœuds voisins, comme le fait le plan de relief.
 */
export function heatmapUvTransform(n: number): { repeat: number; offset: number } {
  if (!(n > 1)) return { repeat: 1, offset: 0 }
  return { repeat: (n - 1) / n, offset: 0.5 / n }
}
