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
import { supabase } from '../lib/supabase';

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
        <Text style={styles.headerTitle}>ზოომაღაზიები</Text>
        <Text style={styles.headerSubtitle}>
          მოძებნე უახლოესი ზოომაღაზია, დაურეკე ან პირდაპირ გაუშვი მარშრუტი.
        </Text>
      </View>
    </View>
  );
}

export default function OthershopsScreen({ onBack = null }) {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const visibleShops = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return shops;
    }

    return shops.filter((shop) => {
      const shopName = String(shop.name || '').toLowerCase();
      const shopAddress = String(shop.address || '').toLowerCase();
      return shopName.includes(normalizedQuery) || shopAddress.includes(normalizedQuery);
    });
  }, [shops, searchQuery]);

  useEffect(() => {
    loadShops();
  }, []);

  async function loadShops(withRefresh = false) {
    if (withRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    // მოგვაქვს მაღაზიები Supabase-დან
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('is_active', true);

    let nextShops = data || [];

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        nextShops = nextShops
          .map((shop) => {
            if (
              shop.lat == null ||
              shop.lng == null ||
              Number.isNaN(shop.lat) ||
              Number.isNaN(shop.lng)
            ) {
              return shop;
            }

            return {
              ...shop,
              distance: getDistance(
                location.coords.latitude,
                location.coords.longitude,
                shop.lat,
                shop.lng
              ),
            };
          })
          .sort((a, b) => {
            if (a.distance == null) return 1;
            if (b.distance == null) return -1;
            return a.distance - b.distance;
          });
      }
    } catch (err) {
      console.log('Shop location error:', err);
    }

    setShops(nextShops);
    setLoading(false);
    setRefreshing(false);
  }

  function openMaps(lat, lng) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('შეცდომა', 'რუკის გახსნა ვერ მოხერხდა.')
    );
  }

  function makeCall(phone) {
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('შეცდომა', 'დარეკვა ვერ მოხერხდა.')
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader onBack={onBack} />

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#6a7f76" />
        <TextInput
          style={styles.searchInput}
          placeholder="მოძებნე მაღაზია"
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
            <RefreshControl refreshing={refreshing} onRefresh={() => loadShops(true)} />
          }
        >
          {visibleShops.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'ასეთი მაღაზია ვერ მოიძებნა.'
                  : 'აქტიური ზოომაღაზიები ჯერ არ არის დამატებული.'}
              </Text>
            </View>
          ) : (
            visibleShops.map((shop, index) => (
              <View key={shop.id} style={styles.card}>
                <View style={styles.imageWrap}>
                  {shop.image_url ? (
                    <Image source={{ uri: shop.image_url }} style={styles.image} />
                  ) : (
                    <View style={[styles.image, { backgroundColor: '#dde6e2', justifyContent: 'center', alignItems: 'center' }]}>
                       <Ionicons name="cart-outline" size={40} color="#90a49c" />
                    </View>
                  )}
                  {index === 0 && shop.distance != null ? (
                    <View style={styles.closestBadge}>
                      <Text style={styles.closestBadgeText}>ყველაზე ახლო</Text>
                    </View>
                  ) : null}
                  {shop.distance != null ? (
                    <View style={styles.distanceBadge}>
                      <Text style={styles.distanceText}>{formatDistance(shop.distance)}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.name}>{shop.name}</Text>
                  <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={16} color="#0066cc" />
                    <Text style={styles.address}>{shop.address}</Text>
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.callButton}
                      onPress={() => makeCall(shop.phone)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="call-outline" size={16} color="#2e8b57" />
                      <Text style={styles.callText}>დარეკვა</Text>
                    </TouchableOpacity>
                    {shop.lat != null && shop.lng != null ? (
                      <TouchableOpacity
                        style={styles.mapButton}
                        onPress={() => openMaps(shop.lat, shop.lng)}
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
  actions: { flexDirection: 'row', marginTop: 18 },
  callButton: {
    flex: 1,
    backgroundColor: '#e8f6ee',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexDirection: 'row',
  },
  callText: { color: '#2e8b57', fontWeight: '800', marginLeft: 8 },
  mapButton: {
    flex: 1,
    backgroundColor: '#eef5ff',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  mapText: { color: '#0066cc', fontWeight: '800', marginLeft: 8 },
});
