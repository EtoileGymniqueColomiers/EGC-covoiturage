import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useRequestBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      tripId,
      passengerId,
      seatsRequested = 1,
      message,
    }: {
      tripId: string
      passengerId: string
      seatsRequested?: number
      message?: string
    }) => {
      // upsert : si une réservation annulée existe déjà pour ce trajet+passager,
      // on la remet à "en_attente" au lieu d'en créer une nouvelle
      // (évite le conflit sur la contrainte UNIQUE trip_id+passenger_id)
      const { data, error } = await supabase
        .from('bookings')
        .upsert(
          {
            trip_id:         tripId,
            passenger_id:    passengerId,
            seats_requested: seatsRequested,
            message:         message ?? null,
            status:          'en_attente',
            updated_at:      new Date().toISOString(),
          },
          { onConflict: 'trip_id,passenger_id' }
        )
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    },
  })
}

export function useRespondBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      bookingId,
      tripId,
      status,
    }: {
      bookingId: string
      tripId: string
      status: 'accepte' | 'refuse'
    }) => {
      const { error } = await supabase
        .from('bookings')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', bookingId)

      if (error) throw error
    },
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
      queryClient.invalidateQueries({ queryKey: ['my-trips'] })
    },
  })
}

export function useCancelBooking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'annule', updated_at: new Date().toISOString() })
        .eq('id', bookingId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['trips'] })
    },
  })
}
