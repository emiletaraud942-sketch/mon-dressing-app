import { describe, expect, it } from 'vitest'
import { doneTaskLabel } from './taskLabel'

const names: Record<string, string> = { pommier: 'pommier', tomate: 'Tomate' }
const lookup = (id: string) => names[id]

describe('doneTaskLabel', () => {
  it('espèce et type', () => {
    expect(doneTaskLabel('2026-W41:pommier:arrosage:0', lookup)).toBe('Arrosage · Pommier')
    expect(doneTaskLabel('2026:tomate:recolte:3', lookup)).toBe('Récolte · Tomate')
  })
  it('arrosage météo du jardin', () => {
    expect(doneTaskLabel('2026-10-18:jardin:arrosage:meteo', lookup)).toBe('Arrosage (météo)')
  })
  it('protection contre le gel', () => {
    expect(doneTaskLabel('2026-10-19:jardin:protection:gel', lookup)).toBe('Protection gel')
  })
  it('espèce inconnue : le type seul', () => {
    expect(doneTaskLabel('2026:fantome:taille:1', lookup)).toBe('Taille')
  })
  it('tolère un suffixe supplémentaire dans la clé', () => {
    expect(doneTaskLabel('2026-W41:pommier:taille:2:abc123', lookup)).toBe('Taille · Pommier')
  })
  it('clé illisible', () => {
    expect(doneTaskLabel('n-importe-quoi', lookup)).toBe('Tâche')
    expect(doneTaskLabel('', lookup)).toBe('Tâche')
  })
})
