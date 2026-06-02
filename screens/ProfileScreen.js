import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Alert, 
  ScrollView, 
  FlatList,
  ActivityIndicator, 
  Switch, 
  Modal, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  Image,
  Keyboard,
  Linking,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '../lib/supabase';
import { uploadImageAsset } from '../lib/storage';
import { updateLostPetMode } from '../lib/lostPetAlerts';
import { ensureProfileRow } from '../lib/profileService';
import {
  ensurePetCodeIsUnique,
} from '../lib/petCode';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const todayIso = () => new Date().toISOString().split('T')[0];
const MEDICAL_WHEEL_ITEM_HEIGHT = 44;

const MEDICAL_TYPE_OPTIONS = [
  { id: 'vaccine', label: 'აცრა', icon: '💉', backgroundColor: '#eef4ff', accentColor: '#2563eb' },
  { id: 'worm', label: 'ჭია', icon: '💊', backgroundColor: '#fff6e8', accentColor: '#d97706' },
  { id: 'parasite', label: 'გარე პარაზიტები', icon: '🦟', backgroundColor: '#fff1f2', accentColor: '#dc2626' },
  { id: 'other', label: 'სხვა', icon: '📝', backgroundColor: '#eefcf5', accentColor: '#2e8b57' },
];

const REMINDER_OPTIONS = [
  { id: 'none', label: 'არ მინდა' },
  { id: '1_month', label: '1 თვეში' },
  { id: '3_months', label: '3 თვეში' },
  { id: '1_year', label: '1 წელში' },
];

const MEDICAL_MONTH_OPTIONS = [
  'იან',
  'თებ',
  'მარ',
  'აპრ',
  'მაი',
  'ივნ',
  'ივლ',
  'აგვ',
  'სექ',
  'ოქტ',
  'ნოე',
  'დეკ',
];

function parseMedicalDate(value = todayIso()) {
  const [rawYear, rawMonth, rawDay] = String(value || todayIso())
    .split('-')
    .map((part) => Number(part));
  const fallback = new Date();
  const year = Number.isFinite(rawYear) ? rawYear : fallback.getFullYear();
  const monthIndex = Number.isFinite(rawMonth) ? Math.min(Math.max(rawMonth - 1, 0), 11) : fallback.getMonth();
  const maxDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = Number.isFinite(rawDay) ? Math.min(Math.max(rawDay, 1), maxDay) : fallback.getDate();

  return { year, monthIndex, day };
}

