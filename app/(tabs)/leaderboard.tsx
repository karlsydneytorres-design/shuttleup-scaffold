import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type Player = {
  id: string;
  username: string | null;
  full_name: string | null;
  wins: number;
  losses: number;
  skill_level: string | null;
  winRate: number;
  total: number;
};

const RANK_COLORS = ['#f59e0b', '#9ca3af', '#b45309'];
const RANK_ICONS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'wins' | 'winrate' | 'matches'>('wins');

  useFocusEffect(
    useCallback(() => {
      loadLeaderboard();
    }, [sortBy])
  );

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const { data, error } = await (supabase.from('users') as any)
        .select('id, username, full_name, wins, losses, skill_level');

      if (error) throw error;

      const enriched: Player[] = (data ?? []).map((p: any) => {
        const total = (p.wins ?? 0) + (p.losses ?? 0);
        const winRate = total > 0 ? Math.round((p.wins / total) * 100) : 0;
        return { ...p, wins: p.wins ?? 0, losses: p.losses ?? 0, total, winRate };
      });

      const sorted = enriched.sort((a, b) => {
        if (sortBy === 'wins') return b.wins - a.wins;
        if (sortBy === 'winrate') return b.winRate - a.winRate;
        if (sortBy === 'matches') return b.total - a.total;
        return 0;
      });

      setPlayers(sorted);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initials = (name: string | null) =>
    name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  const renderPlayer = ({ item, index }: { item: Player; index: number }) => {
    const isCurrentUser = item.id === currentUserId;
    const isTop3 = index < 3;

    return (
      <View style={[
        styles.row,
        isCurrentUser && styles.rowHighlight,
        isTop3 && styles.rowTop3,
      ]}>
        {/* Rank */}
        <View style={styles.rankCol}>
          {isTop3 ? (
            <Text style={styles.rankEmoji}>{RANK_ICONS[index]}</Text>
          ) : (
            <Text style={[styles.rankNum, isCurrentUser && styles.rankNumHighlight]}>
              {index + 1}
            </Text>
          )}
        </View>

        {/* Avatar */}
        <View style={[
          styles.avatar,
          isTop3 && { borderWidth: 2, borderColor: RANK_COLORS[index] },
          isCurrentUser && { backgroundColor: '#d1fae5' },
        ]}>
          <Text style={styles.avatarText}>{initials(item.full_name)}</Text>
        </View>

        {/* Name + skill */}
        <View style={styles.nameCol}>
          <Text style={[styles.playerName, isCurrentUser && styles.playerNameHighlight]}>
            {item.full_name ?? item.username ?? 'Unknown'}
            {isCurrentUser && ' (you)'}
          </Text>
          <Text style={styles.skillLevel}>{item.skill_level ?? 'unranked'}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsCol}>
          <Text style={[styles.statMain, isTop3 && { color: RANK_COLORS[index] }]}>
            {sortBy === 'wins' && `${item.wins}W`}
            {sortBy === 'winrate' && `${item.winRate}%`}
            {sortBy === 'matches' && `${item.total}`}
          </Text>
          <Text style={styles.statSub}>
            {sortBy === 'wins' && `${item.winRate}% WR`}
            {sortBy === 'winrate' && `${item.wins}W ${item.losses}L`}
            {sortBy === 'matches' && `${item.wins}W ${item.losses}L`}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <TouchableOpacity onPress={loadLeaderboard}>
          <Ionicons name="refresh-outline" size={22} color="#1D9E75" />
        </TouchableOpacity>
      </View>

      {/* Sort tabs */}
      <View style={styles.sortRow}>
        {([
          { key: 'wins', label: 'Wins' },
          { key: 'winrate', label: 'Win Rate' },
          { key: 'matches', label: 'Matches' },
        ] as const).map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.sortChip, sortBy === s.key && styles.sortChipActive]}
            onPress={() => setSortBy(s.key)}
          >
            <Text style={[styles.sortChipText, sortBy === s.key && styles.sortChipTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color="#1D9E75" />
      ) : (
        <FlatList
          data={players}
          keyExtractor={(p) => p.id}
          renderItem={renderPlayer}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  sortRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  sortChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sortChipActive: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  sortChipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  sortChipTextActive: { color: '#fff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  rowHighlight: {
    borderColor: '#1D9E75',
    backgroundColor: '#f0fdf4',
  },
  rowTop3: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  rankCol: { width: 28, alignItems: 'center' },
  rankEmoji: { fontSize: 20 },
  rankNum: { fontSize: 16, fontWeight: '700', color: '#9ca3af' },
  rankNumHighlight: { color: '#1D9E75' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  nameCol: { flex: 1 },
  playerName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  playerNameHighlight: { color: '#1D9E75' },
  skillLevel: { fontSize: 12, color: '#9ca3af', marginTop: 1, textTransform: 'capitalize' },
  statsCol: { alignItems: 'flex-end' },
  statMain: { fontSize: 16, fontWeight: '700', color: '#111827' },
  statSub: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
});