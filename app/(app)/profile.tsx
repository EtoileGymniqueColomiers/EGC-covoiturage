import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/stores/auth.store'
import { supabase, signOut } from '@/lib/supabase'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AddressInput } from '@/components/ui/AddressInput'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatPhoneInput } from '@/lib/formatters'
import { COLORS, SPACING, RADIUS } from '@/constants/theme'

const ROLE_LABELS: Record<string, string> = {
  licencie:  'Licencié',
  parent:    'Parent',
  encadrant: 'Encadrant',
  admin:     'Administrateur',
}

export default function ProfileScreen() {
  const { profile, session, fetchProfile } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)

  const [firstName, setFirstName]     = useState(profile?.first_name ?? '')
  const [lastName, setLastName]       = useState(profile?.last_name ?? '')
  const [email, setEmail]             = useState(profile?.email ?? '')
  const [phone, setPhone]             = useState(profile?.phone ?? '')
  const [address, setAddress]         = useState(profile?.address ?? '')
  const [carCapacity, setCarCapacity] = useState(profile?.car_capacity ?? 0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [errors, setErrors]           = useState<Record<string, string>>({})

  const isLicencie = profile?.role === 'licencie'

  const CAR_OPTIONS = [
    { value: 0, label: 'Je n\'ai pas de voiture' },
    { value: 1, label: '1 place disponible' },
    { value: 2, label: '2 places disponibles' },
    { value: 3, label: '3 places disponibles' },
    { value: 4, label: '4 places disponibles' },
    { value: 5, label: '5 places disponibles' },
  ]

  const selectedCarLabel = CAR_OPTIONS.find(o => o.value === carCapacity)?.label ?? 'Sélectionner...'

  function openEdit() {
    setFirstName(profile?.first_name ?? '')
    setLastName(profile?.last_name ?? '')
    setEmail(profile?.email ?? '')
    setPhone(profile?.phone ?? '')
    setAddress(profile?.address ?? '')
    setCarCapacity(profile?.car_capacity ?? 0)
    setDropdownOpen(false)
    setErrors({})
    setEditing(true)
  }

  function cancelEdit() {
    setDropdownOpen(false)
    setErrors({})
    setEditing(false)
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!firstName.trim()) e.firstName = 'Prénom requis'
    if (!lastName.trim())  e.lastName  = 'Nom requis'
    if (isLicencie) {
      if (!email.trim()) e.email = 'Email requis'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email invalide'
    }
    if (!phone.trim()) {
      e.phone = 'Le téléphone est obligatoire'
    } else if (!/^(\+33|0)[1-9](\s?\d{2}){4}$/.test(phone.replace(/\s/g, ''))) {
      e.phone = 'Numéro de téléphone invalide'
    }
    if (!address.trim()) {
      e.address = 'L\'adresse est obligatoire pour les suggestions de trajets'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate() || !session || !profile) return
    setLoading(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({
          first_name:   firstName.trim(),
          last_name:    lastName.trim(),
          ...(isLicencie ? { email: email.trim() } : {}),
          phone:        phone.trim(),
          address:      address.trim(),
          car_capacity: carCapacity,
        })
        .eq('id', profile.id)

      if (error) throw error
      await fetchProfile(session.user.id)
      setEditing(false)
      setErrors({})
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => { await signOut() },
        },
      ]
    )
  }

  if (!profile) return null

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Avatar + infos principales */}
        <View style={styles.profileHeader}>
          <Avatar firstName={profile.first_name} lastName={profile.last_name} size={72} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {profile.first_name} {profile.last_name}
            </Text>
            <Badge label={ROLE_LABELS[profile.role] ?? profile.role} variant="info" />
            {profile.group?.name && (
              <Text style={styles.groupName}>{profile.group.name}</Text>
            )}
          </View>
        </View>

        {/* Informations */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mes informations</Text>
            {!editing ? (
              <Button label="Modifier" onPress={openEdit} variant="ghost" size="sm" />
            ) : (
              <Button label="Annuler" onPress={cancelEdit} variant="ghost" size="sm" />
            )}
          </View>

          {!editing ? (
            <>
              {profile.role === 'licencie' && (
                <InfoRow icon="mail-outline" label="Email" value={
                  profile.email && !profile.email.includes('@egc.internal')
                    ? profile.email
                    : 'Non renseigné'
                } />
              )}
              <InfoRow icon="call-outline"     label="Téléphone" value={profile.phone ?? 'Non renseigné'} />
              <InfoRow icon="location-outline" label="Adresse"   value={profile.address ?? 'Non renseignée'} />
              <InfoRow icon="car-outline"      label="Places dans ma voiture" value={
                profile.car_capacity === 0
                  ? 'Je n\'ai pas de voiture'
                  : `${profile.car_capacity} place${profile.car_capacity > 1 ? 's' : ''}`
              } />
              {profile.license_number && (
                <InfoRow icon="card-outline" label="N° de licence" value={profile.license_number} />
              )}
            </>
          ) : (
            <View style={styles.editForm}>
              {/* Email — licenciés uniquement */}
              {isLicencie && (
                <Input
                  label="Email *"
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
                />
              )}
              <View style={styles.nameRow}>
                <Input
                  label="Prénom *"
                  placeholder="Marie"
                  value={firstName}
                  onChangeText={(v) => {
                    setFirstName(v)
                    if (v.trim()) setErrors((e) => ({ ...e, firstName: '' }))
                  }}
                  error={errors.firstName}
                  autoCapitalize="words"
                  containerStyle={styles.halfInput}
                />
                <Input
                  label="Nom *"
                  placeholder="Martin"
                  value={lastName}
                  onChangeText={(v) => {
                    setLastName(v)
                    if (v.trim()) setErrors((e) => ({ ...e, lastName: '' }))
                  }}
                  error={errors.lastName}
                  autoCapitalize="words"
                  containerStyle={styles.halfInput}
                />
              </View>
              <Input
                label="Téléphone *"
                placeholder="06 XX XX XX XX"
                value={phone}
                onChangeText={(v) => {
                  const formatted = formatPhoneInput(v)
                  setPhone(formatted)
                  if (formatted.trim()) setErrors((e) => ({ ...e, phone: '' }))
                }}
                error={errors.phone}
                icon="call-outline"
                keyboardType="phone-pad"
              />
              <AddressInput
                label="Adresse *"
                value={address}
                onSelect={(addr) => {
                  setAddress(addr)
                  if (addr.trim()) setErrors((e) => ({ ...e, address: '' }))
                }}
                error={errors.address}
                hint="Obligatoire pour les suggestions de trajets"
              />
              <View>
                <Text style={styles.fieldLabel}>Places dans ma voiture</Text>

                <TouchableOpacity
                  style={[styles.dropdown, dropdownOpen && styles.dropdownOpen]}
                  onPress={() => setDropdownOpen(v => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dropdownValue}>{selectedCarLabel}</Text>
                  <Ionicons
                    name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>

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
              </View>
              <Button label="Enregistrer" onPress={handleSave} loading={loading} fullWidth />
            </View>
          )}
        </Card>

        {/* Statistiques */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Mon activité</Text>
          <View style={styles.statsRow}>
            <StatBox icon="car-outline" label="Trajets proposés" value="—" />
            <StatBox icon="people-outline" label="Covoiturages" value="—" />
          </View>
        </Card>

        {/* Sécurité */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Compte</Text>
          <Button
            label="Se déconnecter"
            onPress={handleSignOut}
            variant="outline"
            fullWidth
          />
        </Card>

        <Text style={styles.version}>EGC Covoiturage v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Ionicons name={icon as never} size={18} color={COLORS.primary} style={infoStyles.icon} />
      <View style={infoStyles.content}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={infoStyles.value}>{value}</Text>
      </View>
    </View>
  )
}

function StatBox({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={statStyles.box}>
      <Ionicons name={icon as never} size={22} color={COLORS.primary} />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  )
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  icon: { marginTop: 2 },
  content: { flex: 1 },
  label: { fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', fontWeight: '600' },
  value: { fontSize: 14, color: COLORS.text, marginTop: 2 },
})

const statStyles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', gap: 4, padding: SPACING.md, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md },
  value: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  label: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },
})

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  profileInfo: { flex: 1, gap: SPACING.xs },
  profileName: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  groupName: { fontSize: 13, color: COLORS.textSecondary },
  section: { gap: SPACING.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  editForm:   { gap: SPACING.md },
  nameRow:    { flexDirection: 'row', gap: SPACING.sm },
  halfInput:  { flex: 1 },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: COLORS.text, marginBottom: 6 },

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
  dropdownOpen:         { borderColor: COLORS.primary, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  dropdownValue:        { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  dropdownList: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: COLORS.primary,
    borderBottomLeftRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    overflow: 'hidden',
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
  dropdownItemLast:     {},
  dropdownItemText:     { fontSize: 15, color: COLORS.text },
  dropdownItemTextSelected: { color: COLORS.primary, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  version: { textAlign: 'center', fontSize: 12, color: COLORS.textMuted, marginTop: SPACING.sm },
})
