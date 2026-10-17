import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { getState, replaceData } from './store'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let client: SupabaseClient | undefined
export function supabase(): SupabaseClient | undefined {
  if (!url || !key) return undefined
  return (client ??= createClient(url, key))
}

export const syncAvailable = () => !!supabase()

export async function currentUser(): Promise<User | null> {
  const sb = supabase()
  if (!sb) return null
  const { data } = await sb.auth.getUser()
  return data.user
}

export async function sendMagicLink(email: string) {
  const sb = supabase()
  if (!sb) throw new Error('Synchronisation non configurée')
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/#reglages' } })
  if (error) throw error
}

export async function signOut() {
  await supabase()?.auth.signOut()
}

/** Envoie l'état local (jardins, plantes, tâches faites ; les photos restent sur l'appareil). */
export async function pushSnapshot() {
  const sb = supabase()
  const user = await currentUser()
  if (!sb || !user) throw new Error('Connectez-vous d’abord')
  const { gardens, plants, tasksDone } = getState()
  const { error } = await sb.from('garden_snapshots').upsert({ user_id: user.id, data: { gardens, plants, tasksDone }, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function pullSnapshot(): Promise<boolean> {
  const sb = supabase()
  const user = await currentUser()
  if (!sb || !user) throw new Error('Connectez-vous d’abord')
  const { data, error } = await sb.from('garden_snapshots').select('data').eq('user_id', user.id).maybeSingle()
  if (error) throw error
  if (!data) return false
  replaceData(data.data)
  return true
}
