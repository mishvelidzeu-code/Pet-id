import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { fetchPublicClinics } from '../lib/contentService';
import BookingRequestModal from '../components/BookingRequestModal';

function getDistance(lat1, lon1, lat2, lon2) {
  const radius = 6371;
  const deltaLat = (lat2 - lat1) * (Math.PI / 180);
  const deltaLng = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
}

function formatDistance(value) {
  if (value == null) return null;
  if (value < 1) return `${Math.round(value * 1000)} მ`;
  return `${value.toFixed(1)} კმ`;
}

function ScreenHeader({ onBack }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={20} color="#16352c" />
        </TouchableOpacity>
      ) : null}
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>კლინიკები</Text>
        <Text style={styles.headerSubtitle}>
          მოძებნე უახლოესი ვეტ-კლინიკა, დაურეკე ან პირდაპირ გაუშვი მარშრუტი.
        </Text>
      </View>
    </View>
  );
}

export default function ClinicsScreen({ onBack = null, session = null, profile = null }) {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingClinic, setBookingClinic] = useState(null);

  const visibleClinics = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return clinics;
    }

    return clinics.filter((clinic) => {
      const clinicName = String(clinic.name || '').toLowerCase();
      const clinicAddress = String(clinic.address || '').toLowerCase();
      const clinicServices = String(clinic.services_preview || '').toLowerCase();
      return (
        clinicName.includes(normalizedQuery) ||
        clinicAddress.includes(normalizedQuery) ||
        clinicServices.includes(normalizedQuery)
      );
    });
  }, [clinics, searchQuery]);

  useEffect(() => {
    loadClinics();
  }, []);

  async function loadClinics(withRefresh = false) {
    if (withRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { data } = await fetchPublicClinics();
    let nextClinics = data || [];

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        nextClinics = nextClinics
          .map((clinic) => {
            if (
              clinic.lat == null ||
              clinic.lng == null ||
              Number.isNaN(clinic.lat) ||
              Number.isNaN(clinic.lng)
            ) {
              return clinic;
            }

            return {
              ...clinic,
              distance: getDistance(
                location.coords.latitude,
                location.coords.longitude,
                clinic.lat,
                clinic.lng
              ),
            };
          })
          .sort((a, b) => {
            if (a.distance == null) return 1;
            if (b.distance == null) return -1;
            return a.distance - b.distance;
          });
      }
    } catch (error) {
      console.log('Clinic location error:', error);
    }

    setClinics(nextClinics);
    setLoading(false);
    setRefreshing(false);
  }

  function openMaps(clinic) {
    const url =
      clinic.google_maps_url ||
      `https://www.google.com/maps/dir/?api=1&destination=${clinic.lat},${clinic.lng}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('შეცდომა', 'რუკის გახსნა ვერ მოხერხდა.')
    );
  }

  function makeCall(phone) {
    if (!phone) {
      Alert.alert('შეცდომა', 'ტელეფონის ნომერი მითითებული არ არის.');
      return;
    }

    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('შეცდომა', 'დარეკვა ვერ მოხერხდა.')
    );
  }

  function openWhatsApp(phone) {
    if (!phone) {
      Alert.alert('შეცდომა', 'WhatsApp ნომერი მითითებული არ არის.');
      return;
    }

    const normalizedPhone = String(phone).replace(/[^\d]/g, '');
    Linking.openURL(`https://wa.me/${normalizedPhone}`).catch(() =>
      Alert.alert('შეცდომა', 'WhatsApp-ის გახსნა ვერ მოხერხდა.')
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader onBack={onBack} />

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#6a7f76" />
        <TextInput
          style={styles.searchInput}
          placeholder="მოძებნე კლინიკა"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#8ca097"
        />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2e8b57" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadClinics(true)} />
          }
        >
          {visibleClinics.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'ასეთი კლინიკა ვერ მოიძებნა.'
                  : 'აქტიური კლინიკები ჯერ არ არის დამატებული.'}
              </Text>
            </View>
          ) : (
            visibleClinics.map((clinic, index) => (
              <View key={clinic.id} style={styles.card}>
                <View style={styles.imageWrap}>
                  <Image source={{ uri: clinic.image_url }} style={styles.image} />
                  {index === 0 && clinic.distance != null ? (
                    <View style={styles.closestBadge}>
                      <Text style={styles.closestBadgeText}>ყველაზე ახლო</Text>
                    </View>
                  ) : null}
                  {clinic.distance != null ? (
                    <View style={styles.distanceBadge}>
                      <Text style={styles.distanceText}>{formatDistance(clinic.distance)}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.name}>{clinic.name}</Text>
                  <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={16} color="#0066cc" />
                    <Text style={styles.address}>{clinic.address}</Text>
                  </View>
                  {clinic.working_hours ? (
                    <View style={styles.addressRow}>
                      <Ionicons name="time-outline" size={16} color="#2e8b57" />
                      <Text style={styles.address}>{clinic.working_hours}</Text>
                    </View>
                  ) : null}
                  {clinic.services?.length ? (
                    <View style={styles.serviceList}>
                      {clinic.services.slice(0, 5).map((service) => (
                        <View key={service.id} style={styles.serviceRow}>
                          <Text style={styles.serviceName} numberOfLines={1}>
                            {service.title}
                          </Text>
                          <Text style={styles.servicePrice}>{service.price_label}</Text>
                        </View>
                      ))}
                    </View>
                  ) : clinic.services_preview ? (
                    <View style={styles.servicesPreview}>
                      <Ionicons name="medical-outline" size={14} color="#2e8b57" />
                      <Text style={styles.servicesPreviewText}>{clinic.services_preview}</Text>
                    </View>
                  ) : null}
                  <View style={styles.actions}>
                    {clinic.business_id ? (
                      <TouchableOpacity
                        style={styles.bookingButton}
                        onPress={() => setBookingClinic(clinic)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="calendar-outline" size={16} color="#ffffff" />
                        <Text style={styles.bookingText}>დაჯავშნა</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={styles.callButton}
                      onPress={() => makeCall(clinic.phone)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="call-outline" size={16} color="#2e8b57" />
                      <Text style={styles.callText}>დარეკვა</Text>
                    </TouchableOpacity>
                    {clinic.whatsapp ? (
                      <TouchableOpacity
                        style={styles.whatsappButton}
                        onPress={() => openWhatsApp(clinic.whatsapp)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="logo-whatsapp" size={16} color="#128c7e" />
                        <Text style={styles.whatsappText}>WhatsApp</Text>
                      </TouchableOpacity>
                    ) : null}
                    {clinic.google_maps_url || (clinic.lat != null && clinic.lng != null) ? (
                      <TouchableOpacity
                        style={styles.mapButton}
                        onPress={() => openMaps(clinic)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="navigate-outline" size={16} color="#0066cc" />
                        <Text style={styles.mapText}>მარშრუტი</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <BookingRequestModal
        visible={Boolean(bookingClinic)}
        business={bookingClinic}
        session={session}
        profile={profile}
        onClose={() => setBookingClinic(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eef1ef',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#edf4ef',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#16352c' },
  headerSubtitle: { marginTop: 6, color: '#6a7f76', lineHeight: 19 },
  searchWrap: {
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 6,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e6ece8',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: '#16352c',
    fontSize: 15,
    fontWeight: '700',
  },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 18, paddingBottom: 70 },
  empty: { backgroundColor: '#fff', borderRadius: 24, padding: 30, alignItems: 'center' },
  emptyText: { color: '#687b74', fontWeight: '700', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  imageWrap: { height: 190, backgroundColor: '#dde6e2' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  closestBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: '#ff5b5b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  closestBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  distanceBadge: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  distanceText: { color: '#16352c', fontWeight: '800', fontSize: 11 },
  cardBody: { padding: 18 },
  name: { fontSize: 22, fontWeight: '800', color: '#16352c' },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  address: { color: '#687b74', marginLeft: 8, lineHeight: 20, flex: 1 },
  servicesPreview: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eefaf3',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  servicesPreviewText: {
    flex: 1,
    marginLeft: 8,
    color: '#2e8b57',
    lineHeight: 18,
    fontSize: 12,
    fontWeight: '900',
  },
  serviceList: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: '#eefaf3',
    overflow: 'hidden',
  },
  serviceRow: {
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dcefe5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceName: {
    flex: 1,
    color: '#16352c',
    fontSize: 13,
    fontWeight: '900',
    paddingRight: 10,
  },
  servicePrice: {
    color: '#2e8b57',
    fontSize: 12,
    fontWeight: '900',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  callButton: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#e8f6ee',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  callText: { color: '#2e8b57', fontWeight: '800', marginLeft: 8 },
  bookingButton: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#16352c',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  bookingText: { color: '#ffffff', fontWeight: '900', marginLeft: 8 },
  whatsappButton: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#e7f8f1',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  whatsappText: { color: '#128c7e', fontWeight: '800', marginLeft: 8 },
  mapButton: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#eef5ff',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  mapText: { color: '#0066cc', fontWeight: '800', marginLeft: 8 },
});
