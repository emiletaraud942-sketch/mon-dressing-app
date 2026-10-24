import { describe, expect, it } from 'vitest'
import { friendlyError } from './http'

describe('friendlyError', () => {
  it('garde les phrases déjà simples', () => {
    expect(friendlyError(new Error('Connexion impossible. Vérifiez votre accès à Internet.')).message).toBe('Connexion impossible. Vérifiez votre accès à Internet.')
    expect(friendlyError(new Error('Le service met trop de temps à répondre. Réessayez dans un instant.'))).toEqual({
      message: 'Le service met trop de temps à répondre. Réessayez dans un instant.',
    })
    expect(friendlyError(new Error('Photo illisible. Essayez une autre photo.')).detail).toBeUndefined()
  })

  it('cache le code d’erreur dans « Détails »', () => {
    const r = friendlyError(new Error('IGN a répondu une erreur (503).'))
    expect(r.message).toBe('Le service ne répond pas pour le moment. Réessayez plus tard.')
    expect(r.detail).toBe('IGN a répondu une erreur (503).')
    expect(friendlyError(new Error('Open-Meteo a renvoyé une réponse illisible.')).detail).toContain('Open-Meteo')
  })

  it('remplace un message technique par une phrase simple', () => {
    const r = friendlyError(new TypeError("Cannot read properties of undefined (reading 'x')"))
    expect(r.message).toBe('Un problème est survenu. Réessayez dans un instant.')
    expect(r.detail).toContain('undefined')
    expect(friendlyError('{"error":"x"}').detail).toBe('{"error":"x"}')
  })

  it('erreur vide ou inconnue : phrase générique, pas de détail', () => {
    expect(friendlyError(undefined)).toEqual({ message: 'Un problème est survenu. Réessayez dans un instant.' })
    expect(friendlyError(new Error(''))).toEqual({ message: 'Un problème est survenu. Réessayez dans un instant.' })
  })
})
