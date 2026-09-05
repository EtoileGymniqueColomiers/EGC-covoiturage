import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  RefreshControl,
  Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { DatePickerInput } from '@/components/ui/DatePickerInput'
import { useAuthStore } from '@/stores/auth.store'
import { Input } from '@/components/ui/Input'
import { AddressInput } from '@/components/ui/AddressInput'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { COLORS, SPACING, RADIUS } from '@/constants/theme'
import { Event } from '@/types'

export default function EventsScreen() {
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  // Formulaire
  const [name, setName]                       = useState('')
  const [eventDate, setEventDate]             = useState('')
  const [endDate, setEndDate]                 = useState('')
  const [isMultiDay, setIsMultiDay]           = useState(false)
  const [location, setLocation]               = useState('')
  const [locationLat, setLocationLat]         = useState<number | null>(null)
  const [locationLng, setLocationLng]         = useState<number | null>(null)
  const [description, setDescription]         = useState('')
  const [accommodationNote, setAccommodationNote] = useState('')
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [formErrors, setFormErrors]           = useState<Record<string, string>>({})

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data } = await supabase.from('groups').select('id, name').order('name')
      return data ?? []
    },
  })

  function toggleGroup(id: string) {
    setSelectedGroupIds(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    )
  }

  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true })
      return (data ?? []) as Event[]
    },
  })

  const createEvent = useMutation({
    mutationFn: async () => {
      const [d, m, y] = eventDate.split('/')
      const dateFormatted = `${y}-${m}-${d}`

      let endDateFormatted: string | null = null
      if (isMultiDay && endDate.trim()) {
        const [ed, em, ey] = endDate.split('/')
        endDateFormatted = `${ey}-${em}-${ed}`
      }

      // group_ids n'est inclus que si des groupes sont sélectionnés
      // (évite l'erreur si la migration 005 n'a pas encore été appliquée)
      const payload: Record<string, unknown> = {
        name:               name.trim(),
        event_date:         dateFormatted,
        end_date:           endDateFormatted,
        is_multi_day:       isMultiDay,
        location:           location.trim(),
        lat:                locationLat,
        lng:                locationLng,
        description:        description.trim() || null,
        accommodation_note: isMultiDay ? (accommodationNote.trim() || null) : null,
        created_by:         profile?.id,
      }
      if (selectedGroupIds.length > 0) {
        payload.group_ids = selectedGroupIds
      }

      const { error } = await supabase.from('events').insert(payload)
      if (error) throw error

      await supabase.from('admin_audit_log').insert({
        admin_id:    profile?.id,
        action:      'create_event',
        target_type: 'event',
        reason:      name,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['admin_audit'] })
      setShowModal(false)
      resetForm()
    },
    onError: (err: Error) => {
      console.error('[events] create error:', err)
      Alert.alert('Impossible de créer l\'événement', err.message || 'Vérifiez votre connexion et réessayez.')
    },
  })

  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      await supabase.from('events').delete().eq('id', eventId)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Nom requis'
    if (!eventDate.trim()) e.eventDate = 'Date requise'
    else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(eventDate)) e.eventDate = 'Format : JJ/MM/AAAA'
    if (isMultiDay && endDate && !/^\d{2}\/\d{2}\/\d{4}$/.test(endDate)) e.endDate = 'Format : JJ/MM/AAAA'
    if (!location.trim()) e.location = 'Lieu requis'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  function resetForm() {
    setName(''); setEventDate(''); setEndDate('')
    setIsMultiDay(false); setLocation(''); setLocationLat(null); setLocationLng(null)
    setDescription(''); setAccommodationNote(''); setSelectedGroupIds([]); setFormErrors({})
  }

  function handleDelete(event: Event) {
    Alert.alert(
      'Supprimer l\'événement',
      `Supprimer "${event.name}" ? Les trajets associés seront dissociés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteEvent.mutate(event.id) },
      ]
    )
  }

  const now = new Date().toISOString().split('T')[0]
  const upcoming = (events ?? []).filter((e) => e.event_date >= now)
  const past     = (events ?? []).filter((e) => e.event_date < now)

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Événements</Text>
        <Button label="+ Ajouter" onPress={() => setShowModal(true)} size="sm" />
      </View>

      <FlatList
        data={[...upcoming, ...past]}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.primary} />
        }
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Aucun événement</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isPast = item.event_date < now
          return (
            <View style={[styles.eventCard, isPast && styles.eventCardPast]}>
              <View style={styles.eventHeader}>
                <View style={styles.eventTitleRow}>
                  <Text style={styles.eventName}>{item.name}</Text>
                  {item.is_multi_day && <Badge label="Multi-jours" variant="info" />}
                  {isPast && <Badge label="Passé" variant="neutral" />}
                </View>
                <TouchableOpacity onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                </TouchableOpacity>
              </View>

              <View style={styles.eventDetails}>
                <View style={styles.eventRow}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.eventDetail}>
                    {format(new Date(item.event_date), 'd MMMM yyyy', { locale: fr })}
                    {item.is_multi_day && item.end_date
                      ? ` → ${format(new Date(item.end_date), 'd MMMM yyyy', { locale: fr })}`
                      : ''}
                  </Text>
                </View>
                <View style={styles.eventRow}>
                  <Ionicons name="location-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.eventDetail}>{item.location}</Text>
                </View>
                {item.accommodation_note && (
                  <View style={styles.eventRow}>
                    <Ionicons name="bed-outline" size={14} color={COLORS.warning} />
                    <Text style={styles.eventDetail}>{item.accommodation_note}</Text>
                  </View>
                )}
              </View>
            </View>
          )
        }}
      />

      {/* Modal création */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouvel événement</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); resetForm() }}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Input label="Nom de l'événement *" placeholder="Championnat Régional" value={name} onChangeText={setName} error={formErrors.name} icon="trophy-outline" />
            <DatePickerInput label="Date *" value={eventDate} onChange={setEventDate} error={formErrors.eventDate} minimumDate={new Date()} />
            <AddressInput
              label="Lieu *"
              placeholder="Gymnase de Lyon, 12 rue du Sport"
              value={location}
              onSelect={(addr, lat, lng) => {
                setLocation(addr)
                setLocationLat(lat ?? null)
                setLocationLng(lng ?? null)
                setFormErrors(e => ({ ...e, location: '' }))
              }}
              error={formErrors.location}
            />
            <Input label="Description (optionnel)" placeholder="Informations complémentaires..." value={description} onChangeText={setDescription} multiline />

            {/* Multi-jours */}
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.switchTitle}>Événement sur plusieurs jours</Text>
                <Text style={styles.switchSub}>Week-end, stage avec nuitée</Text>
              </View>
              <Switch
                value={isMultiDay}
                onValueChange={setIsMultiDay}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.textInverse}
              />
            </View>

            {isMultiDay && (
              <>
                <DatePickerInput label="Date de fin" value={endDate} onChange={setEndDate} error={formErrors.endDate} minimumDate={new Date()} />
                <Input label="Hébergement (optionnel)" placeholder="Ex : Gymnase de Grenoble — nuit du samedi" value={accommodationNote} onChangeText={setAccommodationNote} icon="bed-outline" multiline />
              </>
            )}

            {/* Groupes concernés */}
            <View>
              <Text style={styles.fieldLabel}>Groupes concernés</Text>
              <Text style={styles.fieldHint}>
                {selectedGroupIds.length === 0
                  ? 'Aucun sélectionné → tous les membres seront notifiés'
                  : `${selectedGroupIds.length} groupe(s) sélectionné(s)`}
              </Text>
              <View style={styles.groupsGrid}>
                {(groups ?? []).map((g) => {
                  const selected = selectedGroupIds.includes(g.id)
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.groupChip, selected && styles.groupChipSelected]}
                      onPress={() => toggleGroup(g.id)}
                      activeOpacity={0.8}
                    >
                      {selected && (
                        <Ionicons name="checkmark" size={14} color={COLORS.textInverse} style={{ marginRight: 4 }} />
                      )}
                      <Text style={[styles.groupChipText, selected && styles.groupChipTextSelected]}>
                        {g.name}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>

            <Button
              label="Créer l'événement"
              onPress={() => { if (validate()) createEvent.mutate() }}
              loading={createEvent.isPending}
              fullWidth
              style={{ marginTop: SPACING.sm }}
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
  list: { padding: SPACING.md, paddingTop: 0, paddingBottom: SPACING.xl },
  empty: { alignItems: 'center', paddingTop: SPACING.xxl, gap: SPACING.sm },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
  eventCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  eventCardPast: { opacity: 0.6 },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  eventName: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  eventDetails: { gap: SPACING.xs },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  eventDetail: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalContent: { padding: SPACING.md, gap: SPACING.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  switchLabel: { flex: 1 },
  fieldLabel:  { fontSize: 14, fontWeight: '500', color: COLORS.text, marginBottom: 4 },
  fieldHint:   { fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.sm },
  groupsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  groupChip:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border },
  groupChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  groupChipText:         { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  groupChipTextSelected: { color: COLORS.textInverse, fontWeight: '600' },
  switchTitle: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  switchSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
})
