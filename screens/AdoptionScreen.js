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
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { fetchPublicAdoptionPosts } from '../lib/contentService';

function Header({ onBack }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={20} color="#16352c" />
        </TouchableOpacity>
      ) : null}
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>ოჯახს ეძებენ</Text>
        <Text style={styles.headerSubtitle}>
          ქუჩიდან გადარჩენილი და თავშესაფარში მყოფი ცხოველები, რომლებიც მზრუნველ ხელებს ელოდებიან.
        </Text>
      </View>
    </View>
  );
}

function Metric({ icon, label, value }) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={18} color="#dff9e7" />
      <View style={{ marginLeft: 8 }}>
        <Text style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    </View>
  );
}

function ContactButton({ icon, text, onPress, tone = 'primary' }) {
  return (
    <TouchableOpacity
      style={[styles.contactButton, tone === 'secondary' && styles.contactButtonSecondary]}
      onPress={onPress}
      activeOpacity={0.84}
    >
      <Ionicons
        name={icon}
        size={18}
        color={tone === 'secondary' ? '#245f4d' : '#ffffff'}
      />
      <Text
        style={[
          styles.contactButtonText,
          tone === 'secondary' && styles.contactButtonTextSecondary,
        ]}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
}

function AdoptionCard({ item, featured = false, onCall }) {
  return (
    <View style={[styles.card, featured && styles.cardFeatured]}>
      <View style={[styles.imageWrap, featured && styles.imageWrapFeatured]}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Ionicons name="paw-outline" size={38} color="#618272" />
          </View>
        )}
        <View style={styles.imageOverlay} />

        <View style={styles.badgeRow}>
          <View style={[styles.badge, featured ? styles.badgeFeatured : styles.badgeDefault]}>
            <Text style={styles.badgeText}>
              {featured ? 'დღის გამორჩეული მეგობარი' : 'ახალ სახლს ელის'}
            </Text>
          </View>
          {item.sex ? (
            <View style={styles.badgeMuted}>
              <Text style={styles.badgeMutedText}>{item.sex}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSubtitle}>
              {item.breed || 'ჯიში უცნობია'}
              {item.age_label ? ` • ${item.age_label}` : ''}
            </Text>
          </View>
          <View style={styles.locationChip}>
            <Ionicons name="location-outline" size={14} color="#2e8b57" />
            <Text style={styles.locationChipText}>{item.location || 'მდებარეობა დასაზუსტებელია'}</Text>
          </View>
        </View>

        {item.temperament ? (
          <View style={styles.temperamentBox}>
            <Ionicons name="heart-outline" size={16} color="#cb6a26" />
            <Text style={styles.temperamentText}>{item.temperament}</Text>
          </View>
        ) : null}

        <Text style={styles.description}>{item.description || 'დამატებითი აღწერა მალე დაემატება.'}</Text>

        <View style={styles.contactCard}>
          <View style={styles.contactHeader}>
            <View style={styles.contactAvatar}>
              <Ionicons name="call-outline" size={18} color="#16352c" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactName}>{item.contact_name || 'საკონტაქტო პირი'}</Text>
              <Text style={styles.contactPhone}>{item.contact_phone || 'ნომერი მითითებული არ არის'}</Text>
            </View>
          </View>

          <View style={styles.contactActions}>
            <ContactButton icon="call-outline" text="დარეკვა" onPress={() => onCall(item.contact_phone)} />
            <ContactButton
              icon="chatbubble-ellipses-outline"
              text="SMS"
              tone="secondary"
              onPress={() => {
                if (!item.contact_phone) {
                  Alert.alert('კონტაქტი', 'ტელეფონის ნომერი მითითებული არ არის.');
                  return;
                }

                Linking.openURL(`sms:${item.contact_phone}`).catch(() =>
                  Alert.alert('შეცდომა', 'SMS ფანჯარა ვერ გაიხსნა.')
                );
              }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

export default function AdoptionScreen({ onBack = null }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const featuredItem = useMemo(
    () => items.find((item) => item.is_featured) || items[0] || null,
    [items]
  );
  const restItems = useMemo(
    () => items.filter((item) => item.id !== featuredItem?.id),
    [items, featuredItem]
  );

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems(withRefresh = false) {
    if (withRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { data } = await fetchPublicAdoptionPosts();
    setItems(data || []);
    setLoading(false);
    setRefreshing(false);
  }

  function makeCall(phoneNumber) {
    if (!phoneNumber) {
      Alert.alert('კონტაქტი', 'ტელეფონის ნომერი მითითებული არ არის.');
      return;
    }

    Linking.openURL(`tel:${phoneNumber}`).catch(() =>
      Alert.alert('შეცდომა', 'ზარის გაშვება ვერ მოხერხდა.')
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={onBack} />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2e8b57" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadItems(true)}
              colors={['#2e8b57']}
            />
          }
        >
          <View style={styles.heroCard}>
            <View style={styles.heroGlowOne} />
            <View style={styles.heroGlowTwo} />
            <Text style={styles.heroEyebrow}>ADOPT A FRIEND</Text>
            <Text style={styles.heroTitle}>მეგობარი, რომელსაც სწორედ შენი სახლი ელოდება</Text>
            <Text style={styles.heroText}>
              გახსენი ბარათები, ნახე ხასიათი, დაუკავშირდი მზრუნველს და აჩუქე ახალი დასაწყისი
              ოთხფეხა მეგობარს.
            </Text>

            <View style={styles.metricsRow}>
              <Metric icon="paw-outline" label="აქტიური ბარათი" value={String(items.length)} />
              <Metric
                icon="sparkles-outline"
                label="გამორჩეული"
                value={featuredItem ? '1' : '0'}
              />
            </View>
          </View>

          {featuredItem ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>ახლა ყველაზე მეტად ელოდება ოჯახს</Text>
              <AdoptionCard item={featuredItem} featured onCall={makeCall} />
            </View>
          ) : null}

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>ყველა ბარათი</Text>
            <Text style={styles.sectionSubtitle}>
              დაუკავშირდი პასუხისმგებელ ადამიანს და შეთანხმდი გაცნობაზე ან აყვანის დეტალებზე.
            </Text>

            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="leaf-outline" size={30} color="#6c8578" />
                <Text style={styles.emptyTitle}>აქტიური აყვანის ბარათები ჯერ არ არის</Text>
                <Text style={styles.emptyText}>
                  როგორც კი ახალი ცხოველი დაემატება, აქვე გამოჩნდება სრული ინფორმაცია.
                </Text>
              </View>
            ) : (
              restItems.map((item) => (
                <AdoptionCard key={item.id} item={item} onCall={makeCall} />
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef3f0' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef3f0',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#16352c' },
  headerSubtitle: { marginTop: 6, color: '#6e8179', lineHeight: 20 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 18, paddingBottom: 70 },
  heroCard: {
    backgroundColor: '#16352c',
    borderRadius: 32,
    padding: 24,
    marginBottom: 18,
    overflow: 'hidden',
  },
  heroGlowOne: {
    position: 'absolute',
    top: -50,
    right: -10,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(85, 196, 141, 0.16)',
  },
  heroGlowTwo: {
    position: 'absolute',
    bottom: -60,
    left: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 195, 87, 0.12)',
  },
  heroEyebrow: {
    color: '#bde4cb',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  heroTitle: {
    marginTop: 16,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    color: '#fff',
  },
  heroText: {
    marginTop: 10,
    color: '#d2e4db',
    lineHeight: 21,
    fontSize: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 10,
  },
  metricValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#d4eee0',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionBlock: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#16352c',
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: '#6f827b',
    lineHeight: 20,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 4,
  },
  cardFeatured: {
    borderWidth: 1,
    borderColor: '#d3eadc',
  },
  imageWrap: {
    height: 220,
    backgroundColor: '#dbe7e0',
  },
  imageWrapFeatured: {
    height: 250,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 34, 27, 0.18)',
  },
  badgeRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  badgeFeatured: {
    backgroundColor: '#ffb44d',
  },
  badgeDefault: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  badgeMuted: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  badgeMutedText: {
    color: '#305344',
    fontSize: 11,
    fontWeight: '800',
  },
  cardBody: {
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#16352c',
  },
  cardSubtitle: {
    marginTop: 6,
    color: '#6e8179',
    fontWeight: '700',
  },
  locationChip: {
    maxWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef8f3',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  locationChipText: {
    color: '#2e8b57',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 5,
    flexShrink: 1,
  },
  temperamentBox: {
    marginTop: 14,
    flexDirection: 'row',
    backgroundColor: '#fff5eb',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  temperamentText: {
    flex: 1,
    marginLeft: 8,
    color: '#935525',
    lineHeight: 19,
    fontWeight: '600',
  },
  description: {
    marginTop: 14,
    color: '#50625a',
    lineHeight: 22,
    fontSize: 14,
  },
  contactCard: {
    marginTop: 16,
    backgroundColor: '#f5f8f6',
    borderRadius: 22,
    padding: 14,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#dff1e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#16352c',
  },
  contactPhone: {
    marginTop: 4,
    color: '#6c7d76',
    fontWeight: '700',
  },
  contactActions: {
    flexDirection: 'row',
    marginTop: 14,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2e8b57',
    borderRadius: 18,
    paddingVertical: 13,
    marginRight: 8,
  },
  contactButtonSecondary: {
    backgroundColor: '#e6f2ec',
    marginRight: 0,
  },
  contactButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '800',
    fontSize: 13,
  },
  contactButtonTextSecondary: {
    color: '#245f4d',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '800',
    color: '#244036',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: '#6c7d76',
    lineHeight: 20,
    textAlign: 'center',
  },
});
