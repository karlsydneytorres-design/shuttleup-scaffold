export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite'
export type MatchFormat = 'singles' | 'doubles'
export type MatchStatus = 'in_progress' | 'completed' | 'cancelled'
export type SessionStatus = 'open' | 'full' | 'cancelled' | 'completed'

export interface User {
  id: string
  email: string
  username: string
  full_name: string
  skill_level: SkillLevel
  playing_styles: string[]
  avatar_url: string | null
  wins: number
  losses: number
  created_at: string
}

export interface Court {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  surface_type: string
  is_indoor: boolean
  avg_rating: number
}

export interface Match {
  id: string
  court_id: string
  format: MatchFormat
  status: MatchStatus
  played_at: string
  created_by: string
  sets: MatchSet[]
  players: MatchPlayer[]
}

export interface MatchSet {
  id: string
  match_id: string
  set_number: number
  score_team1: number
  score_team2: number
}

export interface MatchPlayer {
  id: string
  match_id: string
  user_id: string
  team: number
  is_winner: boolean
  user?: User
}

export interface Session {
  id: string
  court_id: string
  created_by: string
  format: MatchFormat
  slots_total: number
  slots_filled: number
  status: SessionStatus
  scheduled_at: string
  court?: Court
  players?: SessionPlayer[]
}

export interface SessionPlayer {
  id: string
  session_id: string
  user_id: string
  status: 'confirmed' | 'waitlisted'
  joined_at: string
  user?: User
}
