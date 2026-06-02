import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { supabase, signOut } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { COLORS, SPACING, RADIUS } from '@/constants/theme'

export default function AdminDashboard() {
  const router = useRouter()
  const { clearAuth } = useAuthStore()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true)
            try {
              await signOut()
            } finally {
              // Force la réinitialisation du store et la redirection
              // même si Supabase met du temps à répondre
              clearAuth()
              router.replace('/(auth)/login')
              setSigningOut(false)
            }
          },
        },
      ]
    )
  }

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['admin_stats'],
    queryFn: async () => {
      const [users, trips, bookings, pendingBookings] = await Promise.all([
        supabase.from('users').select('id, role, is_active, created_at', { count: 'exact' }),
        supabase.from('trips').select('id, status', { count: 'exact' }).eq('status', 'actif'),
        supabase.from('bookings').select('id', { count: 'exact' }).eq('status', 'accepte'),
        supabase.from('bookings').select('id', { count: 'exact' }).eq('status', 'en_attente'),
      ])
      return {
        totalUsers:      users.count ?? 0,
        activeTrips:     trips.count ?? 0,
        acceptedBookings: bookings.count ?? 0,
        pendingBookings:  pendingBookings.count ?? 0,
        suspended:        (users.data ?? []).filter((u) => !u.is_active).length,
      }
    },
  })

  const { data: recentAudit } = useQuery({
    queryKey: ['admin_audit'],
    queryFn: async () => {
      const { data } = await supabase
        .from('admin_audit_log')
        .select('*, admin:users!admin_id(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(5)
      return data ?? []
    },
  })

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Administration EGC</Text>
          <Text style={styles.subtitle}>Tableau de bord</Text>
        </View>
        <Button label="Déconnexion" onPress={handleSignOut} loading={signingOut} variant="outline" size="sm" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.primary} />
        }
      >
        {/* Statistiques */}
        <View style={styles.statsGrid}>
          <StatCard icon="people"       label="Membres"           value={stats?.totalUsers ?? '—'}      color={COLORS.primary} />
          <StatCard icon="car"          label="Trajets actifs"    value={stats?.activeTrips ?? '—'}     color={COLORS.success} />
          <StatCard icon="checkmark-circle" label="Confirmés"    value={stats?.acceptedBookings ?? '—'} color={COLORS.info} />
          <StatCard icon="time"         label="En attente"        value={stats?.pendingBookings ?? '—'}  color={COLORS.warning} />
        </View>

        {stats?.suspended && stats.suspended > 0 ? (
          <View style={styles.alertBanner}>
            <Ionicons name="warning-outline" size={20} color={COLORS.warning} />
            <Text style={styles.alertText}>
              {stats.suspended} compte{stats.suspended > 1 ? 's' : ''} suspendu{stats.suspended > 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}

        {/* Journal d'audit */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Actions récentes</Text>
          {recentAudit?.length === 0 && (
            <Text style={styles.emptyText}>Aucune action enregistrée</Text>
          )}
          {recentAudit?.map((log) => (
            <View key={log.id} style={styles.auditRow}>
              <View style={styles.auditDot} />
              <View style={styles.auditContent}>
                <Text style={styles.auditAction}>{log.action}</Text>
                <Text style={styles.auditAdmin}>
                  par {log.admin?.first_name} {log.admin?.last_name}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({
  icon, label, value, color,
}: { icon: string; label: string; value: number | string; color: string }) {
  return (
    <View style={[statStyles.card, { borderLeftColor: color }]}>
      <Ionicons name={icon as never} size={24} color={color} />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  )
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderLeftWidth: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  value: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  label: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
})

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: SPACING.md },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textSecondary },
  scroll: { padding: SPACING.md, paddingTop: 0, gap: SPACING.md, paddingBottom: SPACING.xl },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.warningLight, padding: SPACING.md, borderRadius: RADIUS.md },
  alertText: { fontSize: 14, color: COLORS.warning, fontWeight: '600' },
  section: { gap: SPACING.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
  auditRow: { flexDirection: 'row', gap: SPACING.sm, paddingVertical: SPACING.xs },
  auditDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 6 },
  auditContent: { flex: 1 },
  auditAction: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  auditAdmin: { fontSize: 11, color: COLORS.textMuted },
})
