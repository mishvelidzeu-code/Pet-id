import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchPublicEvents } from '../lib/contentService';

export default function EventsScreen() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    const { data } = await fetchPublicEvents();
    setEvents(data || []);
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ივენთები</Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2e8b57" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {events.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>გამოქვეყნებული ივენთები ჯერ არ არის.</Text>
            </View>
          ) : (
            events.map((event) => (
              <View key={event.id} style={styles.card}>
                <View style={styles.imageWrap}>
                  <Image source={{ uri: event.image_url }} style={styles.image} />
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{event.date_badge || 'TBA'}</Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.title}>{event.title}</Text>
                  <Text style={styles.meta}>{event.date || 'თარიღი არ არის მითითებული'}</Text>
                  <Text style={styles.meta}>{event.location}</Text>
                  <Text style={styles.description}>{event.description}</Text>
                  <TouchableOpacity style={styles.cta} activeOpacity={0.8}>
                    <Text style={styles.ctaText}>დასწრება</Text>
                  </TouchableOpacity>
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
  imageWrap: { height: 190, backgroundColor: '#dde6e2' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  badge: { position: 'absolute', top: 14, right: 14, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: '#2e8b57', fontWeight: '800', fontSize: 11 },
  cardBody: { padding: 18 },
  title: { fontSize: 22, fontWeight: '800', color: '#16352c' },
  meta: { marginTop: 8, color: '#687b74', fontWeight: '600' },
  description: { marginTop: 12, color: '#6b7f78', lineHeight: 22 },
  cta: { backgroundColor: '#2e8b57', borderRadius: 16, alignItems: 'center', paddingVertical: 16, marginTop: 16 },
  ctaText: { color: '#fff', fontWeight: '800' },
});
