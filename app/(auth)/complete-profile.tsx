import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase, signOut } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { AddressInput } from '@/components/ui/AddressInput'
import { formatPhoneInput } from '@/lib/formatters'
import { COLORS, SPACING, RADIUS, SHADOW } from '@/constants/theme'

const CAR_OPTIONS = [
  { value: 0, label: 'Je n\'ai pas de voiture' },
  { value: 1, label: '1 place disponible' },
  { value: 2, label: '2 places disponibles' },
  { value: 3, label: '3 places disponibles' },
  { value: 4, label: '4 places disponibles' },
  { value: 5, label: '5 places disponibles' },
]

export default function CompleteProfileScreen() {
  const { session, profile, fetchProfile } = useAuthStore()
  const [loading, setLoading]   = useState(false)
  const [step, setStep]         = useState<1 | 2>(1)

  const [email, setEmail]             = useState('')
  const [phone, setPhone]             = useState('')
  const [address, setAddress]         = useState('')
  const [addressLat, setAddressLat]   = useState<number | undefined>()
  const [addressLng, setAddressLng]   = useState<number | undefined>()
  const [carCapacity, setCarCapacity] = useState<number | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [errors, setErrors]           = useState<Record<string, string>>({})

  const isLicencie = profile?.role === 'licencie'

  const selectedLabel = carCapacity !== null
    ? CAR_OPTIONS.find(o => o.value === carCapacity)?.label
    : null

  function validateStep1(): boolean {
    const e: Record<string, string> = {}
    if (isLicencie) {
      if (!email.trim()) e.email = 'Adresse email requise'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Adresse email invalide'
    }
    if (!address.trim()) e.address = 'Votre adresse est nécessaire pour les suggestions de trajets'
    if (!phone.trim()) e.phone = 'Le téléphone est obligatoire'
    else if (!/^(\+33|0)[1-9](\s?\d{2}){4}$/.test(phone.replace(/\s/g, '')))
      e.phone = 'Numéro de téléphone invalide'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep2(): boolean {
    const e: Record<string, string> = {}
    if (carCapacity === null) e.car = 'Veuillez sélectionner une option'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validateStep2() || !session) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          ...(isLicencie && email.trim() ? { email: email.trim() } : {}),
          phone:            phone.trim(),
          address:          address.trim(),
          lat:              addressLat ?? null,
          lng:              addressLng ?? null,
          car_capacity:     carCapacity ?? 0,
          profile_complete: true,
        })
        .eq('auth_id', session.user.id)

      if (error) throw error
      await fetchProfile(session.user.id)
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder. Réessayez.')
    } finally {
      setLoading(false)
    }
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
          {/* ── Logo ── */}
          <View style={styles.header}>
            <Image
              source={require('../../logo/logoNoirPng.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* ── Bienvenue ── */}
          <View style={styles.welcome}>
            <Text style={styles.welcomeTitle}>
              Bienvenue{profile?.first_name ? `, ${profile.first_name}` : ''} ! 👋
            </Text>
            <Text style={styles.welcomeSubtitle}>
              Avant de commencer, prenons 30 secondes pour compléter votre profil.
              Cela permettra aux autres membres de vous trouver facilement.
            </Text>
          </View>

          {/* ── Progression ── */}
          <View style={styles.progressRow}>
            <View style={styles.progressStep}>
              <View style={[styles.progressDot, styles.progressDotActive]}>
                {step > 1
                  ? <Ionicons name="checkmark" size={14} color={COLORS.textInverse} />
                  : <Text style={styles.progressDotText}>1</Text>
                }
              </View>
              <Text style={[styles.progressLabel, step === 1 && styles.progressLabelActive]}>
                Coordonnées
              </Text>
            </View>
            <View style={[styles.progressLine, step > 1 && styles.progressLineActive]} />
            <View style={styles.progressStep}>
              <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]}>
                <Text style={[styles.progressDotText, step >= 2 && styles.progressDotTextActive]}>
                  2
                </Text>
              </View>
              <Text style={[styles.progressLabel, step === 2 && styles.progressLabelActive]}>
                Transport
              </Text>
            </View>
          </View>

          {/* ══ ÉTAPE 1 — Coordonnées ══ */}
          {step === 1 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons name="location" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>Vos coordonnées</Text>
                  <Text style={styles.cardSubtitle}>
                    Pour calculer la distance avec les trajets disponibles
                  </Text>
                </View>
              </View>

              <View style={styles.fields}>
                {isLicencie && (
                  <Input
                    label="Adresse email *"
                    placeholder="votre@email.com"
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v)
                      if (v.trim()) setErrors(e => ({ ...e, email: '' }))
                    }}
                    error={errors.email}
                    icon="mail-outline"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    hint="Utilisée pour les notifications de réservation"
                  />
                )}
                <AddressInput
                  label="Adresse *"
                  placeholder="12 rue des Acacias, Lyon"
                  value={address}
                  onSelect={(addr, lat, lng) => {
                    setAddress(addr)
                    setAddressLat(lat)
                    setAddressLng(lng)
                  }}
                  error={errors.address}
                />
                <Input
                  label="Téléphone *"
                  placeholder="06 XX XX XX XX"
                  value={phone}
                  onChangeText={(v) => setPhone(formatPhoneInput(v))}
                  error={errors.phone}
                  icon="call-outline"
                  keyboardType="phone-pad"
                  hint="Partagé uniquement avec vos covoitureurs confirmés"
                />
              </View>

              <Button
                label="Continuer →"
                onPress={() => { if (validateStep1()) setStep(2) }}
                fullWidth
              />
            </View>
          )}

          {/* ══ ÉTAPE 2 — Transport ══ */}
          {step === 2 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons name="car" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>Avez-vous une voiture ?</Text>
                  <Text style={styles.cardSubtitle}>
                    Combien d&apos;enfants pouvez-vous emmener en plus des vôtres ?
                  </Text>
                </View>
              </View>

              {/* Liste déroulante */}
              <View>
                <Text style={styles.dropdownLabel}>Nombre de places disponibles *</Text>

                <TouchableOpacity
                  style={[styles.dropdown, dropdownOpen && styles.dropdownOpen, !!errors.car && styles.dropdownError]}
                  onPress={() => { setDropdownOpen(v => !v); setErrors({}) }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dropdownValue, !selectedLabel && styles.dropdownPlaceholder]}>
                    {selectedLabel ?? 'Sélectionnez une option...'}
                  </Text>
                  <Ionicons
                    name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>

                {/* Options déroulées inline */}
                {dropdownOpen && (
                  <View style={styles.dropdownList}>
                    {CAR_OPTIONS.map((opt, index) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.dropdownItem,
                          carCapacity === opt.value && styles.dropdownItemSelected,
                          index === CAR_OPTIONS.length - 1 && styles.dropdownItemLast,
                        ]}
                        onPress={() => {
                          setCarCapacity(opt.value)
                          setDropdownOpen(false)
                          setErrors({})
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.dropdownItemText,
                          carCapacity === opt.value && styles.dropdownItemTextSelected,
                        ]}>
                          {opt.label}
                        </Text>
                        {carCapacity === opt.value && (
                          <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {errors.car && (
                  <Text style={styles.errorText}>{errors.car}</Text>
                )}
              </View>

              {/* Boutons étape 2 */}
              <View style={styles.stepBtns}>
                <Button
                  label="← Retour"
                  onPress={() => { setStep(1); setDropdownOpen(false) }}
                  variant="outline"
                  style={styles.backBtn}
                />
                <Button
                  label="C'est parti !"
                  onPress={handleSave}
                  loading={loading}
                  style={styles.nextBtn}
                />
              </View>
            </View>
          )}

          {/* ── Note confidentialité ── */}
          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.privacyText}>
              Vos informations sont visibles uniquement par les membres de l&apos;EGC.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  flex:   { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  header: { alignItems: 'center', paddingTop: SPACING.sm },
  logo:   { width: 100, height: 100 },

  welcome: { alignItems: 'center', gap: SPACING.sm },
  welcomeTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  welcomeSubtitle: {
    fontSize: 14, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 22, maxWidth: 320,
  },

  progressRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.xl,
  },
  progressStep:         { alignItems: 'center', gap: 6 },
  progressDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  progressDotActive:     { backgroundColor: COLORS.primary },
  progressDotText:       { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  progressDotTextActive: { color: COLORS.textInverse },
  progressLine:          { flex: 1, height: 2, backgroundColor: COLORS.border, marginBottom: 20 },
  progressLineActive:    { backgroundColor: COLORS.primary },
  progressLabel:         { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },
  progressLabelActive:   { color: COLORS.primary, fontWeight: '700' },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.md,
  },
  cardHeader:     { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  cardIcon: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  cardHeaderText: { flex: 1, gap: 4 },
  cardTitle:      { fontSize: 17, fontWeight: '700', color: COLORS.text },
  cardSubtitle:   { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  fields:         { gap: SPACING.md },

  // Boutons étape 1
  step1Btns:   { flexDirection: 'row', gap: SPACING.sm },
  logoutBtn:   { flex: 1 },
  continueBtn: { flex: 2 },

  // Boutons étape 2
  stepBtns: { flexDirection: 'row', gap: SPACING.sm },
  backBtn:  { flex: 1 },
  nextBtn:  { flex: 2 },

  // Dropdown
  dropdownLabel: {
    fontSize: 14, fontWeight: '500', color: COLORS.text, marginBottom: 6,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 13,
  },
  dropdownOpen:        { borderColor: COLORS.primary, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  dropdownError:       { borderColor: COLORS.error },
  dropdownValue:       { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  dropdownPlaceholder: { color: COLORS.textMuted, fontWeight: '400' },

  dropdownList: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: COLORS.primary,
    borderBottomLeftRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  dropdownItemSelected: { backgroundColor: COLORS.primaryLight },
  dropdownItemLast:     { borderBottomWidth: 0 },
  dropdownItemText:     { fontSize: 15, color: COLORS.text },
  dropdownItemTextSelected: { color: COLORS.primary, fontWeight: '600' },

  errorText: { fontSize: 12, color: COLORS.error, marginTop: 6 },

  privacyNote: {
    flexDirection: 'row', alignItems: 'center',
    gap: SPACING.sm, justifyContent: 'center',
  },
  privacyText: {
    fontSize: 12, color: COLORS.textMuted,
    textAlign: 'center', flex: 1, lineHeight: 18,
  },
})
