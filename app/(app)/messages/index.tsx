import React from 'react'
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
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useConversations } from '@/hooks/useMessages'
import { useAuthStore } from '@/stores/auth.store'
import { Avatar } from '@/components/ui/Avatar'
import { Conversation } from '@/types'
import { COLORS, SPACING, RADIUS } from '@/constants/theme'

export default function MessagesScreen() {
  const router = useRouter()
  const { profile } = useAuthStore()
  const { data: conversations, isLoading, refetch } = useConversations(profile?.id ?? '')

  function getOtherUser(conv: Conversation) {
    return conv.user_a_id === profile?.id ? conv.user_b : conv.user_a
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      <FlatList
        data={conversations ?? []}
        keyExtractor={(c) => c.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.primary} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubble-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Aucun message</Text>
              <Text style={styles.emptyText}>
                Vos conversations avec les conducteurs et passagers apparaîtront ici.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const other = getOtherUser(item)
          return (
            <TouchableOpacity
              style={styles.convRow}
              onPress={() => router.push(`/(app)/messages/${item.id}`)}
              activeOpacity={0.8}
            >
              <Avatar firstName={other?.first_name} lastName={other?.last_name} size={48} />
              <View style={styles.convContent}>
                <View style={styles.convHeader}>
                  <Text style={styles.convName}>
                    {other?.first_name} {other?.last_name}
                  </Text>
                  {item.created_at && (
                    <Text style={styles.convTime}>
                      {formatDistanceToNow(new Date(item.created_at), { locale: fr, addSuffix: true })}
                    </Text>
                  )}
                </View>
                {item.trip && (
                  <Text style={styles.convTrip} numberOfLines={1}>
                    🚗 {item.trip.departure_address} → {item.trip.arrival_address}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )
        }}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  list: { padding: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xl },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  convContent: { flex: 1 },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  convTime: { fontSize: 11, color: COLORS.textMuted },
  convTrip: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  empty: { alignItems: 'center', paddingTop: SPACING.xxl, gap: SPACING.sm },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', maxWidth: 280 },
})
