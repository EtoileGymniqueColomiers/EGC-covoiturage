import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DatePickerInput } from '@/components/ui/DatePickerInput'
import { useAuthStore } from '@/stores/auth.store'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { COLORS, SPACING, RADIUS } from '@/constants/theme'
import { UserProfile, UserRole } from '@/types'

const PAGE_SIZE = 15

const ROLE_LABELS: Record<UserRole, string> = {
  licencie:  'Licencié',
  parent:    'Parent',
  encadrant: 'Encadrant',
  admin:     'Admin',
}

const ROLE_VARIANT: Record<UserRole, 'info' | 'success' | 'warning' | 'neutral'> = {
  licencie:  'info',
  parent:    'success',
  encadrant: 'warning',
  admin:     'neutral',
}

export default function UsersScreen() {
  const { profile: adminProfile } = useAuthStore()
  const queryClient = useQueryClient()

  const [search, setSearch]           = useState('')
  const [limit, setLimit]             = useState(PAGE_SIZE)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => { setLimit(PAGE_SIZE) }, [search])

  // Création licencié
  const [licenseNumber, setLicenseNumber]   = useState('')
  const [firstName, setFirstName]           = useState('')
  const [lastName, setLastName]             = useState('')
  const [birthdate, setBirthdate]           = useState('')
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [createErrors, setCreateErrors]     = useState<Record<string, string>>({})

  const { data: queryResult, isLoading, refetch } = useQuery({
    queryKey: ['admin_users', search, limit],
    queryFn: async () => {
      let query = supabase
        .from('users')
        .select('*, user_groups(group_id, groups(id, name))', { count: 'exact' })
        .neq('role', 'admin')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (search.trim()) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,license_number.ilike.%${search}%`
        )
      }

      const { data, count } = await query
      return { users: (data ?? []) as UserProfile[], total: count ?? 0 }
    },
  })

  const users      = queryResult?.users ?? []
  const totalUsers = queryResult?.total ?? 0
  const hasMore    = users.length < totalUsers

  const pendingUsers = (users ?? []).filter(u => !u.is_active && u.role !== 'licencie')

  const approveUser = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from('users').update({ is_active: true }).eq('id', userId)
      await supabase.from('admin_audit_log').insert({
        admin_id: adminProfile?.id,
        action: 'approve_registration',
        target_type: 'user',
        target_id: userId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] })
      queryClient.invalidateQueries({ queryKey: ['admin_audit'] })
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] })
    },
  })

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await supabase.from('groups').select('id, name').order('name')
      return data ?? []
    },
  })

  const suspendUser = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      await supabase.from('users').update({
        is_active: false,
        suspended_at: new Date().toISOString(),
        suspended_reason: reason,
      }).eq('id', userId)

      await supabase.from('admin_audit_log').insert({
        admin_id: adminProfile?.id,
        action: 'suspend_user',
        target_type: 'user',
        target_id: userId,
        reason,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] })
      queryClient.invalidateQueries({ queryKey: ['admin_audit'] })
    },
  })

  const reactivateUser = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from('users').update({
        is_active: true,
        suspended_at: null,
        suspended_reason: null,
      }).eq('id', userId)

      await supabase.from('admin_audit_log').insert({
        admin_id: adminProfile?.id,
        action: 'reactivate_user',
        target_type: 'user',
        target_id: userId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] })
      queryClient.invalidateQueries({ queryKey: ['admin_audit'] })
    },
  })

  const deleteMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('admin_delete_member', { p_user_id: userId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] })
      queryClient.invalidateQueries({ queryKey: ['admin_audit'] })
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] })
    },
    onError: (err: Error) => Alert.alert('Erreur', err.message),
  })

  const createLicencie = useMutation({
    mutationFn: async () => {
      const [d, m, y] = birthdate.split('/')
      const birthdateFmt = `${y}-${m}-${d}`

      const { error } = await supabase.rpc('admin_create_licencie', {
        p_license_number: licenseNumber.trim(),
        p_birthdate:      birthdateFmt,
        p_first_name:     firstName.trim(),
        p_last_name:      lastName.trim(),
        p_group_ids:      selectedGroupIds.length > 0 ? selectedGroupIds : null,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] })
      queryClient.invalidateQueries({ queryKey: ['admin_audit'] })
      queryClient.invalidateQueries({ queryKey: ['admin_stats'] })
      setShowCreateModal(false)
      resetCreateForm()
      Alert.alert('Compte créé', `Le licencié ${firstName} ${lastName} peut maintenant se connecter.`)
    },
    onError: (err: Error) => {
      Alert.alert('Erreur', err.message)
    },
  })

  function resetCreateForm() {
    setLicenseNumber(''); setFirstName(''); setLastName('')
    setBirthdate(''); setSelectedGroupIds([]); setCreateErrors({})
  }

  function validateCreate(): boolean {
    const e: Record<string, string> = {}
    if (!licenseNumber.trim()) e.licenseNumber = 'Numéro de licence requis'
    if (!birthdate.trim()) e.birthdate = 'Date de naissance requise'
    else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(birthdate)) e.birthdate = 'Format : JJ/MM/AAAA'
    setCreateErrors(e)
    return Object.keys(e).length === 0
  }

  function handleDelete(user: UserProfile) {
    const name = `${user.first_name} ${user.last_name}`

    const details: Record<string, string> = {
      licencie:
        `• Tous les trajets créés par ce licencié\n• Toutes ses réservations\n• Ses conversations et messages\n• Son lien avec son compte parent\n\nLe compte parent ne sera pas supprimé.`,
      parent:
        `• Tous les trajets créés par ce parent\n• Toutes ses réservations\n• Ses conversations et messages\n• Ses liens avec ses enfants licenciés\n\nLes comptes licenciés ne seront pas supprimés.`,
      encadrant:
        `• Tous les trajets créés par cet encadrant\n• Toutes ses réservations\n• Ses conversations et messages`,
    }

    const roleLabel = ROLE_LABELS[user.role] ?? user.role
    const detail = details[user.role] ?? ''

    Alert.alert(
      '⚠️ Suppression définitive',
      `Vous êtes sur le point de supprimer définitivement le compte ${roleLabel} de ${name}.\n\nCette action supprimera :\n${detail}\n\n⚠️ Cette action est IRRÉVERSIBLE.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: () => deleteMember.mutate(user.id),
        },
      ]
    )
  }

  function handleSuspend(user: UserProfile) {
    Alert.prompt(
      'Suspendre le compte',
      `Raison de la suspension de ${user.first_name} ${user.last_name} :`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Suspendre',
          style: 'destructive',
          onPress: (reason) => {
            if (reason) suspendUser.mutate({ userId: user.id, reason })
          },
        },
      ],
      'plain-text'
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Membres</Text>
        <Button label="+ Créer licencié" onPress={() => setShowCreateModal(true)} size="sm" />
      </View>

      {/* Demandes en attente */}
      {pendingUsers.length > 0 && (
        <View style={styles.pendingSection}>
          <Text style={styles.pendingSectionTitle}>
            ⏳ Demandes en attente ({pendingUsers.length})
          </Text>
          {pendingUsers.map((u) => (
            <View key={u.id} style={styles.pendingCard}>
              <View style={styles.pendingInfo}>
                <Text style={styles.pendingName}>{u.first_name} {u.last_name}</Text>
                <Text style={styles.pendingEmail}>{u.email}</Text>
                <Text style={styles.pendingRole}>Parent / Encadrant</Text>
              </View>
              <View style={styles.pendingActions}>
                <Button
                  label="Refuser"
                  onPress={() => suspendUser.mutate({ userId: u.id, reason: 'Demande refusée' })}
                  variant="outline"
                  size="sm"
                />
                <Button
                  label="Valider"
                  onPress={() => approveUser.mutate(u.id)}
                  size="sm"
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Recherche */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un membre..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={COLORS.textMuted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.primary} />
        }
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        ListFooterComponent={() => (
          <View style={styles.footer}>
            <Text style={styles.footerCount}>{users.length} / {totalUsers} membres</Text>
            {hasMore && (
              <Button
                label={`Charger plus (${totalUsers - users.length} restants)`}
                onPress={() => setLimit(prev => prev + PAGE_SIZE)}
                variant="outline"
                size="sm"
              />
            )}
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.userCard, !item.is_active && styles.userCardSuspended]}>
            <Avatar firstName={item.first_name} lastName={item.last_name} size={44} />
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>
                  {item.first_name || '—'} {item.last_name || '—'}
                </Text>
                <Badge
                  label={ROLE_LABELS[item.role] ?? item.role}
                  variant={ROLE_VARIANT[item.role] ?? 'neutral'}
                />
              </View>
              {item.license_number && (
                <Text style={styles.userDetail}>Licence : {item.license_number}</Text>
              )}
              {(item.user_groups ?? []).length > 0 && (
                <Text style={styles.userDetail}>
                  {(item.user_groups ?? [])
                    .map((ug: any) => ug.groups?.name)
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              )}
              {!item.is_active && (
                <Text style={styles.suspendedLabel}>⛔ Suspendu</Text>
              )}
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                onPress={() =>
                  item.is_active
                    ? handleSuspend(item)
                    : reactivateUser.mutate(item.id)
                }
                style={styles.actionBtn}
              >
                <Ionicons
                  name={item.is_active ? 'ban-outline' : 'checkmark-circle-outline'}
                  size={22}
                  color={item.is_active ? COLORS.error : COLORS.success}
                />
              </TouchableOpacity>

              {item.role !== 'admin' && (
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  style={styles.actionBtn}
                >
                  <Ionicons name="trash-outline" size={22} color={COLORS.error} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      {/* Modal création licencié */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Créer un compte licencié</Text>
            <TouchableOpacity onPress={() => { setShowCreateModal(false); resetCreateForm() }}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Input
              label="Numéro de licence *"
              placeholder="Ex : 123456"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              error={createErrors.licenseNumber}
              icon="card-outline"
              autoCapitalize="none"
            />
            <DatePickerInput
              label="Date de naissance * (= mot de passe initial)"
              value={birthdate}
              onChange={setBirthdate}
              error={createErrors.birthdate}
              hint="Le licencié se connectera avec cette date comme mot de passe"
              maximumDate={new Date()}
            />
            <View style={styles.nameRow}>
              <Input label="Prénom" placeholder="Marie" value={firstName} onChangeText={setFirstName} containerStyle={styles.halfInput} autoCapitalize="words" />
              <Input label="Nom"    placeholder="Martin" value={lastName} onChangeText={setLastName} containerStyle={styles.halfInput} autoCapitalize="words" />
            </View>

            <View>
              <Text style={styles.fieldLabel}>Groupes d'entraînement</Text>
              <Text style={styles.fieldHint}>Plusieurs groupes possibles</Text>
              <View style={styles.groupsList}>
                {groups?.map((g) => {
                  const active = selectedGroupIds.includes(g.id)
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.groupChip, active && styles.groupChipActive]}
                      onPress={() =>
                        setSelectedGroupIds(prev =>
                          active ? prev.filter(id => id !== g.id) : [...prev, g.id]
                        )
                      }
                    >
                      {active && (
                        <Ionicons name="checkmark" size={12} color={COLORS.textInverse} style={{ marginRight: 4 }} />
                      )}
                      <Text style={[styles.groupChipText, active && styles.groupChipTextActive]}>
                        {g.name}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            <Button
              label="Créer le compte"
              onPress={() => { if (validateCreate()) createLicencie.mutate() }}
              loading={createLicencie.isPending}
              fullWidth
              style={{ marginTop: SPACING.md }}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.md, marginBottom: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, height: 44 },
  searchIcon: { marginRight: SPACING.sm },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  list: { padding: SPACING.md, paddingTop: 0, paddingBottom: SPACING.xl },
  pendingSection:      { marginHorizontal: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm },
  pendingSectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.warning },
  pendingCard: { backgroundColor: COLORS.warningLight, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.warning, gap: SPACING.sm },
  pendingInfo: { gap: 2 },
  pendingName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  pendingEmail: { fontSize: 12, color: COLORS.textSecondary },
  pendingRole: { fontSize: 11, color: COLORS.textMuted },
  pendingActions: { flexDirection: 'row', gap: SPACING.sm },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  userCardSuspended: { opacity: 0.6, borderColor: COLORS.error },
  userInfo: { flex: 1, gap: 3 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  userName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  userDetail: { fontSize: 12, color: COLORS.textMuted },
  suspendedLabel: { fontSize: 12, color: COLORS.error, fontWeight: '600' },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingVertical: SPACING.lg, alignItems: 'center', gap: SPACING.sm },
  footerCount: { fontSize: 12, color: COLORS.textMuted },
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalContent: { padding: SPACING.md, gap: SPACING.md },
  nameRow: { flexDirection: 'row', gap: SPACING.sm },
  halfInput: { flex: 1 },
  fieldLabel: { fontSize: 14, fontWeight: '500', color: COLORS.text, marginBottom: 2 },
  fieldHint:  { fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.sm },
  groupsList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  groupChip: { paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  groupChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  groupChipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  groupChipTextActive: { color: COLORS.textInverse, fontWeight: '600' },
})
