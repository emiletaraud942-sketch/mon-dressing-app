// Lecture des en-têtes d'images (JPEG, PNG, WebP) sans les décoder : dimensions et métadonnées.
// L'équivalent pour le serveur est dans api/identify.ts (les fonctions /api ne peuvent pas importer src/ : voir docs/SECURITE.md).

export interface ImageSize {
  mime: 'image/jpeg' | 'image/png' | 'image/webp'
  width: number
  height: number
}

const u16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1]
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n))

/** Dimensions déclarées par l'en-tête, ou undefined si le format est inconnu, tronqué ou incohérent. */
export function imageSize(b: Uint8Array): ImageSize | undefined {
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && ascii(b, 12, 4) === 'IHDR') {
    return { mime: 'image/png', width: u32(b, 16), height: u32(b, 20) }
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let o = 2
    for (let guard = 0; o + 4 <= b.length && guard < 1000; guard++) {
      if (b[o] !== 0xff) return undefined
      const marker = b[o + 1]
      if (marker === 0xff) {
        o++ // octets de remplissage
        continue
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        o += 2
        continue
      }
      if (marker === 0xd9 || marker === 0xda) return undefined // fin / début des données : aucun SOF rencontré
      const len = u16(b, o + 2)
      if (len < 2) return undefined
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      if (isSof) {
        if (o + 9 > b.length) return undefined
        return { mime: 'image/jpeg', height: u16(b, o + 5), width: u16(b, o + 7) }
      }
      o += 2 + len
    }
    return undefined
  }
  if (b.length >= 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
    const kind = ascii(b, 12, 4)
    if (kind === 'VP8X') return { mime: 'image/webp', width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) }
    if (kind === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return { mime: 'image/webp', width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff }
    if (kind === 'VP8L' && b[20] === 0x2f) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)
      return { mime: 'image/webp', width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) }
    }
  }
  return undefined
}

/** Vrai si les dimensions déclarées sont plausibles (non nulles, sous les plafonds de côté et de pixels). */
export function sizeWithinLimits(s: Pick<ImageSize, 'width' | 'height'>, maxSide: number, maxPixels: number): boolean {
  return s.width > 0 && s.height > 0 && s.width <= maxSide && s.height <= maxSide && s.width * s.height <= maxPixels
}

/**
 * Segments de métadonnées d'un JPEG (EXIF, GPS inclus, XMP, IPTC/Photoshop, commentaires) : liste vide = image propre.
 * Sert à PROUVER qu'une photo ré-encodée par le navigateur ne contient plus de position GPS.
 */
export function jpegMetadataSegments(b: Uint8Array): string[] {
  const found: string[] = []
  if (!(b.length >= 4 && b[0] === 0xff && b[1] === 0xd8)) return found
  let o = 2
  for (let guard = 0; o + 4 <= b.length && guard < 1000; guard++) {
    if (b[o] !== 0xff) break
    const marker = b[o + 1]
    if (marker === 0xff) {
      o++
      continue
    }
    if (marker === 0xd9 || marker === 0xda) break
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      o += 2
      continue
    }
    const len = u16(b, o + 2)
    if (len < 2) break
    const body = ascii(b, o + 4, Math.min(30, len - 2))
    if (marker === 0xe1 && body.startsWith('Exif')) found.push('EXIF')
    else if (marker === 0xe1 && body.includes('ns.adobe.com/xap')) found.push('XMP')
    else if (marker === 0xed) found.push('IPTC')
    else if (marker === 0xfe) found.push('COM')
    else if (marker === 0xe2 && body.startsWith('MPF')) found.push('MPF')
    o += 2 + len
  }
  return found
}
