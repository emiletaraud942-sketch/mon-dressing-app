import { describe, expect, it } from 'vitest'
import { heatmapUvTransform, nodeToTexelCoord, texelCenterU } from './heatmap'

// sunHoursGrid place l'échantillon (i, j) sur le nœud x = -h + i·2h/(n-1) : le premier et le dernier
// échantillon sont sur les bords du carré. Les texels d'une DataTexture n×n sont centrés en (i+0,5)/n.
describe('carte d’ensoleillement : indice → coordonnée', () => {
  it('le centre du texel i est en (i+0,5)/n', () => {
    expect(texelCenterU(0, 40)).toBeCloseTo(0.5 / 40)
    expect(texelCenterU(39, 40)).toBeCloseTo(39.5 / 40)
  })

  it('le nœud i du terrain tombe exactement au centre du texel i', () => {
    for (const n of [2, 5, 40, 64]) {
      const { repeat, offset } = heatmapUvTransform(n)
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1) // coordonnée UV du nœud sur le plan
        expect(u * repeat + offset).toBeCloseTo(texelCenterU(i, n), 10)
      }
    }
  })

  it('les bords du plan restent dans la texture (pas de bavure par ClampToEdge)', () => {
    const { repeat, offset } = heatmapUvTransform(40)
    expect(offset).toBeGreaterThan(0)
    expect(offset + repeat).toBeLessThan(1)
  })

  it('nodeToTexelCoord renvoie l’abscisse locale du nœud dans le plan', () => {
    // 3 nœuds sur [-10, 10] : -10, 0, 10
    expect(nodeToTexelCoord(0, 3, 10)).toBeCloseTo(-10)
    expect(nodeToTexelCoord(1, 3, 10)).toBeCloseTo(0)
    expect(nodeToTexelCoord(2, 3, 10)).toBeCloseTo(10)
  })

  it('n < 2 : transformation neutre', () => {
    expect(heatmapUvTransform(1)).toEqual({ repeat: 1, offset: 0 })
  })
})
