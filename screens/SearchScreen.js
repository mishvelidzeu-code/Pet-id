import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import {
  fetchPublicAdoptionPosts,
  fetchPublicClinics,
  fetchPublicEvents,
} from '../lib/contentService';
import AdoptionScreen from './AdoptionScreen';
import ClinicsScreen from './clinicsScreen';
import EventsScreen from './iventsScreen';
import OthershopsScreen from './OthershopsScreen'; // დამატებულია ზოომაღაზიების ეკრანი
import {
  normalizePetCode,
  validatePetCode,
} from '../lib/petCode';
import {
  fetchPublicLostPets,
  findPublicLostPetByCode,
} from '../lib/publicLostPets';
import { updateLostPetMode } from '../lib/lostPetAlerts';

const { width, height } = Dimensions.get('window');

const SEARCH_CARD_IMAGES = {
  clinics:
    'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/4.webp',
  zooShops:
    'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/2.webp',
  events:
    'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/3.webp',
};

const MEDICAL_TYPE_OPTIONS = [
  {
    id: 'vaccine',
    label: 'აცრა',
    icon: 'shield-checkmark-outline',
    backgroundColor: '#eef4ff',
    accentColor: '#2563eb',
  },
  {
    id: 'worm',
    label: 'ჭია',
    icon: 'flask-outline',
    backgroundColor: '#fff6e8',
    accentColor: '#d97706',
  },
  {
    id: 'parasite',
    label: 'გარე პარაზიტები',
    icon: 'bug-outline',
    backgroundColor: '#fff1f2',
    accentColor: '#dc2626',
  },
  {
    id: 'other',
    label: 'სხვა',
    icon: 'document-text-outline',
    backgroundColor: '#eefcf5',
    accentColor: '#2e8b57',
  },
];

function formatMedicalDateLabel(value) {
  if (!value) return 'ჯერ არა';

  const [rawYear, rawMonth, rawDay] = String(value)
    .split('-')
    .map((part) => Number(part));

  const parsedDate =
    Number.isFinite(rawYear) && Number.isFinite(rawMonth) && Number.isFinite(rawDay)
      ? new Date(rawYear, rawMonth - 1, rawDay)
      : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'ჯერ არა';
  }

  return new Intl.DateTimeFormat('ka-GE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsedDate);
}

function getMedicalTypeMeta(value = '') {
  const normalizedValue = String(value || '').toLowerCase();

  if (normalizedValue === 'vaccine' || normalizedValue.includes('აცრა')) return MEDICAL_TYPE_OPTIONS[0];
  if (normalizedValue === 'worm' || normalizedValue.includes('ჭია')) return MEDICAL_TYPE_OPTIONS[1];
  if (normalizedValue === 'parasite' || normalizedValue.includes('გარე პარაზიტები')) return MEDICAL_TYPE_OPTIONS[2];
  return MEDICAL_TYPE_OPTIONS[3];
}

function prioritizeLostPets(pets = [], priorityPetId = null) {
  if (!priorityPetId) {
    return pets;
  }

  const priorityPet = pets.find((pet) => pet.id === priorityPetId);

  if (!priorityPet) {
    return pets;
  }

  return [priorityPet, ...pets.filter((pet) => pet.id !== priorityPetId)];
}

function ShellHeader({ title, subtitle, onBack }) {
  return (
    <View style={styles.shellHeader}>
      {onBack ? (
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={20} color="#16352c" />
        </TouchableOpacity>
      ) : null}
      <View style={styles.shellHeaderCopy}>
        <Text style={styles.mainTitle}>{title}</Text>
        <Text style={styles.refreshHint}>{subtitle}</Text>
      </View>
    </View>
  );
}

function FeatureCard({ title, subtitle, imageUrl, tintColor, icon, onPress, style }) {
  return (
    <TouchableOpacity style={[styles.featureCard, style]} onPress={onPress} activeOpacity={0.88}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.featureImage} /> : null}
      <View style={[styles.featureOverlay, { backgroundColor: tintColor }]} />
      <View style={styles.featureTopRow}>
        <View style={styles.featureIconWrap}>
          <Ionicons name={icon} size={22} color="#fff" />
        </View>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </View>
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

