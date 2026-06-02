import React, { useState } from 'react'

const PAGE_SIZE = 5
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { COLORS, SPACING, RADIUS } from '@/constants/theme'
import { Group } from '@/types'

type GroupWithCount = Group & { member_count: number }
type Member = {
  id: string
  first_name: string | null
  last_name: string | null
  license_number: string | null
}

export default function GroupsScreen() {
  const queryClient = useQueryClient()

  const [limit, setLimit] = useState(PAGE_SIZE)

  // Modals
  const [editModal, setEditModal]     = useState<GroupWithCount | 'new' | null>(null)
  const [membersModal, setMembersModal] = useState<GroupWithCount | null>(null)
  const [memberSearch, setMemberSearch] = useState('')

  // Formulaire groupe
  const [formName, setFormName]   = useState('')
  const [formCoach, setFormCoach] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // ── Groupes avec nombre de membres ──────────────────────────────────────
  const { data: queryResult, isLoading, refetch } = useQuery({
    queryKey: ['admin_groups', limit],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('groups')
        .select('*, user_groups(user_id)', { count: 'exact' })
        .order('name')
        .limit(limit)
      if (error) throw error
      const groups = (data ?? []).map(g => ({
        ...g,
        member_count: Array.isArray(g.user_groups) ? g.user_groups.length : 0,
      })) as GroupWithCount[]
      return { groups, total: count ?? 0 }
    },
  })

  const groups      = queryResult?.groups ?? []
  const totalGroups = queryResult?.total ?? 0
  const hasMore     = groups.length < totalGroups

  // ── Membres du groupe sélectionné ───────────────────────────────────────
  const { data: members } = useQuery({
    queryKey: ['group_members', membersModal?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_groups')
        .select('users(id, first_name, last_name, license_number)')
        .eq('group_id', membersModal!.id)
      if (error) throw error
      return (data ?? [])
        .map((r: any) => r.users)
        .filter(Boolean) as Member[]
    },
    enabled: !!membersModal,
  })

  // ── Licenciés disponibles (pas encore dans le groupe) ───────────────────
  const { data: available } = useQuery({
    queryKey: ['available_licencies', membersModal?.id, members],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, license_number')
        .eq('role', 'licencie')
        .eq('is_active', true)
        .order('last_name')
      if (error) throw error
      const memberIds = new Set((members ?? []).map(m => m.id))
      return (data ?? []).filter(u => !memberIds.has(u.id)) as Member[]
    },
    enabled: !!membersModal && members !== undefined,
  })

  // ── Mutations ────────────────────────────────────────────────────────────
  const createGroup = useMutation({
    mutationFn: async ({ name, coach }: { name: string; coach: string }) => {
      const { error } = await supabase.from('groups').insert({
        name:       name.trim(),
        coach_name: coach.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setEditModal(null)
    },
    onError: (err: Error) => Alert.alert('Erreur', err.message),
  })

  const updateGroup = useMutation({
    mutationFn: async ({ id, name, coach }: { id: string; name: string; coach: string }) => {
      const { error } = await supabase.from('groups').update({
        name:       name.trim(),
        coach_name: coach.trim() || null,
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setEditModal(null)
    },
    onError: (err: Error) => Alert.alert('Erreur', err.message),
  })

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('groups').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_groups'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
    onError: (err: Error) => Alert.alert('Erreur', err.message),
  })

  const addMember = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const { error } = await supabase.from('user_groups').insert({
        group_id: groupId,
        user_id:  userId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group_members', membersModal?.id] })
      queryClient.invalidateQueries({ queryKey: ['available_licencies', membersModal?.id] })
      queryClient.invalidateQueries({ queryKey: ['admin_groups'] })
    },
    onError: (err: Error) => Alert.alert('Erreur', err.message),
  })

  const removeMember = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const { error } = await supabase.from('user_groups')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group_members', membersModal?.id] })
      queryClient.invalidateQueries({ queryKey: ['available_licencies', membersModal?.id] })
      queryClient.invalidateQueries({ queryKey: ['admin_groups'] })
    },
    onError: (err: Error) => Alert.alert('Erreur', err.message),
  })

  // ── Helpers ──────────────────────────────────────────────────────────────
  function openAdd() {
    setFormName(''); setFormCoach(''); setFormErrors({})
    setEditModal('new')
  }

  function openEdit(g: GroupWithCount) {
    setFormName(g.name); setFormCoach(g.coach_name ?? ''); setFormErrors({})
    setEditModal(g)
  }

  function confirmDelete(g: GroupWithCount) {
    Alert.alert(
      'Supprimer le groupe',
      `Supprimer « ${g.name} » ?\n\nLes ${g.member_count} licencié(s) seront retirés du groupe, leurs comptes ne seront pas supprimés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteGroup.mutate(g.id) },
      ]
    )
  }

  function confirmRemoveMember(member: Member) {
    if (!membersModal) return
    Alert.alert(
      'Retirer du groupe',
      `Retirer ${member.first_name} ${member.last_name} du groupe « ${membersModal.name} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => removeMember.mutate({ groupId: membersModal.id, userId: member.id }),
        },
      ]
    )
  }

  function handleSaveGroup() {
    const e: Record<string, string> = {}
    if (!formName.trim()) e.name = 'Le nom est requis'
    setFormErrors(e)
    if (Object.keys(e).length > 0) return

    if (editModal === 'new') {
      createGroup.mutate({ name: formName, coach: formCoach })
    } else if (editModal) {
      updateGroup.mutate({ id: editModal.id, name: formName, coach: formCoach })
    }
  }

  const filteredAvailable = (available ?? []).filter(u => {
    if (!memberSearch.trim()) return true
    const q = memberSearch.toLowerCase()
    return (
      `${u.first_name ?? ''} ${u.last_name ?? ''}`.toLowerCase().includes(q) ||
      (u.license_number ?? '').toLowerCase().includes(q)
    )
  })

  // ── Rendu ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Groupes</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={22} color={COLORS.surface} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={g => g.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.primary} />
        }
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        ListFooterComponent={() =>
          groups.length > 0 ? (
            <View style={styles.footer}>
              <Text style={styles.footerCount}>{groups.length} / {totalGroups} groupe{totalGroups !== 1 ? 's' : ''}</Text>
              {hasMore && (
                <Button
                  label={`Charger plus (${totalGroups - groups.length} restants)`}
                  onPress={() => setLimit(prev => prev + PAGE_SIZE)}
                  variant="outline"
                  size="sm"
                />
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="people-circle-outline" size={56} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Aucun groupe</Text>
              <Text style={styles.emptyHint}>Appuyez sur + pour créer le premier groupe d'entraînement</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name="people" size={22} color={COLORS.primary} />
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{item.name}</Text>
              {item.coach_name ? (
                <Text style={styles.cardCoach}>Coach : {item.coach_name}</Text>
              ) : null}
              <Text style={styles.cardCount}>
                {item.member_count} licencié{item.member_count !== 1 ? 's' : ''}
              </Text>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => { setMemberSearch(''); setMembersModal(item) }}
              >
                <Ionicons name="person-add-outline" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
                <Ionicons name="create-outline" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(item)}>
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* ══════════════════════════════════════════
          Modal — Créer / Modifier un groupe
      ══════════════════════════════════════════ */}
      <Modal
        visible={editModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModal(null)}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editModal === 'new' ? 'Nouveau groupe' : 'Modifier le groupe'}
            </Text>
            <TouchableOpacity onPress={() => setEditModal(null)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Input
              label="Nom du groupe *"
              placeholder="Ex : U12 Mixte, Compétition Élite, Loisir adulte…"
              value={formName}
              onChangeText={v => { setFormName(v); setFormErrors(e => ({ ...e, name: '' })) }}
              error={formErrors.name}
              icon="people-outline"
              autoCapitalize="words"
            />
            <Input
              label="Coach responsable"
              placeholder="Prénom et nom du coach"
              value={formCoach}
              onChangeText={setFormCoach}
              icon="person-outline"
              autoCapitalize="words"
            />
            <Button
              label={editModal === 'new' ? 'Créer le groupe' : 'Enregistrer les modifications'}
              onPress={handleSaveGroup}
              loading={createGroup.isPending || updateGroup.isPending}
              fullWidth
              style={{ marginTop: SPACING.sm }}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════════
          Modal — Gestion des membres
      ══════════════════════════════════════════ */}
      <Modal
        visible={membersModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setMembersModal(null); setMemberSearch('') }}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{membersModal?.name}</Text>
              <Text style={styles.modalSubtitle}>
                {(members ?? []).length} membre{(members ?? []).length !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setMembersModal(null); setMemberSearch('') }}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.membersContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Ajouter un licencié */}
            <Text style={styles.sectionLabel}>Ajouter un licencié</Text>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={16} color={COLORS.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Nom ou numéro de licence…"
                value={memberSearch}
                onChangeText={setMemberSearch}
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
              />
              {memberSearch.length > 0 && (
                <TouchableOpacity onPress={() => setMemberSearch('')}>
                  <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {memberSearch.length > 0 && (
              <View style={styles.availableList}>
                {filteredAvailable.length === 0 ? (
                  <Text style={styles.noResultText}>Aucun licencié trouvé</Text>
                ) : (
                  filteredAvailable.slice(0, 12).map(u => (
                    <View key={u.id} style={styles.memberRow}>
                      <Avatar firstName={u.first_name} lastName={u.last_name} size={36} />
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{u.first_name} {u.last_name}</Text>
                        {u.license_number && (
                          <Text style={styles.memberLicense}>#{u.license_number}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          membersModal && addMember.mutate({ groupId: membersModal.id, userId: u.id })
                        }
                      >
                        <Ionicons name="add-circle" size={30} color={COLORS.success} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Membres actuels */}
            <Text style={[styles.sectionLabel, { marginTop: SPACING.lg }]}>
              Membres actuels
            </Text>

            {(members ?? []).length === 0 ? (
              <View style={styles.emptyMembers}>
                <Text style={styles.emptyMembersText}>
                  Ce groupe n'a pas encore de membres.{'\n'}
                  Utilisez la recherche ci-dessus pour en ajouter.
                </Text>
              </View>
            ) : (
              (members ?? []).map(m => (
                <View key={m.id} style={styles.memberRow}>
                  <Avatar firstName={m.first_name} lastName={m.last_name} size={36} />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{m.first_name} {m.last_name}</Text>
                    {m.license_number && (
                      <Text style={styles.memberLicense}>#{m.license_number}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => confirmRemoveMember(m)}>
                    <Ionicons name="remove-circle" size={30} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: SPACING.md,
  },
  title:  { fontSize: 22, fontWeight: '800', color: COLORS.text },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  list: { padding: SPACING.md, paddingTop: 0, paddingBottom: SPACING.xl },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody:    { flex: 1, gap: 3 },
  cardName:    { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardCoach:   { fontSize: 13, color: COLORS.textSecondary },
  cardCount:   { fontSize: 12, color: COLORS.textMuted },
  cardActions: { flexDirection: 'row', gap: 4 },
  actionBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  footer:      { paddingVertical: SPACING.lg, alignItems: 'center', gap: SPACING.sm },
  footerCount: { fontSize: 12, color: COLORS.textMuted },

  empty:      { alignItems: 'center', paddingTop: SPACING.xl * 2, gap: SPACING.md },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptyHint:  { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: SPACING.xl },

  modal:        { flex: 1, backgroundColor: COLORS.background },
  modalHeader:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle:    { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  modalContent:  { padding: SPACING.md, gap: SPACING.md },

  membersContent: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
  sectionLabel:   { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    height: 44, marginTop: SPACING.xs,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },

  availableList: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  noResultText: { padding: SPACING.md, color: COLORS.textMuted, textAlign: 'center', fontSize: 13 },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  memberInfo:    { flex: 1 },
  memberName:    { fontSize: 14, fontWeight: '600', color: COLORS.text },
  memberLicense: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  emptyMembers:     { padding: SPACING.lg, alignItems: 'center' },
  emptyMembersText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
})
