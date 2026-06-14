import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type Player = {
  id: string;
  full_name: string | null;
  username: string | null;
  skill_level: string | null;
  wins: number;
  losses: number;
};

type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  created_at: string;
  friend?: Player;
  requester?: Player;
};

export default function FriendsScreen() {
  const [tab, setTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [requests, setRequests] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [sentRequests, setSentRequests] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadFriends();
    }, [])
  );

  const loadFriends = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      // Load accepted friends
      const { data: friendData } = await (supabase.from('friendships') as any)
        .select('*, friend:users!friendships_friend_id_fkey(id, full_name, username, skill_level, wins, losses)')
        .eq('user_id', user?.id)
        .eq('status', 'accepted');

      setFriends(friendData ?? []);

      // Load incoming requests
      const { data: requestData } = await (supabase.from('friendships') as any)
        .select('*, requester:users!friendships_user_id_fkey(id, full_name, username, skill_level, wins, losses)')
        .eq('friend_id', user?.id)
        .eq('status', 'pending');

      setRequests(requestData ?? []);

      // Load sent pending requests
      const { data: sentData } = await (supabase.from('friendships') as any)
        .select('friend_id')
        .eq('user_id', user?.id)
        .eq('status', 'pending');

      setSentRequests((sentData ?? []).map((s: any) => s.friend_id));
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const searchPlayers = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data, error } = await (supabase.from('users') as any)
        .select('id, full_name, username, skill_level, wins, losses')
        .or(`full_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
        .neq('id', currentUserId)
        .limit(10);

      if (error) throw error;
      setSearchResults(data ?? []);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (playerId: string) => {
    try {
      const { error } = await (supabase.from('friendships') as any).insert({
        user_id: currentUserId,
        friend_id: playerId,
        status: 'pending',
      });
      if (error) throw error;
      setSentRequests((prev) => [...prev, playerId]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const respondToRequest = async (friendshipId: string, accept: boolean) => {
    try {
      const { error } = await (supabase.from('friendships') as any)
        .update({ status: accept ? 'accepted' : 'rejected' })
        .eq('id', friendshipId);
      if (error) throw error;
      loadFriends();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const initials = (name: string | null) =>
    name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  const renderPlayer = (player: Player, actionSlot: React.ReactNode) => (
    <View key={player.id} style={styles.playerCard}>
      <View style={styles.playerAvatar}>
        <Text style={styles.playerAvatarText}>{initials(player.full_name)}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{player.full_name ?? player.username ?? 'Unknown'}</Text>
        <Text style={styles.playerMeta}>
          @{player.username ?? '—'} · {player.skill_level ?? 'unranked'} · {player.wins ?? 0}W
        </Text>
      </View>
      {actionSlot}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {([
          { key: 'friends', label: 'Friends', count: friends.length },
          { key: 'requests', label: 'Requests', count: requests.length },
          { key: 'search', label: 'Find players', count: 0 },
        ] as const).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
              {t.count > 0 && (
                <Text style={styles.tabBadge}> {t.count}</Text>
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color="#1D9E75" />
      ) : (
        <>
          {/* Friends tab */}
          {tab === 'friends' && (
            <FlatList
              data={friends}
              keyExtractor={(f) => f.id}
              contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="people-outline" size={48} color="#d1d5db" />
                  <Text style={styles.emptyText}>No friends yet</Text>
                  <Text style={styles.emptySubtext}>Search for players to add them!</Text>
                </View>
              }
              renderItem={({ item }) =>
                renderPlayer(
                  item.friend!,
                  <Ionicons name="checkmark-circle" size={22} color="#1D9E75" />
                )
              }
            />
          )}

          {/* Requests tab */}
          {tab === 'requests' && (
            <FlatList
              data={requests}
              keyExtractor={(r) => r.id}
              contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="mail-outline" size={48} color="#d1d5db" />
                  <Text style={styles.emptyText}>No pending requests</Text>
                </View>
              }
              renderItem={({ item }) =>
                renderPlayer(
                  item.requester!,
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => respondToRequest(item.id, true)}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => respondToRequest(item.id, false)}
                    >
                      <Ionicons name="close" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )
              }
            />
          )}

          {/* Search tab */}
          {tab === 'search' && (
            <View style={{ flex: 1 }}>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color="#9ca3af" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name or username..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={searchPlayers}
                  returnKeyType="search"
                  placeholderTextColor="#9ca3af"
                />
                {searching ? (
                  <ActivityIndicator size="small" color="#1D9E75" />
                ) : (
                  <TouchableOpacity onPress={searchPlayers}>
                    <Text style={styles.searchBtn}>Search</Text>
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={searchResults}
                keyExtractor={(p) => p.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Ionicons name="search-outline" size={48} color="#d1d5db" />
                    <Text style={styles.emptyText}>Search for players</Text>
                    <Text style={styles.emptySubtext}>Find friends by name or username</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const isFriend = friends.some((f) => f.friend?.id === item.id);
                  const isPending = sentRequests.includes(item.id);

                  return renderPlayer(
                    item,
                    isFriend ? (
                      <Ionicons name="checkmark-circle" size={22} color="#1D9E75" />
                    ) : isPending ? (
                      <Text style={styles.pendingText}>Pending</Text>
                    ) : (
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => sendRequest(item.id)}
                      >
                        <Ionicons name="person-add-outline" size={16} color="#fff" />
                      </TouchableOpacity>
                    )
                  );
                }}
              />
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tabActive: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  tabText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  tabBadge: { fontSize: 12, fontWeight: '700' },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerAvatarText: { fontSize: 15, fontWeight: '700', color: '#065f46' },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  playerMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingText: { fontSize: 12, color: '#9ca3af', fontWeight: '500' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  searchBtn: { fontSize: 14, color: '#1D9E75', fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 60 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#9ca3af' },
  emptySubtext: { fontSize: 14, color: '#d1d5db', textAlign: 'center' },
});