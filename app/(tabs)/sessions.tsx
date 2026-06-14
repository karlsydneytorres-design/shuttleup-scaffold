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

type Session = {
  id: string;
  court_id: string | null;
  created_by: string;
  format: string;
  slots_total: number;
  slots_filled: number;
  status: string;
  scheduled_at: string;
  created_at: string;
  court?: { name: string; address: string } | null;
  isOwner?: boolean;
};

type Court = {
  id: string;
  name: string;
  address: string;
};

export default function SessionsScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'mine'>('open');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [format, setFormat] = useState<'singles' | 'doubles'>('singles');
  const [slotsTotal, setSlotsTotal] = useState('4');
  const [scheduledAt, setScheduledAt] = useState('');
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<string | null>(null);
  const [showCourtPicker, setShowCourtPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [filter])
  );

  const loadCourts = async () => {
    const { data } = await (supabase.from('courts') as any).select('id, name, address');
    setCourts(data ?? []);
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      let query = supabase
        .from('sessions')
        .select('*, court:courts(name, address)')
        .order('scheduled_at');

      if (filter === 'open') {
        query = query.eq('status', 'open').gt('scheduled_at', new Date().toISOString());
      } else {
        query = query.eq('created_by', user?.id ?? '');
      }

      const { data, error } = await query;
      if (error) throw error;

      const enriched = (data || []).map((s: any) => ({
        ...s,
        isOwner: s.created_by === user?.id,
      }));

      setSessions(enriched);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async (session: Session) => {
    if (session.slots_filled >= session.slots_total) {
      Alert.alert('Full', 'This session is already full.');
      return;
    }
    try {
      await (supabase.from('session_players') as any)
        .insert({ session_id: session.id, user_id: userId });
      await (supabase.from('sessions') as any)
        .update({ slots_filled: session.slots_filled + 1 })
        .eq('id', session.id);
      loadSessions();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const createSession = async () => {
    if (!scheduledAt) {
      Alert.alert('Missing info', 'Please enter a date and time.');
      return;
    }
    setCreating(true);
    try {
      const parsed = new Date(scheduledAt);
      if (isNaN(parsed.getTime())) {
        Alert.alert('Invalid date', 'Use format: YYYY-MM-DD HH:MM');
        return;
      }

      const { error } = await (supabase.from('sessions') as any).insert({
        created_by: userId,
        court_id: selectedCourt,
        format,
        slots_total: parseInt(slotsTotal) || 4,
        slots_filled: 0,
        status: 'open',
        scheduled_at: parsed.toISOString(),
      });

      if (error) throw error;

      setShowModal(false);
      setScheduledAt('');
      setSlotsTotal('4');
      setFormat('singles');
      setSelectedCourt(null);
      loadSessions();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setCreating(false);
    }
  };

  const getStatusColor = (session: Session) => {
    const pct = session.slots_filled / session.slots_total;
    if (pct >= 1) return '#ef4444';
    if (pct >= 0.75) return '#f59e0b';
    return '#1D9E75';
  };

  const renderSession = ({ item }: { item: Session }) => {
    const isFull = item.slots_filled >= item.slots_total;
    const date = new Date(item.scheduled_at);

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.courtName}>
              {item.court?.name ?? 'No court specified'}
            </Text>
            {item.court?.address && (
              <Text style={styles.courtAddress}>{item.court.address}</Text>
            )}
          </View>
          <View style={[styles.formatBadge, item.format === 'doubles' && styles.formatBadgeDoubles]}>
            <Text style={styles.formatBadgeText}>{item.format}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={14} color="#6b7280" />
            <Text style={styles.infoText}>
              {date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={14} color="#6b7280" />
            <Text style={styles.infoText}>
              {date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="people-outline" size={14} color={getStatusColor(item)} />
            <Text style={[styles.infoText, { color: getStatusColor(item) }]}>
              {item.slots_filled}/{item.slots_total} players
            </Text>
          </View>
        </View>

        {item.isOwner ? (
          <View style={styles.ownerBadge}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#1D9E75" />
            <Text style={styles.ownerText}>Your session</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.joinBtn, isFull && styles.joinBtnFull]}
            onPress={() => !isFull && joinSession(item)}
            disabled={isFull}
          >
            <Text style={styles.joinBtnText}>{isFull ? 'Full' : 'Join session'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sessions</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => { loadCourts(); setShowModal(true); }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {(['open', 'mine'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'open' ? 'Open sessions' : 'My sessions'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color="#1D9E75" />
      ) : sessions.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>No sessions found</Text>
          <Text style={styles.emptySubtext}>
            {filter === 'open' ? 'Create one to get started!' : "You haven't created any sessions yet."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => s.id}
          renderItem={renderSession}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onRefresh={loadSessions}
          refreshing={loading}
        />
      )}

      {/* Create Session Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create session</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Format</Text>
              <View style={styles.toggle}>
                {(['singles', 'doubles'] as const).map((f) => (
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

              <Text style={styles.fieldLabel}>Total slots</Text>
              <View style={styles.toggle}>
                {['2', '4', '6', '8'].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.toggleBtn, slotsTotal === n && styles.toggleActive]}
                    onPress={() => setSlotsTotal(n)}
                  >
                    <Text style={[styles.toggleText, slotsTotal === n && styles.toggleTextActive]}>{n}</Text>
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

              <Text style={styles.fieldLabel}>Date & time (YYYY-MM-DD HH:MM)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 2026-06-20 09:00"
                value={scheduledAt}
                onChangeText={setScheduledAt}
                placeholderTextColor="#9ca3af"
              />

              <TouchableOpacity
                style={[styles.createConfirmBtn, creating && { opacity: 0.6 }]}
                onPress={createSession}
                disabled={creating}
              >
                <Text style={styles.createConfirmText}>
                  {creating ? 'Creating...' : 'Create session'}
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
              {selectedCourt === null && (
                <Ionicons name="checkmark-circle" size={20} color="#1D9E75" />
              )}
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
                {selectedCourt === court.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#1D9E75" />
                )}
              </TouchableOpacity>
            ))}
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
  courtName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  courtAddress: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  formatBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  formatBadgeDoubles: { backgroundColor: '#fef3c7' },
  formatBadgeText: { fontSize: 12, fontWeight: '600', color: '#5b21b6' },
  infoRow: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 13, color: '#6b7280' },
  joinBtn: {
    backgroundColor: '#1D9E75',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  joinBtnFull: { backgroundColor: '#e5e7eb' },
  joinBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  ownerText: { fontSize: 13, color: '#1D9E75', fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#9ca3af' },
  emptySubtext: { fontSize: 14, color: '#d1d5db', textAlign: 'center', paddingHorizontal: 32 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 8, marginTop: 16 },
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
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  createConfirmBtn: {
    backgroundColor: '#1D9E75',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  createConfirmText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
});