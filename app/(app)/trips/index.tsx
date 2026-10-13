import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTrips } from '@/hooks/useTrips'
import { useAuthStore } from '@/stores/auth.store'
import { TripCard } from '@/components/TripCard'
import { Button } from '@/components/ui/Button'
import { COLORS, SPACING, RADIUS } from '@/constants/theme'
import { TripType } from '@/types'

type Filter = 'tous' | TripType

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'tous',     label: 'Tous' },
  { key: 'ponctuel', label: 'Ponctuels' },
  { key: 'regulier', label: 'Réguliers' },
]

export default function TripsScreen() {
  const router = useRouter()
  const { profile } = useAuthStore()
  const [filter, setFilter] = useState<Filter>('tous')

  const { data: trips, isLoading, refetch } = useTrips({
    type: filter === 'tous' ? undefined : filter,
  })

  return (
    <SafeAreaView style={styles.safe} testID="screen-trips" accessibilityLabel="screen-trips">
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.title}>Trajets disponibles</Text>
        <Button
          label="+ Proposer"
          onPress={() => router.push('/(app)/trips/create')}
          size="sm"
        />
      </View>

      {/* Filtres */}
      <View style={styles.filtersWrapper}>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          keyExtractor={(f) => f.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text
                style={[styles.filterText, filter === item.key && styles.filterTextActive]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Liste */}
      <FlatList
        data={trips ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.primary} />
        }
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="car-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Aucun trajet trouvé</Text>
              <Text style={styles.emptyText}>
                Soyez le premier à proposer un trajet !
              </Text>
              <Button
                label="Proposer un trajet"
                onPress={() => router.push('/(app)/trips/create')}
                style={{ marginTop: SPACING.sm }}
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            currentUserId={profile?.id}
            onPress={() => router.push(`/(app)/trips/${item.id}`)}
          />
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  filtersWrapper: { paddingBottom: SPACING.sm },
  filters: { paddingHorizontal: SPACING.md, gap: SPACING.sm },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.textInverse, fontWeight: '600' },
  list: { padding: SPACING.md, paddingTop: 0, paddingBottom: SPACING.xl },
  empty: {
    alignItems: 'center',
    paddingTop: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
})
