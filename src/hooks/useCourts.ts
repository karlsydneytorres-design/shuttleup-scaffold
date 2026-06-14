import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useCourts(searchQuery?: string) {
  return useQuery({
    queryKey: ['courts', searchQuery],
    queryFn: async () => {
      let query = supabase.from('courts').select('*').order('avg_rating', { ascending: false })
      if (searchQuery) query = query.ilike('name', `%${searchQuery}%`)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}
