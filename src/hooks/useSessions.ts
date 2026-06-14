import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export function useOpenSessions() {
  return useQuery({
    queryKey: ['sessions', 'open'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*, court:courts(*), players:session_players(*, user:users(*))')
        .eq('status', 'open')
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at')
      if (error) throw error
      return data
    },
  })
}

export function useJoinSession() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data: session } = await supabase
        .from('sessions')
        .select('slots_total, slots_filled')
        .eq('id', sessionId)
        .single()

      const isFull = session && session.slots_filled >= session.slots_total
      await supabase.from('session_players').insert({
        session_id: sessionId,
        user_id: user!.id,
        status: isFull ? 'waitlisted' : 'confirmed',
      })
      if (!isFull) {
        await supabase
          .from('sessions')
          .update({ slots_filled: (session?.slots_filled ?? 0) + 1 })
          .eq('id', sessionId)
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })
}
