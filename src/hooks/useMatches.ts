import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Match } from '@/types'

export function useMyMatches() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['matches', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_players')
        .select('match:matches(*, sets(*), players:match_players(*, user:users(*)))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data?.map((d) => d.match) as Match[]
    },
  })
}

export function useCreateMatch() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  return useMutation({
    mutationFn: async (payload: {
      courtId: string
      format: string
      opponentId: string
      sets: { score_team1: number; score_team2: number }[]
    }) => {
      const { data: match, error } = await supabase
        .from('matches')
        .insert({
          court_id: payload.courtId,
          format: payload.format,
          status: 'completed',
          played_at: new Date().toISOString(),
          created_by: user!.id,
        })
        .select()
        .single()
      if (error) throw error

      await supabase.from('sets').insert(
        payload.sets.map((s, i) => ({ match_id: match.id, set_number: i + 1, ...s }))
      )

      const wins = payload.sets.filter((s) => s.score_team1 > s.score_team2).length
      const isWinner = wins > payload.sets.length / 2
      await supabase.from('match_players').insert([
        { match_id: match.id, user_id: user!.id, team: 1, is_winner: isWinner },
        { match_id: match.id, user_id: payload.opponentId, team: 2, is_winner: !isWinner },
      ])
      return match
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
  })
}
