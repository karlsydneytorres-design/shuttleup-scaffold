// Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
// Placeholder until you connect your Supabase project
export type Database = {
  public: {
    Tables: {
      users: { Row: any; Insert: any; Update: any }
      matches: { Row: any; Insert: any; Update: any }
      match_players: { Row: any; Insert: any; Update: any }
      sets: { Row: any; Insert: any; Update: any }
      courts: { Row: any; Insert: any; Update: any }
      court_reviews: { Row: any; Insert: any; Update: any }
      sessions: { Row: any; Insert: any; Update: any }
      session_players: { Row: any; Insert: any; Update: any }
      friendships: { Row: any; Insert: any; Update: any }
      tournaments: { Row: any; Insert: any; Update: any }
      tournament_players: { Row: any; Insert: any; Update: any }
      achievements: { Row: any; Insert: any; Update: any }
    }
  }
}