function MyPetsShortcut({ pets, onPress }) {
  const hasPets = pets.length > 0;
  const previewPets = pets.slice(0, 2);

  return (
    <TouchableOpacity style={styles.profileShortcut} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.profileShortcutCopy}>
        <View style={styles.sectionPill}>
          <Ionicons name="paw" size={14} color="#2e8b57" />
          <Text style={styles.sectionPillText}>ჩემი ცხოველები</Text>
        </View>
        <Text style={styles.profileShortcutTitle}>
          {hasPets ? 'გადადით პროფილში და მართეთ თქვენი ბარათები' : 'დაამატე პირველი ცხოველი'}
        </Text>
        <Text style={styles.profileShortcutText}>
          {hasPets
            ? `${pets.length} ცხოველი პროფილში. შეეხე ბარათს და პირდაპირ გადადი.`
            : 'პროფილში შეგიძლია დაამატო ცხოველი, პასპორტი და სამედიცინო ჩანაწერები.'}
        </Text>
      </View>

      <View style={styles.profileShortcutVisual}>
        {previewPets.length ? (
          previewPets.map((pet, index) => (
            <Image
              key={pet.id}
              source={{ uri: pet.photo_url }}
              style={[
                styles.profileShortcutImage,
                index === 1 ? styles.profileShortcutImageOffset : null,
              ]}
            />
          ))
        ) : (
          <View style={styles.profileShortcutPlaceholder}>
            <Ionicons name="paw-outline" size={30} color="#2e8b57" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function MyPetsPreviewCard({ pets, onOpenProfile, onOpenPassport, onOpenMedical, onToggleLost, style }) {
  const previewPets = pets.slice(0, 2);

  return (
    <View style={[styles.myPetsCard, style]}>
      <View style={styles.myPetsHeader}>
        <View style={styles.sectionPill}>
          <Ionicons name="paw" size={14} color="#2e8b57" />
          <Text style={styles.sectionPillText}>ჩემი ცხოველები</Text>
        </View>

        <TouchableOpacity style={styles.myPetsHeaderAction} onPress={onOpenProfile} activeOpacity={0.85}>
          <Text style={styles.myPetsHeaderActionText}>პროფილზე</Text>
          <Ionicons name="arrow-forward" size={16} color="#16352c" />
        </TouchableOpacity>
      </View>

      {previewPets.length ? (
        previewPets.map((pet) => (
          <View key={pet.id} style={styles.myPetPreviewCard}>
            <View style={styles.myPetImageColumn}>
              <View style={styles.myPetPhotoWrap}>
                {pet.photo_url ? (
                  <Image source={{ uri: pet.photo_url }} style={styles.myPetPhoto} />
                ) : (
                  <View style={[styles.myPetPhoto, styles.myPetPhotoFallback]}>
                    <Ionicons name="paw-outline" size={26} color="#6c847a" />
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.passportThumbWrap,
                  !pet.passport_photo_url && styles.passportThumbWrapDisabled,
                ]}
                onPress={() => pet.passport_photo_url && onOpenPassport(pet.passport_photo_url)}
                activeOpacity={pet.passport_photo_url ? 0.85 : 1}
                disabled={!pet.passport_photo_url}
              >
                {pet.passport_photo_url ? (
                  <Image source={{ uri: pet.passport_photo_url }} style={styles.passportThumb} />
                ) : (
                  <View style={[styles.passportThumb, styles.passportThumbFallback]}>
                    <Ionicons name="document-text-outline" size={22} color="#7d8791" />
                  </View>
                )}
                <Text style={styles.passportThumbLabel}>
                  {pet.passport_photo_url ? 'პასპორტი' : 'არ არის'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.myPetInfo}>
              <Text style={styles.myPetName} numberOfLines={1}>
                {pet.name || 'უსახელო ბარათი'}
              </Text>

              <View style={styles.myPetIdCard}>
                <Text style={styles.myPetIdLabel}>Pet ID</Text>
                <Text style={styles.myPetIdValue}>{pet.short_code || '-'}</Text>
              </View>

              <View style={styles.searchModeBox}>
                <View style={styles.searchModeCopy}>
                  <Text style={styles.searchModeTitle}>ძებნის რეჟიმი</Text>
                  <Text style={[styles.searchModeText, pet.is_lost ? styles.searchModeTextAlert : styles.searchModeTextSafe]}>
                    {pet.is_lost ? 'აქტიურია' : 'გამორთულია'}
                  </Text>
                </View>

                <Switch
                  trackColor={{ false: '#d7dee7', true: '#ffd1d1' }}
                  thumbColor={pet.is_lost ? '#ff4d4d' : '#ffffff'}
                  value={pet.is_lost}
                  onValueChange={() => onToggleLost(pet.id, pet.is_lost)}
                />
              </View>
            </View>
          </View>
        ))
      ) : (
        <TouchableOpacity style={styles.myPetsEmptyAction} onPress={onOpenProfile} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={18} color="#16352c" />
          <Text style={styles.myPetsEmptyActionText}> დაამატე ცხოველი</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function MyPetsHeroCard({ pets, onOpenProfile, onOpenPassport, onOpenMedical, onToggleLost, style }) {
  const previewPets = pets.slice(0, 2);

  return (
    <View style={[styles.myPetsCard, styles.myPetsCardHero, style]}>
      <View style={styles.myPetsGlowPrimary} />
      <View style={styles.myPetsGlowSecondary} />
      <View style={styles.myPetsGridGlow} />

      <View style={styles.myPetsHeader}>
        <TouchableOpacity
          style={[styles.myPetsHeaderCopy, styles.myPetsHeaderCopyButton]}
          onPress={onOpenProfile}
          activeOpacity={0.85}
        >
          <View style={styles.myPetsHeaderBadgeRow}>
            <View style={styles.myPetsSectionPill}>
              <Ionicons name="paw" size={14} color="#d8f5e6" />
              <Text style={styles.myPetsSectionPillText}>ჩემი ცხოველები</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.myPetsHeaderActionModern} onPress={onOpenProfile} activeOpacity={0.85}>
          <View style={styles.myPetsHeaderActionIcon}>
            <Ionicons name="arrow-forward" size={16} color="#ffffff" />
          </View>
        </TouchableOpacity>
      </View>

      {previewPets.length ? (
        <>
          {previewPets.map((pet) => (
            <View key={pet.id} style={styles.modernPetCard}>
              <View style={styles.modernPetImageWrap}>
                {pet.photo_url ? (
                  <Image source={{ uri: pet.photo_url }} style={styles.modernPetImage} />
                ) : (
                  <View style={[styles.modernPetImage, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="paw" size={60} color="#c5d1cb" />
                  </View>
                )}
              </View>

              <Text style={styles.modernPetName} numberOfLines={1}>
                {pet.name || 'უსახელო ბარათი'}
              </Text>

              <View style={styles.modernPetActions}>
                <TouchableOpacity
                  style={[styles.modernActionButton, !pet.passport_photo_url && { opacity: 0.6 }]}
                  onPress={() => {
                    if (pet.passport_photo_url) {
                      onOpenPassport(pet.passport_photo_url);
                    } else {
                      Alert.alert('პასპორტი', 'პასპორტის ფოტო ჯერ დამატებული არ არის.');
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <View style={[styles.modernActionIcon, { backgroundColor: '#eef4ff' }]}>
                    <Ionicons name="document-text-outline" size={26} color="#2563eb" />
                  </View>
                  <Text style={styles.modernActionText}>პასპორტი</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modernActionButton}
                  onPress={() => onOpenMedical(pet)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.modernActionIcon, { backgroundColor: '#fff1f2' }]}>
                    <Ionicons name="medkit-outline" size={26} color="#dc2626" />
                  </View>
                  <Text style={styles.modernActionText}>მედ. ბარათი</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modernSearchBox}>
                <View style={styles.modernSearchTextWrap}>
                  <Text style={styles.modernSearchTitle}>ძებნის რეჟიმი</Text>
                  <Text
                    style={[
                      styles.modernSearchStatus,
                      pet.is_lost ? styles.modernSearchStatusLost : styles.modernSearchStatusSafe,
                    ]}
                  >
                    {pet.is_lost ? 'ჩართულია (იძებნება)' : 'გამორთულია'}
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#d7dee7', true: '#ffd1d1' }}
                  thumbColor={pet.is_lost ? '#ff4d4d' : '#ffffff'}
                  value={pet.is_lost}
                  onValueChange={() => onToggleLost(pet.id, pet.is_lost)}
                />
              </View>
            </View>
          ))}
        </>
      ) : (
        <TouchableOpacity
          style={[styles.myPetsEmptyAction, styles.myPetsEmptyActionHero]}
          onPress={onOpenProfile}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={18} color="#fff7f7" />
          <Text style={[styles.myPetsEmptyActionText, styles.myPetsEmptyActionTextHero]}>
            დაამატე ცხოველი
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function LostPreviewCard({ pets, onOpenList, onOpenPet }) {
  const previewPets = pets.slice(0, 2);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelHeaderCopy}>
          <Text style={styles.panelTitle}>ამჟამად იძებნებიან</Text>
          <Text style={styles.panelSubtitle}>
            ჩანს პირველი {previewPets.length || 0} ცხოველი. შეეხე და გახსენი სრული სია.
          </Text>
        </View>
        {pets.length > 0 ? (
          <TouchableOpacity style={styles.panelLinkBtn} onPress={onOpenList} activeOpacity={0.85}>
            <Text style={styles.panelLink}>ყველას ნახვა</Text>
            <Ionicons name="arrow-forward" size={14} color="#2e8b57" />
          </TouchableOpacity>
        ) : null}
      </View>

      {!previewPets.length ? (
        <View style={styles.emptyFeed}>
          <Text style={styles.emptyFeedText}>ამჟამად ყველა ცხოველი უსაფრთხოდაა.</Text>
        </View>
      ) : (
        previewPets.map((pet) => (
          <TouchableOpacity
            key={pet.id}
            style={styles.miniCard}
            onPress={() => onOpenPet(pet, 'home')}
            activeOpacity={0.9}
          >
            <Image source={{ uri: pet.photo_url }} style={styles.miniImg} />
            <View style={styles.miniInfo}>
              <View style={styles.rowBetween}>
                <Text style={styles.miniName} numberOfLines={1}>
                  {pet.name}
                </Text>
                {pet.location ? (
                  <Text style={styles.miniLoc} numberOfLines={1}>
                    {pet.location}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.miniBreed} numberOfLines={1}>
                {pet.sex ? `${pet.sex} • ` : ''}
                {pet.breed || 'ჯიში უცნობია'}
              </Text>

              <View style={styles.miniBottomRow}>
                <View style={styles.miniIdBadge}>
                  <Text style={styles.miniCode}>ID: {pet.short_code}</Text>
                </View>
                <View style={styles.inlineArrow}>
                  <Text style={styles.inlineArrowText}>გახსნა</Text>
                  <Ionicons name="chevron-forward" size={16} color="#16352c" />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

export default function SearchScreen({
  navigation,
  route,
  session,
  profile,
  petsRefreshToken = 0,
  recentLostPetId = null,
  primaryPetId = null,
  onPetsChanged,
}) {
  const [code, setCode] = useState('');
  const [selectedPet, setSelectedPet] = useState(null);
  const [lostPets, setLostPets] = useState([]);
  const [myPets, setMyPets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isZoomVisible, setIsZoomVisible] = useState(false);
  const [zoomImage, setZoomImage] = useState(null);
  const [isMedicalVisible, setIsMedicalVisible] = useState(false);
  const [medicalPet, setMedicalPet] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [medicalFilter, setMedicalFilter] = useState(null);
  const [medicalLoading, setMedicalLoading] = useState(false);
  const [activeView, setActiveView] = useState('home');
  const [previousView, setPreviousView] = useState('home');
  const [clinicPreview, setClinicPreview] = useState(null);
  const [eventPreview, setEventPreview] = useState(null);
  const [adoptionPreview, setAdoptionPreview] = useState(null);
  const detailScrollRef = useRef(null);

  const featuredLostPets = useMemo(() => lostPets.slice(0, 2), [lostPets]);
  const featuredMyPets = useMemo(() => {
    if (!myPets.length) {
      return [];
    }

    const primaryPet = primaryPetId
      ? myPets.find((pet) => pet.id === primaryPetId)
      : null;

    return [primaryPet || myPets[0]];
  }, [myPets, primaryPetId]);
  const filteredMedicalRecords = useMemo(() => {
    if (!medicalFilter) {
      return medicalRecords;
    }

    return medicalRecords.filter((record) => getMedicalTypeMeta(record.record_type || '').id === medicalFilter);
  }, [medicalFilter, medicalRecords]);

  const loadHomeData = useCallback(
    async (withRefresh = false, priorityLostId = null) => {
      if (withRefresh) {
        setRefreshing(true);
      } else {
        setHomeLoading(true);
      }

      const requests = [
        fetchPublicLostPets(),
        fetchPublicAdoptionPosts(),
        fetchPublicClinics(),
        fetchPublicEvents(),
      ];

      if (session?.user?.id) {
        requests.push(
          supabase
            .from('pets')
            .select('*')
            .eq('owner_id', session.user.id)
            .order('created_at', { ascending: false })
        );
      }

      const results = await Promise.all(requests);
      const [lostResult, adoptionResult, clinicsResult, eventsResult, myPetsResult] = results;

      if (!lostResult.error && lostResult.data) {
        setLostPets(prioritizeLostPets(lostResult.data, priorityLostId));
      }

      setAdoptionPreview((adoptionResult.data || [])[0] || null);
      setClinicPreview((clinicsResult.data || [])[0] || null);
      setEventPreview((eventsResult.data || [])[0] || null);
      setMyPets(myPetsResult?.data || []);
      setHomeLoading(false);
      setRefreshing(false);
    },
    [session?.user?.id]
  );

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  useEffect(() => {
    if (!petsRefreshToken) {
      return;
    }

    loadHomeData(true, recentLostPetId);
  }, [loadHomeData, petsRefreshToken, recentLostPetId]);

  useEffect(() => {
    setLostPets((current) => prioritizeLostPets(current, recentLostPetId));
  }, [recentLostPetId]);

  useEffect(() => {
    const searchView = route?.params?.searchView;

    // დაემატა othershops შემოწმებაშიც
    if (searchView === 'events' || searchView === 'clinics' || searchView === 'adoption' || searchView === 'othershops' || searchView === 'lost') {
      setSelectedPet(null);
      setActiveView(searchView === 'lost' ? 'lost' : searchView);
    }
  }, [route?.params?.searchView]);

  useEffect(() => {
    if (!selectedPet) {
      return;
    }

    requestAnimationFrame(() => {
      detailScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, [selectedPet]);

  const onRefresh = async () => {
    setCode('');
    setSelectedPet(null);
    setActiveView('home');
    await loadHomeData(true);
  };

  const handleRestart = () => {
    setCode('');
    setSelectedPet(null);
    setActiveView('home');
  };

  const openPet = (pet, source = 'home') => {
    setPreviousView(source);
    setSelectedPet(pet);
  };

  const loadMedicalRecords = async (petId) => {
    if (!petId) {
      setMedicalRecords([]);
      return;
    }

    const { data, error } = await supabase
      .from('medical_records')
      .select('*')
      .eq('pet_id', petId)
      .order('date_administered', { ascending: false });

    if (error) {
      Alert.alert('შეცდომა', error.message);
      setMedicalRecords([]);
      return;
    }

    setMedicalRecords(data || []);
  };

  const openMedicalCard = async (pet) => {
    setMedicalPet(pet);
    setMedicalFilter(null);
    setMedicalLoading(true);
    setIsMedicalVisible(true);
    await loadMedicalRecords(pet.id);
    setMedicalLoading(false);
  };

  const closeMedicalCard = () => {
    setIsMedicalVisible(false);
    setMedicalPet(null);
    setMedicalRecords([]);
    setMedicalFilter(null);
    setMedicalLoading(false);
  };

  const confirmToggleMyPetLost = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    const question = newStatus
      ? 'ნამდვილად გსურთ ძებნის რეჟიმის ჩართვა? ადმინს მიუვა მოთხოვნა და მისი დადასტურების შემდეგ ყველა მომხმარებელს გაეგზავნება შეტყობინება.'
      : 'ნამდვილად იპოვეთ ძაღლი/კატა?';

    Alert.alert('სტატუსის შეცვლა', question, [
      { text: 'არა', style: 'cancel' },
      {
        text: 'დიახ',
        onPress: async () => {
          const { error } = await updateLostPetMode(id, newStatus);

          if (error) {
            Alert.alert('შეცდომა', error.message);
            return;
          }

          onPetsChanged?.({ recentLostPetId: newStatus ? id : null });
          await loadHomeData(true, newStatus ? id : null);
          if (newStatus) {
            Alert.alert('მოთხოვნა გაგზავნილია', 'ცხოველი დაემატა ძებნის სიაში. საერთო შეტყობინება გაიგზავნება ადმინის დადასტურების შემდეგ.');
          }
        },
      },
    ]);
  };

  const closePet = () => {
    setSelectedPet(null);
    setActiveView(previousView);
  };

  const openZoom = (url) => {
    setZoomImage(url);
    setIsZoomVisible(true);
  };

  const makeCall = (phoneNumber) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
      return;
    }

    Alert.alert('შეცდომა', 'ტელეფონის ნომერი მითითებული არ არის.');
  };

  const handleSearch = async () => {
    const normalizedCode = normalizePetCode(code);
    const validationError = validatePetCode(normalizedCode);

    if (validationError) {
      return Alert.alert('ყურადღება', validationError);
    }

    Keyboard.dismiss();
    setLoading(true);

    const { data, error } = await findPublicLostPetByCode(normalizedCode);

    setLoading(false);

    if (error || !data) {
      Alert.alert(
        'ვერ მოიძებნა',
        'ასეთი Pet ID ვერ ვიპოვეთ. გადაამოწმე კოდი და სცადე თავიდან.'
      );
      return;
    }

    setPreviousView(activeView);
    setSelectedPet(data);
    setCode('');
  };

  if (activeView === 'events') {
    return <EventsScreen onBack={() => setActiveView('home')} />;
  }

  if (activeView === 'clinics') {
    return <ClinicsScreen onBack={() => setActiveView('home')} />;
  }

  if (activeView === 'adoption') {
    return <AdoptionScreen onBack={() => setActiveView('home')} />;
  }

  // დაემატა othershops-ის ეკრანის გამოძახება
  if (activeView === 'othershops') {
    return <OthershopsScreen onBack={() => setActiveView('home')} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ShellHeader
        title={selectedPet ? 'ნაპოვნი ბარათი' : activeView === 'lost' ? 'იძებნებიან' : 'მთავარი'}
        subtitle={
          selectedPet
            ? 'ნახე ინფორმაცია და საჭიროების შემთხვევაში დაუკავშირდი პატრონს.'
            : activeView === 'lost'
              ? 'გადაათვალიერე ყველა გამოქვეყნებული ცხოველი.'
              : '   ვირტუალური პასპორტი შენი ცხოველისთვის  Pet ID .'
        }
        onBack={selectedPet ? closePet : activeView === 'lost' ? () => setActiveView('home') : null}
      />

      {selectedPet ? (
        <ScrollView
          key={selectedPet.id}
          ref={detailScrollRef}
          contentContainerStyle={styles.detailScrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.resultCard}>
            <TouchableOpacity onPress={() => openZoom(selectedPet.photo_url)} activeOpacity={0.9}>
              <Image source={{ uri: selectedPet.photo_url }} style={styles.petImage} />
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: selectedPet.is_lost ? '#ff4d4d' : '#2e8b57' },
                ]}
              >
                <Text style={styles.statusText}>
                  {selectedPet.is_lost ? 'იძებნება' : 'უსაფრთხოდაა'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.content}>
              <View style={styles.titleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.petName}>{selectedPet.name}</Text>
                  <Text style={styles.petBreed}>
                    {selectedPet.sex ? `${selectedPet.sex} • ` : ''}
                    {selectedPet.breed || 'ჯიში მითითებული არ არის'}
                  </Text>
                </View>
                <View style={styles.locBadge}>
                  <Text style={styles.locText}>ID: {selectedPet.short_code}</Text>
                </View>
              </View>

              <View style={styles.detailFacts}>
                <View style={styles.detailFact}>
                  <Text style={styles.detailFactLabel}>მდებარეობა</Text>
                  <Text style={styles.detailFactValue}>{selectedPet.location || '-'}</Text>
                </View>
                <View style={styles.detailFact}>
                  <Text style={styles.detailFactLabel}>ფერი</Text>
                  <Text style={styles.detailFactValue}>{selectedPet.color || '-'}</Text>
                </View>
                <View style={styles.detailFact}>
                  <Text style={styles.detailFactLabel}>ზომა</Text>
                  <Text style={styles.detailFactValue}>{selectedPet.size || '-'}</Text>
                </View>
                <View style={styles.detailFact}>
                  <Text style={styles.detailFactLabel}>წონა</Text>
                  <Text style={styles.detailFactValue}>{selectedPet.weight || '-'}</Text>
                </View>
              </View>

              {selectedPet.description ? (
                <View style={styles.descBox}>
                  <Text style={styles.descText}>{selectedPet.description}</Text>
                </View>
              ) : null}

              {selectedPet.is_lost ? (
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => makeCall(selectedPet.profiles?.phone_number)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.callBtnText}>დარეკვა პატრონთან</Text>
                  <Text style={styles.ownerNameText}>
                    {selectedPet.profiles?.full_name || 'პატრონის სახელი არ ჩანს'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.safeBox}>
                  <Text style={styles.safeText}>
                    ეს ცხოველი დაკარგულად მონიშნული არ არის. დამატებითი პირადი ინფორმაცია დამალულია.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      ) : activeView === 'lost' ? (
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2e8b57']} />
          }
        >
          {lostPets.length ? (
            lostPets.map((pet) => (
              <TouchableOpacity
                key={pet.id}
                style={styles.miniCard}
                onPress={() => openPet(pet, 'lost')}
                activeOpacity={0.9}
              >
                <Image source={{ uri: pet.photo_url }} style={styles.miniImg} />
                <View style={styles.miniInfo}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.miniName} numberOfLines={1}>
                      {pet.name}
                    </Text>
                    {pet.location ? (
                      <Text style={styles.miniLoc} numberOfLines={1}>
                        {pet.location}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.miniBreed} numberOfLines={1}>
                    {pet.sex ? `${pet.sex} • ` : ''}
                    {pet.breed || 'ჯიში უცნობია'}
                  </Text>
                  <View style={styles.miniBottomRow}>
                    <View style={styles.miniIdBadge}>
                      <Text style={styles.miniCode}>ID: {pet.short_code}</Text>
                    </View>
                    <View style={styles.inlineArrow}>
                      <Text style={styles.inlineArrowText}>გახსნა</Text>
                      <Ionicons name="chevron-forward" size={16} color="#16352c" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyFeed}>
              <Text style={styles.emptyFeedText}>ამჟამად ყველა ცხოველი უსაფრთხოდაა.</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2e8b57']} />
          }
        >
          <View style={styles.searchBox}>
            <TextInput
              style={styles.input}
              placeholder="შეიყვანე Pet ID (მაგ: AB12)"
              value={code}
              onChangeText={setCode}
              placeholderTextColor="#8fa29b"
            />
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={handleSearch}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.searchBtnText}>ძებნა</Text>
              )}
            </TouchableOpacity>
          </View>

          {homeLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#2e8b57" />
            </View>
          ) : (
            <>
              {/* პირველი რიგი: მაღაზიები (ივენთების ნაცვლად) და კლინიკები */}
              <View style={styles.quickGrid}>
                <FeatureCard
                  title="ზოო-Shops"
                  subtitle="უახლოესი ზოომაღაზიები"
                  imageUrl={SEARCH_CARD_IMAGES.zooShops}
                  tintColor="rgba(23, 55, 45, 0.84)"
                  icon="cart-outline"
                  onPress={() => setActiveView('othershops')}
                />
                <FeatureCard
                  title="კლინიკები"
                  subtitle="ვეტ-კლინიკები რუკით"
                  imageUrl={SEARCH_CARD_IMAGES.clinics}
                  tintColor="rgba(7, 84, 138, 0.82)"
                  icon="medical-outline"
                  onPress={() => setActiveView('clinics')}
                />
              </View>

              {/* მეორე რიგი: ოჯახს ეძებენ და ივენთები (ორივე გვერდიგვერდ) */}
              <View style={styles.quickGrid}>
                <FeatureCard
                  title="ოჯახს ეძებენ"
                  subtitle={
                    adoptionPreview?.name
                      ? `${adoptionPreview.name} და სხვები`
                      : 'იპოვე ოთხფეხა მეგობარი'
                  }
                  imageUrl={adoptionPreview?.image_url}
                  tintColor="rgba(16, 41, 33, 0.78)"
                  icon="home-outline"
                  onPress={() => setActiveView('adoption')}
                />
                <FeatureCard
                  title="ივენთები"
                  subtitle="შეხვედრები და აქტივობები"
                  imageUrl={SEARCH_CARD_IMAGES.events}
                  tintColor="rgba(110, 48, 22, 0.82)"
                  icon="calendar-outline"
                  onPress={() => setActiveView('events')}
                />
              </View>

              <MyPetsHeroCard
                pets={featuredMyPets}
                style={styles.myPetsCardHero}
                onOpenProfile={() => navigation.navigate('Profile')}
                onOpenPassport={(imageUrl) => {
                  setZoomImage(imageUrl);
                  setIsZoomVisible(true);
                }}
                onOpenMedical={openMedicalCard}
                onToggleLost={confirmToggleMyPetLost}
              />

              <LostPreviewCard
                pets={featuredLostPets}
                onOpenList={() => setActiveView('lost')}
                onOpenPet={openPet}
              />
            </>
          )}
        </ScrollView>
      )}

      <Modal visible={isMedicalVisible} transparent animationType="slide" onRequestClose={closeMedicalCard}>
        <View style={styles.medModalOverlay}>
          <View style={styles.medModalSheet}>
            <View style={styles.medModalHandle} />

            <View style={styles.medModalHeader}>
              <View style={styles.medModalHeaderCopy}>
                <Text style={styles.medModalEyebrow}>სამედიცინო ბარათი</Text>
                <Text style={styles.medModalTitle}>{medicalPet?.name || 'ცხოველი'}</Text>
                <Text style={styles.medModalSubtitle}>
                  აცრები, ჭიის პროცედურები და სხვა ჩანაწერები ერთ ადგილას.
                </Text>
              </View>

              <TouchableOpacity style={styles.medModalCloseBtn} onPress={closeMedicalCard} activeOpacity={0.85}>
                <Ionicons name="close" size={20} color="#16352c" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.medModalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.medOverviewCard}>
                <View style={styles.medOverviewTopRow}>
                  <View style={styles.medOverviewPetRow}>
                    <View style={styles.medOverviewPetPhotoWrap}>
                      {medicalPet?.photo_url ? (
                        <Image source={{ uri: medicalPet.photo_url }} style={styles.medOverviewPetPhoto} />
                      ) : (
                        <View style={[styles.medOverviewPetPhoto, styles.medOverviewPetPhotoFallback]}>
                          <Ionicons name="paw-outline" size={24} color="#6c847a" />
                        </View>
                      )}
                    </View>

                    <View style={styles.medOverviewCopy}>
                      <Text style={styles.medOverviewTitle}>{medicalPet?.name || 'ცხოველი'}</Text>
                      <Text style={styles.medOverviewSubtitleCard}>
                        {medicalPet?.breed || 'ჯიში მითითებული არ არის'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.medOverviewCountBadge}>
                    <Text style={styles.medOverviewCountValue}>{medicalRecords.length}</Text>
                    <Text style={styles.medOverviewCountLabel}>ჩანაწერი</Text>
                  </View>
                </View>

                <View style={styles.medOverviewStats}>
                  <View style={styles.medOverviewStat}>
                    <Text style={styles.medOverviewStatLabel}>ბოლო პროცედურა</Text>
                    <Text style={styles.medOverviewStatValue}>
                      {medicalRecords[0]?.date_administered ? formatMedicalDateLabel(medicalRecords[0].date_administered) : 'ჯერ არა'}
                    </Text>
                  </View>
                  <View style={styles.medOverviewStat}>
                    <Text style={styles.medOverviewStatLabel}>შემდეგი შეხსენება</Text>
                    <Text style={styles.medOverviewStatValue}>
                      {medicalRecords.find((record) => record.next_due_date)?.next_due_date
                        ? formatMedicalDateLabel(medicalRecords.find((record) => record.next_due_date)?.next_due_date)
                        : 'არ არის'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.medFilterSection}>
                <Text style={styles.medFilterTitle}>ფილტრი</Text>
                <View style={styles.medFilterRow}>
                  {MEDICAL_TYPE_OPTIONS.map((option) => {
                    const isActive = medicalFilter === option.id;

                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[
                          styles.medFilterChip,
                          isActive && styles.medFilterChipActive,
                          { backgroundColor: isActive ? option.backgroundColor : '#fff' },
                        ]}
                        onPress={() => setMedicalFilter((current) => (current === option.id ? null : option.id))}
                        activeOpacity={0.86}
                      >
                        <Ionicons
                          name={option.icon}
                          size={15}
                          color={isActive ? option.accentColor : '#678077'}
                        />
                        <Text
                          style={[
                            styles.medFilterChipText,
                            isActive && { color: option.accentColor },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {medicalLoading ? (
                <View style={styles.medLoadingBox}>
                  <ActivityIndicator size="large" color="#2e8b57" />
                </View>
              ) : filteredMedicalRecords.length ? (
                filteredMedicalRecords.map((record, index) => {
                  const typeMeta = getMedicalTypeMeta(record.record_type || '');

                  return (
                    <View key={record.id || index} style={styles.medRecordCard}>
                      <View style={[styles.medRecordIconWrap, { backgroundColor: typeMeta.backgroundColor }]}>
                        <Ionicons name={typeMeta.icon} size={18} color={typeMeta.accentColor} />
                      </View>

                      <View style={styles.medRecordBody}>
                        <View style={styles.medRecordHeader}>
                          <View style={styles.medRecordTextWrap}>
                            <Text style={styles.medRecordTitle}>{record.record_name || typeMeta.label}</Text>
                            <Text style={styles.medRecordSubtitle}>{typeMeta.label}</Text>
                          </View>

                          <View style={[styles.medTypeBadge, { backgroundColor: typeMeta.backgroundColor }]}>
                            <Text style={[styles.medTypeBadgeText, { color: typeMeta.accentColor }]}>
                              {typeMeta.label}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.medRecordDatesRow}>
                          <View style={styles.medDateBadge}>
                            <Text style={styles.medDateBadgeLabel}>ჩატარების თარიღი</Text>
                            <Text style={styles.medDateBadgeValue}>{formatMedicalDateLabel(record.date_administered)}</Text>
                          </View>

                          <View style={[styles.medDateBadge, !record.next_due_date && styles.medDateBadgeMuted]}>
                            <Text style={styles.medDateBadgeLabel}>შემდეგი შეხსენება</Text>
                            <Text style={styles.medDateBadgeValue}>
                              {record.next_due_date ? formatMedicalDateLabel(record.next_due_date) : 'არ არის'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyMedContainer}>
                  <View style={styles.emptyMedIconWrap}>
                    <Ionicons name="medkit-outline" size={26} color="#2e8b57" />
                  </View>
                  <Text style={styles.emptyMedTitle}>ისტორია ჯერ ცარიელია</Text>
                  <Text style={styles.emptyMedText}>
                    როდესაც პროფილში სამედიცინო ჩანაწერებს დაამატებ, აქაც ეგრევე გამოჩნდება.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.medProfileLinkBtn}
                onPress={() => {
                  closeMedicalCard();
                  navigation.navigate('Profile');
                }}
                activeOpacity={0.86}
              >
                <Ionicons name="create-outline" size={18} color="#16352c" />
                <Text style={styles.medProfileLinkText}>სრულად რედაქტირება პროფილში</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={isZoomVisible} transparent animationType="fade">
        <View style={styles.zoomOverlay}>
          <TouchableOpacity style={styles.closeZoom} onPress={() => setIsZoomVisible(false)}>
            <Text style={styles.closeZoomText}>✕ დახურვა</Text>
          </TouchableOpacity>
          <Image source={{ uri: zoomImage }} style={styles.fullImage} resizeMode="contain" />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#eef3f0',
  },
  shellHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
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
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  shellHeaderCopy: {
    flex: 1,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#16352c',
  },
  refreshHint: {
    fontSize: 13,
    color: '#6f837b',
    marginTop: 4,
    lineHeight: 18,
  },
  scrollContainer: {
    padding: 20,
    paddingTop: 4,
    paddingBottom: 100,
  },
  heroCard: {
    backgroundColor: '#16352c',
    borderRadius: 32,
    padding: 22,
    marginBottom: 18,
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 41, 33, 0.68)',
  },
  heroBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroBadgeText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: '800',
    fontSize: 12,
  },
  heroTitle: {
    marginTop: 18,
    fontSize: 29,
    lineHeight: 34,
    color: '#fff',
    fontWeight: '900',
  },
  heroText: {
    marginTop: 10,
    color: '#d4e4dc',
    lineHeight: 21,
    fontSize: 14,
  },
  heroActionRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroActionText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    paddingRight: 10,
    flex: 1,
  },
  searchBox: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
    marginBottom: 18,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '800',
    color: '#16352c',
    letterSpacing: 1,
  },
  searchBtn: {
    backgroundColor: '#2e8b57',
    paddingHorizontal: 26,
    paddingVertical: 16,
    borderRadius: 16,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingVertical: 40,
    alignItems: 'center',
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  featureCard: {
    width: '48.3%',
    minHeight: 206,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#24453a',
    justifyContent: 'space-between',
  },
  featureCardFull: {
    width: '100%',
    minHeight: 188,
    marginBottom: 18,
  },
  featureImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  featureOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  featureTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  featureIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCopy: {
    padding: 16,
  },
  featureTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  featureSubtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.86)',
    lineHeight: 18,
    fontSize: 13,
  },
  myPetsCard: {
    backgroundColor: '#123a30',
    borderRadius: 34,
    padding: 20,
    marginBottom: 18,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
  },
  myPetsCardHero: {
    borderRadius: 34,
    padding: 20,
    paddingTop: 16,
    minHeight: 0,
  },
  myPetsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  myPetsGlowPrimary: {
    position: 'absolute',
    top: -52,
    right: -30,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: 'rgba(118, 228, 177, 0.18)',
  },
  myPetsGlowSecondary: {
    position: 'absolute',
    bottom: -70,
    left: -36,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(75, 143, 255, 0.10)',
  },
  myPetsGridGlow: {
    position: 'absolute',
    top: 92,
    right: 26,
    width: 110,
    height: 110,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  myPetsHeaderCopy: {
    flex: 1,
    paddingRight: 10,
  },
  myPetsHeaderCopyButton: {
    alignSelf: 'stretch',
  },
  myPetsHeaderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  myPetsSectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  myPetsSectionPillText: {
    color: '#f6fbf8',
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 6,
  },
  myPetsCountPill: {
    marginLeft: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  myPetsCountPillText: {
    color: 'rgba(239,247,242,0.92)',
    fontSize: 12,
    fontWeight: '800',
  },
  myPetsHeroTitle: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '900',
    color: '#f7fbf8',
    lineHeight: 28,
  },
  myPetsHeaderAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef3f0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  myPetsHeaderActionText: {
    color: 'rgba(240,248,244,0.86)',
    fontWeight: '800',
    fontSize: 12,
    marginTop: 2,
  },
  myPetsHeaderActionModern: {
    marginLeft: 12,
    width: 46,
    height: 46,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myPetsHeaderActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  myPetsHeaderActionLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  modernPetCard: {
    marginTop: -10, // <--- შეცვლილია: ავწიეთ ზემოთ 16-ის ნაცვლად
    backgroundColor: '#fff',
    borderRadius: 36, // <--- შეცვლილია: ოდნავ უფრო მრგვალი (32-დან 36-მდე)
    padding: 18, // <--- შეცვლილია: ოდნავ მეტი სივრცე შიგნით (16-დან 18-მდე)
    shadowColor: '#0e241c',
    shadowOpacity: 0.12, // <--- შეცვლილია: ოდნავ მკვეთრი ჩრდილი
    shadowRadius: 24,
    elevation: 6,
  },
 modernPetImageWrap: {
    width: '100%',
    height: 260, // <--- შეცვლილია: 220-დან 260-მდე გავზარდეთ სურათის სიმაღლე
    borderRadius: 28, // <--- შეცვლილია: ოდნავ მეტი სიმრგვალე სურათზე
    backgroundColor: '#f0f5f2',
    overflow: 'hidden',
    marginBottom: 18, // <--- ოდნავ მეტი დაშორება ტექსტამდე
  },
  modernPetImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  modernPetName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#16352c',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  modernPetActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modernActionButton: {
    flex: 1,
    backgroundColor: '#fbfcfb',
    borderRadius: 24,
    paddingVertical: 18,
    alignItems: 'center',
    marginHorizontal: 6,
    borderWidth: 1.5,
    borderColor: '#e8ecea',
  },
  modernActionIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modernActionText: {
    color: '#16352c',
    fontSize: 15,
    fontWeight: '800',
  },
  modernSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f8f6',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2eae5',
  },
  modernSearchTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  modernSearchTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6c847a',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  modernSearchStatus: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '900',
  },
  modernSearchStatusSafe: {
    color: '#2e8b57',
  },
  modernSearchStatusLost: {
    color: '#dc2626',
  },
  sectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#eef8f3',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sectionPillText: {
    color: '#2e8b57',
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 6,
  },
  myPetPreviewCard: {
    marginTop: 14,
    backgroundColor: '#f7faf8',
    borderRadius: 24,
    padding: 14,
    flexDirection: 'row',
  },
  myPetImageColumn: {
    width: 96,
    marginRight: 14,
  },
  myPetPhotoWrap: {
    width: 96,
  },
  myPetPhoto: {
    width: 96,
    height: 96,
    borderRadius: 22,
    backgroundColor: '#dbe4df',
  },
  myPetPhotoFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  myPetInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  myPetName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#16352c',
  },
  passportThumbWrap: {
    width: 96,
    alignItems: 'center',
    marginTop: 10,
  },
  passportThumbWrapDisabled: {
    opacity: 0.7,
  },
  passportThumb: {
    width: 96,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#e6ece8',
  },
  passportThumbFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  passportThumbLabel: {
    marginTop: 7,
    fontSize: 11,
    fontWeight: '800',
    color: '#7c8b85',
  },
  myPetIdCard: {
    backgroundColor: '#16352c',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  myPetIdLabel: {
    color: '#92cdb1',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  myPetIdValue: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  searchModeBox: {
    marginTop: 12,
    backgroundColor: '#edf3ef',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#dce7e1',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchModeCopy: {
    flex: 1,
    paddingRight: 10,
  },
  searchModeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5e726b',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  searchModeText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
  },
  searchModeTextSafe: {
    color: '#246b47',
  },
  searchModeTextAlert: {
    color: '#cc3c3c',
  },
  myPetsEmptyAction: {
    marginTop: 16,
    backgroundColor: '#edf3ef',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myPetsEmptyActionText: {
    color: '#16352c',
    fontWeight: '800',
    marginLeft: 8,
  },
  myPetsEmptyActionHero: {
    backgroundColor: 'rgba(255, 114, 114, 0.20)',
    borderRadius: 22,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 184, 0.45)',
  },
  myPetsEmptyActionTextHero: {
    color: '#fff7f7',
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 30,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  panelHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#16352c',
  },
  panelSubtitle: {
    marginTop: 6,
    color: '#678077',
    lineHeight: 19,
  },
  panelLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef8f3',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  panelLink: {
    color: '#2e8b57',
    fontWeight: '800',
    marginRight: 6,
  },
  detailScrollContainer: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 25,
    elevation: 8,
  },
  petImage: {
    width: '100%',
    height: 248,
    resizeMode: 'cover',
    backgroundColor: '#d9e3df',
  },
  statusBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  content: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  petName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  petBreed: {
    fontSize: 15,
    color: '#666',
    marginTop: 6,
    fontWeight: '600',
  },
  locBadge: {
    backgroundColor: '#f0f7ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: 12,
  },
  locText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0066cc',
  },
  detailFacts: {
    flexDirection: 'row',
    backgroundColor: '#f7faf8',
    borderRadius: 22,
    padding: 14,
    marginBottom: 16,
  },
  detailFact: {
    flex: 1,
    alignItems: 'center',
  },
  detailFactLabel: {
    fontSize: 12,
    color: '#7b8e87',
    marginBottom: 6,
    fontWeight: '700',
  },
  detailFactValue: {
    fontSize: 14,
    color: '#16352c',
    fontWeight: '800',
    textAlign: 'center',
  },
  descBox: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  descText: {
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 14,
  },
  callBtn: {
    backgroundColor: '#ff4d4d',
    padding: 18,
    borderRadius: 20,
    alignItems: 'center',
  },
  callBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  ownerNameText: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.9,
    marginTop: 6,
    fontWeight: '600',
  },
  safeBox: {
    backgroundColor: '#eefcf5',
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  safeText: {
    fontSize: 14,
    color: '#2e8b57',
    textAlign: 'center',
    fontWeight: '700',
    lineHeight: 22,
  },
  miniCard: {
    flexDirection: 'row',
    backgroundColor: '#f7faf8',
    borderRadius: 24,
    padding: 14,
    marginTop: 12,
  },
  miniImg: {
    width: 116,
    height: 116,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  miniInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    flex: 1,
  },
  miniLoc: {
    fontSize: 11,
    color: '#ff4d4d',
    fontWeight: '800',
    marginLeft: 10,
    maxWidth: 90,
  },
  miniBreed: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    marginTop: 4,
  },
  miniBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  miniIdBadge: {
    backgroundColor: '#eefcf5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  miniCode: {
    color: '#2e8b57',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  inlineArrow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineArrowText: {
    color: '#16352c',
    fontWeight: '800',
    fontSize: 12,
    marginRight: 2,
  },
  emptyFeed: {
    padding: 36,
    alignItems: 'center',
    backgroundColor: '#f7faf8',
    borderRadius: 24,
    marginTop: 10,
  },
  emptyFeedText: {
    color: '#6b7f78',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  medModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 24, 19, 0.42)',
    justifyContent: 'flex-end',
  },
  medModalSheet: {
    maxHeight: height * 0.86,
    backgroundColor: '#f4f8f6',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 10,
  },
  medModalHandle: {
    alignSelf: 'center',
    width: 58,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#d1dbd5',
    marginBottom: 12,
  },
  medModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  medModalHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  medModalEyebrow: {
    color: '#2e8b57',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  medModalTitle: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: '900',
    color: '#16352c',
  },
  medModalSubtitle: {
    marginTop: 6,
    color: '#678077',
    fontSize: 14,
    lineHeight: 20,
  },
  medModalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#e7efea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medModalContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  medOverviewCard: {
    backgroundColor: '#fff',
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e4eee8',
  },
  medOverviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medOverviewPetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  medOverviewPetPhotoWrap: {
    width: 64,
    height: 64,
    borderRadius: 999,
    padding: 3,
    backgroundColor: '#e3f4ea',
    marginRight: 12,
  },
  medOverviewPetPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#dbe4df',
  },
  medOverviewPetPhotoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  medOverviewCopy: {
    flex: 1,
  },
  medOverviewTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#16352c',
  },
  medOverviewSubtitleCard: {
    marginTop: 4,
    color: '#678077',
    fontSize: 13,
    fontWeight: '600',
  },
  medOverviewCountBadge: {
    minWidth: 84,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#16352c',
    alignItems: 'center',
  },
  medOverviewCountValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  medOverviewCountLabel: {
    color: '#9ecfb8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  medOverviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  medOverviewStat: {
    width: '48.5%',
    backgroundColor: '#f7faf8',
    borderRadius: 18,
    padding: 14,
  },
  medOverviewStatLabel: {
    color: '#768b83',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  medOverviewStatValue: {
    marginTop: 6,
    color: '#16352c',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  medFilterSection: {
    marginTop: 16,
  },
  medFilterTitle: {
    color: '#16352c',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 10,
  },
  medFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  medFilterChip: {
    marginHorizontal: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dde6e1',
    flexDirection: 'row',
    alignItems: 'center',
  },
  medFilterChipActive: {
    borderColor: 'transparent',
  },
  medFilterChipText: {
    marginLeft: 6,
    color: '#60736c',
    fontWeight: '800',
    fontSize: 12,
  },
  medLoadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  medRecordCard: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e3ebe6',
    flexDirection: 'row',
  },
  medRecordIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  medRecordBody: {
    flex: 1,
  },
  medRecordHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  medRecordTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  medRecordTitle: {
    color: '#16352c',
    fontSize: 16,
    fontWeight: '900',
  },
  medRecordSubtitle: {
    marginTop: 4,
    color: '#6f827b',
    fontSize: 12,
    fontWeight: '700',
  },
  medTypeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  medTypeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  medRecordDatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  medDateBadge: {
    width: '48.3%',
    backgroundColor: '#f7faf8',
    borderRadius: 16,
    padding: 12,
  },
  medDateBadgeMuted: {
    backgroundColor: '#f3f5f4',
  },
  medDateBadgeLabel: {
    color: '#768b83',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  medDateBadgeValue: {
    marginTop: 6,
    color: '#16352c',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  emptyMedContainer: {
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e3ebe6',
  },
  emptyMedIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eefcf5',
  },
  emptyMedTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '900',
    color: '#16352c',
  },
  emptyMedText: {
    marginTop: 8,
    color: '#678077',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  medProfileLinkBtn: {
    marginTop: 16,
    backgroundColor: '#eaf1ed',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medProfileLinkText: {
    color: '#16352c',
    fontWeight: '900',
    fontSize: 14,
    marginLeft: 8,
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  fullImage: {
    width,
    height: height * 0.8,
  },
  closeZoom: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
  },
  closeZoomText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
