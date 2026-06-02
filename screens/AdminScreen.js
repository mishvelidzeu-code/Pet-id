import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AdminShopManager from '../components/AdminShopManager';
import AdminPushManager from '../components/AdminPushManager';
import { supabase } from '../lib/supabase';
import { isAdminUser } from '../lib/adminConfig';
import { uploadImageAsset } from '../lib/storage';
import {
  buildEventDate,
  fetchAdminAdoptionPosts,
  fetchAdminCharityPosts,
  fetchAdminClinics,
  fetchAdminEvents,
} from '../lib/contentService';
import {
  ensurePetCodeIsUnique,
} from '../lib/petCode';

const tabs = ['dashboard', 'pets', 'adoption', 'clinics', 'events', 'charity', 'shop', 'notifications'];

const tabLabels = {
  dashboard: 'მიმოხილვა',
  pets: 'ცხოველები',
  adoption: 'აყვანა',
  clinics: 'კლინიკები',
  events: 'ივენთები',
  charity: 'დახმარება',
  shop: 'მაღაზია',
  notifications: 'ნოთიფიკაციები',
};

const emptyPet = (ownerId = '') => ({
  owner_id: ownerId,
  name: '',
  breed: '',
  sex: '',
  color: '',
  size: '',
  weight: '',
  location: '',
  description: '',
  birth_date: '',
  microchip_id: '',
  short_code: '',
  photoAsset: null,
  photoUrl: '',
  passportAsset: null,
  passportUrl: '',
  is_lost: false,
});
const emptyClinic = () => ({
  name: '',
  address: '',
  phone: '',
  lat: '',
  lng: '',
  imageAsset: null,
  imageUrl: '',
  is_active: true,
});

const emptyEvent = () => ({
  title: '',
  dateText: new Date().toISOString().slice(0, 10),
  timeText: '12:00',
  location: '',
  description: '',
  imageAsset: null,
  imageUrl: '',
  is_published: true,
});

const emptyCharity = () => ({
  name: '',
  condition: '',
  description: '',
  bank_name: '',
  iban: '',
  receiver: '',
  imageAsset: null,
  imageUrl: '',
  urgent: false,
  status: 'active',
});

const emptyAdoption = () => ({
  name: '',
  breed: '',
  age_label: '',
  sex: '',
  location: '',
  temperament: '',
  description: '',
  contact_name: '',
  contact_phone: '',
  imageAsset: null,
  imageUrl: '',
  is_featured: false,
  is_active: true,
});

function getErrorMessage(error) {
  return error?.message || 'უცნობი შეცდომა მოხდა.';
}

function partsFromDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      dateText: new Date().toISOString().slice(0, 10),
      timeText: '12:00',
    };
  }

  return {
    dateText: date.toISOString().slice(0, 10),
    timeText: date.toISOString().slice(11, 16),
  };
}

async function pickImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new Error('გალერეის წვდომა საჭიროა.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.6,
    base64: true,
  });

  return result.canceled ? null : result.assets[0];
}

function PreviewImage({ uri, label }) {
  if (!uri) {
    return (
      <View style={[styles.thumb, styles.thumbPlaceholder]}>
        <Text style={styles.thumbPlaceholderText}>{label}</Text>
      </View>
    );
  }

  return <Image source={{ uri }} style={styles.thumb} />;
}

