import React, { useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { Notification } from '@/types'
import { COLORS, SPACING, RADIUS } from '@/constants/theme'

// ─── Config des types de notification ────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  new_event:         { icon: 'calendar',               color: COLORS.primary,   bg: COLORS.primaryLight },
  booking_request:   { icon: 'person-add',             color: COLORS.warning,   bg: COLORS.warningLight },
  booking_accepte:   { icon: 'checkmark-circle',       color: COLORS.success,   bg: COLORS.successLight },
  booking_refuse:    { icon: 'close-circle',           color: COLORS.error,     bg: COLORS.errorLight },
  booking_annule:    { icon: 'remove-circle',          color: COLORS.textMuted, bg: COLORS.borderLight },
  new_message:       { icon: 'chatbubble',             color: COLORS.info,      bg: COLORS.infoLight },
}

const DEFAULT_CONFIG = { icon: 'notifications', color: COLORS.primary, bg: COLORS.primaryLight }

// ─── Composant ────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['notifications', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as Notification[]
    },
    enabled: !!profile?.id,
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', profile?.id ?? '')
        .is('read_at', null)
    },
    onSuccess: () => {
      queryClient.setQueryData(['notifications', 'unread-count', profile?.id], 0)
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Marquer toutes comme lues à l'ouverture
  useEffect(() => {
    if (profile?.id && notifications?.some(n => !n.read_at)) {
      markAllRead.mutate()
    }
  }, [profile?.id, notifications?.length])

  const unreadCount = notifications?.filter(n => !n.read_at).length ?? 0

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={notifications ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Aucune notification</Text>
              <Text style={styles.emptyText}>
                Vos réservations, événements et messages apparaîtront ici.
              </Text>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        renderItem={({ item }) => {
          const config = TYPE_CONFIG[item.type] ?? DEFAULT_CONFIG
          const isUnread = !item.read_at

          return (
            <View style={[styles.notifCard, isUnread && styles.notifCardUnread]}>
              {/* Icône */}
              <View style={[styles.iconWrap, { backgroundColor: config.bg }]}>
                <Ionicons name={config.icon as never} size={22} color={config.color} />
              </View>

              {/* Contenu */}
              <View style={styles.content}>
                <View style={styles.contentHeader}>
                  <Text style={[styles.notifTitle, isUnread && styles.notifTitleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {isUnread && <View style={styles.unreadDot} />}
                </View>
                {item.body && (
                  <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                )}
                <Text style={styles.notifTime}>
                  {formatDistanceToNow(new Date(item.created_at), { locale: fr, addSuffix: true })}
                </Text>
              </View>
            </View>
          )
        }}
      />
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  badge: {
    backgroundColor: COLORS.error, borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 2, minWidth: 22, alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  list: { padding: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xl },

  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  notifCardUnread: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },

  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  content:       { flex: 1 },
  contentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  notifTitle:    { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.textSecondary },
  notifTitleUnread: { color: COLORS.text, fontWeight: '700' },
  unreadDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginLeft: SPACING.sm },
  notifBody:     { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 4 },
  notifTime:     { fontSize: 11, color: COLORS.textMuted },

  empty:      { alignItems: 'center', paddingTop: SPACING.xxl, gap: SPACING.sm },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  emptyText:  { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', maxWidth: 280 },
})
