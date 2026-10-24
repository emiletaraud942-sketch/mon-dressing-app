// Configuration publique de l'entraide (URL du projet Supabase dédié + clé « anon / publishable », publiques par conception).
// Noms acceptés, du préféré au plus ancien. Les deux premiers n'ont pas le préfixe VITE_ (vite.config.ts : envPrefix) et
// aucun mot « KEY » / « TOKEN » / « SECRET », que Vercel refuse ou signale dans un nom de variable.
const e = import.meta.env

export const neighborsUrl: string | undefined = e.NEIGHBORS_SUPABASE_URL || e.VITE_NEIGHBORS_SUPABASE_URL || undefined
export const neighborsKey: string | undefined =
  e.NEIGHBORS_SUPABASE_PUBLISHABLE || e.VITE_NEIGHBORS_SUPABASE_PUBLIC_TOKEN || e.VITE_NEIGHBORS_SUPABASE_ANON_KEY || undefined
