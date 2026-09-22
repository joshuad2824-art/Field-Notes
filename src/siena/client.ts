import { createClient } from '@supabase/supabase-js'

// Both values are public configuration. The vault key stays on paired devices.
export const SIENA_URL = 'https://ihzuhlhspuuevuwswkky.supabase.co'
export const SIENA_PUBLISHABLE_KEY = 'sb_publishable_CYyXjBb29FAcmCo1reNDRg_1c99_OgB'

export const sienaClient = createClient(SIENA_URL, SIENA_PUBLISHABLE_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, autoRefreshToken: true },
})

export async function sendSignInLink(email: string, redirectTo: string): Promise<void> {
  const { error } = await sienaClient.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  })
  if (error) throw error
}

export async function linkedVault(): Promise<string | null> {
  const { data, error } = await sienaClient.from('vault_links').select('vault').maybeSingle()
  if (error) throw error
  return data?.vault ?? null
}
