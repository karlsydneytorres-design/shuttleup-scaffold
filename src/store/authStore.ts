import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  session: any | null
  loading: boolean
  setSession: (session: any) => void
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  fetchProfile: (userId: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,

  setSession: (session) => set({ session, loading: false }),

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  },

  signUp: async (email, password, username) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (!error && data.user) {
      await supabase.from('users').insert({
        id: data.user.id,
        email,
        username,
        full_name: username,
        skill_level: 'beginner',
        playing_styles: [],
        wins: 0,
        losses: 0,
      })
    }
    return { error }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },

  fetchProfile: async (userId) => {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single()
    if (data) set({ user: data })
  },
}))
