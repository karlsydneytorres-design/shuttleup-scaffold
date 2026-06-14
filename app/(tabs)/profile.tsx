import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ALL_BADGES, checkAndAwardAchievements, getUserAchievements } from '@/lib/achievements';

type Profile = {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  skill_level: string | null;
  playing_styles: string[] | null;
  avatar_url: string | null;
  wins: number;
  losses: number;
};

type Match = {
  id: string;
  format: string;
  status: string;
  played_at: string;
  is_winner: boolean;
  sets: { score_team1: number; score_team2: number; set_number: number }[];
};

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'competitive'];
const PLAYING_STYLES = ['aggressive', 'defensive', 'all-around', 'net player', 'baseliner'];

export default function ProfileScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editSkill, setEditSkill] = useState('');
  const [editStyles, setEditStyles] = useState<string[]>([]);

  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [newlyEarned, setNewlyEarned] = useState<string[]>([]);

  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchFilter, setMatchFilter] = useState<'all' | 'singles' | 'doubles'>('all');

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'history') loadMatches();
    }, [activeTab])
  );

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login'); return; }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);

      const newly = await checkAndAwardAchievements(
        user.id,
        (data as any).wins ?? 0,
        (data as any).losses ?? 0
      );
      if (newly && newly.length > 0) setNewlyEarned(newly);

      const earned = await getUserAchievements(user.id);
      setEarnedBadges(earned);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMatches = async () => {
    setMatchesLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await (supabase
        .from('match_players') as any)
        .select('is_winner, match:matches(*, sets(*))')
        .eq('user_id', user?.id);

      if (error) throw error;

      const enriched: Match[] = (data ?? [])
        .map((d: any) => ({
          ...d.match,
          is_winner: d.is_winner,
          sets: d.match?.sets ?? [],
        }))
        .filter(Boolean)
        .sort((a: any, b: any) =>
          new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
        );

      setMatches(enriched);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setMatchesLoading(false);
    }
  };

  const startEditing = () => {
    if (!profile) return;
    setEditName(profile.full_name ?? '');
    setEditUsername(profile.username ?? '');
    setEditSkill(profile.skill_level ?? '');
    setEditStyles(profile.playing_styles ?? []);
    setEditing(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase.from('users') as any)
        .update({
          full_name: editName,
          username: editUsername,
          skill_level: editSkill,
          playing_styles: editStyles,
        })
        .eq('id', profile!.id);

      if (error) throw error;
      setEditing(false);
      loadProfile();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStyle = (style: string) => {
    setEditStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const handleSignOut = async () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive', onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth/login');
        }
      },
    ]);
  };

  const total = (profile?.wins ?? 0) + (profile?.losses ?? 0);
  const winRate = total > 0 ? Math.round(((profile?.wins ?? 0) / total) * 100) : 0;

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?';

  const filteredMatches = matches.filter((m) => {
    if (matchFilter === 'all') return true;
    return m.format === matchFilter;
  });

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#1D9E75" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.headerActions}>
          {activeTab === 'profile' && !editing && (
            <TouchableOpacity style={styles.editBtn} onPress={startEditing}>
              <Ionicons name="pencil-outline" size={16} color="#1D9E75" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Avatar + name */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.fullName}>{profile?.full_name ?? 'No name set'}</Text>
          <Text style={styles.username}>@{profile?.username ?? 'no username'}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{winRate}%</Text>
          <Text style={styles.statLbl}>Win rate</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{profile?.wins ?? 0}</Text>
          <Text style={styles.statLbl}>Wins</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{profile?.losses ?? 0}</Text>
          <Text style={styles.statLbl}>Losses</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{total}</Text>
          <Text style={styles.statLbl}>Matches</Text>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        {(['profile', 'history'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => {
              setActiveTab(t);
              if (t === 'history') loadMatches();
            }}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'profile' ? 'Profile' : 'Match History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <ScrollView contentContainerStyle={styles.content}>
          {editing && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Edit info</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Full name"
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={editUsername}
                onChangeText={setEditUsername}
                placeholder="Username"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
              />
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skill level</Text>
            {editing ? (
              <View style={styles.chipRow}>
                {SKILL_LEVELS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, editSkill === s && styles.chipActive]}
                    onPress={() => setEditSkill(s)}
                  >
                    <Text style={[styles.chipText, editSkill === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.chipRow}>
                <View style={styles.chipActive}>
                  <Text style={styles.chipTextActive}>{profile?.skill_level ?? 'Not set'}</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Playing style</Text>
            {editing ? (
              <View style={styles.chipRow}>
                {PLAYING_STYLES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, editStyles.includes(s) && styles.chipActive]}
                    onPress={() => toggleStyle(s)}
                  >
                    <Text style={[styles.chipText, editStyles.includes(s) && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.chipRow}>
                {(profile?.playing_styles ?? []).length > 0
                  ? profile!.playing_styles!.map((s) => (
                      <View key={s} style={styles.chipActive}>
                        <Text style={styles.chipTextActive}>{s}</Text>
                      </View>
                    ))
                  : <Text style={styles.emptyText}>No styles set</Text>
                }
              </View>
            )}
          </View>

          {/* Achievements */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Achievements · {earnedBadges.length}/{ALL_BADGES.length}
            </Text>
            <View style={styles.badgeGrid}>
              {ALL_BADGES.map((badge) => {
                const isEarned = earnedBadges.includes(badge.key);
                const isNew = newlyEarned.includes(badge.key);
                return (
                  <View
                    key={badge.key}
                    style={[
                      styles.badgeCard,
                      isEarned && { borderColor: badge.color, borderWidth: 2 },
                      !isEarned && styles.badgeCardLocked,
                    ]}
                  >
                    <Text style={[styles.badgeIcon, !isEarned && styles.badgeIconLocked]}>
                      {isEarned ? badge.icon : '🔒'}
                    </Text>
                    <Text style={[styles.badgeTitle, !isEarned && styles.badgeTitleLocked]}>
                      {badge.title}
                    </Text>
                    <Text style={styles.badgeDesc}>{badge.description}</Text>
                    {isNew && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEW!</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {editing && (
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={saveProfile}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save changes'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <View style={{ flex: 1 }}>
          <View style={styles.filterRow}>
            {(['all', 'singles', 'doubles'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, matchFilter === f && styles.filterChipActive]}
                onPress={() => setMatchFilter(f)}
              >
                <Text style={[styles.filterChipText, matchFilter === f && styles.filterChipTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {matchesLoading ? (
            <ActivityIndicator style={{ marginTop: 48 }} size="large" color="#1D9E75" />
          ) : filteredMatches.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="tennisball-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No matches yet</Text>
              <Text style={styles.emptySubtext}>Log your first match!</Text>
            </View>
          ) : (
            <FlatList
              data={filteredMatches}
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              renderItem={({ item }) => {
                const date = new Date(item.played_at);
                const sortedSets = [...item.sets].sort((a, b) => a.set_number - b.set_number);
                return (
                  <View style={[styles.matchCard, item.is_winner ? styles.matchWin : styles.matchLoss]}>
                    <View style={styles.matchLeft}>
                      <View style={[styles.resultBadge, item.is_winner ? styles.winBadge : styles.lossBadge]}>
                        <Text style={styles.resultBadgeText}>{item.is_winner ? 'W' : 'L'}</Text>
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.matchFormat}>{item.format} match</Text>
                      <Text style={styles.matchSets}>
                        {sortedSets.map((s) => `${s.score_team1}–${s.score_team2}`).join(', ')}
                      </Text>
                      <Text style={styles.matchDate}>
                        {date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    <Ionicons
                      name={item.is_winner ? 'trophy-outline' : 'close-circle-outline'}
                      size={20}
                      color={item.is_winner ? '#1D9E75' : '#ef4444'}
                    />
                  </View>
                );
              }}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { paddingHorizontal: 16, paddingBottom: 80 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#1D9E75',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnText: { fontSize: 13, color: '#1D9E75', fontWeight: '500' },
  avatarSection: { alignItems: 'center', marginBottom: 16, gap: 8 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#065f46' },
  fullName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  username: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statVal: { fontSize: 18, fontWeight: '700', color: '#1D9E75' },
  statLbl: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tabTextActive: { color: '#111827', fontWeight: '700' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 12, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  chipActive: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1D9E75',
  },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  chipTextActive: { fontSize: 13, color: '#fff', fontWeight: '500' },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#9ca3af' },
  emptySubtext: { fontSize: 14, color: '#d1d5db' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
    width: '100%',
  },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 24 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, color: '#6b7280', fontWeight: '500' },
  saveBtn: {
    flex: 2,
    backgroundColor: '#1D9E75',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCard: {
    width: '30%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 4,
  },
  badgeCardLocked: { backgroundColor: '#f9fafb', opacity: 0.5 },
  badgeIcon: { fontSize: 28 },
  badgeIconLocked: { opacity: 0.4 },
  badgeTitle: { fontSize: 11, fontWeight: '700', color: '#111827', textAlign: 'center' },
  badgeTitleLocked: { color: '#9ca3af' },
  badgeDesc: { fontSize: 10, color: '#9ca3af', textAlign: 'center', lineHeight: 13 },
  newBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  newBadgeText: { fontSize: 9, fontWeight: '700', color: '#d97706' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  filterChipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 60 },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  matchWin: { borderLeftWidth: 4, borderLeftColor: '#1D9E75' },
  matchLoss: { borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  matchLeft: { alignItems: 'center' },
  resultBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  winBadge: { backgroundColor: '#d1fae5' },
  lossBadge: { backgroundColor: '#fee2e2' },
  resultBadgeText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  matchFormat: { fontSize: 14, fontWeight: '600', color: '#111827' },
  matchSets: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  matchDate: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
});