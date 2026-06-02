import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { formatPhoneInput } from '@/lib/formatters'
import { FEATURE_AUTH_EMAIL_CONFIRMATION } from '@/constants/features'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { AddressInput } from '@/components/ui/AddressInput'
import { COLORS, SPACING, RADIUS, SHADOW } from '@/constants/theme'

export default function RegisterScreen() {
  const router = useRouter()

  const [firstName, setFirstName]   = useState('')
  const [lastName, setLastName]     = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [phone, setPhone]           = useState('')
  const [address, setAddress]       = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [loading, setLoading]       = useState(false)
  const [errors, setErrors]         = useState<Record<string, string>>({})
  const [submitted, setSubmitted]   = useState(false)

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!firstName.trim()) e.firstName = 'Prénom requis'
    if (!lastName.trim())  e.lastName  = 'Nom requis'
    if (!email.trim()) e.email = 'Email requis'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email invalide'
    if (!password || password.length < 8) e.password = 'Mot de passe : 8 caractères minimum'
    if (!phone.trim()) e.phone = 'Téléphone requis'
    else if (!/^(\+33|0)[1-9](\s?\d{2}){4}$/.test(phone.replace(/\s/g, '')))
      e.phone = 'Numéro invalide'
    if (!address.trim()) e.address = 'Adresse requise'
    if (!licenseNumber.trim()) e.licenseNumber = 'N° de licence d\'un enfant requis'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setLoading(true)

    try {
      // 1. Vérifier que le numéro de licence existe (via SECURITY DEFINER pour contourner le RLS)
      const { data: licenseResult, error: licenseError } = await supabase
        .rpc('verify_license_exists', { p_license: licenseNumber.trim() })

      if (licenseError || !licenseResult?.exists) {
        setErrors(e => ({ ...e, licenseNumber: 'Ce numéro de licence n\'existe pas dans le club' }))
        return
      }

      const licenseUser = {
        id:         licenseResult.id as string,
        first_name: licenseResult.first_name as string,
        last_name:  licenseResult.last_name as string,
      }

      // 2. Créer le compte Supabase Auth (non confirmé, en attente admin)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            role: 'parent',
            first_name: firstName.trim(),
            last_name:  lastName.trim(),
          },
        },
      })

      if (authError) {
        console.error('[register] auth.signUp error:', authError)
        if (
          authError.message.toLowerCase().includes('rate limit') ||
          authError.message.toLowerCase().includes('email rate') ||
          authError.message.toLowerCase().includes('too many')
        ) {
          Alert.alert(
            'Trop de tentatives',
            'Le nombre de demandes d\'inscription a été dépassé pour cette heure.\n\nRéessayez dans quelques minutes ou contactez l\'administration du club.',
          )
        } else if (authError.message.includes('already registered')) {
          setErrors(e => ({ ...e, email: 'Cet email est déjà utilisé' }))
        } else {
          Alert.alert('Erreur de création de compte', authError.message)
        }
        return
      }

      if (!authData.user) throw new Error('Création compte échouée')

      // 3 + 4 + 5. Profil, lien enfant et notification admins via SECURITY DEFINER
      const { error: registerError } = await supabase.rpc('register_parent_account', {
        p_auth_id:    authData.user.id,
        p_email:      email.trim(),
        p_first_name: firstName.trim(),
        p_last_name:  lastName.trim(),
        p_phone:      phone.trim(),
        p_address:    address.trim(),
        p_child_id:   licenseUser.id,
      })

      if (registerError) throw registerError

      setSubmitted(true)

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[register] unexpected error:', err)
      Alert.alert('Erreur', msg || 'Impossible de soumettre la demande. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
          </View>
          <Text style={styles.successTitle}>Demande envoyée !</Text>
          <Text style={styles.successText}>
            Votre demande d'inscription a été transmise à l'administrateur du club.
            {FEATURE_AUTH_EMAIL_CONFIRMATION
              ? '\n\nVérifiez votre boîte mail pour confirmer votre adresse email avant que votre compte soit activé.'
              : '\n\nVous serez contacté par l\'administration dès que votre compte sera validé.'
            }
          </Text>
          <Button
            label="Retour à la connexion"
            onPress={() => router.replace('/(auth)/login')}
            fullWidth
            style={{ marginTop: SPACING.xl }}
          />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require('../../logo/logoNoirPng.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Demande d'inscription</Text>
            <Text style={styles.subtitle}>
              Réservé aux parents de licenciés EGC.{'\n'}
              Votre compte sera activé après validation par l'administration.
            </Text>
          </View>

          {/* Formulaire */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Vos informations</Text>

            <View style={styles.nameRow}>
              <Input
                label="Prénom *"
                placeholder="Marie"
                value={firstName}
                onChangeText={(v) => { setFirstName(v); setErrors(e => ({ ...e, firstName: '' })) }}
                error={errors.firstName}
                autoCapitalize="words"
                containerStyle={styles.halfInput}
              />
              <Input
                label="Nom *"
                placeholder="Martin"
                value={lastName}
                onChangeText={(v) => { setLastName(v); setErrors(e => ({ ...e, lastName: '' })) }}
                error={errors.lastName}
                autoCapitalize="words"
                containerStyle={styles.halfInput}
              />
            </View>

            <Input
              label="Email *"
              placeholder="votre@email.com"
              value={email}
              onChangeText={(v) => { setEmail(v); setErrors(e => ({ ...e, email: '' })) }}
              error={errors.email}
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Input
              label="Mot de passe * (8 caractères min.)"
              placeholder="••••••••"
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors(e => ({ ...e, password: '' })) }}
              error={errors.password}
              icon="lock-closed-outline"
              isPassword
            />

            <Input
              label="Téléphone *"
              placeholder="06 XX XX XX XX"
              value={phone}
              onChangeText={(v) => { setPhone(formatPhoneInput(v)); setErrors(e => ({ ...e, phone: '' })) }}
              error={errors.phone}
              icon="call-outline"
              keyboardType="phone-pad"
            />

            <AddressInput
              label="Adresse *"
              placeholder="12 rue des Acacias, Lyon"
              value={address}
              onSelect={(addr) => { setAddress(addr); setErrors(e => ({ ...e, address: '' })) }}
              error={errors.address}
            />
          </View>

          {/* N° licence enfant */}
          <View style={styles.card}>
            <View style={styles.licenseHeader}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
              <Text style={styles.sectionLabel}>Vérification d'appartenance</Text>
            </View>
            <Text style={styles.licenseHint}>
              Renseignez le numéro de licence d'un de vos enfants licenciés à l'EGC.
              Cela nous permet de vérifier que vous êtes bien membre du club.
            </Text>
            <Input
              label="Numéro de licence de votre enfant *"
              placeholder="Ex : 123456"
              value={licenseNumber}
              onChangeText={(v) => { setLicenseNumber(v); setErrors(e => ({ ...e, licenseNumber: '' })) }}
              error={errors.licenseNumber}
              icon="card-outline"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Button
            label="Envoyer la demande"
            onPress={handleSubmit}
            loading={loading}
            fullWidth
          />

          <Button
            label="J'ai déjà un compte"
            onPress={() => router.back()}
            variant="ghost"
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  flex:   { flex: 1 },
  scroll: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xl },

  header:   { alignItems: 'center', gap: SPACING.sm, paddingBottom: SPACING.sm },
  logo:     { width: 80, height: 80 },
  title:    { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm,
  },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  nameRow:      { flexDirection: 'row', gap: SPACING.sm },
  halfInput:    { flex: 1 },

  licenseHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  licenseHint:   { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },

  successContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: SPACING.xl, gap: SPACING.md,
  },
  successIcon:  { marginBottom: SPACING.sm },
  successTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  successText:  { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
})
