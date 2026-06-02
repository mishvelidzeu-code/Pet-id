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
import * as Clipboard from 'expo-clipboard';
import { fetchPublicCharityPosts } from '../lib/contentService';

const supportEmail = 'geogeorgia150@gmail.com';
const tbcIban = 'GE00TB0000000სატესტო';
const bogIban = 'GE00BG0000000სატესტო';

function HeroMetric({ icon, label, value }) {
  return (
    <View style={styles.heroMetric}>
      <Ionicons name={icon} size={18} color="#d7f5e4" />
      <View style={{ marginLeft: 8 }}>
        <Text style={styles.heroMetricValue}>{value}</Text>
        <Text style={styles.heroMetricLabel}>{label}</Text>
      </View>
    </View>
  );
}

function DonationMethodCard({ bank, iban, accent, icon, onCopy }) {
  return (
    <TouchableOpacity
      style={[styles.donationMethodCard, { borderColor: accent }]}
      onPress={() => onCopy(iban)}
      activeOpacity={0.86}
    >
      <View style={[styles.donationMethodIcon, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <View style={styles.donationMethodCopy}>
        <Text style={styles.donationMethodBank}>{bank}</Text>
        <Text style={styles.donationMethodIban}>{iban}</Text>
        <Text style={styles.donationMethodHint}>დააკოპირე ერთი შეხებით</Text>
      </View>
    </TouchableOpacity>
  );
}

function StoryCard({ item, completed = false, featured = false, onCopy }) {
  return (
    <View style={[styles.storyCard, featured && styles.storyCardFeatured, completed && styles.storyCardCompleted]}>
      <View style={[styles.storyImageWrap, featured && styles.storyImageWrapFeatured]}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.storyImage} />
        ) : (
          <View style={[styles.storyImage, styles.storyImageFallback]}>
            <Ionicons name="heart-outline" size={36} color="#70867e" />
          </View>
        )}
        <View style={styles.storyImageOverlay} />

        <View style={styles.storyTopRow}>
          <View
            style={[
              styles.storyBadge,
              completed
                ? styles.storyBadgeCompleted
                : item.urgent
                  ? styles.storyBadgeUrgent
                  : styles.storyBadgeActive,
            ]}
          >
            <Text style={styles.storyBadgeText}>
              {completed ? 'უკვე დავეხმარეთ' : item.urgent ? 'სასწრაფო' : 'აქტიური'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.storyBody}>
        <Text style={styles.storyTitle}>{item.name}</Text>
        <Text style={[styles.storyCondition, completed && styles.storyConditionCompleted]}>
          {item.condition}
        </Text>
        <Text style={styles.storyDescription}>{item.description}</Text>

        {!completed && item.iban ? (
          <View style={styles.storyPaymentWrap}>
            {item.bank_name ? (
              <Text style={styles.storyReceiverText}>ბანკი: {item.bank_name}</Text>
            ) : null}
            {item.receiver ? (
              <Text style={styles.storyReceiverText}>მიმღები: {item.receiver}</Text>
            ) : null}

            <TouchableOpacity
              style={styles.copyIbanButton}
              onPress={() => onCopy(item.iban)}
              activeOpacity={0.86}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.copyIbanLabel}>IBAN</Text>
                <Text style={styles.copyIbanValue}>{item.iban}</Text>
              </View>
              <Ionicons name="copy-outline" size={20} color="#16352c" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function InfoCard({ icon, title, text, accent = '#f59e0b', backgroundColor = '#fff8e9' }) {
  return (
    <View style={[styles.infoCard, { backgroundColor, borderColor: `${accent}33` }]}>
      <View style={[styles.infoIconWrap, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoText}>{text}</Text>
      </View>
    </View>
  );
}

function SectionSpotlight({
  icon,
  eyebrow,
  title,
  subtitle,
  tone = 'warm',
}) {
  const isSuccess = tone === 'success';

  return (
    <View
      style={[
        styles.sectionSpotlight,
        isSuccess ? styles.sectionSpotlightSuccess : styles.sectionSpotlightWarm,
      ]}
    >
      <View
        style={[
          styles.sectionSpotlightIconWrap,
          isSuccess ? styles.sectionSpotlightIconWrapSuccess : styles.sectionSpotlightIconWrapWarm,
        ]}
      >
        <Ionicons name={icon} size={22} color={isSuccess ? '#1f8b56' : '#c96c00'} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.sectionSpotlightEyebrow,
            isSuccess ? styles.sectionSpotlightEyebrowSuccess : styles.sectionSpotlightEyebrowWarm,
          ]}
        >
          {eyebrow}
        </Text>
        <Text style={styles.sectionSpotlightTitle}>{title}</Text>
        <Text style={styles.sectionSpotlightSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

export default function HelpScreen() {
  const [activePosts, setActivePosts] = useState([]);
  const [completedPosts, setCompletedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const featuredActivePost = useMemo(() => activePosts[0] || null, [activePosts]);
  const moreActivePosts = useMemo(() => activePosts.slice(1), [activePosts]);

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts(withRefresh = false) {
    if (withRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { activePosts: active, completedPosts: completed } = await fetchPublicCharityPosts();
    setActivePosts(active || []);
    setCompletedPosts(completed || []);
    setLoading(false);
    setRefreshing(false);
  }

  async function copyToClipboard(text) {
    await Clipboard.setStringAsync(text);
    Alert.alert('წარმატება', 'ინფორმაცია დაკოპირდა.');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadPosts(true)}
            colors={['#2e8b57']}
          />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <Text style={styles.heroEyebrow}>PET ID CARE</Text>
          <Text style={styles.heroTitle}>სატესტო რეჟიმი</Text>
          <Text style={styles.heroText}>
            აქ ჩანს ცხოველები, რომლებსაც მხოლოდ გვერდის სატესტო
            მონაცემებია შესაბამისად არცერთ ცხოველს არ ჭირდება დახმარება
            და ყველა მონაცემი არის სატესტო.

          </Text>

          <View style={styles.heroMetricsRow}>
            <HeroMetric icon="heart-outline" label="აქტიური" value={String(activePosts.length)} />
            <HeroMetric icon="checkmark-circle-outline" label="დახმარებული" value={String(completedPosts.length)} />
          </View>
        </View>

        <View style={styles.donationHubCard}>
          <View style={styles.donationHubHeader}>
            <View>
              <Text style={styles.donationHubTitle}>განავითარე Pet ID</Text>
              <Text style={styles.donationHubText}>
                შენი მხარდაჭერა გვეხმარება სერვერის, შენახვისა და ახალი ფუნქციების
                დაფინანსებაში.
              </Text>
            </View>
            <View style={styles.donationHubIcon}>
              <Ionicons name="sparkles-outline" size={28} color="#16352c" />
            </View>
          </View>

          <DonationMethodCard
            bank="TBC"
            iban={tbcIban}
            accent="#0066cc"
            icon="card-outline"
            onCopy={copyToClipboard}
          />
          <DonationMethodCard
            bank="BOG"
            iban={bogIban}
            accent="#f97316"
            icon="wallet-outline"
            onCopy={copyToClipboard}
          />
        </View>

        <InfoCard
          icon="mail-open-outline"
          title="როგორ დავამატოთ დასახმარებელი ცხოველი?"
          text={`მოგვწერე ელ-ფოსტაზე ${supportEmail}. გამოგვიგზავნე ვეტ-ექიმის დასკვნა, ფოტოები, ისტორია და საბანკო დეტალები.`}
        />

        <InfoCard
          icon="shield-checkmark-outline"
          title="უსაფრთხოება"
          text="გადარიცხვა გააკეთე მხოლოდ აქ მითითებულ ანგარიშებზე და საეჭვო პირად შეტყობინებებს ნუ ენდობი."
          accent="#2e8b57"
          backgroundColor="#edf9f2"
        />

        <SectionSpotlight
          icon="heart-circle-outline"
          eyebrow="აქ იწყება მხარდაჭერა"
          title="მათ შენი დახმარება სჭირდებათ"
          subtitle="აქ ჩანს ყველა აქტიური შემთხვევა, სადაც შენი ჩარევა ყველაზე მნიშვნელოვანია."
        />

        {loading ? (
          <View style={styles.loaderCard}>
            <ActivityIndicator size="large" color="#2e8b57" />
          </View>
        ) : featuredActivePost ? (
          <>
            <StoryCard item={featuredActivePost} featured onCopy={copyToClipboard} />
            {moreActivePosts.map((item) => (
              <StoryCard key={item.id} item={item} onCopy={copyToClipboard} />
            ))}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="leaf-outline" size={34} color="#5e726b" />
            <Text style={styles.emptyTitle}>აქტიური დახმარების პოსტები ჯერ არ არის</Text>
            <Text style={styles.emptyText}>
              როცა ახალი შემთხვევა დაემატება, აქ გამოჩნდება ყველა ინფორმაცია.
            </Text>
          </View>
        )}

        <SectionSpotlight
          icon="checkmark-circle-outline"
          eyebrow="დასრულებული ისტორიები"
          title="უკვე დავეხმარეთ"
          subtitle="ეს ნაწილი მწვანედ გამოყოფს იმ შემთხვევებს, სადაც დახმარებამ შედეგი უკვე მოიტანა."
          tone="success"
        />

        {completedPosts.length ? (
          completedPosts.map((item) => (
            <StoryCard key={item.id} item={item} completed onCopy={copyToClipboard} />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-outline" size={34} color="#5e726b" />
            <Text style={styles.emptyTitle}>დასრულებული ისტორიები ჯერ არ არის</Text>
            <Text style={styles.emptyText}>
              როგორც კი რომელიმე დახმარება დასრულდება, ეს ნაწილიც შეივსება.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.contactCard}
          onPress={() => Linking.openURL(`mailto:${supportEmail}`)}
          activeOpacity={0.86}
        >
          <View style={styles.contactIcon}>
            <Ionicons name="mail-outline" size={24} color="#16352c" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>მოგვწერე მხარდაჭერაზე</Text>
            <Text style={styles.contactSubtitle}>{supportEmail}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="#16352c" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f9',
  },
  content: {
    padding: 18,
    paddingBottom: 80,
  },
  heroCard: {
    backgroundColor: '#16352c',
    borderRadius: 30,
    padding: 22,
    marginBottom: 16,
    overflow: 'hidden',
  },
  heroGlowOne: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(96, 214, 162, 0.14)',
    top: -40,
    right: -35,
  },
  heroGlowTwo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    bottom: -35,
    left: -20,
  },
  heroEyebrow: {
    color: '#9ad8b8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 31,
    fontWeight: '900',
    marginTop: 8,
  },
  heroText: {
    color: '#d4e7dd',
    marginTop: 10,
    lineHeight: 22,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  heroMetric: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    padding: 14,
    marginRight: 10,
  },
  heroMetricValue: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
  heroMetricLabel: {
    color: '#d7e7df',
    marginTop: 2,
    fontWeight: '700',
    fontSize: 12,
  },
  donationHubCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
  },
  donationHubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  donationHubTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#16352c',
  },
  donationHubText: {
    marginTop: 8,
    color: '#677b73',
    lineHeight: 21,
    maxWidth: '90%',
  },
  donationHubIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#edf7f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  donationMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    marginTop: 10,
  },
  donationMethodIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donationMethodCopy: {
    flex: 1,
    marginLeft: 12,
  },
  donationMethodBank: {
    fontSize: 13,
    color: '#6a7f77',
    fontWeight: '800',
  },
  donationMethodIban: {
    marginTop: 4,
    color: '#16352c',
    fontWeight: '900',
    fontSize: 14,
  },
  donationMethodHint: {
    marginTop: 4,
    color: '#85968f',
    fontSize: 12,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  infoIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#16352c',
  },
  infoText: {
    marginTop: 6,
    color: '#687b74',
    lineHeight: 20,
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#16352c',
  },
  sectionSubtitle: {
    marginTop: 4,
    color: '#697d76',
    lineHeight: 19,
  },
  sectionSpotlight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 28,
    padding: 18,
    marginTop: 10,
    marginBottom: 14,
    borderWidth: 1,
  },
  sectionSpotlightWarm: {
    backgroundColor: '#fff6eb',
    borderColor: '#ffd7a3',
  },
  sectionSpotlightSuccess: {
    backgroundColor: '#eef9f1',
    borderColor: '#cdebd5',
  },
  sectionSpotlightIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  sectionSpotlightIconWrapWarm: {
    backgroundColor: '#fff0d8',
  },
  sectionSpotlightIconWrapSuccess: {
    backgroundColor: '#ddf3e4',
  },
  sectionSpotlightEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionSpotlightEyebrowWarm: {
    color: '#b76a05',
  },
  sectionSpotlightEyebrowSuccess: {
    color: '#2a8b58',
  },
  sectionSpotlightTitle: {
    marginTop: 5,
    fontSize: 24,
    fontWeight: '900',
    color: '#16352c',
  },
  sectionSpotlightSubtitle: {
    marginTop: 7,
    color: '#647972',
    lineHeight: 20,
  },
  loaderCard: {
    backgroundColor: '#fff',
    borderRadius: 26,
    paddingVertical: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 26,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 19,
    fontWeight: '900',
    color: '#16352c',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: '#687b74',
    lineHeight: 21,
    textAlign: 'center',
  },
  storyCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
  },
  storyCardFeatured: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
  },
  storyCardCompleted: {
    borderWidth: 1,
    borderColor: '#dceee5',
  },
  storyImageWrap: {
    height: 210,
    position: 'relative',
    backgroundColor: '#dae3df',
  },
  storyImageWrapFeatured: {
    height: 270,
  },
  storyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  storyImageFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#dee7e3',
  },
  storyImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 24, 18, 0.12)',
  },
  storyTopRow: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  storyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  storyBadgeUrgent: {
    backgroundColor: '#ff5b5b',
  },
  storyBadgeActive: {
    backgroundColor: '#f59e0b',
  },
  storyBadgeCompleted: {
    backgroundColor: '#2e8b57',
  },
  storyBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
  storyBody: {
    padding: 18,
  },
  storyTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#16352c',
  },
  storyCondition: {
    marginTop: 8,
    color: '#cf6e05',
    fontWeight: '800',
    lineHeight: 19,
  },
  storyConditionCompleted: {
    color: '#2e8b57',
  },
  storyDescription: {
    marginTop: 10,
    color: '#677b73',
    lineHeight: 22,
  },
  storyPaymentWrap: {
    marginTop: 16,
  },
  storyReceiverText: {
    color: '#62766f',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  copyIbanButton: {
    marginTop: 8,
    backgroundColor: '#f0f6f3',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyIbanLabel: {
    color: '#69807a',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  copyIbanValue: {
    color: '#16352c',
    fontWeight: '900',
  },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 26,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#edf7f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  contactTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#16352c',
  },
  contactSubtitle: {
    marginTop: 5,
    color: '#6a7f77',
  },
});
