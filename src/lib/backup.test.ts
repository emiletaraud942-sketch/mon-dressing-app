import { describe, expect, it } from 'vitest'
import { shouldRemindExport } from './backup'

const DAY = 86400000
const now = Date.UTC(2026, 9, 18)

describe('shouldRemindExport', () => {
  it('jamais sans données', () => {
    expect(shouldRemindExport({ now, hasData: false, firstUse: now - 90 * DAY })).toBe(false)
  })
  it('pas pendant les 30 premiers jours', () => {
    expect(shouldRemindExport({ now, hasData: true, firstUse: now - 10 * DAY })).toBe(false)
  })
  it('après 30 jours sans export', () => {
    expect(shouldRemindExport({ now, hasData: true, firstUse: now - 31 * DAY })).toBe(true)
  })
  it('un export récent repousse le rappel', () => {
    expect(shouldRemindExport({ now, hasData: true, firstUse: now - 200 * DAY, lastExport: now - 5 * DAY })).toBe(false)
  })
  it('un seul rappel par mois', () => {
    expect(shouldRemindExport({ now, hasData: true, firstUse: now - 90 * DAY, lastReminder: now - 3 * DAY })).toBe(false)
    expect(shouldRemindExport({ now, hasData: true, firstUse: now - 90 * DAY, lastReminder: now - 40 * DAY })).toBe(true)
  })
  it('sans point de départ, pas de rappel', () => {
    expect(shouldRemindExport({ now, hasData: true })).toBe(false)
  })
})
