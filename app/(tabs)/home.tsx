import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useState, useCallback } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function HomeScreen() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [matches, setMatches] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

useFocusEffect(
  useCallback(() => {
    loadData()
  }, [])
)

  const loadData = async () => {
    setLoading(true)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { router.replace('/auth/login'); return }

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()
    setUser(profile)

      const { data: matchData } = await (supabase
      .from('match_players') as any)
      .select('match:matches(*, sets(*))')
      .eq('user_id', authUser.id)
      .limit(3)

    setMatches(matchData?.map((d: any) => d.match).filter(Boolean) ?? [])

    const { data: sessionData } = await supabase
      .from('sessions')
      .select('*, court:courts(*)')
      .eq('status', 'open')
      .gt('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .limit(3)
    setSessions(sessionData ?? [])

    setLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/auth/login')
  }

  const total = (user?.wins ?? 0) + (user?.losses ?? 0)
  const winRate = total > 0 ? Math.round((user.wins / total) * 100) : 0

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#1D9E75" />
    </View>
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hey, {user?.full_name?.split(' ')[0]} 👋</Text>
          <Text style={styles.sub}>{user?.skill_level} player</Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={{ marginLeft: 12 }}>
          <Text style={styles.signout}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{winRate}%</Text>
          <Text style={styles.statLbl}>Win rate</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{user?.wins ?? 0}</Text>
          <Text style={styles.statLbl}>Wins</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{user?.losses ?? 0}</Text>
          <Text style={styles.statLbl}>Losses</Text>
        </View>
      </View>

      {/* Recent Matches */}
      <Text style={styles.section}>Recent matches</Text>
      {matches.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No matches yet — log your first one!</Text>
        </View>
      ) : (
        matches.map((match: any) => (
          <View key={match.id} style={styles.card}>
            <Text style={styles.cardTitle}>{match.format} match</Text>
            <Text style={styles.cardSub}>
              {match.sets?.map((s: any) => `${s.score_team1}–${s.score_team2}`).join(', ')}
            </Text>
          </View>
        ))
      )}

      {/* Open Sessions */}
      <Text style={styles.section}>Open sessions nearby</Text>
      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No open sessions — create one!</Text>
        </View>
      ) : (
        sessions.map((session: any) => (
          <TouchableOpacity key={session.id} style={styles.card}>
            <Text style={styles.cardTitle}>{session.court?.name ?? 'Session'}</Text>
            <Text style={styles.cardSub}>
              {new Date(session.scheduled_at).toDateString()} · {session.slots_filled}/{session.slots_total} players
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F6' },
  content: { padding: 16, paddingTop: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  sub: { fontSize: 13, color: '#888', marginTop: 2, textTransform: 'capitalize' },
  signout: { fontSize: 13, color: '#1D9E75' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#e5e5e5', alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '700', color: '#1D9E75' },
  statLbl: { fontSize: 11, color: '#888', marginTop: 4 },
  section: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: '#e5e5e5' },
  cardTitle: { fontSize: 15, fontWeight: '500', color: '#1a1a1a' },
  cardSub: { fontSize: 13, color: '#888', marginTop: 3 },
  empty: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 10, borderWidth: 0.5, borderColor: '#e5e5e5', alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#aaa' },
})