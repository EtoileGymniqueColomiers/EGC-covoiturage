export type UserRole = 'licencie' | 'parent' | 'encadrant' | 'admin'
export type TripType = 'regulier' | 'ponctuel' | 'evenement'
export type TripStatus = 'actif' | 'complet' | 'annule' | 'termine'
export type TripDirection = 'aller' | 'retour'
export type BookingStatus = 'en_attente' | 'accepte' | 'refuse' | 'annule'

export interface Group {
  id: string
  name: string
  schedule: { day: string; time: string }[]
  coach_name: string | null
  created_at: string
}

export interface Event {
  id: string
  name: string
  event_date: string
  end_date: string | null
  is_multi_day: boolean
  location: string
  lat: number | null
  lng: number | null
  description: string | null
  accommodation_note: string | null
  created_by: string | null
  created_at: string
}

export interface UserProfile {
  id: string
  auth_id: string | null
  role: UserRole
  license_number: string | null
  email: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  address: string | null
  lat: number | null
  lng: number | null
  car_capacity: number
  is_active: boolean
  profile_complete: boolean
  push_token: string | null
  created_at: string
  // Groupes via table de jointure user_groups (chargés en option selon la requête)
  user_groups?: { group_id: string; groups: { id: string; name: string } | null }[]
}

export interface Trip {
  id: string
  driver_id: string
  event_id: string | null
  type: TripType
  direction: TripDirection | null
  status: TripStatus
  departure_address: string
  departure_lat: number | null
  departure_lng: number | null
  arrival_address: string
  arrival_lat: number | null
  arrival_lng: number | null
  departure_time: string
  available_seats: number
  booked_seats: number
  comment: string | null
  recurrence_rule: string | null
  group_id: string | null
  intermediate_stop: string | null
  is_offer: boolean
  created_at: string
  driver?: UserProfile
  event?: Event
  group?: Group
  bookings?: Booking[]
}

export interface Booking {
  id: string
  trip_id: string
  passenger_id: string
  status: BookingStatus
  seats_requested: number
  message: string | null
  created_at: string
  updated_at: string
  trip?: Trip
  passenger?: UserProfile
}

export interface Conversation {
  id: string
  trip_id: string
  user_a_id: string
  user_b_id: string
  created_at: string
  trip?: Trip
  user_a?: UserProfile
  user_b?: UserProfile
  last_message?: Message
  unread_count?: number
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  read_at: string | null
  created_at: string
  sender?: UserProfile
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  data: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

export interface ParentChild {
  parent_id: string
  child_id: string
  validated: boolean
  parent?: UserProfile
  child?: UserProfile
}
