import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'
import { supabase, signInWithEmail, logSupabaseError, logSupabaseInfo } from '@/lib/supabase'
import { getSnapshotLaunchConfig } from '@/lib/snapshot'
import { UserProfile } from '@/types'

interface AuthState {
  session: Session | null
  profile: UserProfile | null
  isLoading: boolean
  setSession: (session: Session | null) => void
  fetchProfile: (userId: string) => Promise<void>
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  isLoading: true,

  setSession: (session) => set({ session }),

  fetchProfile: async (userId: string) => {
    logSupabaseInfo('Store', `Chargement profil → ${userId}`)

    const { data, error } = await supabase
      .from('users')
      .select('*, group:groups(*)')
      .eq('auth_id', userId)
      .single()

    if (error) {
      logSupabaseError('Store.fetchProfile', error)
    } else {
      logSupabaseInfo('Store', `Profil chargé — role: ${data?.role}, complet: ${data?.profile_complete}`)
    }

    set({ profile: data as UserProfile | null, isLoading: false })
  },

  clearAuth: () => set({ session: null, profile: null, isLoading: false }),
}))

async function signInForSnapshotIfNeeded(): Promise<boolean> {
  const config = getSnapshotLaunchConfig()
  if (!config) return false

  logSupabaseInfo('Auth', 'Mode snapshot détecté — connexion démo automatique')
  try {
    const { data, error } = await signInWithEmail(config.email, config.password)
    if (error) {
      logSupabaseError('Auth.snapshotSignIn', error)
      useAuthStore.setState({ isLoading: false })
      return true
    }
    const userId = data.user?.id
    if (userId) {
      useAuthStore.getState().setSession(data.session)
      await useAuthStore.getState().fetchProfile(userId)
    } else {
      useAuthStore.setState({ isLoading: false })
    }
  } catch (err) {
    logSupabaseError('Auth.snapshotSignIn', err)
    useAuthStore.setState({ isLoading: false })
  }
  return true
}

/** Initialise l'écoute de la session Supabase — à appeler une seule fois dans le root layout */
export function initializeAuth() {
  logSupabaseInfo('Auth', 'Initialisation de la session...')

  supabase.auth.getSession().then(async ({ data: { session }, error }) => {
    if (error) {
      logSupabaseError('Auth.getSession', error)
      useAuthStore.setState({ isLoading: false })
      return
    }

    if (session) {
      logSupabaseInfo('Auth', `Session existante trouvée — user: ${session.user.id}`)
      useAuthStore.getState().setSession(session)
      useAuthStore.getState().fetchProfile(session.user.id)
      return
    }

    const handledBySnapshot = await signInForSnapshotIfNeeded()
    if (handledBySnapshot) return

    logSupabaseInfo('Auth', 'Aucune session active — affichage login')
    useAuthStore.setState({ isLoading: false })
  })

  supabase.auth.onAuthStateChange(async (_event, session) => {
    logSupabaseInfo('Auth', `onAuthStateChange — event: ${_event}`)

    // Avoid racing snapshot auto-login: INITIAL_SESSION(null) must not clear
    // loading state before signInForSnapshotIfNeeded runs in getSession().
    if (!session && _event === 'INITIAL_SESSION' && getSnapshotLaunchConfig()) {
      return
    }

    useAuthStore.getState().setSession(session)
    if (session) {
      await useAuthStore.getState().fetchProfile(session.user.id)
    } else {
      useAuthStore.getState().clearAuth()
    }
  })
}
