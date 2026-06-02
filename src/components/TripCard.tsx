import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Trip } from '@/types'
import { Avatar } from './ui/Avatar'
import { Badge } from './ui/Badge'
import { COLORS, RADIUS, SHADOW, SPACING } from '@/constants/theme'

interface TripCardProps {
  trip: Trip
  onPress: () => void
  currentUserId?: string
}

const TYPE_LABELS: Record<string, string> = {
  regulier: 'Régulier',
  ponctuel: 'Ponctuel',
  evenement: 'Compétition',
}

const ROLE_LABELS: Record<string, string> = {
  licencie:  'Licencié',
  parent:    'Parent',
  encadrant: 'Encadrant',
  admin:     'Admin',
}

export function TripCard({ trip, onPress, currentUserId }: TripCardProps) {
  const available = trip.available_seats - trip.booked_seats
  const isDriver = trip.driver_id === currentUserId
  const departureDate = new Date(trip.departure_time)

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      {/* En-tête : type + date */}
      <View style={styles.header}>
        <Badge
          label={TYPE_LABELS[trip.type] ?? trip.type}
          variant={trip.type === 'evenement' ? 'info' : trip.type === 'regulier' ? 'success' : 'neutral'}
        />
        <Text style={styles.date}>
          {format(departureDate, "EEE d MMM · HH'h'mm", { locale: fr })}
        </Text>
      </View>

      {/* Itinéraire */}
      <View style={styles.route}>
        <View style={styles.routeIndicator}>
          <View style={styles.dotGreen} />
          <View style={styles.line} />
          <View style={styles.dotBlue} />
        </View>
        <View style={styles.routeLabels}>
          <Text style={styles.address} numberOfLines={1}>{trip.departure_address}</Text>
          <Text style={styles.address} numberOfLines={1}>{trip.arrival_address}</Text>
        </View>
      </View>

      {/* Pied : conducteur + places */}
      <View style={styles.footer}>
        <View style={styles.driver}>
          <Avatar
            firstName={trip.driver?.first_name}
            lastName={trip.driver?.last_name}
            size={32}
          />
          <View>
            <Text style={styles.driverName}>
              {trip.driver?.first_name} {trip.driver?.last_name?.[0]}.
              {isDriver && <Text style={styles.youBadge}> (vous)</Text>}
            </Text>
            {trip.driver?.role && (
              <Text style={styles.driverRole}>
                {ROLE_LABELS[trip.driver.role] ?? trip.driver.role}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.seats}>
          {Array.from({ length: trip.available_seats }).map((_, i) => (
            <Ionicons
              key={i}
              name="person"
              size={14}
              color={i < trip.booked_seats ? COLORS.primary : COLORS.border}
              style={{ marginLeft: 2 }}
            />
          ))}
          <Text style={[styles.seatsText, available === 0 && styles.seatsTextFull]}>
            {available === 0 ? 'Complet' : `${available} place${available > 1 ? 's' : ''}`}
          </Text>
        </View>
      </View>

      {trip.comment && (
        <Text style={styles.comment} numberOfLines={1}>
          💬 {trip.comment}
        </Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    ...SHADOW.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  route: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  routeIndicator: {
    alignItems: 'center',
    width: 12,
    paddingVertical: 2,
  },
  dotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
  },
  line: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
    marginVertical: 3,
  },
  dotBlue: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  routeLabels: { flex: 1, gap: 8 },
  address: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  driver: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  driverName: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  driverRole: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  youBadge: { color: COLORS.primary, fontWeight: '600' },
  seats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seatsText: { fontSize: 12, color: COLORS.textSecondary, marginLeft: 4 },
  seatsTextFull: { color: COLORS.error },
  comment: { fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' },
})
