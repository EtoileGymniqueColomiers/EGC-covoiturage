import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useTrip } from '@/hooks/useTrips'
import { useRequestBooking, useRespondBooking, useCancelBooking } from '@/hooks/useBookings'
import { useAuthStore } from '@/stores/auth.store'
import { getOrCreateConversation } from '@/hooks/useMessages'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { COLORS, SPACING, RADIUS, SHADOW } from '@/constants/theme'
import { BookingStatus } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  regulier: 'Régulier',
  ponctuel: 'Ponctuel',
  evenement: 'Compétition',
}

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  en_attente: 'En attente',
  accepte: 'Confirmé',
  refuse: 'Refusé',
  annule: 'Annulé',
}

const BOOKING_STATUS_VARIANT: Record<BookingStatus, 'success' | 'error' | 'warning' | 'neutral'> = {
  en_attente: 'warning',
  accepte: 'success',
  refuse: 'error',
  annule: 'neutral',
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { profile } = useAuthStore()

  const { data: trip, isLoading, refetch } = useTrip(id)
  const requestBooking = useRequestBooking()
  const respondBooking = useRespondBooking()
  const cancelBooking  = useCancelBooking()

  const [bookingMessage, setBookingMessage] = useState('')
  const [showMessageInput, setShowMessageInput] = useState(false)

  if (isLoading || !trip) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const isDriver   = trip.driver_id === profile?.id
  const available  = trip.available_seats - trip.booked_seats
  // On ignore les réservations annulées : le passager peut re-soumettre après annulation
  const myBooking  = trip.bookings?.find(
    (b) => b.passenger_id === profile?.id && b.status !== 'annule'
  )
  const acceptedPassengers = trip.bookings?.filter((b) => b.status === 'accepte') ?? []
  const pendingBookings    = trip.bookings?.filter((b) => b.status === 'en_attente') ?? []

  async function handleRequestBooking() {
    if (!profile || !trip) return

    try {
      await requestBooking.mutateAsync({
        tripId: trip.id,
        passengerId: profile.id,
        message: bookingMessage.trim() || undefined,
      })
      setShowMessageInput(false)
      setBookingMessage('')
      refetch()
      Alert.alert('Demande envoyée', 'Le conducteur a été notifié de votre demande.')
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer la demande. Réessayez.')
    }
  }

  async function handleRespondBooking(bookingId: string, status: 'accepte' | 'refuse') {
    try {
      await respondBooking.mutateAsync({ bookingId, tripId: trip.id, status })
      refetch()
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour la réservation.')
    }
  }

  async function handleOpenChat(otherUserId: string) {
    if (!profile) return
    try {
      const convId = await getOrCreateConversation(trip.id, profile.id, otherUserId)
      router.push(`/(app)/messages/${convId}`)
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir la conversation.')
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Détail du trajet</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type + statut */}
        <View style={styles.badges}>
          <Badge label={TYPE_LABELS[trip.type] ?? trip.type} variant="info" />
          {trip.status === 'complet' && <Badge label="Complet" variant="error" />}
          {trip.direction && (
            <Badge
              label={trip.direction === 'aller' ? '→ Aller' : '← Retour'}
              variant="neutral"
            />
          )}
        </View>

        {/* Itinéraire */}
        <Card>
          <View style={styles.routeRow}>
            <View style={styles.routeDots}>
              <View style={styles.dotGreen} />
              <View style={styles.routeLine} />
              <View style={styles.dotBlue} />
            </View>
            <View style={styles.routeAddresses}>
              <View>
                <Text style={styles.routeLabel}>Départ</Text>
                <Text style={styles.routeAddress}>{trip.departure_address}</Text>
              </View>
              <View style={{ marginTop: SPACING.sm }}>
                <Text style={styles.routeLabel}>Arrivée</Text>
                <Text style={styles.routeAddress}>{trip.arrival_address}</Text>
              </View>
            </View>
          </View>

          {trip.intermediate_stop && (
            <View style={styles.stopRow}>
              <Ionicons name="location-outline" size={16} color={COLORS.warning} />
              <Text style={styles.stopText}>Arrêt : {trip.intermediate_stop}</Text>
            </View>
          )}
        </Card>

        {/* Date et places */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>
              {format(new Date(trip.departure_time), "EEEE d MMMM yyyy 'à' HH'h'mm", { locale: fr })}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>
              {available > 0 ? `${available} place${available > 1 ? 's' : ''} disponible${available > 1 ? 's' : ''}` : 'Complet'}
            </Text>
          </View>
          {trip.comment && (
            <View style={styles.infoRow}>
              <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
              <Text style={styles.infoText}>{trip.comment}</Text>
            </View>
          )}
        </Card>

        {/* Conducteur */}
        <Card>
          <Text style={styles.sectionTitle}>Conducteur</Text>
          <View style={styles.driverRow}>
            <Avatar
              firstName={trip.driver?.first_name}
              lastName={trip.driver?.last_name}
              size={48}
            />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>
                {trip.driver?.first_name} {trip.driver?.last_name}
                {isDriver && ' (vous)'}
              </Text>
              {trip.driver?.role && (
                <Text style={styles.driverRole}>
                  {{
                    licencie:  'Licencié',
                    parent:    'Parent',
                    encadrant: 'Encadrant',
                    admin:     'Admin',
                  }[trip.driver.role] ?? trip.driver.role}
                </Text>
              )}
              <Text style={styles.driverCapacity}>
                {trip.driver?.car_capacity ?? 0} places dans son véhicule
              </Text>
            </View>
            {!isDriver && myBooking?.status === 'accepte' && trip.driver?.phone && (
              <TouchableOpacity style={styles.phoneBtn}>
                <Ionicons name="call-outline" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>
          {!isDriver && (
            <Button
              label="Envoyer un message"
              onPress={() => handleOpenChat(trip.driver_id)}
              variant="outline"
              size="sm"
              style={{ marginTop: SPACING.sm }}
            />
          )}
        </Card>

        {/* Passagers confirmés */}
        {acceptedPassengers.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>
              Passagers confirmés ({acceptedPassengers.length})
            </Text>
            {acceptedPassengers.map((b) => (
              <View key={b.id} style={styles.passengerRow}>
                <Avatar
                  firstName={b.passenger?.first_name}
                  lastName={b.passenger?.last_name}
                  size={36}
                />
                <Text style={styles.passengerName}>
                  {b.passenger?.first_name} {b.passenger?.last_name}
                </Text>
                {isDriver && (
                  <TouchableOpacity
                    style={styles.chatBtn}
                    onPress={() => handleOpenChat(b.passenger_id)}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </Card>
        )}

        {/* Demandes en attente — vue conducteur */}
        {isDriver && pendingBookings.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>
              Demandes en attente ({pendingBookings.length})
            </Text>
            {pendingBookings.map((b) => (
              <View key={b.id} style={styles.pendingRow}>
                <View style={styles.pendingHeader}>
                  <Avatar
                    firstName={b.passenger?.first_name}
                    lastName={b.passenger?.last_name}
                    size={36}
                  />
                  <Text style={styles.passengerName}>
                    {b.passenger?.first_name} {b.passenger?.last_name}
                  </Text>
                </View>
                {b.message && (
                  <Text style={styles.pendingMessage}>💬 {b.message}</Text>
                )}
                <View style={styles.pendingActions}>
                  <Button
                    label="Refuser"
                    onPress={() => handleRespondBooking(b.id, 'refuse')}
                    variant="outline"
                    size="sm"
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Accepter"
                    onPress={() => handleRespondBooking(b.id, 'accepte')}
                    size="sm"
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Action passager */}
        {!isDriver && trip.status === 'actif' && (
          <View style={styles.bookingSection}>
            {!myBooking ? (
              <>
                {showMessageInput && (
                  <Card style={{ marginBottom: SPACING.sm }}>
                    <Text style={styles.sectionTitle}>Message pour le conducteur (optionnel)</Text>
                    <TextInput
                      style={styles.messageInput}
                      placeholder="Ex : Je suis proche de la gare, je peux être à l'heure..."
                      value={bookingMessage}
                      onChangeText={setBookingMessage}
                      multiline
                      maxLength={200}
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </Card>
                )}
                <View style={styles.bookingActions}>
                  {!showMessageInput && (
                    <Button
                      label="+ Ajouter un message"
                      onPress={() => setShowMessageInput(true)}
                      variant="ghost"
                      size="sm"
                    />
                  )}
                  <Button
                    label={available > 0 ? 'Demander une place' : 'Complet'}
                    onPress={handleRequestBooking}
                    loading={requestBooking.isPending}
                    disabled={available === 0}
                    fullWidth
                  />
                </View>
              </>
            ) : (
              <Card style={styles.myBookingCard}>
                <View style={styles.myBookingHeader}>
                  <Text style={styles.myBookingTitle}>Ma réservation</Text>
                  <Badge
                    label={BOOKING_STATUS_LABELS[myBooking.status]}
                    variant={BOOKING_STATUS_VARIANT[myBooking.status]}
                  />
                </View>
                {myBooking.status === 'en_attente' && (
                  <Button
                    label="Annuler ma demande"
                    onPress={() =>
                      Alert.alert('Annuler ?', 'Voulez-vous annuler votre demande ?', [
                        { text: 'Non', style: 'cancel' },
                        {
                          text: 'Oui, annuler',
                          style: 'destructive',
                          onPress: async () => {
                            await cancelBooking.mutateAsync(myBooking.id)
                            refetch()
                          },
                        },
                      ])
                    }
                    variant="outline"
                    size="sm"
                    style={{ marginTop: SPACING.sm }}
                  />
                )}
              </Card>
            )}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textMuted },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },

  badges: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },

  routeRow: { flexDirection: 'row', gap: SPACING.md },
  routeDots: { alignItems: 'center', paddingTop: 4 },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.success },
  routeLine: { width: 2, flex: 1, backgroundColor: COLORS.border, marginVertical: 4, minHeight: 30 },
  dotBlue: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  routeAddresses: { flex: 1 },
  routeLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  routeAddress: { fontSize: 15, color: COLORS.text, fontWeight: '500', marginTop: 2 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  stopText: { fontSize: 13, color: COLORS.textSecondary },

  infoCard: { gap: SPACING.sm },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  infoText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 20 },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },

  driverRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  driverInfo: { flex: 1 },
  driverName:     { fontSize: 15, fontWeight: '600', color: COLORS.text },
  driverRole:     { fontSize: 12, color: COLORS.primary, fontWeight: '500', marginTop: 1 },
  driverCapacity: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  phoneBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },

  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  passengerName: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '500' },
  chatBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },

  pendingRow: { gap: SPACING.sm, marginBottom: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  pendingMessage: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic', paddingLeft: 44 },
  pendingActions: { flexDirection: 'row', gap: SPACING.sm },

  bookingSection: { gap: SPACING.sm },
  bookingActions: { gap: SPACING.sm },
  messageInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, minHeight: 80, fontSize: 14, color: COLORS.text, textAlignVertical: 'top' },

  myBookingCard: { gap: SPACING.sm },
  myBookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  myBookingTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
})
