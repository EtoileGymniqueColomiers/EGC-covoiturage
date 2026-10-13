import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { signInLicencie, signInWithEmail } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { DatePickerInput } from '@/components/ui/DatePickerInput'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { COLORS, SPACING, RADIUS } from '@/constants/theme'

type LoginMode = 'licencie' | 'parent'

export default function LoginScreen() {
  const router = useRouter()
  const [mode, setMode] = useState<LoginMode>('licencie')
  const [loading, setLoading] = useState(false)

  // Licencié
  const [licenseNumber, setLicenseNumber] = useState('')
  const [birthdate, setBirthdate] = useState('')

  // Parent / Encadrant
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [errors, setErrors]     = useState<Record<string, string>>({})
  const [loginError, setLoginError] = useState<string | null>(null)


  function validate(): boolean {
    const e: Record<string, string> = {}

    if (mode === 'licencie') {
      if (!licenseNumber.trim()) e.licenseNumber = 'Numéro de licence requis'
      if (!birthdate.trim()) e.birthdate = 'Date de naissance requise'
      else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(birthdate))
        e.birthdate = 'Format attendu : JJ/MM/AAAA'
    } else {
      if (!email.trim()) e.email = 'Email requis'
      if (!password.trim()) e.password = 'Mot de passe requis'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function classifyError(message: string): string {
    if (
      message.includes('Invalid login') ||
      message.includes('invalid_grant') ||
      message.includes('Invalid credentials') ||
      message.includes('invalid credentials')
    ) {
      return mode === 'licencie'
        ? 'Numéro de licence ou date de naissance incorrect.'
        : 'Email ou mot de passe incorrect.'
    }
    if (message.includes('Email not confirmed')) {
      return 'Email non confirmé. Vérifiez votre boîte mail.'
    }
    if (message.includes('Too many requests') || message.includes('rate limit')) {
      return 'Trop de tentatives. Réessayez dans quelques minutes.'
    }
    if (message.includes('fetch') || message.includes('network') || message.includes('Network')) {
      return 'Impossible de joindre le serveur. Vérifiez votre connexion.'
    }
    return 'Une erreur est survenue. Réessayez.'
  }

  async function handleLogin() {
    setLoginError(null)
    if (!validate()) return
    setLoading(true)

    try {
      let result
      if (mode === 'licencie') {
        const [d, m, y] = birthdate.split('/')
        result = await signInLicencie(licenseNumber.trim(), `${y}-${m}-${d}`)
      } else {
        result = await signInWithEmail(email.trim(), password)
      }

      if (result.error) {
        setLoginError(classifyError(result.error.message))
        return
      }

      const userId = result.data?.user?.id
      if (!userId) return

      await useAuthStore.getState().fetchProfile(userId)
      const profile = useAuthStore.getState().profile

      if (!profile || !profile.profile_complete) {
        router.replace('/(auth)/complete-profile')
      } else if (profile.role === 'admin') {
        router.replace('/(admin)')
      } else {
        router.replace('/(app)')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      setLoginError(classifyError(message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} testID="screen-login" accessibilityLabel="screen-login">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / En-tête */}
          <View style={styles.header}>
            <Image
              source={require('../../logo/logoNoirPng.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>EGC Covoiturage</Text>
            <Text style={styles.tagline}>Réservé aux membres du club</Text>
          </View>

          {/* Sélecteur de mode */}
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'licencie' && styles.modeTabActive]}
              onPress={() => { setMode('licencie'); setErrors({}); setLoginError(null) }}
              testID="login-mode-licencie"
              accessibilityLabel="login-mode-licencie"
            >
              <Ionicons
                name="card-outline"
                size={16}
                color={mode === 'licencie' ? COLORS.primary : COLORS.textMuted}
              />
              <Text style={[styles.modeTabText, mode === 'licencie' && styles.modeTabTextActive]}>
                Licencié
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, mode === 'parent' && styles.modeTabActive]}
              onPress={() => { setMode('parent'); setErrors({}); setLoginError(null) }}
              testID="login-mode-parent"
              accessibilityLabel="login-mode-parent"
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={mode === 'parent' ? COLORS.primary : COLORS.textMuted}
              />
              <Text style={[styles.modeTabText, mode === 'parent' && styles.modeTabTextActive]}>
                Parent / Encadrant
              </Text>
            </TouchableOpacity>
          </View>

          {/* Formulaire */}
          <View style={styles.form}>
            {mode === 'licencie' ? (
              <>
                <Input
                  label="Numéro de licence"
                  placeholder="Ex : 123456"
                  value={licenseNumber}
                  onChangeText={(v) => { setLicenseNumber(v); setLoginError(null) }}
                  error={errors.licenseNumber}
                  icon="card-outline"
                  keyboardType="default"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <DatePickerInput
                  label="Date de naissance"
                  value={birthdate}
                  onChange={setBirthdate}
                  error={errors.birthdate}
                  maximumDate={new Date()}
                />
              </>
            ) : (
              <>
                <Input
                  label="Adresse email"
                  placeholder="votre@email.com"
                  value={email}
                  onChangeText={(v) => { setEmail(v); setLoginError(null) }}
                  error={errors.email}
                  icon="mail-outline"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="login-email"
                  accessibilityLabel="login-email"
                />
                <Input
                  label="Mot de passe"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setLoginError(null) }}
                  error={errors.password}
                  icon="lock-closed-outline"
                  isPassword
                  testID="login-password"
                  accessibilityLabel="login-password"
                />
              </>
            )}

            {loginError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                <Text style={styles.errorBannerText}>{loginError}</Text>
              </View>
            )}

            <Button
              label="Se connecter"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              style={styles.loginButton}
              testID="login-submit"
            />

            {mode === 'parent' && (
              <Text style={styles.registerHint}>
                Pas encore de compte ?{' '}
                <Text style={styles.registerLink} onPress={() => router.push('/(auth)/register')}>
                  Faire une demande
                </Text>
              </Text>
            )}
          </View>

          <Text style={styles.footer}>
            Accès réservé aux membres de l&apos;EGC.{'\n'}
            Pour toute aide, contactez l&apos;administration.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
    gap: SPACING.lg,
  },
  header: { alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  logo: {
    width: 120,
    height: 120,
  },
  appName: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  tagline: { fontSize: 14, color: COLORS.textSecondary },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  modeTabActive: { backgroundColor: COLORS.surface },
  modeTabText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  modeTabTextActive: { color: COLORS.primary, fontWeight: '600' },
  form: { gap: SPACING.md },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.errorLight,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.error,
    fontWeight: '500',
    lineHeight: 20,
  },
  loginButton: { marginTop: SPACING.xs },
  registerHint: { textAlign: 'center', fontSize: 13, color: COLORS.textSecondary },
  registerLink: { color: COLORS.primary, fontWeight: '600' },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginTop: SPACING.lg,
  },
})
