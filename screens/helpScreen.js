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
import * as Clipboard from 'expo-clipboard';
import { fetchPublicCharityPosts } from '../lib/contentService';

const supportEmail = 'geogeorgia150@gmail.com';
const appIban = 'GE00TB0000000000000000';

function CharityCard({ item, completed = false, onCopy }) {
  return (
    <View style={[styles.charityCard, completed && styles.completedCard]}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: item.image_url }} style={styles.image} />
        <View style={[styles.badge, completed ? styles.completedBadge : item.urgent ? styles.urgentBadge : styles.activeBadge]}>
          <Text style={styles.badgeText}>{completed ? 'დასრულებული' : item.urgent ? 'სასწრაფო' : 'აქტიური'}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={[styles.condition, completed && styles.completedCondition]}>{item.condition}</Text>
        <Text style={styles.description}>{item.description}</Text>

        {!completed && item.iban ? (
          <TouchableOpacity style={styles.ibanBox} onPress={() => onCopy(item.iban)} activeOpacity={0.8}>
            <Text style={styles.ibanText}>{item.iban}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default function HelpScreen() {
  const [activePosts, setActivePosts] = useState([]);
  const [completedPosts, setCompletedPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    setLoading(true);
    const { activePosts: active, completedPosts: completed } = await fetchPublicCharityPosts();
    setActivePosts(active || []);
    setCompletedPosts(completed || []);
    setLoading(false);
  }

  async function copyToClipboard(text) {
    await Clipboard.setStringAsync(text);
    Alert.alert('წარმატება', 'ანგარიში დაკოპირდა.');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>მხარდაჭერა</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>განავითარე Pet ID</Text>
          <Text style={styles.supportDescription}>
            მცირე დონაციაც კი გვეხმარება სერვერის, შენახვისა და ახალი ფუნქციების ხარჯების დაფარვაში.
          </Text>
          <TouchableOpacity style={styles.ibanBox} onPress={() => copyToClipboard(appIban)} activeOpacity={0.8}>
            <Text style={styles.ibanText}>{appIban}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>როგორ დავამატოთ დასახმარებელი ცხოველი?</Text>
          <Text style={styles.infoText}>
            მოგვწერე ელ-ფოსტაზე {supportEmail}. გამოგვიგზავნე ფოტოები, ისტორია და საბანკო რეკვიზიტები.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>მათ შენი დახმარება სჭირდებათ</Text>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#2e8b57" />
          </View>
        ) : activePosts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>აქტიური დახმარების პოსტები ჯერ არ არის.</Text>
          </View>
        ) : (
          activePosts.map((item) => <CharityCard key={item.id} item={item} onCopy={copyToClipboard} />)
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>უსაფრთხოება</Text>
          <Text style={styles.infoText}>
            თანხა გადარიცხე მხოლოდ აპში მითითებულ ანგარიშებზე და საეჭვო ბმულებს ნუ ენდობი.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>უკვე დავეხმარეთ</Text>
        {completedPosts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>დასრულებული ისტორიები ჯერ არ არის.</Text>
          </View>
        ) : (
          completedPosts.map((item) => (
            <CharityCard key={item.id} item={item} completed onCopy={copyToClipboard} />
          ))
        )}

        <TouchableOpacity style={styles.contactCard} onPress={() => Linking.openURL(`mailto:${supportEmail}`)} activeOpacity={0.8}>
          <Text style={styles.contactTitle}>მოგვწერე მხარდაჭერას</Text>
          <Text style={styles.contactSubtitle}>{supportEmail}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  header: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eef1ef' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#16352c' },
  content: { padding: 18, paddingBottom: 60 },
  supportCard: { backgroundColor: '#fff', borderRadius: 26, padding: 20, marginBottom: 16 },
  supportTitle: { fontSize: 22, fontWeight: '800', color: '#16352c' },
  supportDescription: { marginTop: 10, color: '#687b74', lineHeight: 22 },
  ibanBox: { backgroundColor: '#eef5ff', borderRadius: 16, padding: 14, alignItems: 'center', marginTop: 16 },
  ibanText: { color: '#0066cc', fontWeight: '800', fontSize: 15, letterSpacing: 0.4 },
  infoCard: { backgroundColor: '#fffdf5', borderRadius: 24, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#ffebb3' },
  infoTitle: { fontSize: 16, fontWeight: '800', color: '#9a5a00' },
  infoText: { marginTop: 8, color: '#6f6a53', lineHeight: 22 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#16352c', marginBottom: 12, marginTop: 6 },
  loader: { paddingVertical: 24 },
  empty: { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 14 },
  emptyText: { color: '#687b74', fontWeight: '700', textAlign: 'center' },
  charityCard: { backgroundColor: '#fff', borderRadius: 26, overflow: 'hidden', marginBottom: 16 },
  completedCard: { borderLeftWidth: 5, borderLeftColor: '#2e8b57' },
  imageWrap: { height: 200, backgroundColor: '#dde6e2' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  badge: { position: 'absolute', top: 14, right: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  urgentBadge: { backgroundColor: '#ff5b5b' },
  activeBadge: { backgroundColor: '#f59e0b' },
  completedBadge: { backgroundColor: '#2e8b57' },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  cardBody: { padding: 18 },
  name: { fontSize: 22, fontWeight: '800', color: '#16352c' },
  condition: { marginTop: 8, color: '#d97706', fontWeight: '700' },
  completedCondition: { color: '#2e8b57' },
  description: { marginTop: 10, color: '#687b74', lineHeight: 22 },
  contactCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginTop: 10 },
  contactTitle: { fontSize: 16, fontWeight: '800', color: '#16352c' },
  contactSubtitle: { marginTop: 8, color: '#687b74' },
});
