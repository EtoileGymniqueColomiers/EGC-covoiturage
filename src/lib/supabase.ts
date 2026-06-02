import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, AuthError, PostgrestError } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// ─── Logger centralisé ───────────────────────────────────────────────────────

type LogLevel = 'INFO' | 'WARN' | 'ERROR'

function log(level: LogLevel, context: string, message: string, detail?: unknown) {
  const timestamp = new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
  const prefix = `[EGC ${level}] [${timestamp}] [${context}]`

  if (level === 'ERROR') {
    console.error(`${prefix} ${message}`, detail ?? '')
  } else if (level === 'WARN') {
    console.warn(`${prefix} ${message}`, detail ?? '')
  } else {
    console.log(`${prefix} ${message}`, detail ?? '')
  }
}

function classifyError(error: unknown): string {
  if (!error) return 'Erreur inconnue'

  const msg =
    error instanceof Error ? error.message :
    typeof error === 'string' ? error :
    JSON.stringify(error)

  if (msg.includes('Network request failed') || msg.includes('fetch') || msg.includes('network')) {
    return 'RESEAU — Base de données inaccessible (projet Supabase en pause ou connexion internet coupée)'
  }
  if (msg.includes('Invalid login') || msg.includes('invalid_grant') || msg.includes('Invalid credentials')) {
    return 'AUTH — Identifiants incorrects'
  }
  if (msg.includes('Email not confirmed')) {
    return 'AUTH — Email non confirmé'
  }
  if (msg.includes('JWT')) {
    return 'AUTH — Token expiré ou invalide'
  }
  if (msg.includes('timeout')) {
    return 'RESEAU — Timeout (serveur trop lent ou inaccessible)'
  }
  if (msg.includes('permission denied') || msg.includes('RLS')) {
    return 'SECURITE — Accès refusé (politique RLS)'
  }
  return `INCONNU — ${msg}`
}

// ─── Wrappers d'authentification avec logs ───────────────────────────────────

export async function signInLicencie(licenseNumber: string, birthdate: string) {
  const email = buildLicencieEmail(licenseNumber)
  log('INFO', 'Auth', `Tentative connexion licencié → ${email}`)

  const result = await supabase.auth.signInWithPassword({ email, password: birthdate })

  if (result.error) {
    log('ERROR', 'Auth', classifyError(result.error), result.error)
  } else {
    log('INFO', 'Auth', `Connexion réussie — user: ${result.data.user?.id}`)
  }

  return result
}

export async function signInWithEmail(email: string, password: string) {
  log('INFO', 'Auth', `Tentative connexion email → ${email}`)

  const result = await supabase.auth.signInWithPassword({ email, password })

  if (result.error) {
    log('ERROR', 'Auth', classifyError(result.error), result.error)
  } else {
    log('INFO', 'Auth', `Connexion réussie — user: ${result.data.user?.id}`)
  }

  return result
}

export async function signUpParent(email: string, password: string) {
  log('INFO', 'Auth', `Inscription parent → ${email}`)

  const result = await supabase.auth.signUp({ email, password })

  if (result.error) {
    log('ERROR', 'Auth', classifyError(result.error), result.error)
  } else {
    log('INFO', 'Auth', 'Inscription réussie — email de confirmation envoyé')
  }

  return result
}

export async function signOut() {
  log('INFO', 'Auth', 'Déconnexion')
  return supabase.auth.signOut()
}

/** Format interne de l'email pour les licenciés (jamais visible par l'utilisateur) */
export function buildLicencieEmail(licenseNumber: string): string {
  return `${licenseNumber.toLowerCase().trim()}@egc.internal`
}

// ─── Helper global pour logger les erreurs Supabase ailleurs dans l'app ──────

export function logSupabaseError(context: string, error: PostgrestError | AuthError | Error | unknown) {
  log('ERROR', context, classifyError(error), error)
}

export function logSupabaseInfo(context: string, message: string) {
  log('INFO', context, message)
}