function formatMedicalDateValue(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatMedicalDateLabel(value) {
  const parts = parseMedicalDate(value);
  return new Intl.DateTimeFormat('ka-GE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(parts.year, parts.monthIndex, parts.day));
}

function getMedicalDayCount(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getReminderFromDates(recordDateValue, nextDateValue) {
  if (!nextDateValue) return 'none';

  const base = parseMedicalDate(recordDateValue);
  const target = parseMedicalDate(nextDateValue);
  const baseDate = new Date(base.year, base.monthIndex, base.day);
  const nextDate = new Date(target.year, target.monthIndex, target.day);

  const oneMonth = new Date(baseDate);
  oneMonth.setMonth(oneMonth.getMonth() + 1);
  const threeMonths = new Date(baseDate);
  threeMonths.setMonth(threeMonths.getMonth() + 3);
  const oneYear = new Date(baseDate);
  oneYear.setFullYear(oneYear.getFullYear() + 1);

  const nextIso = formatMedicalDateValue(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
  if (nextIso === formatMedicalDateValue(oneMonth.getFullYear(), oneMonth.getMonth(), oneMonth.getDate())) return '1_month';
  if (nextIso === formatMedicalDateValue(threeMonths.getFullYear(), threeMonths.getMonth(), threeMonths.getDate())) return '3_months';
  if (nextIso === formatMedicalDateValue(oneYear.getFullYear(), oneYear.getMonth(), oneYear.getDate())) return '1_year';
  return 'none';
}

function getMedicalTypeMeta(value = '') {
  if (value === 'vaccine' || value.includes('აცრა')) return MEDICAL_TYPE_OPTIONS[0];
  if (value === 'worm' || value.includes('ჭია')) return MEDICAL_TYPE_OPTIONS[1];
  if (value === 'parasite' || value.includes('გარე პარაზიტები')) return MEDICAL_TYPE_OPTIONS[2];
  return MEDICAL_TYPE_OPTIONS[3];
}

function MedicalWheelColumn({ title, items, selectedValue, onSelect, scrollRef }) {
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === selectedValue)
  );

  useEffect(() => {
    if (!scrollRef.current || selectedIndex < 0) return;

    requestAnimationFrame(() => {
      scrollRef.current?.scrollToOffset({
        offset: selectedIndex * MEDICAL_WHEEL_ITEM_HEIGHT,
        animated: false,
      });
    });
  }, [items, scrollRef, selectedIndex]);

  const handleSnap = (offsetY) => {
    const rawIndex = Math.round(offsetY / MEDICAL_WHEEL_ITEM_HEIGHT);
    const nextIndex = Math.min(Math.max(rawIndex, 0), items.length - 1);
    const nextItem = items[nextIndex];

    if (!nextItem) return;

    if (nextItem.value !== selectedValue) {
      onSelect(nextItem.value);
    }
  };

  return (
    <View style={styles.medWheelColumn}>
      <Text style={styles.medWheelTitle}>{title}</Text>
      <View style={styles.medWheelBox}>
        <View style={styles.medWheelFadeTop} pointerEvents="none" />
        <View style={styles.medWheelSelection} pointerEvents="none" />
        <View style={styles.medWheelFadeBottom} pointerEvents="none" />
        <FlatList
          ref={scrollRef}
          data={items}
          extraData={selectedValue}
          keyExtractor={(item, index) => `${title}-${item.value}-${index}`}
          showsVerticalScrollIndicator={false}
          snapToInterval={MEDICAL_WHEEL_ITEM_HEIGHT}
          disableIntervalMomentum
          bounces={false}
          decelerationRate="fast"
          scrollEventThrottle={16}
          overScrollMode="never"
          removeClippedSubviews={false}
          keyboardShouldPersistTaps="handled"
          getItemLayout={(_, index) => ({
            length: MEDICAL_WHEEL_ITEM_HEIGHT,
            offset: MEDICAL_WHEEL_ITEM_HEIGHT * index,
            index,
          })}
          contentContainerStyle={styles.medWheelContent}
          onMomentumScrollEnd={(event) => handleSnap(event.nativeEvent.contentOffset.y)}
          renderItem={({ item, index }) => {
            const isActive = item.value === selectedValue;

            return (
              <TouchableOpacity
                style={styles.medWheelItem}
                activeOpacity={0.8}
                onPress={() => {
                  scrollRef.current?.scrollToOffset({
                    offset: index * MEDICAL_WHEEL_ITEM_HEIGHT,
                    animated: true,
                  });
                  if (item.value !== selectedValue) {
                    onSelect(item.value);
                  }
                }}
              >
                <View style={[styles.medWheelItemInner, isActive && styles.medWheelItemInnerActive]}>
                  <Text style={[styles.medWheelItemText, isActive && styles.medWheelItemTextActive]}>
                    {item.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
}

// ნოთიფიკაციების ქცევის კონფიგურაცია
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ==========================================
// Dashboard - ძირითადი პანელი (Profile Screen)
// ==========================================
function Dashboard({
  session,
  petsRefreshToken = 0,
  primaryPetId = null,
  onPrimaryPetChanged,
  onPetsChanged,
  onProfileChanged,
}) {
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState([]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [isMedModalVisible, setMedModalVisible] = useState(false);
  const [isMedEditorVisible, setMedEditorVisible] = useState(false);
  const [isMedDatePickerVisible, setMedDatePickerVisible] = useState(false);
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // პასპორტის სურათის სრულ ეკრანზე სანახავი state
  const [viewerImage, setViewerImage] = useState(null);

  // მონაცემები
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petSex, setPetSex] = useState(''); 
  const [petColor, setPetColor] = useState('');
  const [petSize, setPetSize] = useState('');
  const [petWeight, setPetWeight] = useState('');
  const [petLocation, setPetLocation] = useState(''); 
  const [petDesc, setPetDesc] = useState('');
  const [petShortCode, setPetShortCode] = useState('');
  const [dogImage, setDogImage] = useState(null);
  const [passportImage, setPassportImage] = useState(null);
  const [editingPet, setEditingPet] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [selectedPet, setSelectedPet] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [medicalFilter, setMedicalFilter] = useState(null);
  const [recordType, setRecordType] = useState('vaccine');
  const [recordInfo, setRecordInfo] = useState('');
  const [reminder, setReminder] = useState('none');
  const [editingMedId, setEditingMedId] = useState(null);
  const [recordDate, setRecordDate] = useState(todayIso());
  const [existingNextDueDate, setExistingNextDueDate] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pickerYear, setPickerYear] = useState(parseMedicalDate(todayIso()).year);
  const [pickerMonthIndex, setPickerMonthIndex] = useState(parseMedicalDate(todayIso()).monthIndex);
  const [pickerDay, setPickerDay] = useState(parseMedicalDate(todayIso()).day);
  const yearWheelRef = useRef(null);
  const monthWheelRef = useRef(null);
  const dayWheelRef = useRef(null);

  const wheelYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 31 }, (_, index) => currentYear - 15 + index);
  }, []);

  const wheelDayOptions = useMemo(
    () => Array.from({ length: getMedicalDayCount(pickerYear, pickerMonthIndex) }, (_, index) => index + 1),
    [pickerMonthIndex, pickerYear]
  );

  const filteredMedicalRecords = useMemo(() => {
    if (!medicalFilter) {
      return medicalRecords;
    }

    return medicalRecords.filter((record) => getMedicalTypeMeta(record.record_type || '').id === medicalFilter);
  }, [medicalFilter, medicalRecords]);

  const activePrimaryPetId = useMemo(() => {
    if (!pets.length) {
      return null;
    }

    if (primaryPetId && pets.some((pet) => pet.id === primaryPetId)) {
      return primaryPetId;
    }

    return pets[0].id;
  }, [pets, primaryPetId]);

  useEffect(() => { 
    if (session) {
      fetchData(); 
      setupNotifications();
    }
  }, [session]);

  useEffect(() => {
    if (!session || !petsRefreshToken) {
      return;
    }

    fetchData();
  }, [petsRefreshToken, session]);

  useEffect(() => {
    if (!pets.length) {
      if (primaryPetId) {
        onPrimaryPetChanged?.(null);
      }
      return;
    }

    if (activePrimaryPetId !== primaryPetId) {
      onPrimaryPetChanged?.(activePrimaryPetId);
    }
  }, [activePrimaryPetId, onPrimaryPetChanged, pets.length, primaryPetId]);

  useEffect(() => {
    const maxDay = getMedicalDayCount(pickerYear, pickerMonthIndex);
    if (pickerDay > maxDay) {
      setPickerDay(maxDay);
    }
  }, [pickerDay, pickerMonthIndex, pickerYear]);

  async function setupNotifications() {
    if (!Device.isDevice) return;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2e8b57',
        });
      }

      // მუდმივი შეხსენება აპში შესვლისთვის ყოველ 5 დღეში (432000 წამი)
      await Notifications.cancelScheduledNotificationAsync('app-reminder').catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: 'app-reminder',
        content: {
          title: 'Georgian Pets',
          body: 'არ დაგავიწყდეთ თქვენი ცხოველების მონაცემების შემოწმება.',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 432000, 
          repeats: true,
        },
      });
    } catch (error) {
      console.log('Notification setup error:', error);
    }
  }

  async function fetchData() {
    if (!session?.user?.id) return;
    setLoading(true);

    try {
      const userId = session.user.id;
      const ensuredProfile = await ensureProfileRow(session.user);

      if (ensuredProfile.error) {
        throw ensuredProfile.error;
      }

      const { data: prof, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (prof) {
        setFullName(prof.full_name || '');
        setPhone(prof.phone_number || '');
      }

      const { data: pts, error: petsError } = await supabase
        .from('pets')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (petsError) {
        throw petsError;
      }

      setPets(pts || []);
    } catch (error) {
      console.log('Profile fetch error:', error);
      Alert.alert('პროფილი ვერ ჩაიტვირთა', error.message || 'მონაცემების წამოღება ვერ მოხერხდა.');
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!session?.user?.id) return;

    const trimmedFullName = fullName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedFullName) {
      return Alert.alert('პროფილი', 'სახელი და გვარი სავალდებულოა.');
    }

    if (!trimmedPhone) {
      return Alert.alert('პროფილი', 'ტელეფონის ნომერი სავალდებულოა.');
    }

    setSavingProfile(true);
    try {
      const { error } = await ensureProfileRow(session.user, {
        full_name: trimmedFullName,
        phone_number: trimmedPhone,
      });

      if (error) {
        throw error;
      }

      setFullName(trimmedFullName);
      setPhone(trimmedPhone);
      onProfileChanged?.();
      await fetchData();
      Alert.alert('წარმატება', 'მონაცემები შენახულია');
    } catch (error) {
      Alert.alert('პროფილი ვერ შეინახა', error.message || 'შენახვა ვერ მოხერხდა.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function pickImage(type) {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'dog' ? [1, 1] : [3, 4],
      quality: 0.4,
      base64: true,
    });
    if (!result.canceled) {
      if (type === 'dog') setDogImage(result.assets[0]);
      else setPassportImage(result.assets[0]);
    }
  }

  async function handleSave() {
    if (!petName) return Alert.alert("შეცდომა", "სახელი აუცილებელია");
    if (!session?.user?.id) return Alert.alert("შეცდომა", "ავტორიზაცია ვერ მოიძებნა");
    const trimmedFullName = fullName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedFullName) {
      return Alert.alert('პროფილი', 'ძაღლის დამატებამდე შეავსე სახელი და გვარი.');
    }

    if (!trimmedPhone) {
      return Alert.alert('პროფილი', 'ძაღლის დამატებამდე შეავსე ტელეფონის ნომერი.');
    }

    setUploading(true);

    try {
    const ensuredProfile = await ensureProfileRow(session.user, {
      full_name: trimmedFullName,
      phone_number: trimmedPhone,
    });

    if (ensuredProfile.error) {
      throw ensuredProfile.error;
    }

    const shortCode = await ensurePetCodeIsUnique(
      petShortCode,
      editingPet?.id || null
    );
    let dogUrl = editingPet ? editingPet.photo_url : null;
    let passUrl = editingPet ? editingPet.passport_photo_url : null;

    if (dogImage) {
      dogUrl = await uploadImageAsset(dogImage, { folder: 'pets/dogs', prefix: 'dog' });
    }

    if (passportImage) {
      passUrl = await uploadImageAsset(passportImage, { folder: 'pets/passports', prefix: 'passport' });
    }

    const petObj = {
      owner_id: session.user.id,
      name: petName,
      breed: petBreed,
      sex: petSex,
      color: petColor,
      size: petSize,
      weight: petWeight,
      location: petLocation,
      description: petDesc,
      photo_url: dogUrl,
      passport_photo_url: passUrl,
      short_code: shortCode,
    };

    let error;
    let savedPetId = editingPet?.id || null;
    if (editingPet) {
      const res = await supabase.from('pets').update(petObj).eq('id', editingPet.id);
      error = res.error;
    } else {
      petObj.is_lost = false;
      const res = await supabase.from('pets').insert([petObj]).select('id').single();
      error = res.error;
      savedPetId = res.data?.id || null;
    }

    if (!error) {
      setFullName(trimmedFullName);
      setPhone(trimmedPhone);
      if (!editingPet && !activePrimaryPetId && savedPetId) {
        await onPrimaryPetChanged?.(savedPetId);
      }
      onProfileChanged?.();
      onPetsChanged?.();
      setEditModalVisible(false); setAddModalVisible(false);
      resetForm();
      await fetchData();
    } else {
      Alert.alert("შეცდომა", error.message);
    }
    } catch (error) {
      Alert.alert('შენახვა ვერ მოხერხდა', error.message);
    } finally {
      setUploading(false);
    }
  }

  function resetForm() {
    setPetName(''); setPetBreed(''); setPetSex(''); setPetColor(''); setPetSize(''); setPetWeight(''); setPetLocation(''); setPetDesc('');
    setPetShortCode(''); setDogImage(null); setPassportImage(null); setEditingPet(null);
  }

  function startEdit(pet) {
    setEditingPet(pet);
    setPetName(pet.name);
    setPetBreed(pet.breed || '');
    setPetSex(pet.sex || '');
    setPetColor(pet.color || '');
    setPetSize(pet.size || '');
    setPetWeight(pet.weight || '');
    setPetLocation(pet.location || '');
    setPetDesc(pet.description || '');
    setPetShortCode(pet.short_code || '');
    setEditModalVisible(true);
  }

  function setPrimaryPet(id) {
    if (!id || id === activePrimaryPetId) {
      return;
    }

    onPrimaryPetChanged?.(id);
  }

  async function confirmToggleLost(id, currentStatus) {
    const newStatus = !currentStatus;
    const question = newStatus
      ? "ნამდვილად გსურთ ძებნის რეჟიმის ჩართვა? ადმინს მიუვა მოთხოვნა და მისი დადასტურების შემდეგ ყველა მომხმარებელს გაეგზავნება შეტყობინება."
      : "ნამდვილად იპოვეთ ძაღლი/კატა?";
    
    Alert.alert("სტატუსის შეცვლა", question, [
      { text: "არა", style: "cancel" },
      { text: "დიახ", onPress: async () => {
          const { error } = await updateLostPetMode(id, newStatus);
          if (error) {
            Alert.alert("შეცდომა", error.message);
            return;
          }
          onPetsChanged?.({ recentLostPetId: newStatus ? id : null });
          await fetchData();
          if (newStatus) {
            Alert.alert("მოთხოვნა გაგზავნილია", "ცხოველი დაემატა ძებნის სიაში. საერთო შეტყობინება გაიგზავნება ადმინის დადასტურების შემდეგ.");
          }
        }
      }
    ]);
  }

  async function deletePet(id) {
    Alert.alert("წაშლა", "ნამდვილად გსურთ წაშლა?", [
      { text: "არა" },
      { text: "დიახ", style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('pets').delete().eq('id', id);
          if (error) {
            Alert.alert("შეცდომა", error.message);
            return;
          }
          if (id === activePrimaryPetId) {
            const nextPrimaryPetId = pets.find((pet) => pet.id !== id)?.id || null;
            await onPrimaryPetChanged?.(nextPrimaryPetId);
          }
          onPetsChanged?.();
          await fetchData();
      }}
    ]);
  }

  // ==========================================
  // სამედიცინო ბარათის ლოგიკა
  // ==========================================
  async function loadMedicalRecords(petId) {
    if (!petId) return;

    const { data, error } = await supabase
      .from('medical_records')
      .select('*')
      .eq('pet_id', petId)
      .order('date_administered', { ascending: false });

    if (error) {
      Alert.alert('შეცდომა ჩატვირთვისას', error.message);
      return;
    }

    setMedicalRecords(data || []);
  }

  async function openMedicalCard(pet) {
    setSelectedPet(pet);
    setMedicalFilter(null);
    resetMedForm();
    setMedDatePickerVisible(false);
    setMedEditorVisible(false);
    await loadMedicalRecords(pet.id);
    setMedModalVisible(true);
  }

  function closeMedicalCard() {
    setMedModalVisible(false);
    setMedEditorVisible(false);
    setMedDatePickerVisible(false);
    setMedicalFilter(null);
    resetMedForm();
  }

  function resetMedForm() {
    const today = todayIso();
    const todayParts = parseMedicalDate(today);
    setRecordInfo('');
    setRecordType('vaccine');
    setRecordDate(today);
    setReminder('none');
    setEditingMedId(null);
    setExistingNextDueDate(null);
    setPickerYear(todayParts.year);
    setPickerMonthIndex(todayParts.monthIndex);
    setPickerDay(todayParts.day);
  }

  function openNewMedRecord() {
    resetMedForm();
    setMedModalVisible(false);
    setMedDatePickerVisible(false);
    setMedEditorVisible(true);
  }

  function startEditMed(record) {
    const nextReminder = getReminderFromDates(record.date_administered || todayIso(), record.next_due_date || null);
    const parsedDate = parseMedicalDate(record.date_administered || todayIso());

    setEditingMedId(record.id);
    setRecordInfo(record.record_name || (record.record_type || '').split(': ')[1] || '');
    setRecordDate(record.date_administered || todayIso());
    setExistingNextDueDate(record.next_due_date || null);
    setPickerYear(parsedDate.year);
    setPickerMonthIndex(parsedDate.monthIndex);
    setPickerDay(parsedDate.day);

    if ((record.record_type || '').includes('აცრა') || record.record_type === 'vaccine') setRecordType('vaccine');
    else if ((record.record_type || '').includes('ჭია') || record.record_type === 'worm') setRecordType('worm');
    else if ((record.record_type || '').includes('გარე პარაზიტები') || record.record_type === 'parasite') setRecordType('parasite');
    else setRecordType('other');

    setReminder(nextReminder);
    setMedModalVisible(false);
    setMedDatePickerVisible(false);
    setMedEditorVisible(true);
  }

  function openMedDatePicker() {
    const parsedDate = parseMedicalDate(recordDate);
    setPickerYear(parsedDate.year);
    setPickerMonthIndex(parsedDate.monthIndex);
    setPickerDay(parsedDate.day);
    setMedEditorVisible(false);
    setMedDatePickerVisible(true);
  }

  function closeMedEditor() {
    setMedEditorVisible(false);
    setMedDatePickerVisible(false);
    resetMedForm();
    setMedModalVisible(true);
  }

  function cancelMedDatePicker() {
    setMedDatePickerVisible(false);
    setMedEditorVisible(true);
  }

  function jumpMedDatePickerToToday() {
    const today = parseMedicalDate(todayIso());
    setPickerYear(today.year);
    setPickerMonthIndex(today.monthIndex);
    setPickerDay(today.day);
  }

  function confirmMedDatePicker() {
    setRecordDate(formatMedicalDateValue(pickerYear, pickerMonthIndex, pickerDay));
    setMedDatePickerVisible(false);
    setMedEditorVisible(true);
  }

  async function deleteMedRecord(id) {
    Alert.alert("წაშლა", "ნამდვილად გსურთ ამ ჩანაწერის წაშლა?", [
      { text: "არა" },
      { text: "დიახ", style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('medical_records').delete().eq('id', id);
          if (error) {
            Alert.alert('ჩანაწერი ვერ წაიშალა', error.message);
            return;
          }
          setMedDatePickerVisible(false);
          setMedEditorVisible(false);
          resetMedForm();
          await loadMedicalRecords(selectedPet?.id);
          setMedModalVisible(true);
      }}
    ]);
  }

  async function addMedical() {
    if (!recordInfo) {
      Alert.alert("ყურადღება", "გთხოვთ შეიყვანოთ პრეპარატის დასახელება");
      return;
    }
    
    let label = '📝 სხვა';
    if (recordType === 'vaccine') label = '💉 აცრა';
    if (recordType === 'worm') label = '💊 ჭია';
    if (recordType === 'parasite') label = '🦟 გარე პარაზიტები';
    
    // შეხსენების თარიღის გამოთვლა
    let nextDate = editingMedId ? existingNextDueDate : null;
    if (reminder !== 'none') {
      const d = new Date(`${recordDate}T10:00:00`);
      if (reminder === '1_month') d.setMonth(d.getMonth() + 1);
      if (reminder === '3_months') d.setMonth(d.getMonth() + 3);
      if (reminder === '1_year') d.setFullYear(d.getFullYear() + 1);
      nextDate = d.toISOString().split('T')[0];

      // ლოკალური შეხსენების დანიშვნა (დილის 10:00 საათზე)
      const triggerDate = new Date(d);
      triggerDate.setHours(10, 0, 0, 0);

      if (triggerDate > new Date()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🐾 შეხსენება: ${selectedPet.name}`,
            body: `${label} - ${recordInfo}-ის დრო მოვიდა!`,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
          },
        });
      }
    }

    const payload = {
      pet_id: selectedPet.id, 
      record_type: recordType,
      record_name: recordInfo, 
      date_administered: recordDate,
      next_due_date: nextDate
    };

    let error;
    if (editingMedId) {
      const res = await supabase.from('medical_records').update(payload).eq('id', editingMedId);
      error = res.error;
    } else {
      const res = await supabase.from('medical_records').insert([payload]);
      error = res.error;
    }

    if (error) {
      Alert.alert("ვერ შეინახა", error.message);
      return;
    }

    await loadMedicalRecords(selectedPet?.id);
    setMedDatePickerVisible(false);
    setMedEditorVisible(false);
    resetMedForm();
    Keyboard.dismiss();
    setMedModalVisible(true);
  }

  const wheelYearItems = wheelYearOptions.map((year) => ({ label: String(year), value: year }));
  const wheelMonthItems = MEDICAL_MONTH_OPTIONS.map((label, index) => ({ label, value: index }));
  const wheelDayItems = wheelDayOptions.map((day) => ({ label: String(day), value: day }));

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#2e8b57" /></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f4f6f9' }} edges={['top']}>
      <ScrollView 
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        
        <View style={styles.headerRow}>
          <Text style={styles.sectionHeader}>ჩემი ცხოველები</Text>
          <TouchableOpacity style={styles.addCircle} onPress={() => { resetForm(); setAddModalVisible(true); }} activeOpacity={0.8}>
            <Text style={{color: '#fff', fontSize: 24, fontWeight: 'bold'}}>+</Text>
          </TouchableOpacity>
        </View>

        {pets.map((pet) => (
          <View key={pet.id} style={[styles.petCard, pet.is_lost && styles.petCardLost]}>
            <View style={styles.petTopRow}>
              <TouchableOpacity
                style={styles.petImageWrap}
                activeOpacity={pet.photo_url ? 0.88 : 1}
                disabled={!pet.photo_url}
                onPress={() => pet.photo_url && setViewerImage(pet.photo_url)}
              >
                {pet.photo_url ? (
                  <Image source={{ uri: pet.photo_url }} style={styles.petImg} />
                ) : (
                  <View style={styles.petImgPlaceholder}>
                    <Text style={styles.petImgPlaceholderText}>ფოტო</Text>
                  </View>
                )}

                <View
                  style={[
                    styles.petStatusBadge,
                    pet.is_lost ? styles.petStatusBadgeLost : styles.petStatusBadgeSafe,
                  ]}
                >
                  <Text
                    style={[
                      styles.petStatusText,
                      pet.is_lost ? styles.petStatusTextLost : styles.petStatusTextSafe,
                    ]}
                  >
                    {pet.is_lost ? 'იძებნება' : 'დაცული'}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.petContent}>
                <View style={styles.petHeaderRow}>
                  <View style={styles.petTitleWrap}>
                    <Text style={styles.petName} numberOfLines={1}>{pet.name}</Text>
                    <Text style={styles.petBreedText} numberOfLines={1}>
                      {pet.breed || 'ჯიში უცნობია'}
                    </Text>
                  </View>

                  <View style={styles.petActions}>
                    <TouchableOpacity
                      onPress={() => setPrimaryPet(pet.id)}
                      style={[
                        styles.actionBtn,
                        styles.primaryActionBtn,
                        activePrimaryPetId === pet.id
                          ? styles.primaryActionBtnActive
                          : styles.primaryActionBtnIdle,
                      ]}
                      activeOpacity={activePrimaryPetId === pet.id ? 1 : 0.8}
                      disabled={activePrimaryPetId === pet.id}
                    >
                      <Text
                        style={[
                          styles.actionBtnText,
                          activePrimaryPetId === pet.id
                            ? styles.primaryActionBtnTextActive
                            : styles.primaryActionBtnTextIdle,
                        ]}
                      >
                        {activePrimaryPetId === pet.id ? 'მთავარია' : 'მთავარად'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => startEdit(pet)} style={styles.actionBtn} activeOpacity={0.8}>
                      <Text style={styles.actionBtnText}>რედაქტირება</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deletePet(pet.id)}
                      style={[styles.actionBtn, styles.actionBtnDanger]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>წაშლა</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.petInfoGrid}>
                  <View style={[styles.petInfoCard, styles.petInfoCardStrong]}>
                    <Text style={styles.petInfoLabelStrong}>Pet ID</Text>
                    <Text style={styles.petInfoValueStrong}>{pet.short_code || '-'}</Text>
                  </View>

                  <View style={styles.petInfoCard}>
                    <Text style={styles.petInfoLabel}>სქესი</Text>
                    <Text style={styles.petInfoValue}>{pet.sex || '-'}</Text>
                  </View>

                  <View style={[styles.petInfoCard, styles.petInfoCardWide]}>
                    <Text style={styles.petInfoLabel}>მდებარეობა</Text>
                    <Text style={styles.petInfoValue} numberOfLines={2}>{pet.location || '-'}</Text>
                  </View>

                  <View style={styles.petInfoCard}>
                    <Text style={styles.petInfoLabel}>ფერი</Text>
                    <Text style={styles.petInfoValue}>{pet.color || '-'}</Text>
                  </View>

                  <View style={styles.petInfoCard}>
                    <Text style={styles.petInfoLabel}>წონა</Text>
                    <Text style={styles.petInfoValue}>{pet.weight || '-'}</Text>
                  </View>
                </View>

                <View style={styles.petFactsRow}>
                  {pet.sex ? (
                    <View style={styles.petFactChip}>
                      <Text style={styles.petFactChipText}>{pet.sex}</Text>
                    </View>
                  ) : null}
                  {pet.location ? (
                    <View style={styles.petFactChip}>
                      <Text style={styles.petFactChipText}>📍 {pet.location}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.petFactsRow}>
                  {pet.color ? (
                    <View style={styles.petFactChipMuted}>
                      <Text style={styles.petFactChipMutedText}>ფერი: {pet.color}</Text>
                    </View>
                  ) : null}
                  {pet.weight ? (
                    <View style={styles.petFactChipMuted}>
                      <Text style={styles.petFactChipMutedText}>წონა: {pet.weight}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.idBadge}>
                  <Text style={styles.idBadgeLabel}>Pet ID</Text>
                  <Text style={styles.codeText}>{pet.short_code}</Text>
                </View>
              </View>
            </View>

            <View style={styles.petSummaryGrid}>
              <View style={[styles.petSummaryCard, styles.petSummaryCardStrong]}>
                <Text style={styles.petInfoLabelStrong}>Pet ID</Text>
                <Text style={styles.petInfoValueStrong}>{pet.short_code || '-'}</Text>
              </View>

              <View style={[styles.petSummaryCard, styles.petSummaryCardCompact]}>
                <Text style={styles.petInfoLabel}>სქესი</Text>
                <Text style={styles.petInfoValue}>{pet.sex || '-'}</Text>
              </View>

              <View style={[styles.petSummaryCard, styles.petSummaryCardWide]}>
                <Text style={styles.petInfoLabel}>მდებარეობა</Text>
                <Text style={styles.petInfoValue} numberOfLines={2}>{pet.location || '-'}</Text>
              </View>

              <View style={styles.petSummaryCard}>
                <Text style={styles.petInfoLabel}>ფერი</Text>
                <Text style={styles.petInfoValue}>{pet.color || '-'}</Text>
              </View>

              <View style={styles.petSummaryCard}>
                <Text style={styles.petInfoLabel}>წონა</Text>
                <Text style={styles.petInfoValue}>{pet.weight || '-'}</Text>
              </View>
            </View>

            <View style={styles.petBottomRow}>
              <TouchableOpacity
                style={[styles.featureBtn, styles.featureBtnPrimary]}
                onPress={() => openMedicalCard(pet)}
                activeOpacity={0.8}
              >
                <Text style={styles.featureBtnText}>სამედიცინო ბარათი</Text>
                <Text style={styles.featureBtnSubtext}>ვაქცინა, ჭია და შეხსენებები</Text>
              </TouchableOpacity>

              {pet.passport_photo_url ? (
                <TouchableOpacity
                  style={[styles.featureBtn, styles.featureBtnWarm]}
                  onPress={() => setViewerImage(pet.passport_photo_url)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.featureBtnText, styles.featureBtnTextWarm]}>პასპორტი</Text>
                  <Text style={[styles.featureBtnSubtext, styles.featureBtnSubtextWarm]}>გახსენი სრული სურათი</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.featureBtn, styles.featureBtnMuted]}>
                  <Text style={[styles.featureBtnText, styles.featureBtnTextMuted]}>პასპორტი არ არის</Text>
                  <Text style={[styles.featureBtnSubtext, styles.featureBtnSubtextMuted]}>დაამატე რედაქტირებიდან</Text>
                </View>
              )}
            </View>

            <View style={styles.lostPanel}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.lostPanelLabel}>ძებნის რეჟიმი</Text>
                <Text style={[styles.lostPanelValue, pet.is_lost ? styles.lostPanelValueAlert : styles.lostPanelValueSafe]}>
                  {pet.is_lost ? 'აქტიურია და ცხოველი ჩანს ძებნის გვერდზე' : 'გამორთულია და ცხოველი უსაფრთხო სიაშია'}
                </Text>
              </View>

              <Switch
                trackColor={{ false: '#d7dee7', true: '#ffd1d1' }}
                thumbColor={pet.is_lost ? '#ff4d4d' : '#ffffff'}
                value={pet.is_lost}
                onValueChange={() => confirmToggleLost(pet.id, pet.is_lost)}
              />
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.profileHeader} onPress={() => setIsProfileOpen(!isProfileOpen)} activeOpacity={0.8}>
          <Text style={styles.profileHeaderText}>👤 ჩემი პროფილი</Text>
          <View style={styles.profileChevronBtn}>
             <Text style={{color: '#555', fontSize: 12, fontWeight: 'bold'}}>{isProfileOpen ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>
        
        {isProfileOpen && (
          <View style={styles.profileContent}>
            <Text style={styles.inputLabel}>სახელი და გვარი</Text>
            <TextInput style={styles.input} placeholder="სახელი გვარი" value={fullName} onChangeText={setFullName} placeholderTextColor="#aaa" />
            
            <Text style={styles.inputLabel}>ტელეფონის ნომერი</Text>
            <TextInput style={styles.input} placeholder="599 12 34 56" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor="#aaa" />
            
            <TouchableOpacity style={styles.saveProfileBtn} onPress={saveProfile} disabled={savingProfile} activeOpacity={0.8}>
              <Text style={styles.saveProfileBtnText}>{savingProfile ? 'ინახება...' : 'შენახვა'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
  style={styles.privacyBtn}
  onPress={() => Linking.openURL('https://sites.google.com/view/pets-id')}
  activeOpacity={0.7}
>
  <Text style={styles.privacyBtnText}>📄 Privacy Policy</Text>
</TouchableOpacity>

            
            <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.logoutBtn}>
              <Text style={styles.logoutBtnText}>სისტემიდან გამოსვლა</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.profileQuickActions}>
          <TouchableOpacity
            style={styles.profileQuickBtn}
            onPress={() => Linking.openURL('https://sites.google.com/view/pets-id')}
            activeOpacity={0.8}
          >
            <Text style={styles.profileQuickBtnIcon}>📄</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileQuickBtnTitle}>Privacy Policy</Text>
              <Text style={styles.profileQuickBtnText}>გახსენი წესები და კონფიდენციალურობის ინფორმაცია</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => supabase.auth.signOut()}
            style={[styles.profileQuickBtn, styles.profileQuickBtnDanger]}
            activeOpacity={0.8}
          >
            <Text style={styles.profileQuickBtnIcon}>↗</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileQuickBtnTitle, styles.profileQuickBtnDangerTitle]}>სისტემიდან გამოსვლა</Text>
              <Text style={[styles.profileQuickBtnText, styles.profileQuickBtnDangerText]}>გამოდი ანგარიშიდან ერთი შეხებით</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ==========================================
          რედაქტირების / დამატების მოდალი 
          ========================================== */}
      <Modal visible={isEditModalVisible || isAddModalVisible} animationType="slide">
        <View style={{flex: 1, backgroundColor: '#f9fbfd', paddingTop: Platform.OS === 'ios' ? 50 : 20}}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
            style={{flex: 1}}
          >
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingPet ? 'რედაქტირება' : 'ახალი ცხოველი'}</Text>
              <TouchableOpacity style={styles.closeIconBtn} onPress={() => { setEditModalVisible(false); setAddModalVisible(false); }}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={{padding: 20}} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              automaticallyAdjustKeyboardInsets
            >
              <View style={styles.rowBetween}>
                <TouchableOpacity style={styles.imageBox} onPress={() => pickImage('dog')} activeOpacity={0.8}>
                  {dogImage ? <Image source={{uri: dogImage.uri}} style={styles.fullImg} /> : (editingPet?.photo_url ? <Image source={{uri: editingPet.photo_url}} style={styles.fullImg} /> : <Text style={styles.imgLabel}>📷 ფოტო</Text>)}
                </TouchableOpacity>
                <TouchableOpacity style={styles.imageBox} onPress={() => pickImage('passport')} activeOpacity={0.8}>
                  {passportImage ? <Image source={{uri: passportImage.uri}} style={styles.fullImg} /> : (editingPet?.passport_photo_url ? <Image source={{uri: editingPet.passport_photo_url}} style={styles.fullImg} /> : <Text style={styles.imgLabel}>📄 პასპორტი</Text>)}
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>ცხოველის სახელი</Text>
                <TextInput style={styles.input} placeholder="ჩაწერეთ სახელი" value={petName} onChangeText={setPetName} placeholderTextColor="#aaa" />
                
                <Text style={styles.inputLabel}>ჯიში</Text>
                <TextInput style={styles.input} placeholder="მაგ: კანე კორსო" value={petBreed} onChangeText={setPetBreed} placeholderTextColor="#aaa" />
                
                <Text style={styles.inputLabel}>Pet ID</Text>
                <TextInput
                  style={styles.input}
                    placeholder="შეიყვანეთ მინიმუმ 3 სიმბოლო"
                  value={petShortCode}
                  onChangeText={setPetShortCode}
                  placeholderTextColor="#aaa"
                />
                <Text style={styles.inputLabel}>სქესი</Text>
                <View style={styles.sexContainer}>
                  <TouchableOpacity style={[styles.sexBtn, petSex === 'ხვადი' && styles.sexBtnActive]} onPress={() => setPetSex('ხვადი')} activeOpacity={0.8}>
                    <Text style={[styles.sexBtnText, petSex === 'ხვადი' && styles.sexBtnTextActive]}>♂️ ხვადი</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.sexBtn, petSex === 'ძუ' && styles.sexBtnActive]} onPress={() => setPetSex('ძუ')} activeOpacity={0.8}>
                    <Text style={[styles.sexBtnText, petSex === 'ძუ' && styles.sexBtnTextActive]}>♀️ ძუ</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>მდებარეობა (ქალაქი / უბანი)</Text>
                <TextInput style={styles.input} placeholder="მაგ: თბილისი, საბურთალო" value={petLocation} onChangeText={setPetLocation} placeholderTextColor="#aaa" />
                
                <Text style={styles.inputLabel}>ფერი</Text>
                <TextInput style={styles.input} placeholder="მაგ: შავი, თეთრი მკერდით" value={petColor} onChangeText={setPetColor} placeholderTextColor="#aaa" />

                <Text style={styles.inputLabel}>ზომა</Text>
                <TextInput style={styles.input} placeholder="პატარა, საშუალო ან დიდი" value={petSize} onChangeText={setPetSize} placeholderTextColor="#aaa" />
                
                <Text style={styles.inputLabel}>წონა (კგ)</Text>
                <TextInput style={styles.input} placeholder="მაგ: 25 კგ" value={petWeight} onChangeText={setPetWeight} placeholderTextColor="#aaa" keyboardType="numbers-and-punctuation"/>
                
                <Text style={styles.inputLabel}>განსაკუთრებული ნიშნები (არასავალდებულო)</Text>
                <TextInput style={[styles.input, styles.textArea]} placeholder="მოკლე აღწერა..." value={petDesc} onChangeText={setPetDesc} multiline placeholderTextColor="#aaa" />
              </View>

              {uploading ? (
                <ActivityIndicator size="large" color="#2e8b57" style={{marginVertical: 20}} />
              ) : (
                <TouchableOpacity style={styles.submitBtn} onPress={handleSave} activeOpacity={0.8}>
                  <Text style={styles.submitBtnText}>{editingPet ? 'შენახვა' : 'რეგისტრაცია'}</Text>
                </TouchableOpacity>
              )}
              <View style={{height: 50}} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ==========================================
          სამედიცინო მოდალი 
          ========================================== */}
      <Modal visible={isMedModalVisible} animationType="slide">
        <View style={styles.medModalScreen}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
            style={{ flex: 1 }}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🩺 {selectedPet?.name}-ის ისტორია</Text>
              <TouchableOpacity style={styles.closeIconBtn} onPress={closeMedicalCard}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.medHistoryContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.medOverviewCard}>
                <View style={styles.medOverviewHeader}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.medOverviewTitle}>{selectedPet?.name || 'ცხოველი'}</Text>
                    <Text style={styles.medOverviewSubtitle}>
                      ყველა ჩატარებული პროცედურა, ბოლოს გაკეთებული თარიღი და შემდეგი შეხსენებები ერთ ადგილას.
                    </Text>
                  </View>
                  <View style={styles.medOverviewBadge}>
                    <Text style={styles.medOverviewBadgeValue}>{medicalRecords.length}</Text>
                    <Text style={styles.medOverviewBadgeLabel}>ჩანაწერი</Text>
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
                    <Text style={styles.medOverviewStatLabel}>აქტიური შეხსენება</Text>
                    <Text style={styles.medOverviewStatValue}>
                      {medicalRecords.filter((record) => record.next_due_date).length}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.medLaunchEditorBtn} onPress={openNewMedRecord} activeOpacity={0.86}>
                <View style={styles.medLaunchEditorIcon}>
                  <Text style={styles.medLaunchEditorIconText}>＋</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medLaunchEditorTitle}>ახალი ჩანაწერის დამატება</Text>
                  <Text style={styles.medLaunchEditorText}>
                    დააჭირე და გახსენი ცალკე ფანჯარა, სადაც თარიღს, ტიპს და შეხსენებას მშვიდად აირჩევ.
                  </Text>
                </View>
              </TouchableOpacity>

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
                        <Text style={styles.medFilterChipIcon}>{option.icon}</Text>
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
                <Text style={styles.medFilterHint}>
                  თუ არაფერი გაქვს მონიშნული, ისტორია სრულად ჩანს.
                </Text>
              </View>

              {filteredMedicalRecords.length === 0 ? (
                <View style={styles.emptyMedContainer}>
                  <View style={styles.emptyMedIconWrap}>
                    <Text style={styles.emptyMedIcon}>🩺</Text>
                  </View>
                  <Text style={styles.emptyMedTitle}>ისტორია ჯერ ცარიელია</Text>
                  <Text style={styles.emptyMedText}>
                    დაამატე პირველი ჩანაწერი და შემდეგ ყველა ვაქცინა თუ პროცედურა აქ დაგელაგება.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.medRecordsSection}>
                    <View style={styles.medRecordsHeader}>
                      <Text style={styles.medRecordsTitle}>ისტორია</Text>
                      <Text style={styles.medRecordsCaption}>ბარათზე დაჭერით რედაქტირდება</Text>
                    </View>
                  </View>

                  {filteredMedicalRecords.map((record, index) => {
                    const typeMeta = getMedicalTypeMeta(record.record_type || '');

                    return (
                      <TouchableOpacity
                        key={record.id || index}
                        style={styles.medItem}
                        onPress={() => startEditMed(record)}
                        activeOpacity={0.84}
                      >
                        <View style={[styles.medItemIconWrap, { backgroundColor: typeMeta.backgroundColor }]}>
                          <Text style={styles.medItemIcon}>{typeMeta.icon}</Text>
                        </View>

                        <View style={styles.medItemBody}>
                          <View style={styles.medItemHeaderRow}>
                            <View style={styles.medItemTitleWrap}>
                              <Text style={styles.medItemTitle}>{record.record_name || typeMeta.label}</Text>
                              <Text style={styles.medItemSubtitle}>{typeMeta.label}</Text>
                            </View>

                            <View style={styles.medItemHeaderActions}>
                              <View style={[styles.medTypeBadge, { backgroundColor: typeMeta.backgroundColor }]}>
                                <Text style={[styles.medTypeBadgeText, { color: typeMeta.accentColor }]}>{typeMeta.label}</Text>
                              </View>
                              <View style={styles.medEditPill}>
                                <Text style={styles.medEditPillText}>რედაქტირება</Text>
                              </View>
                            </View>
                          </View>

                          <View style={styles.medInfoRow}>
                            <View style={styles.medDateBadge}>
                              <Text style={styles.medDateBadgeLabel}>ჩატარების თარიღი</Text>
                              <Text style={styles.medItemDate}>{formatMedicalDateLabel(record.date_administered)}</Text>
                            </View>

                            {record.next_due_date ? (
                              <View style={[styles.medDateBadge, styles.medDateBadgeSuccess]}>
                                <Text style={styles.medDateBadgeLabelSuccess}>შემდეგი შეხსენება</Text>
                                <Text style={[styles.medItemDate, styles.medItemDateSuccess]}>
                                  {formatMedicalDateLabel(record.next_due_date)}
                                </Text>
                              </View>
                            ) : (
                              <View style={[styles.medDateBadge, styles.medDateBadgeMuted]}>
                                <Text style={styles.medDateBadgeLabel}>შეხსენება</Text>
                                <Text style={styles.medItemDate}>არ არის დაყენებული</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={isMedEditorVisible} animationType="slide" transparent={false}>
        <View style={styles.medEditorScreen}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingMedId ? 'რედაქტირება' : 'ახალი ჩანაწერი'}</Text>
              <TouchableOpacity style={styles.closeIconBtn} onPress={closeMedEditor}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.medEditorContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.medEditorHero}>
                <Text style={styles.medEditorHeroTitle}>
                  {selectedPet?.name || 'ცხოველი'} • {editingMedId ? 'ჩანაწერის განახლება' : 'ახალი ჩანაწერის დამატება'}
                </Text>
                <Text style={styles.medEditorHeroText}>
                  შეავსე პროცედურის ტიპი, აირჩიე თარიღი wheel picker-ით და სურვილის შემთხვევაში ჩართე შეხსენება.
                </Text>
              </View>

              <Text style={styles.medSectionLabel}>ტიპი</Text>
              <View style={styles.typeSelector}>
                {MEDICAL_TYPE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => setRecordType(option.id)}
                    style={[
                      styles.typeBtn,
                      recordType === option.id && [styles.typeBtnActive, { borderColor: option.accentColor }],
                    ]}
                    activeOpacity={0.82}
                  >
                    <Text style={[styles.typeBtnText, recordType === option.id && { color: '#fff' }]}>
                      {`${option.icon} ${option.label}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.medSectionLabel}>პრეპარატი / პროცედურა</Text>
              <TextInput
                style={styles.medMainInput}
                placeholder="მაგ. Nobivac DHPPi"
                value={recordInfo}
                onChangeText={setRecordInfo}
                placeholderTextColor="#9aa6b2"
              />

              <Text style={styles.medSectionLabel}>თარიღი</Text>
              <TouchableOpacity style={styles.medDateTrigger} onPress={openMedDatePicker} activeOpacity={0.84}>
                <View>
                  <Text style={styles.medDateTriggerLabel}>არჩეული თარიღი</Text>
                  <Text style={styles.medDateTriggerValue}>{formatMedicalDateLabel(recordDate)}</Text>
                </View>
                <Text style={styles.medDateTriggerAction}>შეცვლა</Text>
              </TouchableOpacity>

              <Text style={styles.medSectionLabel}>შეხსენება მომავალში</Text>
              <View style={styles.medReminderRow}>
                {REMINDER_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => setReminder(option.id)}
                    style={[styles.medReminderChip, reminder === option.id && styles.medReminderChipActive]}
                    activeOpacity={0.82}
                  >
                    <Text style={[styles.medReminderChipText, reminder === option.id && styles.medReminderChipTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.medSaveBtn, editingMedId && styles.medSaveBtnEdit]}
                onPress={addMedical}
                activeOpacity={0.84}
              >
                <Text style={styles.medSaveBtnLabel}>{editingMedId ? 'შენახვა' : 'ჩანაწერის დამატება'}</Text>
              </TouchableOpacity>

              {editingMedId ? (
                <TouchableOpacity style={styles.medDeleteBtn} onPress={() => deleteMedRecord(editingMedId)} activeOpacity={0.84}>
                  <Text style={styles.medDeleteBtnText}>ჩანაწერის წაშლა</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={isMedDatePickerVisible} transparent animationType="fade">
        <View style={styles.medWheelOverlay}>
          <View style={styles.medWheelModal}>
            <View style={styles.medWheelHeader}>
              <Text style={styles.medWheelModalTitle}>თარიღის არჩევა</Text>
              <View style={styles.medWheelHeaderActions}>
                <TouchableOpacity style={styles.medWheelTodayBtn} onPress={jumpMedDatePickerToToday} activeOpacity={0.84}>
                  <Text style={styles.medWheelTodayBtnText}>დღეს</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={cancelMedDatePicker} activeOpacity={0.84}>
                  <Text style={styles.medWheelHeaderAction}>გაუქმება</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.medWheelSelectedDate}>{formatMedicalDateLabel(formatMedicalDateValue(pickerYear, pickerMonthIndex, pickerDay))}</Text>

            <View style={styles.medWheelRow}>
              <MedicalWheelColumn
                title="თვე"
                items={wheelMonthItems}
                selectedValue={pickerMonthIndex}
                onSelect={setPickerMonthIndex}
                scrollRef={monthWheelRef}
              />
              <MedicalWheelColumn
                title="დღე"
                items={wheelDayItems}
                selectedValue={pickerDay}
                onSelect={setPickerDay}
                scrollRef={dayWheelRef}
              />
              <MedicalWheelColumn
                title="წელი"
                items={wheelYearItems}
                selectedValue={pickerYear}
                onSelect={setPickerYear}
                scrollRef={yearWheelRef}
              />
            </View>

            <TouchableOpacity style={styles.medWheelConfirmBtn} onPress={confirmMedDatePicker} activeOpacity={0.84}>
              <Text style={styles.medWheelConfirmText}>თარიღის დადასტურება</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==========================================
          პასპორტის სურათის ნახვის (ზუმის) მოდალი 
          ========================================== */}
      <Modal visible={!!viewerImage} transparent={true} animationType="fade">
        <View style={styles.viewerContainer}>
          <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setViewerImage(null)}>
            <Text style={styles.viewerCloseText}>✕</Text>
          </TouchableOpacity>
          <ScrollView 
            contentContainerStyle={styles.viewerScrollContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent={true}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            {viewerImage && (
              <Image 
                source={{ uri: viewerImage }} 
                style={styles.viewerImage} 
              />
            )}
          </ScrollView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

export default function ProfileScreen({
  session: externalSession = null,
  petsRefreshToken = 0,
  primaryPetId = null,
  onPrimaryPetChanged,
  onPetsChanged,
  onProfileChanged,
}) {
  const [session, setSession] = useState(externalSession);

  useEffect(() => {
    if (externalSession) {
      setSession(externalSession);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [externalSession]);

  // თუ სესია არ არის, აქ შეგიძლიათ დაარენდეროთ ცარიელი View ან Loading 
  // რადგან ნავიგაციამ უნდა გადაამისამართოს Auth ეკრანზე
  if (!session) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#2e8b57" /></View>;
  }

  return (
    <Dashboard
      session={session}
      petsRefreshToken={petsRefreshToken}
      primaryPetId={primaryPetId}
      onPrimaryPetChanged={onPrimaryPetChanged}
      onPetsChanged={onPetsChanged}
      onProfileChanged={onProfileChanged}
    />
  );
}

// ==========================================
// სტილები (Modern UI)
// ==========================================
const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Dashboard Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, marginTop: 10 },
  sectionHeader: { fontSize: 30, fontWeight: '800', color: '#1a1a1a' },
  addCircle: { width: 48, height: 48, backgroundColor: '#2e8b57', borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#2e8b57', shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 },
  
  // Pet Card
  petCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  petCardLost: {
    borderWidth: 1,
    borderColor: '#ffd7d7',
    backgroundColor: '#fffafa',
  },
  petTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  petImageWrap: { width: 104, marginRight: 14, position: 'relative' },
  petImg: { width: 104, height: 104, borderRadius: 24, backgroundColor: '#e8edf2' },
  petImgPlaceholder: {
    width: 104,
    height: 104,
    borderRadius: 24,
    backgroundColor: '#eef3f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petImgPlaceholderText: { fontSize: 15, fontWeight: '700', color: '#78909c' },
  petStatusBadge: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  petStatusBadgeSafe: { backgroundColor: '#e8faf0' },
  petStatusBadgeLost: { backgroundColor: '#ffe5e5' },
  petStatusText: { fontSize: 11, fontWeight: '800' },
  petStatusTextSafe: { color: '#1f8b4d' },
  petStatusTextLost: { color: '#d63333' },
  petContent: { flex: 1 },
  petHeaderRow: { flexDirection: 'column', alignItems: 'stretch' },
  petTitleWrap: { flex: 1, paddingRight: 0 },
  petName: { fontSize: 21, fontWeight: '800', color: '#16231d' },
  petBreedText: { fontSize: 13, color: '#5b6b63', marginTop: 4, fontWeight: '700' },
  petActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', marginLeft: 0, marginTop: 10 },
  actionBtn: {
    minWidth: 68,
    backgroundColor: '#eef4ff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 8,
    marginRight: 8,
  },
  actionBtnDanger: { backgroundColor: '#fff1f2' },
  actionBtnText: { fontSize: 11, color: '#3056d3', fontWeight: '800' },
  actionBtnDangerText: { color: '#d63c5c' },
  primaryActionBtn: { minWidth: 78 },
  primaryActionBtnIdle: { backgroundColor: '#eaf8f0' },
  primaryActionBtnActive: { backgroundColor: '#2e8b57' },
  primaryActionBtnTextIdle: { color: '#20724b' },
  primaryActionBtnTextActive: { color: '#fff' },
  petInfoGrid: {
    display: 'none',
  },
  petInfoCard: {
    width: '48.5%',
    backgroundColor: '#f6f9fb',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ebf0f4',
  },
  petInfoCardStrong: {
    width: '100%',
    marginRight: 0,
    backgroundColor: '#16352c',
  },
  petInfoCardWide: {
    width: '100%',
  },
  petSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  petSummaryCard: {
    width: '48.5%',
    backgroundColor: '#f6f9fb',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ebf0f4',
  },
  petSummaryCardStrong: {
    width: '60%',
    backgroundColor: '#16352c',
  },
  petSummaryCardCompact: {
    width: '36%',
  },
  petSummaryCardWide: {
    width: '100%',
  },
  petInfoLabel: {
    fontSize: 11,
    color: '#70817a',
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  petInfoValue: {
    fontSize: 14,
    color: '#1d3129',
    fontWeight: '800',
    lineHeight: 18,
  },
  petInfoLabelStrong: {
    fontSize: 11,
    color: '#9dd5ba',
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  petInfoValueStrong: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  petFactsRow: { display: 'none' },
  petFactChip: {
    backgroundColor: '#eef7f3',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  petFactChipText: { fontSize: 12, color: '#27684a', fontWeight: '700' },
  petFactChipMuted: {
    backgroundColor: '#f4f7fb',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  petFactChipMutedText: { fontSize: 12, color: '#536471', fontWeight: '700' },
  idBadge: { display: 'none' },
  idBadgeLabel: { fontSize: 10, color: '#a5d9bf', fontWeight: '700', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.8 },
  codeText: { fontSize: 15, color: '#ffffff', fontWeight: '900', letterSpacing: 1.2 },

  petBottomRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1.5,
    borderTopColor: '#eef1f4',
  },
  featureBtn: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginRight: 10,
  },
  featureBtnPrimary: { backgroundColor: '#edf6ff' },
  featureBtnWarm: { backgroundColor: '#fff5e8', marginRight: 0 },
  featureBtnMuted: { backgroundColor: '#f5f6f8', marginRight: 0 },
  featureBtnText: { fontSize: 14, color: '#0d5eb5', fontWeight: '800' },
  featureBtnTextWarm: { color: '#b96c00' },
  featureBtnTextMuted: { color: '#7d8792' },
  featureBtnSubtext: { fontSize: 12, color: '#5f7ea1', marginTop: 6, lineHeight: 16 },
  featureBtnSubtextWarm: { color: '#a97b36' },
  featureBtnSubtextMuted: { color: '#8f98a2' },
  lostPanel: {
    marginTop: 12,
    backgroundColor: '#f7f9fc',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lostPanelLabel: { fontSize: 12, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.7 },
  lostPanelValue: { fontSize: 13, fontWeight: '700', marginTop: 4, lineHeight: 17 },
  lostPanelValueSafe: { color: '#246b47' },
  lostPanelValueAlert: { color: '#cc3c3c' },

  // Profile Section
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 22, borderRadius: 20, marginTop: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  profileHeaderText: { fontWeight: '800', fontSize: 17, color: '#333' },
  profileChevronBtn: { backgroundColor: '#f0f0f0', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  
  profileContent: { backgroundColor: '#fff', padding: 24, borderRadius: 28, marginTop: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  saveProfileBtn: { backgroundColor: '#2e8b57', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 15 },
  saveProfileBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  profileQuickActions: { marginTop: 12 },
  profileQuickBtn: {
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  profileQuickBtnDanger: {
    backgroundColor: '#fff5f6',
    borderWidth: 1,
    borderColor: '#ffd9df',
  },
  profileQuickBtnIcon: {
    fontSize: 19,
    marginRight: 14,
  },
  profileQuickBtnTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#22322c',
  },
  profileQuickBtnText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: '#6d7b75',
  },
  profileQuickBtnDangerTitle: {
    color: '#d24361',
  },
  profileQuickBtnDangerText: {
    color: '#9a5b68',
  },
  logoutBtn: { display: 'none' },
  logoutBtnText: { color: '#ff4d4d', fontWeight: '700', fontSize: 15 },
  // სტილების ბოლოში ჩაამატე:
  privacyBtn: {
    display: 'none',
  },
  privacyBtnText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Modals & Forms
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', backgroundColor: '#fff' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  closeIconBtn: { backgroundColor: '#f4f6f9', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 16, color: '#555', fontWeight: 'bold' },
  
  formGroup: { marginTop: 10 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#eef0f2', padding: 16, borderRadius: 16, marginBottom: 20, fontSize: 15, color: '#333' },
  textArea: { height: 110, textAlignVertical: 'top', paddingTop: 16 },
  
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  imageBox: { width: '48%', height: 140, backgroundColor: '#f8f9fa', borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 22, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  fullImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  imgLabel: { fontSize: 14, color: '#888', fontWeight: '600', marginTop: 8 },
  
  submitBtn: { backgroundColor: '#2e8b57', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#2e8b57', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4, marginTop: 10 },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Sex Selector
  sexContainer: { flexDirection: 'row', marginBottom: 20 },
  sexBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#eef0f2', padding: 16, alignItems: 'center', marginHorizontal: 5, borderRadius: 16 },
  sexBtnActive: { backgroundColor: '#eefcf5', borderColor: '#2e8b57' },
  sexBtnText: { fontSize: 15, color: '#666', fontWeight: '700' },
  sexBtnTextActive: { color: '#2e8b57' },

  // Medical Card
  medOverviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 26,
    padding: 20,
    marginBottom: 18,
    shadowColor: '#10231a',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  medOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  medOverviewTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1d2d27',
  },
  medOverviewSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#6b7b74',
  },
  medOverviewBadge: {
    minWidth: 84,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: '#eefaf3',
    alignItems: 'center',
  },
  medOverviewBadgeValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2e8b57',
  },
  medOverviewBadgeLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#62856f',
  },
  medOverviewStats: {
    flexDirection: 'row',
    marginTop: 16,
  },
  medOverviewStat: {
    flex: 1,
    backgroundColor: '#f6f9fb',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginRight: 10,
  },
  medOverviewStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#72838d',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  medOverviewStatValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#25343b',
  },
  medModalScreen: {
    flex: 1,
    backgroundColor: '#f4f8f6',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  medHistoryContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  medLaunchEditorBtn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#16352c',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  medLaunchEditorIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  medLaunchEditorIconText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 22,
  },
  medLaunchEditorTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  medLaunchEditorText: {
    marginTop: 6,
    color: '#d8e7df',
    lineHeight: 19,
    fontSize: 13,
  },
  emptyMedContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingVertical: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  emptyMedIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eefaf3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyMedIcon: {
    fontSize: 30,
  },
  emptyMedTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#24342e',
    textAlign: 'center',
  },
  emptyMedText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: '#6d7b75',
    textAlign: 'center',
  },
  medFilterSection: {
    marginBottom: 16,
  },
  medFilterTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2f29',
    marginBottom: 10,
  },
  medFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  medFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e6ece8',
  },
  medFilterChipActive: {
    borderColor: '#cfded6',
  },
  medFilterChipIcon: {
    marginRight: 6,
    fontSize: 14,
  },
  medFilterChipText: {
    color: '#4f625b',
    fontSize: 13,
    fontWeight: '700',
  },
  medFilterHint: {
    marginTop: 4,
    color: '#73857e',
    fontSize: 12,
    lineHeight: 18,
  },
  medRecordsSection: {
    marginBottom: 12,
  },
  medRecordsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medRecordsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2f29',
  },
  medRecordsCaption: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7a8d85',
  },
  medItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#edf2ef',
    shadowColor: '#10231a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  medItemIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  medItemIcon: {
    fontSize: 24,
  },
  medItemBody: {
    flex: 1,
  },
  medItemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  medItemTitleWrap: {
    flex: 1,
    paddingRight: 10,
  },
  medItemTitle: {
    fontWeight: '800',
    fontSize: 16,
    color: '#22312b',
  },
  medItemSubtitle: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '700',
    color: '#7b8a83',
  },
  medItemHeaderActions: {
    alignItems: 'flex-end',
  },
  medTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  medTypeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  medEditPill: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#f4f7f9',
  },
  medEditPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#61727c',
  },
  medInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  medDateBadge: {
    backgroundColor: '#f4f7f9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    marginRight: 8,
    marginTop: 8,
    minWidth: 122,
  },
  medDateBadgeMuted: {
    backgroundColor: '#fafbfc',
  },
  medDateBadgeSuccess: {
    backgroundColor: '#edf9f1',
  },
  medDateBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8a9892',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  medDateBadgeLabelSuccess: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4f8f67',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  medItemDate: {
    fontSize: 12,
    color: '#47545d',
    fontWeight: '700',
  },
  medItemDateSuccess: {
    color: '#2e8b57',
  },
  medEditorScreen: {
    flex: 1,
    backgroundColor: '#f7faf8',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  medEditorContent: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 120 : 64,
  },
  medEditorHero: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#10231a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  medEditorHeroTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16352c',
  },
  medEditorHeroText: {
    marginTop: 8,
    color: '#6b7b74',
    lineHeight: 20,
    fontSize: 13,
  },
  medForm: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 26 : 20,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: '#eef1f3',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 12,
  },
  medFormHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  medFormTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1f2f29',
  },
  medFormSubtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: '#74837c',
  },
  medHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medHeaderDelete: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff1f2',
    marginRight: 8,
  },
  medHeaderDeleteText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
  },
  medHeaderCancel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f6f8',
  },
  medHeaderCancelText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#65757f',
  },
  medSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5e6d76',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  typeSelector: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 15 },
  typeBtn: { width: '48.5%', paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', backgroundColor: '#f6f9fb', marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: '#e8eef1' },
  typeBtnActive: { backgroundColor: '#2e8b57', borderColor: '#2e8b57' },
  typeBtnText: { fontSize: 13, color: '#56656e', fontWeight: '800' },
  medOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  medOptionCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#edf2ef',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  medOptionIcon: {
    fontSize: 19,
    marginRight: 10,
  },
  medOptionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#53626a',
  },
  medDateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 18,
  },
  medDateField: {
    flex: 1,
    marginRight: 10,
  },
  medDateInput: {
    backgroundColor: '#f6f9fb',
    borderWidth: 1,
    borderColor: '#e8eef1',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#22312b',
  },
  medTodayBtn: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#eefaf3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medTodayBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2e8b57',
  },
  remBtn: { minWidth: '23%', paddingVertical: 11, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f9fb', borderWidth: 1, borderColor: '#e8eef1', marginRight: 8, marginBottom: 8, borderRadius: 999 },
  remBtnActive: { borderColor: '#b9e1c9', backgroundColor: '#eefcf5' },
  remBtnText: { fontSize: 11, color: '#64727b', fontWeight: '800' },
  medReminderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  medReminderChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#f4f7f9',
    marginRight: 8,
    marginBottom: 8,
  },
  medReminderChipActive: {
    backgroundColor: '#eefaf3',
    borderWidth: 1,
    borderColor: '#b9e1c9',
  },
  medReminderChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#66757e',
  },
  medReminderChipTextActive: {
    color: '#2e8b57',
  },
  medInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  medMainInput: {
    backgroundColor: '#f6f9fb',
    borderWidth: 1,
    borderColor: '#e8eef1',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: '#22312b',
    marginBottom: 16,
  },
  medDateTrigger: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8eef1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  medDateTriggerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7b8a84',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  medDateTriggerValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '900',
    color: '#18352c',
  },
  medDateTriggerAction: {
    color: '#2e8b57',
    fontWeight: '800',
    fontSize: 13,
  },
  medSaveBtn: {
    backgroundColor: '#2e8b57',
    minHeight: 56,
    paddingHorizontal: 18,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2e8b57',
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 3,
  },
  medSaveBtnEdit: {
    backgroundColor: '#0f766e',
  },
  medSaveBtnLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  medDeleteBtn: {
    marginTop: 12,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: '#fff1f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medDeleteBtnText: {
    color: '#d63c5c',
    fontWeight: '800',
    fontSize: 14,
  },
  medSaveBtnText: {
    fontSize: 1,
    lineHeight: 1,
    opacity: 0,
  },
  medSaveBtnTextOverlay: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  medWheelOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 20, 0.42)',
    justifyContent: 'flex-end',
  },
  medWheelModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  medWheelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medWheelHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medWheelModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16352c',
  },
  medWheelTodayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#eefaf3',
    marginRight: 10,
  },
  medWheelTodayBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2e8b57',
  },
  medWheelHeaderAction: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6b7b74',
  },
  medWheelSelectedDate: {
    marginTop: 10,
    marginBottom: 18,
    fontSize: 16,
    fontWeight: '800',
    color: '#2e8b57',
    textAlign: 'center',
  },
  medWheelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  medWheelColumn: {
    width: '31.5%',
  },
  medWheelTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#71807a',
    textAlign: 'center',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  medWheelBox: {
    height: 220,
    borderRadius: 22,
    backgroundColor: '#f5f8f6',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e3ece7',
  },
  medWheelFadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 74,
    backgroundColor: 'rgba(245, 248, 246, 0.72)',
    zIndex: 1,
  },
  medWheelFadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 74,
    backgroundColor: 'rgba(245, 248, 246, 0.72)',
    zIndex: 1,
  },
  medWheelSelection: {
    position: 'absolute',
    top: 88,
    left: 8,
    right: 8,
    height: MEDICAL_WHEEL_ITEM_HEIGHT,
    borderRadius: 16,
    backgroundColor: 'rgba(238, 250, 243, 0.45)',
    borderWidth: 1.5,
    borderColor: '#b7d8c2',
    shadowColor: '#2e8b57',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    zIndex: 2,
  },
  medWheelContent: {
    paddingVertical: 88,
  },
  medWheelItem: {
    height: MEDICAL_WHEEL_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  medWheelItemInner: {
    minWidth: '72%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medWheelItemInnerActive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c7dfd1',
  },
  medWheelItemText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#5f6e67',
  },
  medWheelItemTextActive: {
    color: '#0f2f25',
    fontWeight: '900',
    fontSize: 21,
  },
  medWheelConfirmBtn: {
    marginTop: 18,
    backgroundColor: '#16352c',
    borderRadius: 18,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medWheelConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  // Passport Image Viewer
  viewerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  viewerScrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  viewerCloseBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 30, right: 20, zIndex: 10, width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  viewerCloseText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  viewerImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8, resizeMode: 'contain' }
});
