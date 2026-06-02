import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Trip, TripType, TripDirection } from '@/types'

export function useTrips(filters?: { groupId?: string; eventId?: string; type?: TripType }) {
  return useQuery({
    queryKey: ['trips', filters],
    queryFn: async () => {
      let query = supabase
        .from('trips')
        .select('*, driver:users!driver_id(id, first_name, last_name, car_capacity, phone, push_token), event:events(*), group:groups(*)')
        .eq('status', 'actif')
        .gte('departure_time', new Date().toISOString())
        .order('departure_time', { ascending: true })

      if (filters?.groupId) query = query.eq('group_id', filters.groupId)
      if (filters?.eventId) query = query.eq('event_id', filters.eventId)
      if (filters?.type) query = query.eq('type', filters.type)

      const { data, error } = await query
      if (error) throw error
      return data as Trip[]
    },
  })
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: ['trip', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(`
          *,
          driver:users!driver_id(id, first_name, last_name, car_capacity, phone, push_token),
          event:events(*),
          group:groups(*),
          bookings(*, passenger:users!passenger_id(id, first_name, last_name))
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Trip
    },
  })
}

export function useMyTrips(userId: string) {
  return useQuery({
    queryKey: ['my-trips', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('*, event:events(*), bookings(*, passenger:users!passenger_id(id, first_name, last_name))')
        .eq('driver_id', userId)
        .order('departure_time', { ascending: false })

      if (error) throw error
      return data as Trip[]
    },
  })
}

export function useMyBookings(userId: string) {
  return useQuery({
    queryKey: ['my-bookings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, trip:trips(*, driver:users!driver_id(id, first_name, last_name, phone), event:events(*))')
        .eq('passenger_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })
}

interface CreateTripInput {
  type: TripType
  direction?: TripDirection
  departure_address: string
  departure_lat?: number
  departure_lng?: number
  arrival_address: string
  arrival_lat?: number
  arrival_lng?: number
  departure_time: string
  available_seats: number
  comment?: string
  recurrence_rule?: string
  group_id?: string
  event_id?: string
  intermediate_stop?: string
  is_offer: boolean
}

export function useCreateTrip(driverId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateTripInput) => {
      const { data, error } = await supabase
        .from('trips')
        .insert({ ...input, driver_id: driverId, booked_seats: 0, status: 'actif' })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      queryClient.invalidateQueries({ queryKey: ['my-trips', driverId] })
    },
  })
}

export function useCancelTrip() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (tripId: string) => {
      const { error } = await supabase
        .from('trips')
        .update({ status: 'annule' })
        .eq('id', tripId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      queryClient.invalidateQueries({ queryKey: ['my-trips'] })
    },
  })
}
