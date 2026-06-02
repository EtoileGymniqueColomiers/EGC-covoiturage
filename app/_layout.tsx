import { useEffect } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { useAuthStore, initializeAuth } from '@/stores/auth.store'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
})

function AuthGate() {
  const { session, profile, isLoading } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    const inAuth  = segments[0] === '(auth)'
    const inAdmin = segments[0] === '(admin)'
    const inApp   = segments[0] === '(app)'

    if (!session) {
      if (!inAuth) router.replace('/(auth)/login')
      return
    }

    // Session valide mais pas de profil en base → écran de complétion
    if (!profile) {
      if (!inAuth) router.replace('/(auth)/complete-profile')
      return
    }

    // Compte suspendu
    if (!profile.is_active) {
      router.replace('/(auth)/login')
      return
    }

    // Profil incomplet → compléter avant tout
    if (!profile.profile_complete) {
      if (!inAuth) router.replace('/(auth)/complete-profile')
      return
    }

    // Admin → interface admin
    if (profile.role === 'admin') {
      if (!inAdmin) router.replace('/(admin)')
      return
    }

    // Parent / Licencié / Encadrant → app
    if (!inApp) {
      router.replace('/(app)')
    }
  }, [session, profile, isLoading, segments, router])

  return <Slot />
}

export default function RootLayout() {
  useEffect(() => {
    initializeAuth()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <AuthGate />
    </QueryClientProvider>
  )
}
