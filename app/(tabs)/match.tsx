import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'expo-router'

export default function MatchScreen() {
  const router = useRouter()
  const [step, setStep] = useState<'setup' | 'score' | 'done'>('setup')
  const [format, setFormat] = useState<'singles' | 'doubles'>('singles')

  // Singles
  const [opponentUsername, setOpponentUsername] = useState('')
  const [opponent, setOpponent] = useState<any>(null)

  // Doubles
  const [partnerUsername, setPartnerUsername] = useState('')
  const [opponent2Username, setOpponent2Username] = useState('')
  const [opponent3Username, setOpponent3Username] = useState('')
  const [partner, setPartner] = useState<any>(null)
  const [opponent2, setOpponent2] = useState<any>(null)
  const [opponent3, setOpponent3] = useState<any>(null)

  const [sets, setSets] = useState([{ score_team1: 0, score_team2: 0 }])
  const [currentSet, setCurrentSet] = useState(0)
  const [saving, setSaving] = useState(false)
  const [authUser, setAuthUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthUser(data.user))
  }, [])

  const findUser = async (username: string) => {
    const { data, error } = await (supabase.from('users') as any)
      .select('*')
      .eq('username', username.trim())
      .single()
    if (error || !data) throw new Error(`No player found with username "${username}"`)
    return data
  }

  const searchPlayers = async () => {
    if (format === 'singles') {
      if (!opponentUsername) return
      try {
        const opp = await findUser(opponentUsername)
        setOpponent(opp)
        setStep('score')
      } catch (e: any) {
        Alert.alert('Not found', e.message)
      }
    } else {
      if (!partnerUsername || !opponent2Username || !opponent3Username) {
        Alert.alert('Missing info', 'Please enter all 3 usernames.')
        return
      }
      try {
        const [p, o2, o3] = await Promise.all([
          findUser(partnerUsername),
          findUser(opponent2Username),
          findUser(opponent3Username),
        ])
        setPartner(p)
        setOpponent2(o2)
        setOpponent3(o3)
        setStep('score')
      } catch (e: any) {
        Alert.alert('Not found', e.message)
      }
    }
  }

  const changeScore = (team: 1 | 2, delta: number) => {
    const updated = [...sets]
    const key = team === 1 ? 'score_team1' : 'score_team2'
    updated[currentSet] = { ...updated[currentSet], [key]: Math.max(0, updated[currentSet][key] + delta) }
    setSets(updated)
  }

  const addSet = () => {
    if (sets.length < 3) {
      setSets([...sets, { score_team1: 0, score_team2: 0 }])
      setCurrentSet(sets.length)
    }
  }

  const saveMatch = async () => {
    setSaving(true)
    try {
      const { data: match, error } = await (supabase
        .from('matches') as any)
        .insert({
          format,
          status: 'completed',
          played_at: new Date().toISOString(),
          created_by: authUser.id,
        })
        .select()
        .single()
      if (error) throw error

      await (supabase.from('sets') as any).insert(
        sets.map((s, i) => ({ match_id: match.id, set_number: i + 1, ...s }))
      )

      const myWins = sets.filter(s => s.score_team1 > s.score_team2).length
      const isWinner = myWins > sets.length / 2

      if (format === 'singles') {
        await (supabase.from('match_players') as any).insert([
          { match_id: match.id, user_id: authUser.id, team: 1, is_winner: isWinner },
          { match_id: match.id, user_id: opponent.id, team: 2, is_winner: !isWinner },
        ])

        // Update wins/losses for both players
        await updateRecord(authUser.id, isWinner)
        await updateRecord(opponent.id, !isWinner)

      } else {
        await (supabase.from('match_players') as any).insert([
          { match_id: match.id, user_id: authUser.id, team: 1, is_winner: isWinner },
          { match_id: match.id, user_id: partner.id, team: 1, is_winner: isWinner },
          { match_id: match.id, user_id: opponent2.id, team: 2, is_winner: !isWinner },
          { match_id: match.id, user_id: opponent3.id, team: 2, is_winner: !isWinner },
        ])

        // Update wins/losses for all 4 players
        await updateRecord(authUser.id, isWinner)
        await updateRecord(partner.id, isWinner)
        await updateRecord(opponent2.id, !isWinner)
        await updateRecord(opponent3.id, !isWinner)
      }

      setStep('done')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
    setSaving(false)
  }

  const updateRecord = async (userId: string, won: boolean) => {
  try {
    const { error } = await (supabase.rpc as any)('update_match_record', {
      target_user_id: userId,
      win_delta: won ? 1 : 0,
      loss_delta: won ? 0 : 1,
    })
    if (error) throw error
  } catch (e: any) {
    console.error(`updateRecord failed for ${userId}:`, e.message)
  }
}

  const resetMatch = () => {
    setStep('setup')
    setSets([{ score_team1: 0, score_team2: 0 }])
    setCurrentSet(0)
    setOpponent(null)
    setOpponentUsername('')
    setPartner(null)
    setOpponent2(null)
    setOpponent3(null)
    setPartnerUsername('')
    setOpponent2Username('')
    setOpponent3Username('')
  }

  // SETUP STEP
  if (step === 'setup') return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Log a match</Text>

      <Text style={styles.label}>Format</Text>
      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, format === 'singles' && styles.toggleActive]}
          onPress={() => setFormat('singles')}>
          <Text style={[styles.toggleText, format === 'singles' && styles.toggleTextActive]}>Singles</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, format === 'doubles' && styles.toggleActive]}
          onPress={() => setFormat('doubles')}>
          <Text style={[styles.toggleText, format === 'doubles' && styles.toggleTextActive]}>Doubles</Text>
        </TouchableOpacity>
      </View>

      {format === 'singles' ? (
        <>
          <Text style={styles.label}>Opponent's username</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. karlcassy107"
            value={opponentUsername}
            onChangeText={setOpponentUsername}
            autoCapitalize="none"
          />
        </>
      ) : (
        <>
          <Text style={styles.sectionLabel}>Team 1 (You)</Text>
          <Text style={styles.label}>Your partner's username</Text>
          <TextInput
            style={styles.input}
            placeholder="Partner's username"
            value={partnerUsername}
            onChangeText={setPartnerUsername}
            autoCapitalize="none"
          />

          <Text style={styles.sectionLabel}>Team 2 (Opponents)</Text>
          <Text style={styles.label}>Opponent 1's username</Text>
          <TextInput
            style={styles.input}
            placeholder="Opponent 1's username"
            value={opponent2Username}
            onChangeText={setOpponent2Username}
            autoCapitalize="none"
          />
          <Text style={styles.label}>Opponent 2's username</Text>
          <TextInput
            style={styles.input}
            placeholder="Opponent 2's username"
            value={opponent3Username}
            onChangeText={setOpponent3Username}
            autoCapitalize="none"
          />
        </>
      )}

      <TouchableOpacity style={styles.btn} onPress={searchPlayers}>
        <Text style={styles.btnText}>Find players & start →</Text>
      </TouchableOpacity>
    </ScrollView>
  )

  // SCORE STEP
  if (step === 'score') return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Set {currentSet + 1} of {sets.length}</Text>

      <View style={styles.playersRow}>
        <View style={styles.teamBox}>
          <Text style={styles.teamLabel}>Team 1</Text>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>You</Text>
          </View>
          {format === 'doubles' && partner && (
            <>
              <Text style={styles.andText}>&</Text>
              <View style={[styles.avatar, styles.avatarBlue]}>
                <Text style={styles.avatarText}>{partner?.full_name?.charAt(0)}</Text>
              </View>
              <Text style={styles.playerName}>{partner?.full_name}</Text>
            </>
          )}
        </View>

        <Text style={styles.vs}>vs</Text>

        <View style={styles.teamBox}>
          <Text style={styles.teamLabel}>Team 2</Text>
          <View style={[styles.avatar, styles.avatarGreen]}>
            <Text style={styles.avatarText}>
              {format === 'singles' ? opponent?.full_name?.charAt(0) : opponent2?.full_name?.charAt(0)}
            </Text>
          </View>
          <Text style={styles.playerName}>
            {format === 'singles' ? opponent?.full_name : opponent2?.full_name}
          </Text>
          {format === 'doubles' && opponent3 && (
            <>
              <Text style={styles.andText}>&</Text>
              <View style={[styles.avatar, styles.avatarGreen]}>
                <Text style={styles.avatarText}>{opponent3?.full_name?.charAt(0)}</Text>
              </View>
              <Text style={styles.playerName}>{opponent3?.full_name}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.scoreBox}>
        <View style={styles.scoreCol}>
          <TouchableOpacity style={styles.scoreBtn} onPress={() => changeScore(1, 1)}>
            <Text style={styles.scoreBtnText}>+</Text>
          </TouchableOpacity>
          <Text style={styles.scoreNum}>{sets[currentSet].score_team1}</Text>
          <TouchableOpacity style={styles.scoreBtn} onPress={() => changeScore(1, -1)}>
            <Text style={styles.scoreBtnText}>−</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.scoreDash}>–</Text>
        <View style={styles.scoreCol}>
          <TouchableOpacity style={styles.scoreBtn} onPress={() => changeScore(2, 1)}>
            <Text style={styles.scoreBtnText}>+</Text>
          </TouchableOpacity>
          <Text style={styles.scoreNum}>{sets[currentSet].score_team2}</Text>
          <TouchableOpacity style={styles.scoreBtn} onPress={() => changeScore(2, -1)}>
            <Text style={styles.scoreBtnText}>−</Text>
          </TouchableOpacity>
        </View>
      </View>

      {sets.length > 1 && (
        <View style={styles.setHistory}>
          {sets.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.setPill, i === currentSet && styles.setPillActive]}
              onPress={() => setCurrentSet(i)}>
              <Text style={styles.setPillText}>Set {i + 1}: {s.score_team1}–{s.score_team2}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {sets.length < 3 && (
        <TouchableOpacity style={styles.btnOutline} onPress={addSet}>
          <Text style={styles.btnOutlineText}>+ Add set</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.btn} onPress={saveMatch} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'Saving...' : 'Save match result ✓'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )

  // DONE STEP
  return (
    <View style={styles.center}>
      <Text style={styles.doneEmoji}>🏸</Text>
      <Text style={styles.doneTitle}>Match saved!</Text>
      <Text style={styles.doneSub}>
        {sets.map((s, i) => `Set ${i + 1}: ${s.score_team1}–${s.score_team2}`).join('\n')}
      </Text>
      <TouchableOpacity style={[styles.btn, { marginTop: 32, width: 200 }]} onPress={resetMatch}>
        <Text style={styles.btnText}>Log another</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btnOutline, { marginTop: 12, width: 200 }]} onPress={() => router.push('/(tabs)/home')}>
        <Text style={styles.btnOutlineText}>Go to home</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F6' },
  content: { padding: 20, paddingTop: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F8F6', padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '600', color: '#888', marginBottom: 8, textTransform: 'uppercase' },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 12, marginTop: 8 },
  toggle: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  toggleBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 0.5, borderColor: '#ccc', alignItems: 'center', backgroundColor: '#fff' },
  toggleActive: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  toggleText: { fontSize: 15, color: '#888', fontWeight: '500' },
  toggleTextActive: { color: '#fff' },
  input: { borderWidth: 0.5, borderColor: '#ccc', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 16, backgroundColor: '#fff' },
  btn: { backgroundColor: '#1D9E75', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnOutline: { borderWidth: 1, borderColor: '#1D9E75', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  btnOutlineText: { color: '#1D9E75', fontSize: 15, fontWeight: '500' },
  playersRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 16, marginBottom: 32 },
  teamBox: { alignItems: 'center', gap: 6, flex: 1 },
  teamLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginBottom: 4 },
  playerName: { fontSize: 12, color: '#555', textAlign: 'center' },
  andText: { fontSize: 12, color: '#aaa' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EEEDFE', justifyContent: 'center', alignItems: 'center' },
  avatarGreen: { backgroundColor: '#EAF3DE' },
  avatarBlue: { backgroundColor: '#dbeafe' },
  avatarText: { fontSize: 13, fontWeight: '600', color: '#3C3489' },
  vs: { fontSize: 16, color: '#aaa', marginTop: 40 },
  scoreBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 0.5, borderColor: '#e5e5e5', marginBottom: 20 },
  scoreCol: { alignItems: 'center', gap: 12 },
  scoreNum: { fontSize: 56, fontWeight: '700', color: '#1a1a1a', lineHeight: 64 },
  scoreDash: { fontSize: 32, color: '#ccc', marginTop: -8 },
  scoreBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F0EE', justifyContent: 'center', alignItems: 'center' },
  scoreBtnText: { fontSize: 24, color: '#1a1a1a', lineHeight: 28 },
  setHistory: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  setPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#ccc' },
  setPillActive: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  setPillText: { fontSize: 13, color: '#555' },
  doneEmoji: { fontSize: 64, marginBottom: 16 },
  doneTitle: { fontSize: 28, fontWeight: '700', color: '#1D9E75', marginBottom: 12 },
  doneSub: { fontSize: 16, color: '#888', textAlign: 'center', lineHeight: 26 },
})