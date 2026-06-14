import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type Tournament = {
  id: string;
  name: string;
  court_id: string | null;
  created_by: string;
  format: string;
  status: string;
  starts_at: string;
  created_at: string;
  court?: { name: string; address: string } | null;
  player_count?: number;
  isRegistered?: boolean;
  isOwner?: boolean;
};

type Court = {
  id: string;
  name: string;
  address: string;
};

const FORMATS = ['singles', 'doubles', 'mixed'];
const STATUS_COLORS: Record<string, string> = {
  upcoming: '#3b82f6',
  ongoing: '#1D9E75',
  completed: '#9ca3af',
};

export default function TournamentsScreen() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [format, setFormat] = useState('singles');
  const [startsAt, setStartsAt] = useState('');
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<string | null>(null);
  const [showCourtPicker, setShowCourtPicker] = useState(false);

  // Detail modal
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadTournaments();
    }, [filter])
  );

  const loadTournaments = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      let query = (supabase.from('tournaments') as any)
        .select('*, court:courts(name, address), tournament_players(id, user_id)')
        .order('starts_at');

      if (filter === 'mine') {
        query = query.eq('created_by', user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const enriched: Tournament[] = (data ?? []).map((t: any) => ({
        ...t,
        player_count: t.tournament_players?.length ?? 0,
        isRegistered: t.tournament_players?.some((p: any) => p.user_id === user?.id),
        isOwner: t.created_by === user?.id,
      }));

      setTournaments(enriched);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCourts = async () => {
    const { data } = await (supabase.from('courts') as any).select('id, name, address');
    setCourts(data ?? []);
  };

  const openDetail = async (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setShowDetail(true);
    setPlayersLoading(true);
    try {
      const { data } = await (supabase.from('tournament_players') as any)
        .select('*, user:users(full_name, username, skill_level)')
        .eq('tournament_id', tournament.id)
        .order('seed');
      setPlayers(data ?? []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setPlayersLoading(false);
    }
  };

  const register = async (tournament: Tournament) => {
    try {
      const { error } = await (supabase.from('tournament_players') as any).insert({
        tournament_id: tournament.id,
        user_id: currentUserId,
        seed: tournament.player_count! + 1,
      });
      if (error) throw error;
      Alert.alert('Registered!', `You've joined ${tournament.name}`);
      loadTournaments();
      if (showDetail) openDetail({ ...tournament, player_count: tournament.player_count! + 1 });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const createTournament = async () => {
    if (!name.trim()) { Alert.alert('Missing info', 'Please enter a tournament name.'); return; }
    if (!startsAt) { Alert.alert('Missing info', 'Please enter a start date.'); return; }

    setCreating(true);
    try {
      const parsed = new Date(startsAt);
      if (isNaN(parsed.getTime())) {
        Alert.alert('Invalid date', 'Use format: YYYY-MM-DD HH:MM');
        return;
      }

      const { error } = await (supabase.from('tournaments') as any).insert({
        name: name.trim(),
        created_by: currentUserId,
        court_id: selectedCourt,
        format,
        status: 'upcoming',
        starts_at: parsed.toISOString(),
      });

      if (error) throw error;

      setShowModal(false);
      setName('');
      setStartsAt('');
      setSelectedCourt(null);
      setFormat('singles');
      loadTournaments();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setCreating(false);
    }
  };

  const initials = (name: string | null) =>
    name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  const renderTournament = ({ item }: { item: Tournament }) => {
    const date = new Date(item.starts_at);
    const statusColor = STATUS_COLORS[item.status] ?? '#9ca3af';

    return (
      <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tournamentName}>{item.name}</Text>
            {item.court?.name && (
              <Text style={styles.courtName}>{item.court.name}</Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={13} color="#6b7280" />
            <Text style={styles.infoText}>
              {date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="trophy-outline" size={13} color="#6b7280" />
            <Text style={styles.infoText}>{item.format}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="people-outline" size={13} color="#6b7280" />
            <Text style={styles.infoText}>{item.player_count} players</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          {item.isOwner ? (
            <View style={styles.ownerBadge}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#1D9E75" />
              <Text style={styles.ownerText}>Your tournament</Text>
            </View>
          ) : item.isRegistered ? (
            <View style={styles.registeredBadge}>
              <Ionicons name="checkmark-circle-outline" size={13} color="#3b82f6" />
              <Text style={styles.registeredText}>Registered</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => register(item)}
            >
              <Text style={styles.registerBtnText}>Register</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tournaments</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => { loadCourts(); setShowModal(true); }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'mine'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All tournaments' : 'My tournaments'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color="#1D9E75" />
      ) : tournaments.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="trophy-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>No tournaments yet</Text>
          <Text style={styles.emptySubtext}>Create one to get started!</Text>
        </View>
      ) : (
        <FlatList
          data={tournaments}
          keyExtractor={(t) => t.id}
          renderItem={renderTournament}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onRefresh={loadTournaments}
          refreshing={loading}
        />
      )}

      {/* Create Tournament Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create tournament</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Tournament name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Summer Open 2026"
                value={name}
                onChangeText={setName}
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.fieldLabel}>Format</Text>
              <View style={styles.toggle}>
                {FORMATS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.toggleBtn, format === f && styles.toggleActive]}
                    onPress={() => setFormat(f)}
                  >
                    <Text style={[styles.toggleText, format === f && styles.toggleTextActive]}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Court (optional)</Text>
              <TouchableOpacity
                style={styles.courtPickerBtn}
                onPress={() => setShowCourtPicker(true)}
              >
                <Ionicons name="location-outline" size={16} color="#6b7280" />
                <Text style={styles.courtPickerText}>
                  {selectedCourt
                    ? courts.find((c) => c.id === selectedCourt)?.name ?? 'Select a court'
                    : 'Select a court'}
                </Text>
                <Ionicons name="chevron-down-outline" size={16} color="#6b7280" />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Start date & time (YYYY-MM-DD HH:MM)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2026-07-01 09:00"
                value={startsAt}
                onChangeText={setStartsAt}
                placeholderTextColor="#9ca3af"
              />

              <TouchableOpacity
                style={[styles.createConfirmBtn, creating && { opacity: 0.6 }]}
                onPress={createTournament}
                disabled={creating}
              >
                <Text style={styles.createConfirmText}>
                  {creating ? 'Creating...' : 'Create tournament'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Court Picker Modal */}
      <Modal visible={showCourtPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a court</Text>
              <TouchableOpacity onPress={() => setShowCourtPicker(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.courtOption, selectedCourt === null && styles.courtOptionActive]}
              onPress={() => { setSelectedCourt(null); setShowCourtPicker(false); }}
            >
              <Text style={styles.courtOptionName}>No court</Text>
              {selectedCourt === null && <Ionicons name="checkmark-circle" size={20} color="#1D9E75" />}
            </TouchableOpacity>
            {courts.map((court) => (
              <TouchableOpacity
                key={court.id}
                style={[styles.courtOption, selectedCourt === court.id && styles.courtOptionActive]}
                onPress={() => { setSelectedCourt(court.id); setShowCourtPicker(false); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.courtOptionName}>{court.name}</Text>
                  <Text style={styles.courtOptionAddress}>{court.address}</Text>
                </View>
                {selectedCourt === court.id && <Ionicons name="checkmark-circle" size={20} color="#1D9E75" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Tournament Detail Modal */}
      <Modal visible={showDetail} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedTournament?.name}</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedTournament?.format} · {selectedTournament?.status}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Info */}
              <View style={styles.detailInfo}>
                <View style={styles.infoItem}>
                  <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                  <Text style={styles.infoText}>
                    {selectedTournament && new Date(selectedTournament.starts_at)
                      .toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                {selectedTournament?.court?.name && (
                  <View style={styles.infoItem}>
                    <Ionicons name="location-outline" size={14} color="#6b7280" />
                    <Text style={styles.infoText}>{selectedTournament.court.name}</Text>
                  </View>
                )}
              </View>

              {/* Register button */}
              {!selectedTournament?.isOwner && !selectedTournament?.isRegistered && (
                <TouchableOpacity
                  style={styles.registerBtnLarge}
                  onPress={() => selectedTournament && register(selectedTournament)}
                >
                  <Text style={styles.registerBtnLargeText}>Register for this tournament</Text>
                </TouchableOpacity>
              )}

              {/* Players list */}
              <Text style={styles.playersTitle}>
                Players ({players.length})
              </Text>

              {playersLoading ? (
                <ActivityIndicator color="#1D9E75" style={{ marginTop: 16 }} />
              ) : players.length === 0 ? (
                <Text style={styles.noPlayersText}>No players registered yet</Text>
              ) : (
                players.map((p, index) => (
                  <View key={p.id} style={styles.playerRow}>
                    <Text style={styles.playerSeed}>#{p.seed ?? index + 1}</Text>
                    <View style={styles.playerAvatar}>
                      <Text style={styles.playerAvatarText}>
                        {initials(p.user?.full_name)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playerName}>
                        {p.user?.full_name ?? p.user?.username ?? 'Unknown'}
                      </Text>
                      <Text style={styles.playerSkill}>{p.user?.skill_level ?? 'unranked'}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1D9E75',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  filterChipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  tournamentName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  courtName: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  infoRow: { flexDirection: 'row', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 13, color: '#6b7280' },
  cardFooter: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10 },
  ownerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownerText: { fontSize: 13, color: '#1D9E75', fontWeight: '500' },
  registeredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  registeredText: { fontSize: 13, color: '#3b82f6', fontWeight: '500' },
  registerBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1D9E75',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  registerBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#9ca3af' },
  emptySubtext: { fontSize: 14, color: '#d1d5db' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2, textTransform: 'capitalize' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  toggle: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  toggleActive: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  toggleText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  toggleTextActive: { color: '#fff' },
  courtPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  courtPickerText: { flex: 1, fontSize: 15, color: '#6b7280' },
  courtOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  courtOptionActive: { borderColor: '#1D9E75', backgroundColor: '#f0fdf4' },
  courtOptionName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  courtOptionAddress: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  createConfirmBtn: {
    backgroundColor: '#1D9E75',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  createConfirmText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  detailInfo: { gap: 8, marginBottom: 16 },
  registerBtnLarge: {
    backgroundColor: '#1D9E75',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  registerBtnLargeText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  playersTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  noPlayersText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  playerSeed: { fontSize: 13, fontWeight: '700', color: '#9ca3af', width: 24 },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerAvatarText: { fontSize: 12, fontWeight: '700', color: '#065f46' },
  playerName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  playerSkill: { fontSize: 12, color: '#9ca3af', textTransform: 'capitalize' },
});