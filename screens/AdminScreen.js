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
import { supabase } from '../lib/supabase';
import { isAdminUser } from '../lib/adminConfig';
import { uploadImageAsset } from '../lib/storage';
import { buildEventDate, fetchAdminCharityPosts, fetchAdminClinics, fetchAdminEvents } from '../lib/contentService';

const tabs = ['dashboard', 'pets', 'clinics', 'events', 'charity'];

const emptyPet = (ownerId = '') => ({
  owner_id: ownerId,
  name: '',
  breed: '',
  sex: '',
  color: '',
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
const emptyClinic = () => ({ name: '', address: '', phone: '', lat: '', lng: '', imageAsset: null, imageUrl: '', is_active: true });
const emptyEvent = () => ({ title: '', dateText: new Date().toISOString().slice(0, 10), timeText: '12:00', location: '', description: '', imageAsset: null, imageUrl: '', is_published: true });
const emptyCharity = () => ({ name: '', condition: '', description: '', bank_name: '', iban: '', receiver: '', imageAsset: null, imageUrl: '', urgent: false, status: 'active' });

function normalizeShortCode(value = '') {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function generateShortCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function partsFromDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { dateText: new Date().toISOString().slice(0, 10), timeText: '12:00' };
  return { dateText: date.toISOString().slice(0, 10), timeText: date.toISOString().slice(11, 16) };
}

async function pickImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('áƒ’áƒáƒšáƒ”áƒ áƒ”áƒ˜áƒ¡ áƒ¬áƒ•áƒ“áƒáƒ›áƒ áƒ¡áƒáƒ­áƒ˜áƒ áƒáƒ.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.6, base64: true });
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

export default function AdminScreen({ session, profile }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pets, setPets] = useState([]);
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

  const canAccess = isAdminUser(session, profile);

  const stats = useMemo(() => ({
    pets: pets.length,
    lost: pets.filter((item) => item.is_lost).length,
    clinics: clinics.length,
    events: events.filter((item) => item.is_published).length,
    charity: charityPosts.filter((item) => item.status !== 'completed').length,
  }), [charityPosts, clinics, events, pets]);

  useEffect(() => {
    if (!session || !canAccess) {
      setLoading(false);
      return;
    }
    loadAll();
  }, [canAccess, session]);

  async function loadAll(withRefresh = false) {
    if (!session?.user?.id) return;
    withRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [petsResult, clinicsResult, eventsResult, charityResult] = await Promise.all([
        supabase.from('pets').select('*, profiles(full_name, phone_number)').order('created_at', { ascending: false }),
        fetchAdminClinics(),
        fetchAdminEvents(),
        fetchAdminCharityPosts(),
      ]);
      if (petsResult.error) throw petsResult.error;
      if (clinicsResult.error) throw clinicsResult.error;
      if (eventsResult.error) throw eventsResult.error;
      if (charityResult.error) throw charityResult.error;
      setPets(petsResult.data || []);
      setClinics(clinicsResult.data || []);
      setEvents(eventsResult.data || []);
      setCharityPosts(charityResult.data || []);
    } catch (error) {
      Alert.alert('áƒáƒ“áƒ›áƒ˜áƒœ áƒžáƒáƒœáƒ”áƒšáƒ˜', error.message);
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
    if (type === 'clinic') setClinicForm(emptyClinic());
    if (type === 'event') setEventForm(emptyEvent());
    if (type === 'charity') setCharityForm(emptyCharity());
  }

  function openEdit(type, item) {
    setEditing({ type, id: item.id, ownerId: item.owner_id || '', originalShortCode: item.short_code || '' });
    setFormType(type);
    if (type === 'pet') setPetForm({ owner_id: item.owner_id || session?.user?.id || '', name: item.name || '', breed: item.breed || '', sex: item.sex || '', color: item.color || '', weight: item.weight || '', location: item.location || '', description: item.description || '', birth_date: item.birth_date || '', microchip_id: item.microchip_id || '', short_code: item.short_code || '', photoAsset: null, photoUrl: item.photo_url || '', passportAsset: null, passportUrl: item.passport_photo_url || '', is_lost: Boolean(item.is_lost) });
    if (type === 'clinic') setClinicForm({ name: item.name || '', address: item.address || '', phone: item.phone || '', lat: item.lat ? String(item.lat) : '', lng: item.lng ? String(item.lng) : '', imageAsset: null, imageUrl: item.image_url || '', is_active: item.is_active !== false });
    if (type === 'event') {
      const parts = partsFromDate(item.event_date);
      setEventForm({ title: item.title || '', dateText: parts.dateText, timeText: parts.timeText, location: item.location || '', description: item.description || '', imageAsset: null, imageUrl: item.image_url || '', is_published: item.is_published !== false });
    }
    if (type === 'charity') setCharityForm({ name: item.name || '', condition: item.condition || '', description: item.description || '', bank_name: item.bank_name || '', iban: item.iban || '', receiver: item.receiver || '', imageAsset: null, imageUrl: item.image_url || '', urgent: Boolean(item.urgent), status: item.status === 'completed' ? 'completed' : 'active' });
  }

  async function attachImage(type) {
    try {
      const asset = await pickImage();
      if (!asset) return;
      if (type === 'pet-photo') setPetForm((current) => ({ ...current, photoAsset: asset }));
      if (type === 'pet-passport') setPetForm((current) => ({ ...current, passportAsset: asset }));
      if (type === 'clinic') setClinicForm((current) => ({ ...current, imageAsset: asset }));
      if (type === 'event') setEventForm((current) => ({ ...current, imageAsset: asset }));
      if (type === 'charity') setCharityForm((current) => ({ ...current, imageAsset: asset }));
    } catch (error) {
      Alert.alert('áƒ¡áƒ£áƒ áƒáƒ—áƒ˜', error.message);
    }
  }

  async function ensurePetCodeIsUnique(shortCode, currentId = null) {
    let query = supabase.from('pets').select('id').eq('short_code', shortCode).limit(1);
    if (currentId) query = query.neq('id', currentId);
    const { data, error } = await query;
    if (error) throw error;
    if (data?.length) throw new Error('This Pet ID is already used by another pet.');
  }

  async function savePet() {
    if (!petForm.name.trim()) return Alert.alert('Pet', 'Name is required.');
    setSaving(true);
    try {
      const ownerId = petForm.owner_id || editing?.ownerId || session?.user?.id;
      if (!ownerId) throw new Error('Admin session was not found.');

      const shortCode = normalizeShortCode(petForm.short_code) || editing?.originalShortCode || generateShortCode();
      if (!/^[A-Z0-9]{6}$/.test(shortCode)) throw new Error('Pet ID must be 6 characters.');
      await ensurePetCodeIsUnique(shortCode, editing?.type === 'pet' ? editing.id : null);

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
      setEditing(null);
      setFormType(null);
      Alert.alert('Pet', editing?.type === 'pet' ? 'Pet updated successfully.' : `Pet ID: ${shortCode}`);
    } catch (error) {
      Alert.alert('Pet save failed', error.message);
    } finally {
      setSaving(false);
    }
  }
  async function saveClinic() {
    if (!clinicForm.name.trim() || !clinicForm.address.trim()) return Alert.alert('áƒ™áƒšáƒ˜áƒœáƒ˜áƒ™áƒ', 'áƒ¡áƒáƒ®áƒ”áƒšáƒ˜ áƒ“áƒ áƒ›áƒ˜áƒ¡áƒáƒ›áƒáƒ áƒ—áƒ˜ áƒ¡áƒáƒ•áƒáƒšáƒ“áƒ”áƒ‘áƒ£áƒšáƒáƒ.');
    setSaving(true);
    try {
      const imageUrl = clinicForm.imageAsset ? await uploadImageAsset(clinicForm.imageAsset, { folder: 'admin/clinics', prefix: 'clinic' }) : clinicForm.imageUrl || null;
      const payload = { name: clinicForm.name.trim(), address: clinicForm.address.trim(), phone: clinicForm.phone.trim(), lat: clinicForm.lat.trim() ? Number(clinicForm.lat) : null, lng: clinicForm.lng.trim() ? Number(clinicForm.lng) : null, image_url: imageUrl, is_active: clinicForm.is_active };
      const result = editing?.type === 'clinic' ? await supabase.from('clinics').update(payload).eq('id', editing.id) : await supabase.from('clinics').insert([payload]);
      if (result.error) throw result.error;
      await loadAll(true);
      setActiveTab('clinics');
      setFormType(null);
    } catch (error) {
      Alert.alert('áƒ™áƒšáƒ˜áƒœáƒ˜áƒ™áƒ áƒ•áƒ”áƒ  áƒ¨áƒ”áƒ˜áƒœáƒáƒ®áƒ', error.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveEvent() {
    if (!eventForm.title.trim() || !eventForm.location.trim()) return Alert.alert('áƒ˜áƒ•áƒ”áƒœáƒ—áƒ˜', 'áƒ¡áƒáƒ—áƒáƒ£áƒ áƒ˜ áƒ“áƒ áƒšáƒáƒ™áƒáƒªáƒ˜áƒ áƒ¡áƒáƒ•áƒáƒšáƒ“áƒ”áƒ‘áƒ£áƒšáƒáƒ.');
    setSaving(true);
    try {
      const imageUrl = eventForm.imageAsset ? await uploadImageAsset(eventForm.imageAsset, { folder: 'admin/events', prefix: 'event' }) : eventForm.imageUrl || null;
      const payload = { title: eventForm.title.trim(), event_date: buildEventDate(eventForm.dateText, eventForm.timeText), location: eventForm.location.trim(), description: eventForm.description.trim(), image_url: imageUrl, is_published: eventForm.is_published };
      const result = editing?.type === 'event' ? await supabase.from('events').update(payload).eq('id', editing.id) : await supabase.from('events').insert([payload]);
      if (result.error) throw result.error;
      await loadAll(true);
      setActiveTab('events');
      setFormType(null);
    } catch (error) {
      Alert.alert('áƒ˜áƒ•áƒ”áƒœáƒ—áƒ˜ áƒ•áƒ”áƒ  áƒ¨áƒ”áƒ˜áƒœáƒáƒ®áƒ', error.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveCharity() {
    if (!charityForm.name.trim() || !charityForm.condition.trim()) return Alert.alert('áƒ“áƒáƒ®áƒ›áƒáƒ áƒ”áƒ‘áƒ˜áƒ¡ áƒžáƒáƒ¡áƒ¢áƒ˜', 'áƒ¡áƒáƒ®áƒ”áƒšáƒ˜ áƒ“áƒ áƒ›áƒ“áƒ’áƒáƒ›áƒáƒ áƒ”áƒáƒ‘áƒ áƒ¡áƒáƒ•áƒáƒšáƒ“áƒ”áƒ‘áƒ£áƒšáƒáƒ.');
    setSaving(true);
    try {
      const imageUrl = charityForm.imageAsset ? await uploadImageAsset(charityForm.imageAsset, { folder: 'admin/charity', prefix: 'charity' }) : charityForm.imageUrl || null;
      const payload = { name: charityForm.name.trim(), condition: charityForm.condition.trim(), description: charityForm.description.trim(), bank_name: charityForm.bank_name.trim(), iban: charityForm.iban.trim(), receiver: charityForm.receiver.trim(), image_url: imageUrl, urgent: charityForm.urgent, status: charityForm.status };
      const result = editing?.type === 'charity' ? await supabase.from('charity_posts').update(payload).eq('id', editing.id) : await supabase.from('charity_posts').insert([payload]);
      if (result.error) throw result.error;
      await loadAll(true);
      setActiveTab('charity');
      setFormType(null);
    } catch (error) {
      Alert.alert('áƒžáƒáƒ¡áƒ¢áƒ˜ áƒ•áƒ”áƒ  áƒ¨áƒ”áƒ˜áƒœáƒáƒ®áƒ', error.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleCharityStatus(item) {
    const nextStatus = item.status === 'completed' ? 'active' : 'completed';
    const destinationLabel =
      nextStatus === 'completed' ? 'áƒ£áƒ™áƒ•áƒ” áƒ“áƒáƒ•áƒ”áƒ®áƒ›áƒáƒ áƒ”áƒ—' : 'áƒ›áƒáƒ— áƒ¨áƒ”áƒœáƒ˜ áƒ“áƒáƒ®áƒ›áƒáƒ áƒ”áƒ‘áƒ áƒ¡áƒ­áƒ˜áƒ áƒ“áƒ”áƒ‘áƒáƒ—';

    Alert.alert('áƒ“áƒáƒ®áƒ›áƒáƒ áƒ”áƒ‘áƒ˜áƒ¡ áƒžáƒáƒ¡áƒ¢áƒ˜', `áƒ’áƒáƒ“áƒáƒ•áƒ˜áƒ¢áƒáƒœáƒáƒ— "${item.name}" áƒ¡áƒ”áƒ¥áƒªáƒ˜áƒáƒ¨áƒ˜: ${destinationLabel}?`, [
      { text: 'áƒáƒ áƒ', style: 'cancel' },
      {
        text: 'áƒ“áƒ˜áƒáƒ®',
        onPress: async () => {
          const result = await supabase
            .from('charity_posts')
            .update({ status: nextStatus })
            .eq('id', item.id);

          if (result.error) {
            return Alert.alert('áƒ¡áƒ¢áƒáƒ¢áƒ£áƒ¡áƒ˜', result.error.message);
          }

          await loadAll(true);
        },
      },
    ]);
  }

  function confirmDelete(table, id, message) {
    Alert.alert('áƒ¬áƒáƒ¨áƒšáƒ', message, [
      { text: 'áƒáƒ áƒ', style: 'cancel' },
      { text: 'áƒ“áƒ˜áƒáƒ®', style: 'destructive', onPress: async () => {
        const result = await supabase.from(table).delete().eq('id', id);
        if (result.error) return Alert.alert('áƒ¬áƒáƒ¨áƒšáƒ', result.error.message);
        await loadAll(true);
      } },
    ]);
  }

  function toggleLost(item) {
    Alert.alert('áƒ¡áƒ¢áƒáƒ¢áƒ£áƒ¡áƒ˜', item.is_lost ? 'áƒ›áƒáƒ˜áƒœáƒ˜áƒ¨áƒœáƒáƒ¡ áƒœáƒáƒžáƒáƒ•áƒœáƒáƒ“?' : 'áƒ›áƒáƒ˜áƒœáƒ˜áƒ¨áƒœáƒáƒ¡ áƒ“áƒáƒ™áƒáƒ áƒ’áƒ£áƒšáƒáƒ“?', [
      { text: 'áƒáƒ áƒ', style: 'cancel' },
      { text: 'áƒ“áƒ˜áƒáƒ®', onPress: async () => {
        const result = await supabase.from('pets').update({ is_lost: !item.is_lost }).eq('id', item.id);
        if (result.error) return Alert.alert('áƒ¡áƒ¢áƒáƒ¢áƒ£áƒ¡áƒ˜', result.error.message);
        await loadAll(true);
      } },
    ]);
  }

  function renderDashboard() {
    return (
      <View>
        <View style={styles.card}><Text style={styles.cardTitle}>áƒ¡áƒ¬áƒ áƒáƒ¤áƒ˜ áƒ¡áƒ¢áƒáƒ¢áƒ˜áƒ¡áƒ¢áƒ˜áƒ™áƒ</Text><Text style={styles.stat}>áƒªáƒ®áƒáƒ•áƒ”áƒšáƒ”áƒ‘áƒ˜: {stats.pets}</Text><Text style={styles.stat}>áƒ“áƒáƒ™áƒáƒ áƒ’áƒ£áƒšáƒ˜: {stats.lost}</Text><Text style={styles.stat}>áƒ™áƒšáƒ˜áƒœáƒ˜áƒ™áƒ”áƒ‘áƒ˜: {stats.clinics}</Text><Text style={styles.stat}>áƒ˜áƒ•áƒ”áƒœáƒ—áƒ”áƒ‘áƒ˜: {stats.events}</Text><Text style={styles.stat}>áƒáƒ¥áƒ¢áƒ˜áƒ£áƒ áƒ˜ áƒ“áƒáƒ®áƒ›áƒáƒ áƒ”áƒ‘áƒ: {stats.charity}</Text></View>
        <View style={styles.card}><Text style={styles.cardTitle}>áƒ¡áƒ¬áƒ áƒáƒ¤áƒ˜ áƒ“áƒáƒ›áƒáƒ¢áƒ”áƒ‘áƒ</Text><TouchableOpacity style={styles.action} onPress={() => openCreate('pet')}><Text style={styles.actionText}>áƒªáƒ®áƒáƒ•áƒ”áƒšáƒ˜</Text></TouchableOpacity><TouchableOpacity style={styles.action} onPress={() => openCreate('clinic')}><Text style={styles.actionText}>áƒ™áƒšáƒ˜áƒœáƒ˜áƒ™áƒ˜áƒ¡ áƒ“áƒáƒ›áƒáƒ¢áƒ”áƒ‘áƒ</Text></TouchableOpacity><TouchableOpacity style={styles.action} onPress={() => openCreate('event')}><Text style={styles.actionText}>áƒ˜áƒ•áƒ”áƒœáƒ—áƒ˜áƒ¡ áƒ“áƒáƒ›áƒáƒ¢áƒ”áƒ‘áƒ</Text></TouchableOpacity><TouchableOpacity style={styles.action} onPress={() => openCreate('charity')}><Text style={styles.actionText}>áƒ“áƒáƒ®áƒ›áƒáƒ áƒ”áƒ‘áƒ˜áƒ¡ áƒžáƒáƒ¡áƒ¢áƒ˜áƒ¡ áƒ“áƒáƒ›áƒáƒ¢áƒ”áƒ‘áƒ</Text></TouchableOpacity></View>
      </View>
    );
  }

  function renderList(items, renderer, emptyTitle) {
    if (!items.length) return <View style={styles.card}><Text style={styles.empty}>{emptyTitle}</Text></View>;
    return <View style={styles.card}>{items.map(renderer)}</View>;
  }

  function renderTabContent() {
    if (activeTab === 'dashboard') return renderDashboard();
    if (activeTab === 'pets') return renderList(pets, (item) => (
      <View key={item.id} style={styles.item}>
        <Image source={{ uri: item.photo_url }} style={styles.thumb} />
        <View style={styles.itemContent}><Text style={styles.itemTitle}>{item.name}</Text><Text style={styles.itemSubtitle}>{item.profiles?.full_name || 'áƒ£áƒªáƒœáƒáƒ‘áƒ˜ áƒžáƒáƒ¢áƒ áƒáƒœáƒ˜'}</Text><Text style={styles.itemMeta}>{item.short_code || '---'}</Text></View>
        <View><TouchableOpacity style={styles.smallButton} onPress={() => toggleLost(item)}><Text style={styles.smallButtonText}>{item.is_lost ? 'áƒœáƒáƒžáƒáƒ•áƒœáƒ˜áƒ' : 'áƒ“áƒáƒ™áƒáƒ áƒ’áƒ£áƒšáƒ˜'}</Text></TouchableOpacity><TouchableOpacity style={styles.dangerButton} onPress={() => confirmDelete('pets', item.id, 'áƒªáƒ®áƒáƒ•áƒ”áƒšáƒ˜ áƒ¬áƒáƒ˜áƒ¨áƒáƒšáƒáƒ¡?')}><Text style={styles.dangerButtonText}>áƒ¬áƒáƒ¨áƒšáƒ</Text></TouchableOpacity></View>
      </View>
    ), 'áƒªáƒ®áƒáƒ•áƒ”áƒšáƒ”áƒ‘áƒ˜ áƒ¯áƒ”áƒ  áƒáƒ  áƒáƒ áƒ˜áƒ¡');
    if (activeTab === 'clinics') return renderList(clinics, (item) => (
      <View key={item.id} style={styles.item}>
        <Image source={{ uri: item.image_url }} style={styles.thumb} />
        <View style={styles.itemContent}><Text style={styles.itemTitle}>{item.name}</Text><Text style={styles.itemSubtitle}>{item.address}</Text><Text style={styles.itemMeta}>{item.phone || 'áƒœáƒáƒ›áƒ”áƒ áƒ˜ áƒáƒ áƒáƒ'}</Text></View>
        <View><TouchableOpacity style={styles.smallButton} onPress={() => openEdit('clinic', item)}><Text style={styles.smallButtonText}>áƒ áƒ”áƒ“áƒáƒ¥áƒ¢áƒ˜áƒ áƒ”áƒ‘áƒ</Text></TouchableOpacity><TouchableOpacity style={styles.dangerButton} onPress={() => confirmDelete('clinics', item.id, 'áƒ™áƒšáƒ˜áƒœáƒ˜áƒ™áƒ áƒ¬áƒáƒ˜áƒ¨áƒáƒšáƒáƒ¡?')}><Text style={styles.dangerButtonText}>áƒ¬áƒáƒ¨áƒšáƒ</Text></TouchableOpacity></View>
      </View>
    ), 'áƒ™áƒšáƒ˜áƒœáƒ˜áƒ™áƒ”áƒ‘áƒ˜ áƒ¯áƒ”áƒ  áƒáƒ  áƒáƒ áƒ˜áƒ¡');
    if (activeTab === 'events') return renderList(events, (item) => (
      <View key={item.id} style={styles.item}>
        <Image source={{ uri: item.image_url }} style={styles.thumb} />
        <View style={styles.itemContent}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemSubtitle}>{item.location}</Text><Text style={styles.itemMeta}>{item.date || 'áƒ—áƒáƒ áƒ˜áƒ¦áƒ˜ áƒáƒ áƒáƒ'}</Text></View>
        <View><TouchableOpacity style={styles.smallButton} onPress={() => openEdit('event', item)}><Text style={styles.smallButtonText}>áƒ áƒ”áƒ“áƒáƒ¥áƒ¢áƒ˜áƒ áƒ”áƒ‘áƒ</Text></TouchableOpacity><TouchableOpacity style={styles.dangerButton} onPress={() => confirmDelete('events', item.id, 'áƒ˜áƒ•áƒ”áƒœáƒ—áƒ˜ áƒ¬áƒáƒ˜áƒ¨áƒáƒšáƒáƒ¡?')}><Text style={styles.dangerButtonText}>áƒ¬áƒáƒ¨áƒšáƒ</Text></TouchableOpacity></View>
      </View>
    ), 'áƒ˜áƒ•áƒ”áƒœáƒ—áƒ”áƒ‘áƒ˜ áƒ¯áƒ”áƒ  áƒáƒ  áƒáƒ áƒ˜áƒ¡');
    return renderList(charityPosts, (item) => (
      <View key={item.id} style={styles.item}>
        <Image source={{ uri: item.image_url }} style={styles.thumb} />
        <View style={styles.itemContent}><Text style={styles.itemTitle}>{item.name}</Text><Text style={styles.itemSubtitle}>{item.condition}</Text><Text style={styles.itemMeta}>{item.status === 'completed' ? 'áƒ“áƒáƒ¡áƒ áƒ£áƒšáƒ”áƒ‘áƒ£áƒšáƒ˜' : 'áƒáƒ¥áƒ¢áƒ˜áƒ£áƒ áƒ˜'}</Text></View>
        <View><TouchableOpacity style={styles.smallButton} onPress={() => openEdit('charity', item)}><Text style={styles.smallButtonText}>რედაქტირება</Text></TouchableOpacity><TouchableOpacity style={styles.statusButton} onPress={() => toggleCharityStatus(item)}><Text style={styles.statusButtonText}>{item.status === 'completed' ? 'აქტიურში დაბრუნება' : 'უკვე დავეხმარეთ'}</Text></TouchableOpacity><TouchableOpacity style={styles.dangerButton} onPress={() => confirmDelete('charity_posts', item.id, 'პოსტი წაიშალოს?')}><Text style={styles.dangerButtonText}>წაშლა</Text></TouchableOpacity></View>
      </View>
    ), 'áƒžáƒáƒ¡áƒ¢áƒ”áƒ‘áƒ˜ áƒ¯áƒ”áƒ  áƒáƒ  áƒáƒ áƒ˜áƒ¡');
  }

  function renderImagePicker(previewUri, onPress) {
    return <TouchableOpacity style={styles.imageBox} onPress={onPress}>{previewUri ? <Image source={{ uri: previewUri }} style={styles.imageBoxImg} /> : <Text style={styles.imageBoxText}>áƒ¤áƒáƒ¢áƒáƒ¡ áƒáƒ¢áƒ•áƒ˜áƒ áƒ—áƒ•áƒ</Text>}</TouchableOpacity>;
  }

  function renderPetForm() {
    return <ScrollView contentContainerStyle={styles.formContent}>
      <Text style={styles.formTitle}>{editing?.type === 'pet' ? 'Edit Pet' : 'Add Pet'}</Text>
      <Text style={styles.helperText}>The new pet will be saved under the current admin account.</Text>
      <Text style={styles.inputLabel}>Main photo</Text>
      {renderImagePicker(petForm.photoAsset?.uri || petForm.photoUrl, () => attachImage('pet-photo'))}
      <Text style={styles.inputLabel}>Passport photo</Text>
      {renderImagePicker(petForm.passportAsset?.uri || petForm.passportUrl, () => attachImage('pet-passport'))}
      <TextInput style={styles.input} placeholder="Name" value={petForm.name} onChangeText={(value) => setPetForm((current) => ({ ...current, name: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="Breed" value={petForm.breed} onChangeText={(value) => setPetForm((current) => ({ ...current, breed: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="Sex" value={petForm.sex} onChangeText={(value) => setPetForm((current) => ({ ...current, sex: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="Color" value={petForm.color} onChangeText={(value) => setPetForm((current) => ({ ...current, color: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="Weight" value={petForm.weight} onChangeText={(value) => setPetForm((current) => ({ ...current, weight: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="Location" value={petForm.location} onChangeText={(value) => setPetForm((current) => ({ ...current, location: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="Birth date (YYYY-MM-DD)" value={petForm.birth_date} onChangeText={(value) => setPetForm((current) => ({ ...current, birth_date: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="Microchip ID" value={petForm.microchip_id} onChangeText={(value) => setPetForm((current) => ({ ...current, microchip_id: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="Pet ID (AB12CD)" maxLength={6} autoCapitalize="characters" value={petForm.short_code} onChangeText={(value) => setPetForm((current) => ({ ...current, short_code: normalizeShortCode(value) }))} placeholderTextColor="#98a3a0" />
      <Text style={styles.helperText}>Leave Pet ID empty if you want it generated automatically.</Text>
      <TextInput style={[styles.input, styles.textArea]} placeholder="Description" value={petForm.description} onChangeText={(value) => setPetForm((current) => ({ ...current, description: value }))} multiline placeholderTextColor="#98a3a0" />
      <View style={styles.switchRow}><Text style={styles.switchText}>Mark as lost</Text><Switch value={petForm.is_lost} onValueChange={(value) => setPetForm((current) => ({ ...current, is_lost: value }))} /></View>
      <TouchableOpacity style={styles.saveButton} onPress={savePet} disabled={saving}><Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text></TouchableOpacity>
    </ScrollView>;
  }
  function renderClinicForm() {
    return <ScrollView contentContainerStyle={styles.formContent}>
      <Text style={styles.formTitle}>{editing ? 'áƒ™áƒšáƒ˜áƒœáƒ˜áƒ™áƒ˜áƒ¡ áƒ áƒ”áƒ“áƒáƒ¥áƒ¢áƒ˜áƒ áƒ”áƒ‘áƒ' : 'áƒ™áƒšáƒ˜áƒœáƒ˜áƒ™áƒ˜áƒ¡ áƒ“áƒáƒ›áƒáƒ¢áƒ”áƒ‘áƒ'}</Text>
      {renderImagePicker(clinicForm.imageAsset?.uri || clinicForm.imageUrl, () => attachImage('clinic'))}
      <TextInput style={styles.input} placeholder="áƒ¡áƒáƒ®áƒ”áƒšáƒ˜" value={clinicForm.name} onChangeText={(value) => setClinicForm((current) => ({ ...current, name: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="áƒ›áƒ˜áƒ¡áƒáƒ›áƒáƒ áƒ—áƒ˜" value={clinicForm.address} onChangeText={(value) => setClinicForm((current) => ({ ...current, address: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="áƒ¢áƒ”áƒšáƒ”áƒ¤áƒáƒœáƒ˜" value={clinicForm.phone} onChangeText={(value) => setClinicForm((current) => ({ ...current, phone: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="Latitude" value={clinicForm.lat} onChangeText={(value) => setClinicForm((current) => ({ ...current, lat: value }))} keyboardType="numbers-and-punctuation" placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="Longitude" value={clinicForm.lng} onChangeText={(value) => setClinicForm((current) => ({ ...current, lng: value }))} keyboardType="numbers-and-punctuation" placeholderTextColor="#98a3a0" />
      <View style={styles.switchRow}><Text style={styles.switchText}>áƒáƒ¥áƒ¢áƒ˜áƒ£áƒ áƒ˜ áƒ™áƒšáƒ˜áƒœáƒ˜áƒ™áƒ</Text><Switch value={clinicForm.is_active} onValueChange={(value) => setClinicForm((current) => ({ ...current, is_active: value }))} /></View>
      <TouchableOpacity style={styles.saveButton} onPress={saveClinic} disabled={saving}><Text style={styles.saveButtonText}>{saving ? 'áƒ˜áƒœáƒáƒ®áƒ”áƒ‘áƒ...' : 'áƒ¨áƒ”áƒœáƒáƒ®áƒ•áƒ'}</Text></TouchableOpacity>
    </ScrollView>;
  }

  function renderEventForm() {
    return <ScrollView contentContainerStyle={styles.formContent}>
      <Text style={styles.formTitle}>{editing ? 'áƒ˜áƒ•áƒ”áƒœáƒ—áƒ˜áƒ¡ áƒ áƒ”áƒ“áƒáƒ¥áƒ¢áƒ˜áƒ áƒ”áƒ‘áƒ' : 'áƒ˜áƒ•áƒ”áƒœáƒ—áƒ˜áƒ¡ áƒ“áƒáƒ›áƒáƒ¢áƒ”áƒ‘áƒ'}</Text>
      {renderImagePicker(eventForm.imageAsset?.uri || eventForm.imageUrl, () => attachImage('event'))}
      <TextInput style={styles.input} placeholder="áƒ¡áƒáƒ—áƒáƒ£áƒ áƒ˜" value={eventForm.title} onChangeText={(value) => setEventForm((current) => ({ ...current, title: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={eventForm.dateText} onChangeText={(value) => setEventForm((current) => ({ ...current, dateText: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="14:00" value={eventForm.timeText} onChangeText={(value) => setEventForm((current) => ({ ...current, timeText: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="áƒšáƒáƒ™áƒáƒªáƒ˜áƒ" value={eventForm.location} onChangeText={(value) => setEventForm((current) => ({ ...current, location: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={[styles.input, styles.textArea]} placeholder="áƒáƒ¦áƒ¬áƒ”áƒ áƒ" value={eventForm.description} onChangeText={(value) => setEventForm((current) => ({ ...current, description: value }))} multiline placeholderTextColor="#98a3a0" />
      <View style={styles.switchRow}><Text style={styles.switchText}>áƒ’áƒáƒ›áƒáƒ¥áƒ•áƒ”áƒ§áƒœáƒ”áƒ‘áƒ£áƒšáƒ˜</Text><Switch value={eventForm.is_published} onValueChange={(value) => setEventForm((current) => ({ ...current, is_published: value }))} /></View>
      <TouchableOpacity style={styles.saveButton} onPress={saveEvent} disabled={saving}><Text style={styles.saveButtonText}>{saving ? 'áƒ˜áƒœáƒáƒ®áƒ”áƒ‘áƒ...' : 'áƒ¨áƒ”áƒœáƒáƒ®áƒ•áƒ'}</Text></TouchableOpacity>
    </ScrollView>;
  }

  function renderCharityForm() {
    return <ScrollView contentContainerStyle={styles.formContent}>
      <Text style={styles.formTitle}>{editing ? 'áƒžáƒáƒ¡áƒ¢áƒ˜áƒ¡ áƒ áƒ”áƒ“áƒáƒ¥áƒ¢áƒ˜áƒ áƒ”áƒ‘áƒ' : 'áƒ“áƒáƒ®áƒ›áƒáƒ áƒ”áƒ‘áƒ˜áƒ¡ áƒžáƒáƒ¡áƒ¢áƒ˜áƒ¡ áƒ“áƒáƒ›áƒáƒ¢áƒ”áƒ‘áƒ'}</Text>
      {renderImagePicker(charityForm.imageAsset?.uri || charityForm.imageUrl, () => attachImage('charity'))}
      <TextInput style={styles.input} placeholder="áƒ¡áƒáƒ®áƒ”áƒšáƒ˜" value={charityForm.name} onChangeText={(value) => setCharityForm((current) => ({ ...current, name: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="áƒ›áƒ“áƒ’áƒáƒ›áƒáƒ áƒ”áƒáƒ‘áƒ" value={charityForm.condition} onChangeText={(value) => setCharityForm((current) => ({ ...current, condition: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={[styles.input, styles.textArea]} placeholder="áƒáƒ¦áƒ¬áƒ”áƒ áƒ" value={charityForm.description} onChangeText={(value) => setCharityForm((current) => ({ ...current, description: value }))} multiline placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="áƒ‘áƒáƒœáƒ™áƒ˜" value={charityForm.bank_name} onChangeText={(value) => setCharityForm((current) => ({ ...current, bank_name: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="IBAN" value={charityForm.iban} onChangeText={(value) => setCharityForm((current) => ({ ...current, iban: value }))} placeholderTextColor="#98a3a0" />
      <TextInput style={styles.input} placeholder="áƒ›áƒ˜áƒ›áƒ¦áƒ”áƒ‘áƒ˜" value={charityForm.receiver} onChangeText={(value) => setCharityForm((current) => ({ ...current, receiver: value }))} placeholderTextColor="#98a3a0" />
      <View style={styles.switchRow}><Text style={styles.switchText}>áƒ¡áƒáƒ¡áƒ¬áƒ áƒáƒ¤áƒ</Text><Switch value={charityForm.urgent} onValueChange={(value) => setCharityForm((current) => ({ ...current, urgent: value }))} /></View>
      <View style={styles.segmentButtons}><TouchableOpacity style={[styles.segment, charityForm.status === 'active' && styles.segmentActive]} onPress={() => setCharityForm((current) => ({ ...current, status: 'active' }))}><Text style={[styles.segmentText, charityForm.status === 'active' && styles.segmentTextActive]}>áƒáƒ¥áƒ¢áƒ˜áƒ£áƒ áƒ˜</Text></TouchableOpacity><TouchableOpacity style={[styles.segment, charityForm.status === 'completed' && styles.segmentActive]} onPress={() => setCharityForm((current) => ({ ...current, status: 'completed' }))}><Text style={[styles.segmentText, charityForm.status === 'completed' && styles.segmentTextActive]}>áƒ“áƒáƒ¡áƒ áƒ£áƒšáƒ”áƒ‘áƒ£áƒšáƒ˜</Text></TouchableOpacity></View>
      <TouchableOpacity style={styles.saveButton} onPress={saveCharity} disabled={saving}><Text style={styles.saveButtonText}>{saving ? 'áƒ˜áƒœáƒáƒ®áƒ”áƒ‘áƒ...' : 'áƒ¨áƒ”áƒœáƒáƒ®áƒ•áƒ'}</Text></TouchableOpacity>
    </ScrollView>;
  }

  if (!canAccess) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>áƒáƒ“áƒ›áƒ˜áƒœ áƒ¬áƒ•áƒ“áƒáƒ›áƒ áƒáƒ  áƒ’áƒáƒ¥áƒ•áƒ¡</Text><Text style={styles.subtitle}>áƒ”áƒ¡ áƒ’áƒ•áƒ”áƒ áƒ“áƒ˜ áƒ›áƒ®áƒáƒšáƒáƒ“ áƒáƒ“áƒ›áƒ˜áƒœáƒ˜áƒ¡áƒ¢áƒ áƒáƒ¢áƒáƒ áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡áƒáƒ.</Text></View></SafeAreaView>;
  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" color="#2e8b57" /></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top']}><View style={styles.header}><View><Text style={styles.title}>Admin Panel</Text><Text style={styles.subtitle}>áƒ›áƒáƒ áƒ—áƒ” áƒáƒžáƒ˜ áƒ¢áƒ”áƒšáƒ”áƒ¤áƒáƒœáƒ˜áƒ“áƒáƒœ</Text></View><TouchableOpacity style={styles.refresh} onPress={() => loadAll(true)}><Text style={styles.refreshText}>{refreshing ? '...' : 'áƒ’áƒáƒœáƒáƒ®áƒšáƒ”áƒ‘áƒ'}</Text></TouchableOpacity></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{tabs.map((item) => <TouchableOpacity key={item} style={[styles.tab, activeTab === item && styles.tabActive]} onPress={() => setActiveTab(item)}><Text style={[styles.tabText, activeTab === item && styles.tabTextActive]}>{item}</Text></TouchableOpacity>)}</ScrollView><ScrollView contentContainerStyle={styles.content}>{renderTabContent()}</ScrollView><TouchableOpacity style={styles.fab} onPress={() => activeTab === 'pets' ? openCreate('pet') : setSheetOpen(true)}><Text style={styles.fabText}>+</Text></TouchableOpacity>
    <Modal visible={sheetOpen} transparent animationType="fade"><View style={styles.overlay}><TouchableOpacity style={styles.backdrop} onPress={() => setSheetOpen(false)} /><View style={styles.sheet}><Text style={styles.cardTitle}>áƒ“áƒáƒ›áƒáƒ¢áƒ”áƒ‘áƒ</Text><TouchableOpacity style={styles.action} onPress={() => openCreate('pet')}><Text style={styles.actionText}>áƒªáƒ®áƒáƒ•áƒ”áƒšáƒ˜</Text></TouchableOpacity><TouchableOpacity style={styles.action} onPress={() => openCreate('clinic')}><Text style={styles.actionText}>áƒ™áƒšáƒ˜áƒœáƒ˜áƒ™áƒ</Text></TouchableOpacity><TouchableOpacity style={styles.action} onPress={() => openCreate('event')}><Text style={styles.actionText}>áƒ˜áƒ•áƒ”áƒœáƒ—áƒ˜</Text></TouchableOpacity><TouchableOpacity style={styles.action} onPress={() => openCreate('charity')}><Text style={styles.actionText}>áƒ“áƒáƒ®áƒ›áƒáƒ áƒ”áƒ‘áƒ˜áƒ¡ áƒžáƒáƒ¡áƒ¢áƒ˜</Text></TouchableOpacity><TouchableOpacity onPress={() => setSheetOpen(false)}><Text style={styles.cancel}>áƒ’áƒáƒ£áƒ¥áƒ›áƒ”áƒ‘áƒ</Text></TouchableOpacity></View></View></Modal>
    <Modal visible={Boolean(formType)} animationType="slide"><KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.modalHeader}><Text style={styles.cardTitle}>áƒ¨áƒ”áƒ•áƒ¡áƒ”áƒ‘áƒ</Text><TouchableOpacity onPress={() => setFormType(null)}><Text style={styles.refreshText}>áƒ“áƒáƒ®áƒ£áƒ áƒ•áƒ</Text></TouchableOpacity></View>{formType === 'pet' && renderPetForm()}{formType === 'clinic' && renderClinicForm()}{formType === 'event' && renderEventForm()}{formType === 'charity' && renderCharityForm()}</KeyboardAvoidingView></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef3f1' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: { padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '900', color: '#16352c' },
  subtitle: { color: '#6a7d76', marginTop: 4 },
  refresh: { backgroundColor: '#16352c', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 },
  refreshText: { color: '#2e8b57', fontWeight: '800' },
  tabs: { paddingHorizontal: 14, paddingBottom: 8 },
  tab: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, marginRight: 8 },
  tabActive: { backgroundColor: '#16352c' },
  tabText: { color: '#4f625c', fontWeight: '700', textTransform: 'capitalize' },
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
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '800', color: '#16352c' },
  itemSubtitle: { color: '#6b7f78', marginTop: 4, fontSize: 12 },
  itemMeta: { color: '#8a9893', marginTop: 4, fontSize: 11 },
  smallButton: { backgroundColor: '#eff5f2', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, marginBottom: 8, alignItems: 'center' },
  smallButtonText: { color: '#16352c', fontWeight: '700', fontSize: 12 },
  dangerButton: { backgroundColor: '#fff0f0', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, alignItems: 'center' },
  dangerButtonText: { color: '#cf4a4a', fontWeight: '800', fontSize: 12 },
  statusButton: { backgroundColor: '#eefcf5', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, marginBottom: 8, alignItems: 'center' },
  statusButtonText: { color: '#2e8b57', fontWeight: '800', fontSize: 12 },
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
