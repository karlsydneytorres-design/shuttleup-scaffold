import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { useMyMatches } from '@/hooks/useMatches'
import { useOpenSessions } from '@/hooks/useSessions'
import { format } from 'date-fns'

export default function HomeScreen() {
  const { user } = useAuthStore()
  const { data: matches } = useMyMatches()
  const { data: sessions } = useOpenSessions()
  const router = useRouter()

  const total = (user?.wins ?? 0) + (user?.losses ?? 0)
  const winRate = total > 0 ? Math.round(((user?.wins ?? 0) / total) * 100) : 0

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning, {user?.full_name?.split(' ')[0]}</Text>
        <Text style={styles.sub}>{user?.skill_level} · {user?.wins}W / {user?.losses}L</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{winRate}%</Text>
          <Text style={styles.statLbl}>Win rate</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{total}</Text>
          <Text style={styles.statLbl}>Matches played</Text>
        </View>
      </View>

      <Text style={styles.section}>Recent matches</Text>
      {matches?.slice(0, 3).map((match) => (
        <TouchableOpacity key={match.id} style={styles.card} onPress={() => router.push(`/match/${match.id}`)}>
          <Text style={styles.cardTitle}>{match.format} match</Text>
          <Text style={styles.cardSub}>{format(new Date(match.played_at), 'EEE, MMM d')}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.section}>Open sessions</Text>
      {sessions?.slice(0, 2).map((session) => (
        <TouchableOpacity key={session.id} style={styles.card} onPress={() => router.push(`/sessions/${session.id}`)}>
          <Text style={styles.cardTitle}>{(session as any).court?.name ?? 'Session'}</Text>
          <Text style={styles.cardSub}>{format(new Date((session as any).scheduled_at), 'EEE h:mm a')} · {(session as any).slots_filled}/{(session as any).slots_total} players</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F6' },
  content: { padding: 16 },
  header: { marginBottom: 20 },
  greeting: { fontSize: 22, fontWeight: '600', color: '#1a1a1a' },
  sub: { fontSize: 13, color: '#888', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#e5e5e5' },
  statVal: { fontSize: 28, fontWeight: '600', color: '#1D9E75' },
  statLbl: { fontSize: 12, color: '#888', marginTop: 4 },
  section: { fontSize: 13, fontWeight: '500', color: '#888', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: '#e5e5e5' },
  cardTitle: { fontSize: 15, fontWeight: '500', color: '#1a1a1a' },
  cardSub: { fontSize: 13, color: '#888', marginTop: 3 },
})
