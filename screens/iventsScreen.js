import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fetchPublicEvents } from '../lib/contentService';

function ScreenHeader({ title, subtitle, onBack }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={20} color="#16352c" />
        </TouchableOpacity>
      ) : null}
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

export default function EventsScreen({ onBack = null }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents(withRefresh = false) {
    if (withRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { data } = await fetchPublicEvents();
    setEvents(data || []);
    setLoading(false);
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="ივენთები"
        subtitle="ნახე ახალი შეხვედრები, გამოფენები და ძაღლების აქტივობები."
        onBack={onBack}
      />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2e8b57" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadEvents(true)} />
          }
        >
          {events.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>გამოქვეყნებული ივენთები ჯერ არ არის.</Text>
            </View>
          ) : (
            events.map((event, index) => (
              <View key={event.id} style={styles.card}>
                <View style={styles.imageWrap}>
                  <Image source={{ uri: event.image_url }} style={styles.image} />
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{event.date_badge || 'TBA'}</Text>
                  </View>
                  {index === 0 ? (
                    <View style={styles.featuredBadge}>
                      <Text style={styles.featuredBadgeText}>ახლოს მომავალი</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.title}>{event.title}</Text>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={16} color="#2e8b57" />
                    <Text style={styles.meta}>{event.date || 'თარიღი არ არის მითითებული'}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={16} color="#0066cc" />
                    <Text style={styles.meta}>{event.location}</Text>
                  </View>
                  <Text style={styles.description}>{event.description}</Text>
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
  imageWrap: { height: 210, backgroundColor: '#dde6e2' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  badge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { color: '#2e8b57', fontWeight: '800', fontSize: 11 },
  featuredBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    backgroundColor: 'rgba(22, 53, 44, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  featuredBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  cardBody: { padding: 20 },
  title: { fontSize: 23, fontWeight: '800', color: '#16352c' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  meta: { marginLeft: 8, color: '#687b74', fontWeight: '600', flex: 1 },
  description: { marginTop: 14, color: '#6b7f78', lineHeight: 22 },
});
