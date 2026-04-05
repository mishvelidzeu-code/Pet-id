import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { fetchPublicClinics } from '../lib/contentService';

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(value) {
  if (value == null) return null;
  if (value < 1) return `${Math.round(value * 1000)} მ`;
  return `${value.toFixed(1)} კმ`;
}

export default function ClinicsScreen() {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClinics();
  }, []);

  async function loadClinics() {
    setLoading(true);
    const { data } = await fetchPublicClinics();
    let nextClinics = data || [];

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        nextClinics = nextClinics
          .map((clinic) => {
            if (clinic.lat == null || clinic.lng == null || Number.isNaN(clinic.lat) || Number.isNaN(clinic.lng)) {
              return clinic;
            }

            return {
              ...clinic,
              distance: getDistance(location.coords.latitude, location.coords.longitude, clinic.lat, clinic.lng),
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
  }

  function openMaps(lat, lng) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch(() => Alert.alert('შეცდომა', 'რუკის გახსნა ვერ მოხერხდა.'));
  }

  function makeCall(phone) {
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('შეცდომა', 'დარეკვა ვერ მოხერხდა.'));
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ვეტ-კლინიკები</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2e8b57" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {clinics.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>აქტიური კლინიკები ჯერ არ არის დამატებული.</Text>
            </View>
          ) : (
            clinics.map((clinic, index) => (
              <View key={clinic.id} style={styles.card}>
                <View style={styles.imageWrap}>
                  <Image source={{ uri: clinic.image_url }} style={styles.image} />
                  {index === 0 && clinic.distance != null && (
                    <View style={styles.closestBadge}>
                      <Text style={styles.closestBadgeText}>უახლოესი</Text>
                    </View>
                  )}
                  {clinic.distance != null && (
                    <View style={styles.distanceBadge}>
                      <Text style={styles.distanceText}>{formatDistance(clinic.distance)}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.name}>{clinic.name}</Text>
                  <Text style={styles.address}>{clinic.address}</Text>
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.callButton} onPress={() => makeCall(clinic.phone)} activeOpacity={0.8}>
                      <Text style={styles.callText}>დარეკვა</Text>
                    </TouchableOpacity>
                    {clinic.lat != null && clinic.lng != null && (
                      <TouchableOpacity style={styles.mapButton} onPress={() => openMaps(clinic.lat, clinic.lng)} activeOpacity={0.8}>
                        <Text style={styles.mapText}>მარშრუტი</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  header: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eef1ef' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#16352c' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 18, paddingBottom: 60 },
  empty: { backgroundColor: '#fff', borderRadius: 24, padding: 30, alignItems: 'center' },
  emptyText: { color: '#687b74', fontWeight: '700', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 26, overflow: 'hidden', marginBottom: 18 },
  imageWrap: { height: 180, backgroundColor: '#dde6e2' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  closestBadge: { position: 'absolute', top: 14, left: 14, backgroundColor: '#ff5b5b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  closestBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  distanceBadge: { position: 'absolute', bottom: 14, right: 14, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  distanceText: { color: '#16352c', fontWeight: '800', fontSize: 11 },
  cardBody: { padding: 18 },
  name: { fontSize: 22, fontWeight: '800', color: '#16352c' },
  address: { color: '#687b74', marginTop: 8, lineHeight: 20 },
  actions: { flexDirection: 'row', marginTop: 16 },
  callButton: { flex: 1, backgroundColor: '#e8f6ee', paddingVertical: 14, borderRadius: 16, alignItems: 'center', marginRight: 10 },
  callText: { color: '#2e8b57', fontWeight: '800' },
  mapButton: { flex: 1, backgroundColor: '#eef5ff', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  mapText: { color: '#0066cc', fontWeight: '800' },
});
