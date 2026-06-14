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
  Linking,
  Platform,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const SURFACE_TYPES = ['Wood', 'Synthetic', 'Concrete', 'Grass'];

type Court = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  surface_type: string | null;
  is_indoor: boolean;
  avg_rating: number | null;
  distance?: number;
  created_by?: string | null;
};

type Review = {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user?: { full_name: string | null; username: string | null };
};

export default function CourtsScreen() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterIndoor, setFilterIndoor] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance');

  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Add Court modal state
  const [showAddCourt, setShowAddCourt] = useState(false);
  const [addingCourt, setAddingCourt] = useState(false);
  const [newCourtName, setNewCourtName] = useState('');
  const [newCourtAddress, setNewCourtAddress] = useState('');
  const [newCourtSurface, setNewCourtSurface] = useState('');
  const [newCourtIndoor, setNewCourtIndoor] = useState(false);
  const [newCourtLat, setNewCourtLat] = useState('');
  const [newCourtLng, setNewCourtLng] = useState('');

  useFocusEffect(
    useCallback(() => {
      requestLocationAndFetch();
    }, [])
  );

  const requestLocationAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setUserCoords(coords);
        fetchCourts(coords);
      } else {
        fetchCourts(null);
      }
    } catch {
      fetchCourts(null);
    }
  };

  const fetchCourts = async (coords: { lat: number; lng: number } | null) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('courts').select('*');
      if (error) throw error;
      const enriched: Court[] = (data || []).map((court: any) => {
        let distance: number | undefined;
        if (coords && court.latitude && court.longitude) {
          distance = getDistanceKm(coords.lat, coords.lng, court.latitude, court.longitude);
        }
        return { ...court, distance };
      });
      setCourts(enriched);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load courts');
    } finally {
      setLoading(false);
    }
  };

  const openCourtDetail = async (court: Court) => {
    setSelectedCourt(court);
    setShowDetail(true);
    setMyRating(0);
    setMyComment('');
    loadReviews(court.id);
  };

  const loadReviews = async (courtId: string) => {
    setReviewsLoading(true);
    try {
      const { data, error } = await (supabase.from('court_reviews') as any)
        .select('*, user:users(full_name, username)')
        .eq('court_id', courtId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReviews(data ?? []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setReviewsLoading(false);
    }
  };

  const submitReview = async () => {
    if (myRating === 0) {
      Alert.alert('Rating required', 'Please select a star rating.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase.from('court_reviews') as any).insert({
        court_id: selectedCourt!.id,
        user_id: currentUserId,
        rating: myRating,
        comment: myComment || null,
      });
      if (error) throw error;
      const newAvg = reviews.length > 0
        ? ((reviews.reduce((sum, r) => sum + r.rating, 0) + myRating) / (reviews.length + 1))
        : myRating;
      await (supabase.from('courts') as any)
        .update({ avg_rating: Math.round(newAvg * 10) / 10 })
        .eq('id', selectedCourt!.id);
      setMyRating(0);
      setMyComment('');
      loadReviews(selectedCourt!.id);
      fetchCourts(userCoords);
      Alert.alert('Thanks!', 'Your review has been submitted.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openAddCourt = () => {
    setNewCourtName('');
    setNewCourtAddress('');
    setNewCourtSurface('');
    setNewCourtIndoor(false);
    setNewCourtLat(userCoords ? userCoords.lat.toFixed(6) : '');
    setNewCourtLng(userCoords ? userCoords.lng.toFixed(6) : '');
    setShowAddCourt(true);
  };

  const submitAddCourt = async () => {
    if (!newCourtName.trim()) {
      Alert.alert('Required', 'Please enter a court name.');
      return;
    }
    if (!newCourtAddress.trim()) {
      Alert.alert('Required', 'Please enter an address.');
      return;
    }
    const lat = parseFloat(newCourtLat);
    const lng = parseFloat(newCourtLng);
    const hasCoords = !isNaN(lat) && !isNaN(lng);
    setAddingCourt(true);
    try {
      const { error } = await (supabase.from('courts') as any).insert({
        name: newCourtName.trim(),
        address: newCourtAddress.trim(),
        surface_type: newCourtSurface || null,
        is_indoor: newCourtIndoor,
        latitude: hasCoords ? lat : null,
        longitude: hasCoords ? lng : null,
        avg_rating: null,
        created_by: currentUserId,
      });
      if (error) throw error;
      setShowAddCourt(false);
      fetchCourts(userCoords);
      Alert.alert('Court added!', `${newCourtName.trim()} is now on the map.`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setAddingCourt(false);
    }
  };

  const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const openMaps = (court: Court) => {
    const query = court.latitude && court.longitude
      ? `${court.latitude},${court.longitude}`
      : encodeURIComponent(`${court.name}, ${court.address}`);
    const url = Platform.OS === 'ios' ? `maps://?q=${query}` : `geo:0,0?q=${query}`;
    Linking.openURL(url);
  };

  const renderStars = (rating: number, size = 16, interactive = false) => (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => interactive && setMyRating(star)} disabled={!interactive}>
          <Ionicons
            name={star <= rating ? 'star' : 'star-outline'}
            size={size}
            color={star <= rating ? '#f59e0b' : '#d1d5db'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  const filtered = courts
    .filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch = c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q);
      const matchesFilter = filterIndoor === null || c.is_indoor === filterIndoor;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortBy === 'distance') return (a.distance ?? 999) - (b.distance ?? 999);
      if (sortBy === 'rating') return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
      return 0;
    });

  const renderCourt = ({ item }: { item: Court }) => (
    <TouchableOpacity style={styles.card} onPress={() => openCourtDetail(item)}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={styles.courtName}>{item.name}</Text>
            {item.created_by === currentUserId && (
              <View style={styles.myCourtBadge}>
                <Text style={styles.myCourtBadgeText}>Added by you</Text>
              </View>
            )}
          </View>
          <Text style={styles.courtAddress}>{item.address}</Text>
        </View>
        <View style={[styles.badge, item.is_indoor ? styles.badgeIndoor : styles.badgeOutdoor]}>
          <Text style={[styles.badgeText, item.is_indoor ? styles.badgeTextIndoor : styles.badgeTextOutdoor]}>
            {item.is_indoor ? 'Indoor' : 'Outdoor'}
          </Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        {item.surface_type && (
          <View style={styles.stat}>
            <Ionicons name="layers-outline" size={14} color="#666" />
            <Text style={styles.statText}>{item.surface_type}</Text>
          </View>
        )}
        {item.avg_rating ? (
          <View style={styles.stat}>
            {renderStars(Math.round(item.avg_rating), 13)}
            <Text style={styles.statText}>{item.avg_rating.toFixed(1)}</Text>
          </View>
        ) : (
          <Text style={styles.noRating}>No reviews yet</Text>
        )}
        {item.distance !== undefined && (
          <View style={styles.stat}>
            <Ionicons name="location-outline" size={14} color="#666" />
            <Text style={styles.statText}>{item.distance.toFixed(1)} km</Text>
          </View>
        )}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openMaps(item)}>
          <Ionicons name="navigate-outline" size={16} color="#2563eb" />
          <Text style={styles.actionBtnText}>Directions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openCourtDetail(item)}>
          <Ionicons name="chatbubble-outline" size={16} color="#2563eb" />
          <Text style={styles.actionBtnText}>Reviews</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Courts</Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <TouchableOpacity onPress={requestLocationAndFetch}>
            <Ionicons name="refresh-outline" size={22} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={openAddCourt}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add court</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search courts..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#9ca3af"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filtersRow}>
        <View style={styles.filterGroup}>
          {[{ label: 'All', value: null }, { label: 'Indoor', value: true }, { label: 'Outdoor', value: false }].map((f) => (
            <TouchableOpacity
              key={String(f.value)}
              style={[styles.filterChip, filterIndoor === f.value && styles.filterChipActive]}
              onPress={() => setFilterIndoor(f.value)}
            >
              <Text style={[styles.filterChipText, filterIndoor === f.value && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.filterGroup}>
          {(['distance', 'rating'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.filterChip, sortBy === s && styles.filterChipActive]}
              onPress={() => setSortBy(s)}
            >
              <Text style={[styles.filterChipText, sortBy === s && styles.filterChipTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color="#2563eb" />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="location-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>No courts found</Text>
          <TouchableOpacity style={[styles.addBtn, { marginTop: 12 }]} onPress={openAddCourt}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add the first one</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={renderCourt}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* ── Court Detail Modal ── */}
      <Modal visible={showDetail} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedCourt?.name}</Text>
                <Text style={styles.modalSubtitle}>{selectedCourt?.address}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.reviewForm}>
                <Text style={styles.reviewFormTitle}>Leave a review</Text>
                <View style={{ marginBottom: 10 }}>{renderStars(myRating, 28, true)}</View>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Share your experience (optional)"
                  value={myComment}
                  onChangeText={setMyComment}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                  onPress={submitReview}
                  disabled={submitting}
                >
                  <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit review'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.reviewsTitle}>Reviews {reviews.length > 0 ? `(${reviews.length})` : ''}</Text>
              {reviewsLoading ? (
                <ActivityIndicator color="#2563eb" style={{ marginTop: 16 }} />
              ) : reviews.length === 0 ? (
                <Text style={styles.noReviewsText}>No reviews yet — be the first!</Text>
              ) : (
                reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewAuthor}>
                        {review.user?.full_name ?? review.user?.username ?? 'Anonymous'}
                      </Text>
                      {renderStars(review.rating, 13)}
                    </View>
                    {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
                    <Text style={styles.reviewDate}>
                      {new Date(review.created_at).toLocaleDateString('en-PH', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Add Court Modal ── */}
      <Modal visible={showAddCourt} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '92%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add a court</Text>
                <TouchableOpacity onPress={() => setShowAddCourt(false)}>
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {/* Court name */}
                <Text style={styles.fieldLabel}>Court name *</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Makati Sports Club"
                  value={newCourtName}
                  onChangeText={setNewCourtName}
                  placeholderTextColor="#9ca3af"
                />

                {/* Address */}
                <Text style={styles.fieldLabel}>Address *</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. 123 Ayala Ave, Makati"
                  value={newCourtAddress}
                  onChangeText={setNewCourtAddress}
                  placeholderTextColor="#9ca3af"
                />

                {/* Indoor / Outdoor */}
                <Text style={styles.fieldLabel}>Type</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleOpt, !newCourtIndoor && styles.toggleOptActive]}
                    onPress={() => setNewCourtIndoor(false)}
                  >
                    <Ionicons name="sunny-outline" size={16} color={!newCourtIndoor ? '#fff' : '#6b7280'} />
                    <Text style={[styles.toggleOptText, !newCourtIndoor && styles.toggleOptTextActive]}>Outdoor</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleOpt, newCourtIndoor && styles.toggleOptActive]}
                    onPress={() => setNewCourtIndoor(true)}
                  >
                    <Ionicons name="business-outline" size={16} color={newCourtIndoor ? '#fff' : '#6b7280'} />
                    <Text style={[styles.toggleOptText, newCourtIndoor && styles.toggleOptTextActive]}>Indoor</Text>
                  </TouchableOpacity>
                </View>

                {/* Surface type */}
                <Text style={styles.fieldLabel}>Surface type</Text>
                <View style={styles.chipRow}>
                  {SURFACE_TYPES.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.surfaceChip, newCourtSurface === s && styles.surfaceChipActive]}
                      onPress={() => setNewCourtSurface(newCourtSurface === s ? '' : s)}
                    >
                      <Text style={[styles.surfaceChipText, newCourtSurface === s && styles.surfaceChipTextActive]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Coordinates */}
                <Text style={styles.fieldLabel}>Coordinates (optional)</Text>
                <Text style={styles.fieldHint}>
                  {userCoords
                    ? 'Pre-filled from your current location — adjust if the court is elsewhere.'
                    : 'Enter lat/lng so the court shows distance and directions. Find them on Google Maps.'}
                </Text>
                <View style={styles.coordRow}>
                  <TextInput
                    style={[styles.fieldInput, { flex: 1 }]}
                    placeholder="Latitude"
                    value={newCourtLat}
                    onChangeText={setNewCourtLat}
                    keyboardType="numeric"
                    placeholderTextColor="#9ca3af"
                  />
                  <TextInput
                    style={[styles.fieldInput, { flex: 1 }]}
                    placeholder="Longitude"
                    value={newCourtLng}
                    onChangeText={setNewCourtLng}
                    keyboardType="numeric"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, { marginTop: 20 }, addingCourt && { opacity: 0.5 }]}
                  onPress={submitAddCourt}
                  disabled={addingCourt}
                >
                  <Text style={styles.submitBtnText}>
                    {addingCourt ? 'Adding court...' : 'Add court'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1D9E75',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  filtersRow: { paddingHorizontal: 16, marginTop: 10, gap: 8 },
  filterGroup: { flexDirection: 'row', gap: 6 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterChipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  courtName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  courtAddress: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  myCourtBadge: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  myCourtBadgeText: { fontSize: 10, fontWeight: '600', color: '#16a34a' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeIndoor: { backgroundColor: '#dbeafe' },
  badgeOutdoor: { backgroundColor: '#dcfce7' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextIndoor: { color: '#1d4ed8' },
  badgeTextOutdoor: { color: '#15803d' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12, alignItems: 'center' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, color: '#6b7280' },
  noRating: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },
  cardActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  actionBtnText: { fontSize: 13, color: '#2563eb', fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#9ca3af' },
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  reviewForm: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reviewFormTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 10 },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
    marginBottom: 10,
    textAlignVertical: 'top',
    minHeight: 70,
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  reviewsTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  noReviewsText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 8 },
  reviewCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reviewAuthor: { fontSize: 13, fontWeight: '600', color: '#111827' },
  reviewComment: { fontSize: 13, color: '#374151', marginBottom: 6, lineHeight: 18 },
  reviewDate: { fontSize: 11, color: '#9ca3af' },

  // Add Court form
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  fieldHint: { fontSize: 12, color: '#9ca3af', marginBottom: 8, marginTop: -2, lineHeight: 16 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
    marginBottom: 4,
  },
  coordRow: { flexDirection: 'row', gap: 10 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleOpt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  toggleOptActive: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  toggleOptText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  toggleOptTextActive: { color: '#fff' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  surfaceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  surfaceChipActive: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  surfaceChipText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  surfaceChipTextActive: { color: '#fff' },
});