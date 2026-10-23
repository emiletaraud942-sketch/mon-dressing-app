// Contrôles statiques de la migration d'entraide (filet quand aucun Postgres n'est disponible).
// Les scénarios hostiles réels sont dans supabase/neighbors/tests/ (run.sh sur un Postgres jetable).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NEIGHBORS_LIMITS as L } from './types'

const sql = readFileSync('supabase/neighbors/migrations/20261023000000_neighbors.sql', 'utf8')
const code = sql.replace(/--.*$/gm, '') // sans commentaires

const functions = [...code.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)([\s\S]*?)\$\$;/g)].map((m) => ({ name: m[1], args: m[2], text: m[0] }))
const tables = [...code.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1])

describe('migration entraide : durcissement', () => {
  it('contient les fonctions attendues', () => {
    expect(functions.length).toBeGreaterThanOrEqual(18)
  })
  it('chaque fonction a un search_path vide', () => {
    for (const f of functions) expect(f.text, f.name).toMatch(/set search_path = ''/)
  })
  it('chaque fonction est révoquée à public et anon', () => {
    for (const f of functions) {
      const re = new RegExp(`revoke all on function public\\.${f.name}\\([^)]*\\) from public, anon`)
      expect(code, f.name).toMatch(re)
    }
  })
  it('seules les aides de politiques et la suppression de compte sont appelables par les connectés', () => {
    const granted = [...code.matchAll(/grant execute on function public\.(\w+)/g)].map((m) => m[1]).sort()
    expect(granted).toEqual(['delete_my_account', 'neighbors_can_see_cell', 'neighbors_is_blocked', 'neighbors_is_member', 'neighbors_my_photo_count'])
  })
  it('chaque table publique a la RLS activée', () => {
    expect(tables.sort()).toEqual(['blocks', 'messages', 'posts', 'profiles', 'quotas', 'replies', 'reports', 'threads'])
    for (const t of tables) expect(code, t).toMatch(new RegExp(`alter table public\\.${t}\\s+enable row level security`))
  })
  it('aucun droit à anon ou public, aucun « grant all », aucune politique ouverte', () => {
    expect(code).not.toMatch(/grant [^;]*\bto\b[^;]*\b(anon|public)\b/i)
    expect(code).not.toMatch(/grant all/i)
    expect(code).not.toMatch(/using\s*\(\s*true\s*\)/i)
    expect(code).not.toMatch(/with check\s*\(\s*true\s*\)/i)
    expect(code).not.toMatch(/\bto (anon|public)\b/i)
  })
  it('pas d’extension, pas de SQL dynamique, pas de service_role', () => {
    expect(code).not.toMatch(/create extension/i)
    expect(code).not.toMatch(/\bexecute\s+(format|'|\()/i)
    expect(code).not.toMatch(/service_role/i)
  })
  it('colonnes sensibles : aucun droit client sur banned_at, cell_*/status/expires_at des annonces', () => {
    const grants = [...code.matchAll(/grant (select|insert|update) \(([^)]*)\) on public\.(\w+)/g)].map((m) => `${m[1]} ${m[3]}: ${m[2]}`)
    expect(grants.join('\n')).not.toMatch(/banned_at/)
    expect(grants.find((g) => g.startsWith('insert posts'))).toBe('insert posts: author, kind, title, body, species_id, photo_path')
    expect(grants.find((g) => g.startsWith('update posts'))).toBe('update posts: status')
    expect(grants.find((g) => g.startsWith('update profiles'))).toBe('update profiles: pseudo, cell_lat, cell_lon')
  })
  it('le bucket de photos est privé, limité à 1 Mo et aux images', () => {
    expect(code).toMatch(/'neighbors-photos', 'neighbors-photos', false, 1048576, array\['image\/jpeg', 'image\/png', 'image\/webp'\]/)
    expect(code).toMatch(/\[0-9a-f\]\{8\}.*\\\.jpg\$/) // nom imposé <uid>/<uuid>.jpg
    expect(code).toMatch(/neighbors_my_photo_count\(\)\) < 20/)
  })
  it('les plafonds du client reprennent ceux de la base', () => {
    expect(code).toContain(`neighbors_take_quota(new.author, 'post', ${L.postsPerDay})`)
    expect(code).toContain(`neighbors_take_quota(new.author, 'reply', ${L.repliesPerDay})`)
    expect(code).toContain(`neighbors_take_quota(new.sender, 'message', ${L.messagesPerDay})`)
    expect(code).toContain(`neighbors_take_quota(new.reporter, 'report', ${L.reportsPerDay})`)
    expect(code).toContain(`>= ${L.openPostsMax} then`)
    expect(code).toContain(`between ${L.pseudoMin} and ${L.pseudoMax}`)
    expect(code).toContain(`char_length(btrim(title)) between 1 and ${L.titleMax}`)
    expect(code).toContain(`char_length(body) <= ${L.bodyMax}`)
    expect(code).toContain(`char_length(details) <= ${L.detailsMax}`)
    expect(code).toContain(`interval '${L.postLifetimeDays} days'`)
  })
  it('la migration est rejouable : tout est « if not exists », « or replace » ou précédé d’un drop', () => {
    for (const m of code.matchAll(/^create (table|index|unique index|trigger|policy|function)\b(?! if not exists)(?! or replace)(.*)$/gim)) {
      const stmt = m[0]
      if (/^create (trigger|policy)/i.test(stmt)) {
        const name = /create (?:trigger|policy) (\w+)/i.exec(stmt)![1]
        expect(code, name).toMatch(new RegExp(`drop (trigger|policy) if exists ${name}\\b`))
      } else expect(stmt).toMatch(/if not exists|or replace/)
    }
  })
})
