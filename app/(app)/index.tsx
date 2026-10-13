import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { useTrips } from '@/hooks/useTrips'
import { TripCard } from '@/components/TripCard'
import { Button } from '@/components/ui/Button'
import { COLORS, SPACING, RADIUS, SHADOW } from '@/constants/theme'
import { supabase } from '@/lib/supabase'
import { Event } from '@/types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function HomeScreen() {
  const router = useRouter()
  const { profile } = useAuthStore()

  const { data: trips, isLoading, refetch } = useTrips({
    groupId: profile?.group_id ?? undefined,
  })

  const upcomingTrips = (trips ?? []).slice(0, 3)

  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ['home_events', profile?.id],
    queryFn: async () => {
      if (!profile) return []
      const today = new Date().toISOString().split('T')[0]

      // Groupes du licencié
      const { data: userGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', profile.id)

      const myGroupIds = new Set((userGroups ?? []).map((ug: any) => ug.group_id as string))

      const { data } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(10)

      return ((data ?? []) as Event[])
        .filter(e =>
          !e.group_ids?.length ||
          e.group_ids.some(gid => myGroupIds.has(gid))
        )
        .slice(0, 3)
    },
    enabled: !!profile,
    staleTime: 1000 * 60 * 5,
  })

  function formatGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bonjour'
    if (hour < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }

  function formatNextSession() {
    if (!profile?.group?.schedule?.length) return null
    return profile.group.schedule[0]
  }

  const nextSession = formatNextSession()

  return (
    <SafeAreaView style={styles.safe} testID="screen-home" accessibilityLabel="screen-home">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.primary} />
        }
      >
        {/* En-tête */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {formatGreeting()}, {profile?.first_name} 👋
            </Text>
            {nextSession && (
              <Text style={styles.nextSession}>
                Prochain entraînement : {nextSession.day} à {nextSession.time}
              </Text>
            )}
          </View>
        </View>

        {/* Actions rapides */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionCard, styles.actionOffer]}
            onPress={() => router.push('/(app)/trips/create')}
            activeOpacity={0.85}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="car" size={24} color={COLORS.textInverse} />
            </View>
            <Text style={styles.actionTitle}>Je propose</Text>
            <Text style={styles.actionSub}>un trajet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.actionSearch]}
            onPress={() => router.push('/(app)/trips')}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIcon, styles.actionIconOutline]}>
              <Ionicons name="search" size={24} color={COLORS.primary} />
            </View>
            <Text style={[styles.actionTitle, styles.actionTitleOutline]}>Je cherche</Text>
            <Text style={[styles.actionSub, styles.actionSubOutline]}>un trajet</Text>
          </TouchableOpacity>
        </View>

        {/* Trajets de mon groupe */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {profile?.group?.name
                ? `Trajets — ${profile.group.name}`
                : 'Trajets disponibles'}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(app)/trips')}>
              <Text style={styles.seeAll}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Chargement...</Text>
            </View>
          ) : upcomingTrips.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Aucun trajet disponible pour l'instant</Text>
              <Button
                label="Proposer le premier trajet"
                onPress={() => router.push('/(app)/trips/create')}
                variant="outline"
                size="sm"
                style={{ marginTop: SPACING.sm }}
              />
            </View>
          ) : (
            <View style={styles.tripsList}>
              {upcomingTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  currentUserId={profile?.id}
                  onPress={() => router.push(`/(app)/trips/${trip.id}`)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Événements à venir */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Événements à venir</Text>
          </View>

          {upcomingEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Aucun événement prévu pour ton groupe</Text>
            </View>
          ) : (
            <View style={styles.eventsList}>
              {upcomingEvents.map(event => {
                const dateStr = format(new Date(event.event_date), 'd MMM yyyy', { locale: fr })
                const endStr  = event.is_multi_day && event.end_date
                  ? ` → ${format(new Date(event.end_date), 'd MMM', { locale: fr })}`
                  : ''
                return (
                  <View key={event.id} style={styles.eventCard}>
                    <View style={styles.eventDateBadge}>
                      <Text style={styles.eventDay}>
                        {format(new Date(event.event_date), 'd', { locale: fr })}
                      </Text>
                      <Text style={styles.eventMonth}>
                        {format(new Date(event.event_date), 'MMM', { locale: fr })}
                      </Text>
                    </View>
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
                      <View style={styles.eventMeta}>
                        <Ionicons name="location-outline" size={12} color={COLORS.textMuted} />
                        <Text style={styles.eventLocation} numberOfLines={1}>{event.location}</Text>
                      </View>
                      <Text style={styles.eventDate}>{dateStr}{endStr}</Text>
                    </View>
                    {event.is_multi_day && (
                      <View style={styles.multiDayBadge}>
                        <Text style={styles.multiDayText}>Multi-jours</Text>
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* Rappel sécurité */}
        <View style={styles.safetyBanner}>
          <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
          <Text style={styles.safetyText}>
            Application réservée aux membres de l&apos;EGC. Tous les profils sont vérifiés.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xl },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  nextSession: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },

  actions: { flexDirection: 'row', gap: SPACING.sm },
  actionCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 4,
    ...SHADOW.sm,
  },
  actionOffer: { backgroundColor: COLORS.primary },
  actionSearch: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  actionIconOutline: { backgroundColor: COLORS.primaryLight },
  actionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textInverse },
  actionTitleOutline: { color: COLORS.primary },
  actionSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  actionSubOutline: { color: COLORS.textSecondary },

  section: { gap: SPACING.sm },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  seeAll: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  tripsList: { gap: SPACING.sm },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },

  eventsList: { gap: SPACING.sm },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  eventDateBadge: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDay:   { fontSize: 16, fontWeight: '800', color: COLORS.primary, lineHeight: 18 },
  eventMonth: { fontSize: 10, fontWeight: '600', color: COLORS.primary, textTransform: 'uppercase' },
  eventInfo:  { flex: 1, gap: 2 },
  eventName:  { fontSize: 14, fontWeight: '700', color: COLORS.text },
  eventMeta:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  eventLocation: { fontSize: 12, color: COLORS.textMuted, flex: 1 },
  eventDate:  { fontSize: 11, color: COLORS.textSecondary },
  multiDayBadge: {
    backgroundColor: COLORS.infoLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  multiDayText: { fontSize: 10, fontWeight: '600', color: COLORS.info },

  safetyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  safetyText: { flex: 1, fontSize: 12, color: COLORS.primary, lineHeight: 18 },
})