export default function AdminScreen({ session, profile, route }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pets, setPets] = useState([]);
  const [adoptionPosts, setAdoptionPosts] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [events, setEvents] = useState([]);
  const [charityPosts, setCharityPosts] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formType, setFormType] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [petForm, setPetForm] = useState(() => emptyPet(session?.user?.id ?? ''));
  const [clinicForm, setClinicForm] = useState(emptyClinic());
  const [eventForm, setEventForm] = useState(emptyEvent());
  const [charityForm, setCharityForm] = useState(emptyCharity());
  const [adoptionForm, setAdoptionForm] = useState(emptyAdoption());

  const canAccess = isAdminUser(session, profile);

  useEffect(() => {
    const requestedTab = route?.params?.adminTab;
    if (requestedTab && tabs.includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [route?.params?.adminTab]);

  const stats = useMemo(
    () => ({
      pets: pets.length,
      lost: pets.filter((item) => item.is_lost).length,
      adoptions: adoptionPosts.filter((item) => item.is_active !== false).length,
      clinics: clinics.length,
      events: events.filter((item) => item.is_published).length,
      charity: charityPosts.filter((item) => item.status !== 'completed').length,
    }),
    [adoptionPosts, charityPosts, clinics, events, pets]
  );

  useEffect(() => {
    if (!session || !canAccess) {
      setLoading(false);
      return;
    }
    loadAll();
  }, [canAccess, session]);

  function closeForm() {
    setFormType(null);
    setEditing(null);
  }

  async function loadAll(withRefresh = false) {
    if (!session?.user?.id) return;

    if (withRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [petsResult, adoptionResult, clinicsResult, eventsResult, charityResult] = await Promise.all([
        supabase
          .from('pets')
          .select('*, profiles(full_name, phone_number)')
          .order('created_at', { ascending: false }),
        fetchAdminAdoptionPosts(),
        fetchAdminClinics(),
        fetchAdminEvents(),
        fetchAdminCharityPosts(),
      ]);
      if (petsResult.error) throw petsResult.error;
      if (adoptionResult.error) throw adoptionResult.error;
      if (clinicsResult.error) throw clinicsResult.error;
      if (eventsResult.error) throw eventsResult.error;
      if (charityResult.error) throw charityResult.error;
      setPets(petsResult.data || []);
      setAdoptionPosts(adoptionResult.data || []);
      setClinics(clinicsResult.data || []);
      setEvents(eventsResult.data || []);
      setCharityPosts(charityResult.data || []);
    } catch (error) {
      Alert.alert('ადმინ პანელი', getErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openCreate(type) {
    setEditing(null);
    setFormType(type);
    setSheetOpen(false);
    if (type === 'pet') setPetForm(emptyPet(session?.user?.id ?? ''));
    if (type === 'adoption') setAdoptionForm(emptyAdoption());
    if (type === 'clinic') setClinicForm(emptyClinic());
    if (type === 'event') setEventForm(emptyEvent());
    if (type === 'charity') setCharityForm(emptyCharity());
  }

  function openEdit(type, item) {
    setEditing({
      type,
      id: item.id,
      ownerId: item.owner_id || '',
      originalShortCode: item.short_code || '',
    });
    setFormType(type);

    if (type === 'pet') {
      setPetForm({
        owner_id: item.owner_id || session?.user?.id || '',
        name: item.name || '',
        breed: item.breed || '',
        sex: item.sex || '',
        color: item.color || '',
        size: item.size || '',
        weight: item.weight || '',
        location: item.location || '',
        description: item.description || '',
        birth_date: item.birth_date || '',
        microchip_id: item.microchip_id || '',
        short_code: item.short_code || '',
        photoAsset: null,
        photoUrl: item.photo_url || '',
        passportAsset: null,
        passportUrl: item.passport_photo_url || '',
        is_lost: Boolean(item.is_lost),
      });
    }

    if (type === 'clinic') {
      setClinicForm({
        name: item.name || '',
        address: item.address || '',
        phone: item.phone || '',
        lat: item.lat ? String(item.lat) : '',
        lng: item.lng ? String(item.lng) : '',
        imageAsset: null,
        imageUrl: item.image_url || '',
        is_active: item.is_active !== false,
      });
    }

    if (type === 'adoption') {
      setAdoptionForm({
        name: item.name || '',
        breed: item.breed || '',
        age_label: item.age_label || '',
        sex: item.sex || '',
        location: item.location || '',
        temperament: item.temperament || '',
        description: item.description || '',
        contact_name: item.contact_name || '',
        contact_phone: item.contact_phone || '',
        imageAsset: null,
        imageUrl: item.image_url || '',
        is_featured: Boolean(item.is_featured),
        is_active: item.is_active !== false,
      });
    }

    if (type === 'event') {
      const parts = partsFromDate(item.event_date);

      setEventForm({
        title: item.title || '',
        dateText: parts.dateText,
        timeText: parts.timeText,
        location: item.location || '',
        description: item.description || '',
        imageAsset: null,
        imageUrl: item.image_url || '',
        is_published: item.is_published !== false,
      });
    }

    if (type === 'charity') {
      setCharityForm({
        name: item.name || '',
        condition: item.condition || '',
        description: item.description || '',
        bank_name: item.bank_name || '',
        iban: item.iban || '',
        receiver: item.receiver || '',
        imageAsset: null,
        imageUrl: item.image_url || '',
        urgent: Boolean(item.urgent),
        status: item.status === 'completed' ? 'completed' : 'active',
      });
    }
  }

  async function attachImage(type) {
    try {
      const asset = await pickImage();
      if (!asset) return;
      if (type === 'pet-photo') setPetForm((current) => ({ ...current, photoAsset: asset }));
      if (type === 'pet-passport') setPetForm((current) => ({ ...current, passportAsset: asset }));
      if (type === 'adoption') setAdoptionForm((current) => ({ ...current, imageAsset: asset }));
      if (type === 'clinic') setClinicForm((current) => ({ ...current, imageAsset: asset }));
      if (type === 'event') setEventForm((current) => ({ ...current, imageAsset: asset }));
      if (type === 'charity') setCharityForm((current) => ({ ...current, imageAsset: asset }));
    } catch (error) {
      Alert.alert('სურათი', getErrorMessage(error));
    }
  }

  async function savePet() {
    if (!petForm.name.trim()) return Alert.alert('ცხოველი', 'სახელი სავალდებულოა.');
    setSaving(true);

    try {
      const ownerId = petForm.owner_id || editing?.ownerId || session?.user?.id;

      if (!ownerId) throw new Error('ადმინის სესია ვერ მოიძებნა.');

      const shortCode = await ensurePetCodeIsUnique(
        petForm.short_code,
        editing?.type === 'pet' ? editing.id : null
      );

      const photoUrl = petForm.photoAsset ? await uploadImageAsset(petForm.photoAsset, { folder: 'pets/dogs', prefix: 'admin_pet' }) : petForm.photoUrl || null;
      const passportUrl = petForm.passportAsset ? await uploadImageAsset(petForm.passportAsset, { folder: 'pets/passports', prefix: 'admin_passport' }) : petForm.passportUrl || null;

      const payload = {
        owner_id: ownerId,
        name: petForm.name.trim(),
        breed: petForm.breed.trim(),
        birth_date: petForm.birth_date.trim() || null,
        microchip_id: petForm.microchip_id.trim(),
        photo_url: photoUrl,
        passport_photo_url: passportUrl,
        is_lost: petForm.is_lost,
        short_code: shortCode,
        color: petForm.color.trim(),
        size: petForm.size.trim(),
        weight: petForm.weight.trim(),
        description: petForm.description.trim(),
        location: petForm.location.trim(),
        sex: petForm.sex.trim(),
      };

      const result = editing?.type === 'pet' ? await supabase.from('pets').update(payload).eq('id', editing.id) : await supabase.from('pets').insert([payload]);
      if (result.error) throw result.error;

      await loadAll(true);
      setActiveTab('pets');
      setPetForm(emptyPet(session?.user?.id ?? ''));
      closeForm();
      Alert.alert(
        'ცხოველი',
        editing?.type === 'pet'
          ? 'ცხოველი წარმატებით განახლდა.'
          : `ცხოველი დაემატა. Pet ID: ${shortCode}`
      );
    } catch (error) {
      Alert.alert('ცხოველის შენახვა ვერ მოხერხდა', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function saveAdoption() {
    if (!adoptionForm.name.trim() || !adoptionForm.contact_phone.trim() || !adoptionForm.location.trim()) {
      return Alert.alert('აყვანის ბარათი', 'სახელი, მდებარეობა და საკონტაქტო ნომერი სავალდებულოა.');
    }

    setSaving(true);

    try {
      const imageUrl = adoptionForm.imageAsset
        ? await uploadImageAsset(adoptionForm.imageAsset, { folder: 'admin/adoption', prefix: 'adoption' })
        : adoptionForm.imageUrl || null;

      const payload = {
        name: adoptionForm.name.trim(),
        breed: adoptionForm.breed.trim(),
        age_label: adoptionForm.age_label.trim(),
        sex: adoptionForm.sex.trim(),
        location: adoptionForm.location.trim(),
        temperament: adoptionForm.temperament.trim(),
        description: adoptionForm.description.trim(),
        contact_name: adoptionForm.contact_name.trim(),
        contact_phone: adoptionForm.contact_phone.trim(),
        image_url: imageUrl,
        is_featured: adoptionForm.is_featured,
        is_active: adoptionForm.is_active,
      };

      const result = editing?.type === 'adoption'
        ? await supabase.from('adoption_posts').update(payload).eq('id', editing.id)
        : await supabase.from('adoption_posts').insert([payload]);

      if (result.error) throw result.error;

      await loadAll(true);
      setActiveTab('adoption');
      setAdoptionForm(emptyAdoption());
      closeForm();
    } catch (error) {
      Alert.alert('აყვანის ბარათის შენახვა ვერ მოხერხდა', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function saveClinic() {
    if (!clinicForm.name.trim() || !clinicForm.address.trim()) {
      return Alert.alert('კლინიკა', 'სახელი და მისამართი სავალდებულოა.');
    }

    setSaving(true);

    try {
      const imageUrl = clinicForm.imageAsset ? await uploadImageAsset(clinicForm.imageAsset, { folder: 'admin/clinics', prefix: 'clinic' }) : clinicForm.imageUrl || null;
      const payload = { name: clinicForm.name.trim(), address: clinicForm.address.trim(), phone: clinicForm.phone.trim(), lat: clinicForm.lat.trim() ? Number(clinicForm.lat) : null, lng: clinicForm.lng.trim() ? Number(clinicForm.lng) : null, image_url: imageUrl, is_active: clinicForm.is_active };
      const result = editing?.type === 'clinic' ? await supabase.from('clinics').update(payload).eq('id', editing.id) : await supabase.from('clinics').insert([payload]);
      if (result.error) throw result.error;
      await loadAll(true);
      setActiveTab('clinics');
      setClinicForm(emptyClinic());
      closeForm();
    } catch (error) {
      Alert.alert('კლინიკის შენახვა ვერ მოხერხდა', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function saveEvent() {
    if (!eventForm.title.trim() || !eventForm.location.trim()) {
      return Alert.alert('ივენთი', 'სათაური და ლოკაცია სავალდებულოა.');
    }

    setSaving(true);

    try {
      const imageUrl = eventForm.imageAsset ? await uploadImageAsset(eventForm.imageAsset, { folder: 'admin/events', prefix: 'event' }) : eventForm.imageUrl || null;
      const payload = { title: eventForm.title.trim(), event_date: buildEventDate(eventForm.dateText, eventForm.timeText), location: eventForm.location.trim(), description: eventForm.description.trim(), image_url: imageUrl, is_published: eventForm.is_published };
      const result = editing?.type === 'event' ? await supabase.from('events').update(payload).eq('id', editing.id) : await supabase.from('events').insert([payload]);
      if (result.error) throw result.error;
      await loadAll(true);
      setActiveTab('events');
      setEventForm(emptyEvent());
      closeForm();
    } catch (error) {
      Alert.alert('ივენთის შენახვა ვერ მოხერხდა', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function saveCharity() {
    if (!charityForm.name.trim() || !charityForm.condition.trim()) {
      return Alert.alert('დახმარების პოსტი', 'სახელი და მდგომარეობა სავალდებულოა.');
    }

    setSaving(true);

    try {
      const imageUrl = charityForm.imageAsset ? await uploadImageAsset(charityForm.imageAsset, { folder: 'admin/charity', prefix: 'charity' }) : charityForm.imageUrl || null;
      const payload = { name: charityForm.name.trim(), condition: charityForm.condition.trim(), description: charityForm.description.trim(), bank_name: charityForm.bank_name.trim(), iban: charityForm.iban.trim(), receiver: charityForm.receiver.trim(), image_url: imageUrl, urgent: charityForm.urgent, status: charityForm.status };
      const result = editing?.type === 'charity' ? await supabase.from('charity_posts').update(payload).eq('id', editing.id) : await supabase.from('charity_posts').insert([payload]);
      if (result.error) throw result.error;
      await loadAll(true);
      setActiveTab('charity');
      setCharityForm(emptyCharity());
      closeForm();
    } catch (error) {
      Alert.alert('პოსტის შენახვა ვერ მოხერხდა', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function toggleCharityStatus(item) {
    const nextStatus = item.status === 'completed' ? 'active' : 'completed';
    const destinationLabel =
      nextStatus === 'completed' ? 'უკვე დავეხმარეთ' : 'მათ შენი დახმარება სჭირდებათ';

    Alert.alert('დახმარების პოსტი', `გადავიტანოთ "${item.name}" სექციაში: ${destinationLabel}?`, [
      { text: 'არა', style: 'cancel' },
      {
        text: 'დიახ',
        onPress: async () => {
          const result = await supabase
            .from('charity_posts')
            .update({ status: nextStatus })
            .eq('id', item.id);

          if (result.error) {
            return Alert.alert('სტატუსი', getErrorMessage(result.error));
          }

          await loadAll(true);
        },
      },
    ]);
  }

  function confirmDelete(table, id, message) {
    Alert.alert('წაშლა', message, [
      { text: 'არა', style: 'cancel' },
      { text: 'დიახ', style: 'destructive', onPress: async () => {
        const result = await supabase.from(table).delete().eq('id', id);
        if (result.error) return Alert.alert('წაშლა', getErrorMessage(result.error));
        await loadAll(true);
      } },
    ]);
  }

  function toggleLost(item) {
    Alert.alert('სტატუსი', item.is_lost ? 'მოინიშნოს ნაპოვნად?' : 'მოინიშნოს დაკარგულად?', [
      { text: 'არა', style: 'cancel' },
      { text: 'დიახ', onPress: async () => {
        const result = await supabase.from('pets').update({ is_lost: !item.is_lost }).eq('id', item.id);
        if (result.error) return Alert.alert('სტატუსი', getErrorMessage(result.error));
        await loadAll(true);
      } },
    ]);
  }

  function renderDashboard() {
    return (
      <View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>სწრაფი სტატისტიკა</Text>
          <Text style={styles.stat}>ცხოველები: {stats.pets}</Text>
          <Text style={styles.stat}>დაკარგული: {stats.lost}</Text>
          <Text style={styles.stat}>აყვანის ბარათები: {stats.adoptions}</Text>
          <Text style={styles.stat}>კლინიკები: {stats.clinics}</Text>
          <Text style={styles.stat}>ივენთები: {stats.events}</Text>
          <Text style={styles.stat}>აქტიური დახმარება: {stats.charity}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>სწრაფი დამატება</Text>
          <TouchableOpacity style={styles.action} onPress={() => openCreate('pet')}>
            <Text style={styles.actionText}>ცხოველის დამატება</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => openCreate('adoption')}>
            <Text style={styles.actionText}>აყვანის ბარათის დამატება</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => openCreate('clinic')}>
            <Text style={styles.actionText}>კლინიკის დამატება</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => openCreate('event')}>
            <Text style={styles.actionText}>ივენთის დამატება</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => openCreate('charity')}>
            <Text style={styles.actionText}>დახმარების პოსტის დამატება</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => setActiveTab('shop')}>
            <Text style={styles.actionText}>მაღაზიის მართვა</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => setActiveTab('notifications')}>
            <Text style={styles.actionText}>ნოტიფიკაციების გაგზავნა</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderList(items, renderer, emptyTitle) {
    if (!items.length) {
      return <View style={styles.card}><Text style={styles.empty}>{emptyTitle}</Text></View>;
    }

    return <View style={styles.card}>{items.map(renderer)}</View>;
  }

  function renderTabContent() {
    if (activeTab === 'dashboard') return renderDashboard();

    if (activeTab === 'pets') {
      return renderList(pets, (item) => (
        <View key={item.id} style={styles.item}>
          <PreviewImage uri={item.photo_url} label="ფოტო" />
          <View style={styles.itemContent}>
            <Text style={styles.itemTitle}>{item.name}</Text>
            <Text style={styles.itemSubtitle}>{item.profiles?.full_name || 'უცნობი პატრონი'}</Text>
            <Text style={styles.itemMeta}>{item.short_code || '---'}</Text>
          </View>
          <View style={styles.itemActions}>
            <TouchableOpacity style={styles.smallButton} onPress={() => openEdit('pet', item)}>
              <Text style={styles.smallButtonText}>რედაქტირება</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallButton, item.is_lost && styles.warningButton]}
              onPress={() => toggleLost(item)}
            >
              <Text style={[styles.smallButtonText, item.is_lost && styles.warningButtonText]}>
                {item.is_lost ? 'ნაპოვნია' : 'დაკარგული'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={() => confirmDelete('pets', item.id, 'ცხოველი წაიშალოს?')}
            >
              <Text style={styles.dangerButtonText}>წაშლა</Text>
            </TouchableOpacity>
          </View>
        </View>
      ), 'ცხოველები ჯერ არ არის.');
    }

    if (activeTab === 'adoption') {
      return renderList(adoptionPosts, (item) => (
        <View key={item.id} style={styles.item}>
          <PreviewImage uri={item.image_url} label="ფოტო" />
          <View style={styles.itemContent}>
            <Text style={styles.itemTitle}>{item.name}</Text>
            <Text style={styles.itemSubtitle}>
              {[item.breed, item.location].filter(Boolean).join(' • ') || 'აღწერა დასამატებელია'}
            </Text>
            <Text style={styles.itemMeta}>
              {[item.contact_name, item.contact_phone].filter(Boolean).join(' • ')}
            </Text>
            <Text style={styles.itemMeta}>
              {item.is_active === false ? 'გამორთულია' : item.is_featured ? 'გამორჩეული' : 'აქტიური'}
            </Text>
          </View>
          <View style={styles.itemActions}>
            <TouchableOpacity style={styles.smallButton} onPress={() => openEdit('adoption', item)}>
              <Text style={styles.smallButtonText}>რედაქტირება</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={() => confirmDelete('adoption_posts', item.id, 'აყვანის ბარათი წაიშალოს?')}
            >
              <Text style={styles.dangerButtonText}>წაშლა</Text>
            </TouchableOpacity>
          </View>
        </View>
      ), 'აყვანის ბარათები ჯერ არ არის.');
    }

    if (activeTab === 'clinics') {
      return renderList(clinics, (item) => (
        <View key={item.id} style={styles.item}>
          <PreviewImage uri={item.image_url} label="ფოტო" />
          <View style={styles.itemContent}>
            <Text style={styles.itemTitle}>{item.name}</Text>
            <Text style={styles.itemSubtitle}>{item.address}</Text>
            <Text style={styles.itemMeta}>{item.phone || 'ნომერი არაა'}</Text>
          </View>
          <View style={styles.itemActions}>
            <TouchableOpacity style={styles.smallButton} onPress={() => openEdit('clinic', item)}>
              <Text style={styles.smallButtonText}>რედაქტირება</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={() => confirmDelete('clinics', item.id, 'კლინიკა წაიშალოს?')}
            >
              <Text style={styles.dangerButtonText}>წაშლა</Text>
            </TouchableOpacity>
          </View>
        </View>
      ), 'კლინიკები ჯერ არ არის.');
    }

    if (activeTab === 'events') {
      return renderList(events, (item) => (
        <View key={item.id} style={styles.item}>
          <PreviewImage uri={item.image_url} label="ფოტო" />
          <View style={styles.itemContent}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemSubtitle}>{item.location}</Text>
            <Text style={styles.itemMeta}>{item.date || 'თარიღი უცნობია'}</Text>
          </View>
          <View style={styles.itemActions}>
            <TouchableOpacity style={styles.smallButton} onPress={() => openEdit('event', item)}>
              <Text style={styles.smallButtonText}>რედაქტირება</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={() => confirmDelete('events', item.id, 'ივენთი წაიშალოს?')}
            >
              <Text style={styles.dangerButtonText}>წაშლა</Text>
            </TouchableOpacity>
          </View>
        </View>
      ), 'ივენთები ჯერ არ არის.');
    }

    if (activeTab === 'shop') {
      return <AdminShopManager visible={activeTab === 'shop'} />;
    }

    if (activeTab === 'notifications') {
      return <AdminPushManager visible={activeTab === 'notifications'} />;
    }

    return renderList(charityPosts, (item) => (
      <View key={item.id} style={styles.item}>
        <PreviewImage uri={item.image_url} label="ფოტო" />
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <Text style={styles.itemSubtitle}>{item.condition}</Text>
          <Text style={styles.itemMeta}>{item.status === 'completed' ? 'დასრულებული' : 'აქტიური'}</Text>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity style={styles.smallButton} onPress={() => openEdit('charity', item)}>
            <Text style={styles.smallButtonText}>რედაქტირება</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statusButton} onPress={() => toggleCharityStatus(item)}>
            <Text style={styles.statusButtonText}>
              {item.status === 'completed' ? 'აქტიურში დაბრუნება' : 'უკვე დავეხმარეთ'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => confirmDelete('charity_posts', item.id, 'პოსტი წაიშალოს?')}
          >
            <Text style={styles.dangerButtonText}>წაშლა</Text>
          </TouchableOpacity>
        </View>
      </View>
    ), 'პოსტები ჯერ არ არის.');
  }

  function renderImagePicker(previewUri, onPress) {
    return <TouchableOpacity style={styles.imageBox} onPress={onPress}>{previewUri ? <Image source={{ uri: previewUri }} style={styles.imageBoxImg} /> : <Text style={styles.imageBoxText}>ფოტოს ატვირთვა</Text>}</TouchableOpacity>;
  }

  function renderPetForm() {
    return <ScrollView contentContainerStyle={styles.formContent}>
      <Text style={styles.formTitle}>{editing?.type === 'pet' ? 'ცხოველის რედაქტირება' : 'ცხოველის დამატება'}</Text>
      <Text style={styles.helperText}>ახალი ცხოველი მიმდინარე ადმინის ანგარიშზე შეინახება.</Text>
      <Text style={styles.inputLabel}>მთავარი ფოტო</Text>
      {renderImagePicker(petForm.photoAsset?.uri || petForm.photoUrl, () => attachImage('pet-photo'))}
      <Text style={styles.inputLabel}>პასპორტის ფოტო</Text>
      {renderImagePicker(petForm.passportAsset?.uri || petForm.passportUrl, () => attachImage('pet-passport'))}
      <TextInput style={styles.input} placeholder="სახელი" value={petForm.name} onChangeText={(value) => setPetForm((current) => ({ ...current, name: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="ჯიში" value={petForm.breed} onChangeText={(value) => setPetForm((current) => ({ ...current, breed: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="სქესი" value={petForm.sex} onChangeText={(value) => setPetForm((current) => ({ ...current, sex: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="ფერი" value={petForm.color} onChangeText={(value) => setPetForm((current) => ({ ...current, color: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="ზომა: პატარა, საშუალო ან დიდი" value={petForm.size} onChangeText={(value) => setPetForm((current) => ({ ...current, size: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="წონა" value={petForm.weight} onChangeText={(value) => setPetForm((current) => ({ ...current, weight: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="მდებარეობა" value={petForm.location} onChangeText={(value) => setPetForm((current) => ({ ...current, location: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="დაბადების თარიღი (YYYY-MM-DD)" value={petForm.birth_date} onChangeText={(value) => setPetForm((current) => ({ ...current, birth_date: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="მიკროჩიპის ნომერი" value={petForm.microchip_id} onChangeText={(value) => setPetForm((current) => ({ ...current, microchip_id: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="Pet ID (მინიმუმ 3 სიმბოლო)" value={petForm.short_code} onChangeText={(value) => setPetForm((current) => ({ ...current, short_code: value }))} placeholderTextColor="#98a3a0" />
      <Text style={styles.helperText}>Pet ID სავალდებულოა და უნდა შეიცავდეს მინიმუმ 3 სიმბოლოს.</Text>
      <TextInput style={[styles.input, styles.textArea]} placeholder="აღწერა" value={petForm.description} onChangeText={(value) => setPetForm((current) => ({ ...current, description: value }))} multiline placeholderTextColor="#98a3a0" />
      <View style={styles.switchRow}><Text style={styles.switchText}>დაკარგულად მონიშვნა</Text><Switch value={petForm.is_lost} onValueChange={(value) => setPetForm((current) => ({ ...current, is_lost: value }))} /></View>
      <TouchableOpacity style={styles.saveButton} onPress={savePet} disabled={saving}><Text style={styles.saveButtonText}>{saving ? 'ინახება...' : 'შენახვა'}</Text></TouchableOpacity>
    </ScrollView>;
  }

  function renderAdoptionForm() {
    return <ScrollView contentContainerStyle={styles.formContent}>
      <Text style={styles.formTitle}>{editing?.type === 'adoption' ? 'აყვანის ბარათის რედაქტირება' : 'აყვანის ბარათის დამატება'}</Text>
      <Text style={styles.helperText}>ეს ბარათი გამოჩნდება ძებნის გვერდის adoption სექციაში.</Text>
      <Text style={styles.inputLabel}>ფოტო</Text>
      {renderImagePicker(adoptionForm.imageAsset?.uri || adoptionForm.imageUrl, () => attachImage('adoption'))}
      <TextInput style={styles.input} placeholder="სახელი" value={adoptionForm.name} onChangeText={(value) => setAdoptionForm((current) => ({ ...current, name: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="ჯიში" value={adoptionForm.breed} onChangeText={(value) => setAdoptionForm((current) => ({ ...current, breed: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="ასაკი (მაგ: 8 თვე)" value={adoptionForm.age_label} onChangeText={(value) => setAdoptionForm((current) => ({ ...current, age_label: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="სქესი" value={adoptionForm.sex} onChangeText={(value) => setAdoptionForm((current) => ({ ...current, sex: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="მდებარეობა" value={adoptionForm.location} onChangeText={(value) => setAdoptionForm((current) => ({ ...current, location: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="ხასიათი / ტემპერამენტი" value={adoptionForm.temperament} onChangeText={(value) => setAdoptionForm((current) => ({ ...current, temperament: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="საკონტაქტო პირი" value={adoptionForm.contact_name} onChangeText={(value) => setAdoptionForm((current) => ({ ...current, contact_name: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="ტელეფონი" value={adoptionForm.contact_phone} onChangeText={(value) => setAdoptionForm((current) => ({ ...current, contact_phone: value }))} placeholderTextColor="#98a3a0" keyboardType="phone-pad" />
      <TextInput style={[styles.input, styles.textArea]} placeholder="აღწერა" value={adoptionForm.description} onChangeText={(value) => setAdoptionForm((current) => ({ ...current, description: value }))} multiline placeholderTextColor="#98a3a0" />
      <View style={styles.switchRow}><Text style={styles.switchText}>გამორჩეულად გამოჩნდეს</Text><Switch value={adoptionForm.is_featured} onValueChange={(value) => setAdoptionForm((current) => ({ ...current, is_featured: value }))} /></View>
      <View style={styles.switchRow}><Text style={styles.switchText}>აქტიური ბარათი</Text><Switch value={adoptionForm.is_active} onValueChange={(value) => setAdoptionForm((current) => ({ ...current, is_active: value }))} /></View>
      <TouchableOpacity style={styles.saveButton} onPress={saveAdoption} disabled={saving}><Text style={styles.saveButtonText}>{saving ? 'ინახება...' : 'შენახვა'}</Text></TouchableOpacity>
    </ScrollView>;
  }

  function renderClinicForm() {
    return <ScrollView contentContainerStyle={styles.formContent}>
      <Text style={styles.formTitle}>{editing?.type === 'clinic' ? 'კლინიკის რედაქტირება' : 'კლინიკის დამატება'}</Text>
      {renderImagePicker(clinicForm.imageAsset?.uri || clinicForm.imageUrl, () => attachImage('clinic'))}
      <TextInput style={styles.input} placeholder="სახელი" value={clinicForm.name} onChangeText={(value) => setClinicForm((current) => ({ ...current, name: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="მისამართი" value={clinicForm.address} onChangeText={(value) => setClinicForm((current) => ({ ...current, address: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="ტელეფონი" value={clinicForm.phone} onChangeText={(value) => setClinicForm((current) => ({ ...current, phone: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="Latitude" value={clinicForm.lat} onChangeText={(value) => setClinicForm((current) => ({ ...current, lat: value }))} keyboardType="numbers-and-punctuation" placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="Longitude" value={clinicForm.lng} onChangeText={(value) => setClinicForm((current) => ({ ...current, lng: value }))} keyboardType="numbers-and-punctuation" placeholderTextColor="#98a3a0" />
      <View style={styles.switchRow}><Text style={styles.switchText}>აქტიური კლინიკა</Text><Switch value={clinicForm.is_active} onValueChange={(value) => setClinicForm((current) => ({ ...current, is_active: value }))} /></View>
      <TouchableOpacity style={styles.saveButton} onPress={saveClinic} disabled={saving}><Text style={styles.saveButtonText}>{saving ? 'ინახება...' : 'შენახვა'}</Text></TouchableOpacity>
    </ScrollView>;
  }

  function renderEventForm() {
    return <ScrollView contentContainerStyle={styles.formContent}>
      <Text style={styles.formTitle}>{editing?.type === 'event' ? 'ივენთის რედაქტირება' : 'ივენთის დამატება'}</Text>
      {renderImagePicker(eventForm.imageAsset?.uri || eventForm.imageUrl, () => attachImage('event'))}
      <TextInput style={styles.input} placeholder="სათაური" value={eventForm.title} onChangeText={(value) => setEventForm((current) => ({ ...current, title: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={eventForm.dateText} onChangeText={(value) => setEventForm((current) => ({ ...current, dateText: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="14:00" value={eventForm.timeText} onChangeText={(value) => setEventForm((current) => ({ ...current, timeText: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="ლოკაცია" value={eventForm.location} onChangeText={(value) => setEventForm((current) => ({ ...current, location: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={[styles.input, styles.textArea]} placeholder="აღწერა" value={eventForm.description} onChangeText={(value) => setEventForm((current) => ({ ...current, description: value }))} multiline placeholderTextColor="#98a3a0" />
      <View style={styles.switchRow}><Text style={styles.switchText}>გამოქვეყნებული</Text><Switch value={eventForm.is_published} onValueChange={(value) => setEventForm((current) => ({ ...current, is_published: value }))} /></View>
      <TouchableOpacity style={styles.saveButton} onPress={saveEvent} disabled={saving}><Text style={styles.saveButtonText}>{saving ? 'ინახება...' : 'შენახვა'}</Text></TouchableOpacity>
    </ScrollView>;
  }

  function renderCharityForm() {
    return <ScrollView contentContainerStyle={styles.formContent}>
      <Text style={styles.formTitle}>{editing?.type === 'charity' ? 'დახმარების პოსტის რედაქტირება' : 'დახმარების პოსტის დამატება'}</Text>
      {renderImagePicker(charityForm.imageAsset?.uri || charityForm.imageUrl, () => attachImage('charity'))}
      <TextInput style={styles.input} placeholder="სახელი" value={charityForm.name} onChangeText={(value) => setCharityForm((current) => ({ ...current, name: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="მდგომარეობა" value={charityForm.condition} onChangeText={(value) => setCharityForm((current) => ({ ...current, condition: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={[styles.input, styles.textArea]} placeholder="აღწერა" value={charityForm.description} onChangeText={(value) => setCharityForm((current) => ({ ...current, description: value }))} multiline placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="ბანკი" value={charityForm.bank_name} onChangeText={(value) => setCharityForm((current) => ({ ...current, bank_name: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="IBAN" value={charityForm.iban} onChangeText={(value) => setCharityForm((current) => ({ ...current, iban: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="მიმღები" value={charityForm.receiver} onChangeText={(value) => setCharityForm((current) => ({ ...current, receiver: value }))} placeholderTextColor="#98a3a0" />
      <View style={styles.switchRow}><Text style={styles.switchText}>სასწრაფო</Text><Switch value={charityForm.urgent} onValueChange={(value) => setCharityForm((current) => ({ ...current, urgent: value }))} /></View>
      <View style={styles.segmentButtons}><TouchableOpacity style={[styles.segment, charityForm.status === 'active' && styles.segmentActive]} onPress={() => setCharityForm((current) => ({ ...current, status: 'active' }))}><Text style={[styles.segmentText, charityForm.status === 'active' && styles.segmentTextActive]}>აქტიური</Text></TouchableOpacity><TouchableOpacity style={[styles.segment, charityForm.status === 'completed' && styles.segmentActive]} onPress={() => setCharityForm((current) => ({ ...current, status: 'completed' }))}><Text style={[styles.segmentText, charityForm.status === 'completed' && styles.segmentTextActive]}>დასრულებული</Text></TouchableOpacity></View>
      <TouchableOpacity style={styles.saveButton} onPress={saveCharity} disabled={saving}><Text style={styles.saveButtonText}>{saving ? 'ინახება...' : 'შენახვა'}</Text></TouchableOpacity>
    </ScrollView>;
  }

  if (!canAccess) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.title}>ადმინის წვდომა არ გაქვს</Text>
          <Text style={styles.subtitle}>ეს გვერდი მხოლოდ ადმინისტრატორისთვისაა.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2e8b57" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>ადმინ პანელი</Text>
          <Text style={styles.subtitle}>მართე აპი ტელეფონიდან</Text>
        </View>
        <TouchableOpacity style={styles.refresh} onPress={() => loadAll(true)}>
          <Text style={styles.refreshButtonText}>{refreshing ? '...' : 'განახლება'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={styles.tabs}
      >
        {tabs.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.tab, activeTab === item && styles.tabActive]}
            onPress={() => setActiveTab(item)}
          >
            <Text style={[styles.tabText, activeTab === item && styles.tabTextActive]}>
              {tabLabels[item]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {renderTabContent()}
      </ScrollView>

      {!['shop', 'notifications'].includes(activeTab) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => (activeTab === 'pets' ? openCreate('pet') : setSheetOpen(true))}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <Modal visible={sheetOpen} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} onPress={() => setSheetOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.cardTitle}>დამატება</Text>
            <TouchableOpacity style={styles.action} onPress={() => openCreate('pet')}>
              <Text style={styles.actionText}>ცხოველი</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => openCreate('adoption')}>
              <Text style={styles.actionText}>აყვანის ბარათი</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => openCreate('clinic')}>
              <Text style={styles.actionText}>კლინიკა</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => openCreate('event')}>
              <Text style={styles.actionText}>ივენთი</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => openCreate('charity')}>
              <Text style={styles.actionText}>დახმარების პოსტი</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSheetOpen(false)}>
              <Text style={styles.cancel}>გაუქმება</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(formType)} animationType="slide">
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.cardTitle}>შევსება</Text>
            <TouchableOpacity onPress={closeForm}>
              <Text style={styles.linkText}>დახურვა</Text>
            </TouchableOpacity>
          </View>
          {formType === 'pet' && renderPetForm()}
          {formType === 'adoption' && renderAdoptionForm()}
          {formType === 'clinic' && renderClinicForm()}
          {formType === 'event' && renderEventForm()}
          {formType === 'charity' && renderCharityForm()}
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef3f1' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: { padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '900', color: '#16352c' },
  subtitle: { color: '#6a7d76', marginTop: 4, maxWidth: 220 },
  refresh: { backgroundColor: '#16352c', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 },
  refreshButtonText: { color: '#fff', fontWeight: '800' },
  linkText: { color: '#2e8b57', fontWeight: '800' },
  tabs: { paddingHorizontal: 14, paddingBottom: 8 },
  tab: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, marginRight: 8 },
  tabActive: { backgroundColor: '#16352c' },
  tabText: { color: '#4f625c', fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  content: { padding: 16, paddingBottom: 120 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#16352c', marginBottom: 10 },
  stat: { color: '#526560', fontSize: 14, marginBottom: 6, fontWeight: '600' },
  action: { backgroundColor: '#f2f7f5', padding: 14, borderRadius: 16, marginBottom: 10 },
  actionText: { color: '#16352c', fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#edf2ef' },
  thumb: { width: 68, height: 68, borderRadius: 20, backgroundColor: '#d9e3df', marginRight: 12 },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  thumbPlaceholderText: { color: '#6a7d76', fontWeight: '800', fontSize: 10 },
  itemContent: { flex: 1, paddingRight: 12 },
  itemActions: { width: 122 },
  itemTitle: { fontSize: 16, fontWeight: '800', color: '#16352c' },
  itemSubtitle: { color: '#6b7f78', marginTop: 4, fontSize: 12 },
  itemMeta: { color: '#8a9893', marginTop: 4, fontSize: 11 },
  smallButton: { backgroundColor: '#eff5f2', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, marginBottom: 8, alignItems: 'center' },
  smallButtonText: { color: '#16352c', fontWeight: '700', fontSize: 12 },
  warningButton: { backgroundColor: '#fff6e4' },
  warningButtonText: { color: '#a76b00' },
  dangerButton: { backgroundColor: '#fff0f0', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, alignItems: 'center' },
  dangerButtonText: { color: '#cf4a4a', fontWeight: '800', fontSize: 12 },
  statusButton: { backgroundColor: '#eefcf5', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, marginBottom: 8, alignItems: 'center' },
  statusButtonText: { color: '#2e8b57', fontWeight: '800', fontSize: 12, textAlign: 'center' },
  empty: { color: '#6a7d76', textAlign: 'center', paddingVertical: 30, fontWeight: '700' },
  fab: { position: 'absolute', right: 22, bottom: 28, width: 62, height: 62, borderRadius: 31, justifyContent: 'center', alignItems: 'center', backgroundColor: '#16352c' },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.28)' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  cancel: { textAlign: 'center', color: '#6a7d76', fontWeight: '700', marginTop: 6, paddingVertical: 10 },
  modal: { flex: 1, backgroundColor: '#f3f6f5' },
  modalHeader: { backgroundColor: '#fff', paddingHorizontal: 18, paddingTop: Platform.OS === 'ios' ? 58 : 24, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formContent: { padding: 16, paddingBottom: 40 },
  formTitle: { fontSize: 24, fontWeight: '900', color: '#16352c', marginBottom: 14 },
  inputLabel: { color: '#4f625c', fontWeight: '700', marginBottom: 8 },
  helperText: { color: '#6a7d76', marginBottom: 12, lineHeight: 20 },
  imageBox: { height: 180, borderRadius: 22, backgroundColor: '#dfe8e4', marginBottom: 14, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  imageBoxImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageBoxText: { color: '#5b6f68', fontWeight: '700' },
  input: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: '#16352c', marginBottom: 12 },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  switchRow: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchText: { color: '#16352c', fontWeight: '700' },
  segmentButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  segment: { width: '48%', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  segmentActive: { backgroundColor: '#16352c' },
  segmentText: { color: '#50645d', fontWeight: '700' },
  segmentTextActive: { color: '#fff' },
  saveButton: { backgroundColor: '#16352c', paddingVertical: 18, borderRadius: 18, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
