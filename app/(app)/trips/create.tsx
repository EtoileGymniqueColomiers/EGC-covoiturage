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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/stores/auth.store'
import { useCreateTrip } from '@/hooks/useTrips'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { AddressInput } from '@/components/ui/AddressInput'
import { COLORS, SPACING, RADIUS } from '@/constants/theme'
import { TripType } from '@/types'
import { geocodeAddress } from '@/lib/geocoding'
import { formatTimeInput } from '@/lib/formatters'
import { DatePickerInput } from '@/components/ui/DatePickerInput'

type Step = 1 | 2 | 3

const TRIP_TYPES: { key: TripType; label: string; icon: string; desc: string }[] = [
  { key: 'ponctuel', label: 'Ponctuel',  icon: 'flash-outline',  desc: 'Trajet unique, besoin exceptionnel' },
  { key: 'regulier', label: 'Régulier',  icon: 'repeat-outline', desc: 'Trajet récurrent chaque semaine' },
]

export default function CreateTripScreen() {
  const router     = useRouter()
  const { profile } = useAuthStore()
  const createTrip  = useCreateTrip(profile?.id ?? '')

  const [step, setStep] = useState<Step>(1)

  // Étape 1 — Destination
  const [useProfileAddress, setUseProfileAddress] = useState(true)
  const [departureAddress, setDepartureAddress]   = useState('')
  const [arrivalAddress, setArrivalAddress]       = useState('')

  // Étape 2 — Détails
  const [type, setType]       = useState<TripType>('ponctuel')
  const [date, setDate]       = useState('')
  const [time, setTime]       = useState('')
  const [seats, setSeats]     = useState(2)
  const [comment, setComment] = useState('')
  const [stop, setStop]       = useState('')

  const [errors, setErrors]   = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const profileAddress = profile?.address ?? ''

  function validateStep1(): boolean {
    const e: Record<string, string> = {}
    if (!useProfileAddress && !departureAddress.trim()) {
      e.departure = 'Adresse de départ requise'
    }
    if (!useProfileAddress && !profileAddress && !departureAddress.trim()) {
      e.departure = 'Adresse de départ requise'
    }
    if (!arrivalAddress.trim()) {
      e.arrival = 'Adresse d\'arrivée requise'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep2(): boolean {
    const e: Record<string, string> = {}
    if (!date.trim()) e.date = 'Date requise'
    else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) e.date = 'Format : JJ/MM/AAAA'
    if (!time.trim()) e.time = 'Heure requise'
    else if (!/^\d{2}:\d{2}$/.test(time)) e.time = 'Format : HH:MM'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validateStep2() || !profile) return
    setLoading(true)

    try {
      const finalDeparture = useProfileAddress ? profileAddress : departureAddress
      const [d, m, y]      = date.split('/')
      const departureTime  = new Date(`${y}-${m}-${d}T${time}:00`).toISOString()

      const [depGeo, arrGeo] = await Promise.allSettled([
        geocodeAddress(finalDeparture),
        geocodeAddress(arrivalAddress),
      ])

      const depCoords = depGeo.status === 'fulfilled' ? depGeo.value : null
      const arrCoords = arrGeo.status === 'fulfilled' ? arrGeo.value : null

      await createTrip.mutateAsync({
        type,
        direction:         null,
        departure_address: finalDeparture,
        departure_lat:     depCoords?.lat,
        departure_lng:     depCoords?.lng,
        arrival_address:   arrivalAddress,
        arrival_lat:       arrCoords?.lat,
        arrival_lng:       arrCoords?.lng,
        departure_time:    departureTime,
        available_seats:   seats,
        comment:           comment.trim() || undefined,
        intermediate_stop: stop.trim() || undefined,
        group_id:          profile.group_id ?? undefined,
        is_offer:          true,
      })

      router.back()
      Alert.alert('Trajet publié !', 'Votre trajet est maintenant visible par les membres.')
    } catch {
      Alert.alert('Erreur', 'Impossible de publier le trajet. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  const progress = (step / 3) * 100

  return (
    <SafeAreaView style={styles.safe}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity
          onPress={() => (step > 1 ? setStep((s) => (s - 1) as Step) : router.back())}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Proposer un trajet</Text>
        <Text style={styles.stepIndicator}>{step}/3</Text>
      </View>

      {/* Barre de progression */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ══ ÉTAPE 1 — Destination ══ */}
          {step === 1 && (
            <View style={styles.stepContent}>

              <Text style={styles.stepTitle}>D'où partez-vous ?</Text>

              {/* Option 1 — Mon adresse */}
              <TouchableOpacity
                style={[styles.optionCard, useProfileAddress && styles.optionCardActive]}
                onPress={() => setUseProfileAddress(true)}
                activeOpacity={0.85}
              >
                <View style={[styles.optionRadio, useProfileAddress && styles.optionRadioActive]}>
                  {useProfileAddress && <View style={styles.optionRadioFill} />}
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, useProfileAddress && styles.optionTitleActive]}>
                    Mon adresse
                  </Text>
                  <Text style={styles.optionSub} numberOfLines={1}>
                    {profileAddress || 'Adresse non renseignée dans votre profil'}
                  </Text>
                </View>
                <Ionicons
                  name="home-outline"
                  size={20}
                  color={useProfileAddress ? COLORS.primary : COLORS.textMuted}
                />
              </TouchableOpacity>

              {/* Option 2 — Autre adresse */}
              <TouchableOpacity
                style={[styles.optionCard, !useProfileAddress && styles.optionCardActive]}
                onPress={() => setUseProfileAddress(false)}
                activeOpacity={0.85}
              >
                <View style={[styles.optionRadio, !useProfileAddress && styles.optionRadioActive]}>
                  {!useProfileAddress && <View style={styles.optionRadioFill} />}
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, !useProfileAddress && styles.optionTitleActive]}>
                    Autre adresse
                  </Text>
                  <Text style={styles.optionSub}>Saisir un point de départ différent</Text>
                </View>
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={!useProfileAddress ? COLORS.primary : COLORS.textMuted}
                />
              </TouchableOpacity>

              {!useProfileAddress && (
                <AddressInput
                  label="Adresse de départ"
                  placeholder="12 rue des Acacias, Ville"
                  value={departureAddress}
                  onSelect={(addr) => setDepartureAddress(addr)}
                  error={errors.departure}
                />
              )}

              <Text style={[styles.stepTitle, { marginTop: SPACING.sm }]}>
                Où allez-vous ?
              </Text>

              <AddressInput
                label="Adresse d'arrivée *"
                placeholder="Ex : Gymnase de Lyon, 12 rue du Sport"
                value={arrivalAddress}
                onSelect={(addr) => setArrivalAddress(addr)}
                error={errors.arrival}
              />
            </View>
          )}

          {/* ══ ÉTAPE 2 — Détails ══ */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Détails du trajet</Text>

              {/* Type — 2 options uniquement */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Type de trajet</Text>
                <View style={styles.typeRow}>
                  {TRIP_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.typeCard, type === t.key && styles.typeCardActive]}
                      onPress={() => setType(t.key)}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={t.icon as never}
                        size={26}
                        color={type === t.key ? COLORS.primary : COLORS.textMuted}
                      />
                      <Text style={[styles.typeLabel, type === t.key && styles.typeLabelActive]}>
                        {t.label}
                      </Text>
                      <Text style={[styles.typeDesc, type === t.key && styles.typeDescActive]}>
                        {t.desc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Date & Heure */}
              <View style={styles.row}>
                <DatePickerInput
                  label="Date *"
                  value={date}
                  onChange={setDate}
                  error={errors.date}
                  minimumDate={new Date()}
                  containerStyle={styles.halfInput}
                />
                <Input
                  label="Heure *"
                  placeholder="HH:MM"
                  value={time}
                  onChangeText={(raw) => setTime(formatTimeInput(raw))}
                  error={errors.time}
                  icon="time-outline"
                  keyboardType="numeric"
                  containerStyle={styles.halfInput}
                />
              </View>

              {/* Nombre de places */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Nombre de places</Text>
                <View style={styles.seatsRow}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[styles.seatBtn, seats === n && styles.seatBtnActive]}
                      onPress={() => setSeats(n)}
                    >
                      <Text style={[styles.seatBtnText, seats === n && styles.seatBtnTextActive]}>
                        {n}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <AddressInput
                label="Arrêt intermédiaire (optionnel)"
                placeholder="Ex : Aire de Mâcon sur l'A6"
                value={stop}
                onSelect={(addr) => setStop(addr)}
              />

              <Input
                label="Commentaire (optionnel)"
                placeholder="Ex : Je passe chercher sur Bourg si besoin..."
                value={comment}
                onChangeText={setComment}
                multiline
              />
            </View>
          )}

          {/* ══ ÉTAPE 3 — Récapitulatif ══ */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Récapitulatif</Text>

              <View style={styles.summaryCard}>
                <SummaryRow
                  icon="home-outline"
                  label="Départ"
                  value={useProfileAddress ? (profileAddress || 'Mon adresse') : departureAddress}
                />
                <SummaryRow icon="flag-outline"     label="Arrivée" value={arrivalAddress} />
                <SummaryRow icon="calendar-outline" label="Date"    value={`${date} à ${time}`} />
                <SummaryRow icon="people-outline"   label="Places"  value={`${seats} place${seats > 1 ? 's' : ''}`} />
                <SummaryRow
                  icon="flash-outline"
                  label="Type"
                  value={type === 'regulier' ? 'Régulier (hebdomadaire)' : 'Ponctuel'}
                />
                {comment ? (
                  <SummaryRow icon="chatbubble-outline" label="Note" value={comment} />
                ) : null}
              </View>

              <Text style={styles.confirmNote}>
                En publiant, ce trajet sera visible par tous les membres du club.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Bouton de navigation */}
        <View style={styles.footer}>
          {step < 3 ? (
            <Button
              label={step === 1 ? 'Continuer' : 'Vérifier le trajet'}
              onPress={() => {
                if (step === 1 && validateStep1()) setStep(2)
                else if (step === 2 && validateStep2()) setStep(3)
              }}
              fullWidth
            />
          ) : (
            <Button
              label="Publier le trajet"
              onPress={handleSubmit}
              loading={loading}
              fullWidth
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={summaryStyles.row}>
      <Ionicons name={icon as never} size={18} color={COLORS.primary} />
      <View style={summaryStyles.content}>
        <Text style={summaryStyles.label}>{label}</Text>
        <Text style={summaryStyles.value}>{value}</Text>
      </View>
    </View>
  )
}

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  content: { flex: 1 },
  label:   { fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', fontWeight: '600' },
  value:   { fontSize: 14, color: COLORS.text, fontWeight: '500', marginTop: 2 },
})

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.background },
  flex:          { flex: 1 },
  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle:      { fontSize: 16, fontWeight: '700', color: COLORS.text },
  stepIndicator: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600', width: 40, textAlign: 'right' },
  progressBar:   { height: 3, backgroundColor: COLORS.border },
  progressFill:  { height: 3, backgroundColor: COLORS.primary },
  scroll:        { padding: SPACING.md, paddingBottom: SPACING.xl },
  stepContent:   { gap: SPACING.md },
  stepTitle:     { fontSize: 18, fontWeight: '700', color: COLORS.text },

  // Options de départ
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border,
  },
  optionCardActive:  { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  optionRadio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  optionRadioActive: { borderColor: COLORS.primary },
  optionRadioFill:   { width: 11, height: 11, borderRadius: 6, backgroundColor: COLORS.primary },
  optionContent:     { flex: 1 },
  optionTitle:       { fontSize: 15, fontWeight: '600', color: COLORS.text },
  optionTitleActive: { color: COLORS.primary },
  optionSub:         { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  // Types de trajet — 2 cartes larges
  field:       { gap: SPACING.sm },
  fieldLabel:  { fontSize: 14, fontWeight: '500', color: COLORS.text },
  typeRow:     { flexDirection: 'row', gap: SPACING.md },
  typeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    minHeight: 110,
  },
  typeCardActive:  { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  typeLabel:       { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary, textAlign: 'center' },
  typeLabelActive: { color: COLORS.primary },
  typeDesc:        { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', lineHeight: 15 },
  typeDescActive:  { color: COLORS.primary },

  row:       { flexDirection: 'row', gap: SPACING.sm },
  halfInput: { flex: 1 },

  seatsRow: { flexDirection: 'row', gap: SPACING.sm },
  seatBtn: {
    flex: 1, height: 48, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  seatBtnActive:    { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  seatBtnText:      { fontSize: 16, fontWeight: '700', color: COLORS.textSecondary },
  seatBtnTextActive:{ color: COLORS.textInverse },

  summaryCard:  { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  confirmNote:  { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  footer: {
    padding: SPACING.md, paddingBottom: SPACING.lg,
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
  },

  errorText: { fontSize: 12, color: COLORS.error },
})
