import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Conversation, Message } from '@/types'

export function useConversations(userId: string) {
  return useQuery({
    queryKey: ['conversations', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          trip:trips(id, departure_address, arrival_address, departure_time),
          user_a:users!user_a_id(id, first_name, last_name),
          user_b:users!user_b_id(id, first_name, last_name)
        `)
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Conversation[]
    },
  })
}

export function useMessages(conversationId: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:users!sender_id(id, first_name, last_name)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Message[]
    },
  })

  // Realtime — écoute les nouveaux messages
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
          queryClient.invalidateQueries({ queryKey: ['conversations'] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, queryClient])

  return query
}

export function useSendMessage(conversationId: string, senderId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: senderId, content })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    },
  })
}

export async function getOrCreateConversation(tripId: string, userAId: string, userBId: string) {
  // Cherche une conversation existante
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('trip_id', tripId)
    .or(
      `and(user_a_id.eq.${userAId},user_b_id.eq.${userBId}),and(user_a_id.eq.${userBId},user_b_id.eq.${userAId})`
    )
    .single()

  if (existing) return existing.id

  // Crée une nouvelle conversation
  const { data, error } = await supabase
    .from('conversations')
    .insert({ trip_id: tripId, user_a_id: userAId, user_b_id: userBId })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}
