import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Nombre de notifications non lues + abonnement realtime pour le badge tab. */
export function useUnreadNotificationsCount(userId?: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['notifications', 'unread-count', userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .is('read_at', null)

      if (error) throw error
      return count ?? 0
    },
    enabled: !!userId,
    // Fallback si le realtime n'est pas disponible
    refetchInterval: 60_000,
  })

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications-unread:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, queryClient])

  return query.data ?? 0
}
