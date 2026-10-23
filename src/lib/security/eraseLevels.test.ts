import { describe, expect, it } from 'vitest'
import { availableLevels, canErase, levelToRemote, remoteLeftOnline } from './eraseLevels'

describe('niveaux d’effacement', () => {
  it('sans session de synchro : appareil seulement', () => {
    expect(availableLevels(false)).toEqual(['device'])
    expect(availableLevels(true)).toEqual(['device', 'snapshot', 'account'])
  })
  it('traduit le niveau en option de eraseAllData', () => {
    expect(levelToRemote('device')).toBe('none')
    expect(levelToRemote('snapshot')).toBe('snapshot')
    expect(levelToRemote('account')).toBe('account')
  })
  it('le compte demande une confirmation de plus', () => {
    expect(canErase('device', false, false, false)).toBe(false)
    expect(canErase('snapshot', true, false, false)).toBe(true)
    expect(canErase('account', true, false, false)).toBe(false)
    expect(canErase('account', true, true, false)).toBe(true)
    expect(canErase('account', true, true, true)).toBe(false)
  })
  it('liste ce qui reste en ligne', () => {
    expect(remoteLeftOnline('device', false, false, false)).toEqual([])
    expect(remoteLeftOnline('device', true, true, false)).toHaveLength(2)
    expect(remoteLeftOnline('snapshot', true, false, false)[0]).toMatch(/compte de synchronisation/)
    expect(remoteLeftOnline('account', true, true, true)).toEqual([])
  })
})
