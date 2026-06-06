import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { uploadImageAsset } from '../lib/storage';
import { ensurePetCodeIsUnique } from '../lib/petCode';

const todayIso = () => new Date().toISOString().split('T')[0];

const MEDICAL_TYPES = [
  { id: 'vaccine', label: 'აცრა', icon: 'shield-checkmark-outline', color: '#2563eb', bg: '#eef4ff' },
  { id: 'worm', label: 'ჭია', icon: 'flask-outline', color: '#d97706', bg: '#fff6e8' },
  { id: 'parasite', label: 'პარაზიტები', icon: 'bug-outline', color: '#dc2626', bg: '#fff1f2' },
  { id: 'other', label: 'სხვა', icon: 'document-text-outline', color: '#2e8b57', bg: '#eefcf5' },
];

const REMINDERS = [
  { id: 'none', label: 'არა' },
  { id: '1_month', label: '1 თვე' },
  { id: '3_months', label: '3 თვე' },
  { id: '1_year', label: '1 წელი' },
];

function formatDateLabel(value) {
  if (!value) return 'არ არის';

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return 'არ არის';

  return new Intl.DateTimeFormat('ka-GE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsedDate);
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T10:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function getNextDueDate(dateValue, reminder) {
  if (reminder === 'none') return null;

  const date = new Date(`${dateValue}T10:00:00`);
  if (reminder === '1_month') date.setMonth(date.getMonth() + 1);
  if (reminder === '3_months') date.setMonth(date.getMonth() + 3);
  if (reminder === '1_year') date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().split('T')[0];
}

function getMedicalTypeMeta(value = '') {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'vaccine' || normalized.includes('აცრა')) return MEDICAL_TYPES[0];
  if (normalized === 'worm' || normalized.includes('ჭია')) return MEDICAL_TYPES[1];
  if (normalized === 'parasite' || normalized.includes('პარაზიტ')) return MEDICAL_TYPES[2];
  return MEDICAL_TYPES[3];
}

function getReminderFromRecord(record) {
  if (!record?.next_due_date || !record?.date_administered) return 'none';

  const base = new Date(`${record.date_administered}T10:00:00`);
  const next = record.next_due_date;
  const oneMonth = new Date(base);
  oneMonth.setMonth(oneMonth.getMonth() + 1);
  const threeMonths = new Date(base);
  threeMonths.setMonth(threeMonths.getMonth() + 3);
  const oneYear = new Date(base);
  oneYear.setFullYear(oneYear.getFullYear() + 1);

  if (next === oneMonth.toISOString().split('T')[0]) return '1_month';
  if (next === threeMonths.toISOString().split('T')[0]) return '3_months';
  if (next === oneYear.toISOString().split('T')[0]) return '1_year';
  return 'none';
}

const emptyMedForm = {
  id: null,
  record_name: '',
  record_type: 'vaccine',
  date_administered: todayIso(),
  reminder: 'none',
};

const emptyPetForm = {
  name: '',
  breed: '',
  short_code: '',
  sex: '',
  color: '',
  size: '',
  weight: '',
  location: '',
  description: '',
};

export default function ShopScreen({ session, petsRefreshToken = 0, onPetsChanged }) {
  const [pets, setPets] = useState([]);
  const [recordsByPet, setRecordsByPet] = useState({});
  const [expandedPetId, setExpandedPetId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingPassportId, setUploadingPassportId] = useState(null);
  const [petModalVisible, setPetModalVisible] = useState(false);
  const [petForm, setPetForm] = useState(emptyPetForm);
  const [petPhoto, setPetPhoto] = useState(null);
  const [petPassport, setPetPassport] = useState(null);
  const [savingPet, setSavingPet] = useState(false);
  const [medModalVisible, setMedModalVisible] = useState(false);
  const [activeMedPet, setActiveMedPet] = useState(null);
  const [medForm, setMedForm] = useState(emptyMedForm);
  const [savingMed, setSavingMed] = useState(false);

  useEffect(() => {
    loadPets();
  }, [session?.user?.id]);

  useEffect(() => {
    if (petsRefreshToken) {
      loadPets(true);
    }
  }, [petsRefreshToken]);

  async function loadPets(withRefresh = false) {
    if (!session?.user?.id) {
      setPets([]);
      setRecordsByPet({});
      setExpandedPetId(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (withRefresh) setRefreshing(true);
    else setLoading(true);

    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('პასპორტი ვერ ჩაიტვირთა', error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const nextPets = data || [];
    setPets(nextPets);
    setExpandedPetId((current) => {
      if (current && nextPets.some((pet) => pet.id === current)) return current;
      return null;
    });

    await loadMedicalRecords(nextPets);
    setLoading(false);
    setRefreshing(false);
  }

  async function loadMedicalRecords(nextPets = pets) {
    if (!nextPets.length) {
      setRecordsByPet({});
      return;
    }

    const { data, error } = await supabase
      .from('medical_records')
      .select('*')
      .in(
        'pet_id',
        nextPets.map((pet) => pet.id)
      )
      .order('date_administered', { ascending: false });

    if (error) {
      return;
    }

    const grouped = {};
    (data || []).forEach((record) => {
      grouped[record.pet_id] = [...(grouped[record.pet_id] || []), record];
    });
    setRecordsByPet(grouped);
  }

  function togglePet(petId) {
    setExpandedPetId((current) => (current === petId ? null : petId));
  }

  function openPetForm() {
    setPetForm(emptyPetForm);
    setPetPhoto(null);
    setPetPassport(null);
    setPetModalVisible(true);
  }

  function closePetForm() {
    setPetModalVisible(false);
    setPetForm(emptyPetForm);
    setPetPhoto(null);
    setPetPassport(null);
    setSavingPet(false);
  }

  async function pickPetImage(type) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'photo' ? [1, 1] : [3, 4],
      quality: 0.45,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    if (type === 'photo') setPetPhoto(result.assets[0]);
    else setPetPassport(result.assets[0]);
  }

  async function savePet() {
    if (!session?.user?.id) return;

    if (!petForm.name.trim()) {
      Alert.alert('ცხოველის დამატება', 'შეიყვანე ცხოველის სახელი.');
      return;
    }

    setSavingPet(true);
    try {
      const shortCode = await ensurePetCodeIsUnique(petForm.short_code, null);
      const photoUrl = petPhoto
        ? await uploadImageAsset(petPhoto, { folder: 'pets/dogs', prefix: 'dog' })
        : null;
      const passportUrl = petPassport
        ? await uploadImageAsset(petPassport, { folder: 'pets/passports', prefix: 'passport' })
        : null;

      const { error } = await supabase.from('pets').insert([
        {
          owner_id: session.user.id,
          name: petForm.name.trim(),
          breed: petForm.breed.trim(),
          short_code: shortCode,
          sex: petForm.sex.trim(),
          color: petForm.color.trim(),
          size: petForm.size.trim(),
          weight: petForm.weight.trim(),
          location: petForm.location.trim(),
          description: petForm.description.trim(),
          photo_url: photoUrl,
          passport_photo_url: passportUrl,
          is_lost: false,
        },
      ]);

      if (error) throw error;

      closePetForm();
      onPetsChanged?.();
      await loadPets(true);
    } catch (error) {
      Alert.alert('ცხოველი ვერ დაემატა', error.message || 'შენახვა ვერ მოხერხდა.');
    } finally {
      setSavingPet(false);
    }
  }

  async function changePassportImage(pet) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.45,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    setUploadingPassportId(pet.id);
    try {
      const passportUrl = await uploadImageAsset(result.assets[0], {
        folder: 'pets/passports',
        prefix: 'passport',
      });

      const { error } = await supabase
        .from('pets')
        .update({ passport_photo_url: passportUrl })
        .eq('id', pet.id);

      if (error) throw error;

      setPets((current) =>
        current.map((item) =>
          item.id === pet.id ? { ...item, passport_photo_url: passportUrl } : item
        )
      );
    } catch (error) {
      Alert.alert('პასპორტი ვერ განახლდა', error.message || 'სურათის შენახვა ვერ მოხერხდა.');
    } finally {
      setUploadingPassportId(null);
    }
  }

  function openMedForm(pet, record = null) {
    const typeMeta = getMedicalTypeMeta(record?.record_type || 'vaccine');
    setActiveMedPet(pet);
    setMedForm(
      record
        ? {
            id: record.id,
            record_name: record.record_name || '',
            record_type: typeMeta.id,
            date_administered: record.date_administered || todayIso(),
            reminder: getReminderFromRecord(record),
          }
        : {
            ...emptyMedForm,
            date_administered: todayIso(),
          }
    );
    setMedModalVisible(true);
  }

  function closeMedForm() {
    setMedModalVisible(false);
    setActiveMedPet(null);
    setMedForm(emptyMedForm);
    setSavingMed(false);
  }

  async function saveMedRecord() {
    if (!activeMedPet?.id) return;

    if (!medForm.record_name.trim()) {
      Alert.alert('მედ ბარათი', 'შეიყვანე ჩანაწერის დასახელება.');
      return;
    }

    if (!isValidIsoDate(medForm.date_administered)) {
      Alert.alert('მედ ბარათი', 'თარიღი უნდა იყოს ფორმატით YYYY-MM-DD.');
      return;
    }

    setSavingMed(true);
    const payload = {
      pet_id: activeMedPet.id,
      record_type: medForm.record_type,
      record_name: medForm.record_name.trim(),
      date_administered: medForm.date_administered,
      next_due_date: getNextDueDate(medForm.date_administered, medForm.reminder),
    };

    const result = medForm.id
      ? await supabase.from('medical_records').update(payload).eq('id', medForm.id)
      : await supabase.from('medical_records').insert([payload]);

    setSavingMed(false);

    if (result.error) {
      Alert.alert('მედ ბარათი ვერ შეინახა', result.error.message);
      return;
    }

    await loadMedicalRecords();
    closeMedForm();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2e8b57" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadPets(true)} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>PET ID</Text>
            <Text style={styles.title}>პასპორტი</Text>
            <Text style={styles.subtitle}>ცხოველის პასპორტი და მედ ბარათი ერთ დახვეწილ სივრცეში.</Text>
          </View>

          <TouchableOpacity style={styles.addButton} onPress={openPetForm} activeOpacity={0.86}>
            <Ionicons name="add" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addPetCard} onPress={openPetForm} activeOpacity={0.88}>
          <View style={styles.addPetIcon}>
            <Ionicons name="paw-outline" size={24} color="#2e8b57" />
          </View>
          <View style={styles.addPetCopy}>
            <Text style={styles.addPetTitle}>დაამატე ახალი ცხოველი</Text>
            <Text style={styles.addPetText}>შეავსე ძირითადი მონაცემები, ფოტო და პასპორტი პირდაპირ აქედან.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6f837b" />
        </TouchableOpacity>

        {!pets.length ? (
          <View style={styles.emptyCard}>
            <Ionicons name="id-card-outline" size={42} color="#6f837b" />
            <Text style={styles.emptyTitle}>ცხოველი ჯერ დამატებული არ არის</Text>
            <Text style={styles.emptyText}>პასპორტის სანახავად ჯერ პროფილში დაამატე შენი ცხოველი.</Text>
          </View>
        ) : (
          pets.map((pet) => {
            const isExpanded = expandedPetId === pet.id;
            const records = recordsByPet[pet.id] || [];
            const isUploadingPassport = uploadingPassportId === pet.id;

            return (
              <View key={pet.id} style={[styles.petCard, isExpanded && styles.petCardExpanded]}>
                <TouchableOpacity
                  style={styles.petSummary}
                  onPress={() => togglePet(pet.id)}
                  activeOpacity={0.88}
                >
                  <View style={styles.petPhotoWrap}>
                    {pet.photo_url ? (
                      <Image source={{ uri: pet.photo_url }} style={styles.petPhoto} />
                    ) : (
                      <View style={[styles.petPhoto, styles.petPhotoFallback]}>
                        <Ionicons name="paw-outline" size={30} color="#7b8d86" />
                      </View>
                    )}
                  </View>

                  <View style={styles.petInfo}>
                    <Text style={styles.petName} numberOfLines={1}>{pet.name}</Text>
                    <Text style={styles.petMeta} numberOfLines={1}>
                      {[pet.breed, pet.sex, pet.size].filter(Boolean).join(' • ') || 'მონაცემები შესავსებია'}
                    </Text>
                    <View style={styles.petCodeBadge}>
                      <Text style={styles.petCodeText}>ID: {pet.short_code || '-'}</Text>
                    </View>
                  </View>

                  <View style={styles.expandIcon}>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={22}
                      color="#16352c"
                    />
                  </View>
                </TouchableOpacity>

                {isExpanded ? (
                  <View style={styles.expandedArea}>
                    <View style={styles.detailsGrid}>
                      <View style={styles.factCard}>
                        <Text style={styles.factLabel}>წონა</Text>
                        <Text style={styles.factValue}>{pet.weight || '-'}</Text>
                      </View>
                      <View style={styles.factCard}>
                        <Text style={styles.factLabel}>ფერი</Text>
                        <Text style={styles.factValue}>{pet.color || '-'}</Text>
                      </View>
                      <View style={styles.factCard}>
                        <Text style={styles.factLabel}>ლოკაცია</Text>
                        <Text style={styles.factValue}>{pet.location || '-'}</Text>
                      </View>
                    </View>

                    <View style={styles.passportBlock}>
                      <View style={styles.blockHeader}>
                        <View style={styles.blockTitleRow}>
                          <Ionicons name="id-card-outline" size={18} color="#2e8b57" />
                          <Text style={styles.blockTitle}>პასპორტი</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.smallAction}
                          onPress={() => changePassportImage(pet)}
                          disabled={isUploadingPassport}
                          activeOpacity={0.84}
                        >
                          {isUploadingPassport ? (
                            <ActivityIndicator size="small" color="#2e8b57" />
                          ) : (
                            <>
                              <Ionicons name="camera-outline" size={15} color="#2e8b57" />
                              <Text style={styles.smallActionText}>
                                {pet.passport_photo_url ? 'შეცვლა' : 'დამატება'}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={styles.passportTouchable}
                        onPress={() => changePassportImage(pet)}
                        disabled={isUploadingPassport}
                        activeOpacity={0.88}
                      >
                        {pet.passport_photo_url ? (
                          <Image source={{ uri: pet.passport_photo_url }} style={styles.passportImage} />
                        ) : (
                          <View style={styles.passportEmpty}>
                            <Ionicons name="document-text-outline" size={34} color="#7b8d86" />
                            <Text style={styles.passportEmptyText}>დაამატე ან შეცვალე პასპორტის ფოტო</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.medBlock}
                      onPress={() => openMedForm(pet)}
                      activeOpacity={0.9}
                    >
                      <View style={styles.blockHeader}>
                        <View style={styles.blockTitleRow}>
                          <Ionicons name="medkit-outline" size={18} color="#dc2626" />
                          <Text style={styles.blockTitle}>მედ ბარათი</Text>
                        </View>
                        <View style={[styles.smallAction, styles.medAction]}>
                          <Ionicons name="add" size={16} color="#dc2626" />
                          <Text style={[styles.smallActionText, styles.medActionText]}>ჩანაწერი</Text>
                        </View>
                      </View>

                      {!records.length ? (
                        <View style={styles.medEmpty}>
                          <Text style={styles.medEmptyTitle}>ჯერ ცარიელია</Text>
                          <Text style={styles.medEmptyText}>დააჭირე აქ და დაამატე აცრა, წამალი ან სხვა ჩანაწერი.</Text>
                        </View>
                      ) : (
                        records.slice(0, 5).map((record) => {
                          const meta = getMedicalTypeMeta(record.record_type);
                          return (
                            <TouchableOpacity
                              key={record.id}
                              style={styles.medRecord}
                              onPress={() => openMedForm(pet, record)}
                              activeOpacity={0.86}
                            >
                              <View style={[styles.medIcon, { backgroundColor: meta.bg }]}>
                                <Ionicons name={meta.icon} size={18} color={meta.color} />
                              </View>
                              <View style={styles.medInfo}>
                                <Text style={styles.medTitle}>{record.record_name}</Text>
                                <Text style={styles.medDate}>
                                  გაკეთდა: {formatDateLabel(record.date_administered)}
                                </Text>
                                {record.next_due_date ? (
                                  <Text style={styles.medNext}>
                                    შემდეგი: {formatDateLabel(record.next_due_date)}
                                  </Text>
                                ) : null}
                              </View>
                              <Ionicons name="create-outline" size={18} color="#9aa9a3" />
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={petModalVisible} transparent animationType="slide" onRequestClose={closePetForm}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.petSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>PET ID</Text>
                <Text style={styles.sheetTitle}>ახალი ცხოველი</Text>
              </View>
              <TouchableOpacity style={styles.sheetClose} onPress={closePetForm} activeOpacity={0.84}>
                <Ionicons name="close" size={20} color="#16352c" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <View style={styles.photoPickerRow}>
                <TouchableOpacity
                  style={styles.photoPickerBox}
                  onPress={() => pickPetImage('photo')}
                  activeOpacity={0.86}
                >
                  {petPhoto ? (
                    <Image source={{ uri: petPhoto.uri }} style={styles.photoPickerImage} />
                  ) : (
                    <View style={styles.photoPickerEmpty}>
                      <Ionicons name="camera-outline" size={24} color="#2e8b57" />
                      <Text style={styles.photoPickerText}>ფოტო</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.photoPickerBox}
                  onPress={() => pickPetImage('passport')}
                  activeOpacity={0.86}
                >
                  {petPassport ? (
                    <Image source={{ uri: petPassport.uri }} style={styles.photoPickerImage} />
                  ) : (
                    <View style={styles.photoPickerEmpty}>
                      <Ionicons name="id-card-outline" size={24} color="#2e8b57" />
                      <Text style={styles.photoPickerText}>პასპორტი</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>სახელი</Text>
              <TextInput
                style={styles.input}
                value={petForm.name}
                onChangeText={(value) => setPetForm((current) => ({ ...current, name: value }))}
                placeholder="მაგ: ბრუნო"
                placeholderTextColor="#96a59f"
              />

              <Text style={styles.inputLabel}>Pet ID</Text>
              <TextInput
                style={styles.input}
                value={petForm.short_code}
                onChangeText={(value) => setPetForm((current) => ({ ...current, short_code: value }))}
                placeholder="უნიკალური ID, მინ. 3 სიმბოლო"
                placeholderTextColor="#96a59f"
                autoCapitalize="characters"
              />

              <View style={styles.formTwoCol}>
                <View style={styles.formHalf}>
                  <Text style={styles.inputLabel}>ჯიში</Text>
                  <TextInput
                    style={styles.input}
                    value={petForm.breed}
                    onChangeText={(value) => setPetForm((current) => ({ ...current, breed: value }))}
                    placeholder="ჯიში"
                    placeholderTextColor="#96a59f"
                  />
                </View>
                <View style={styles.formHalf}>
                  <Text style={styles.inputLabel}>სქესი</Text>
                  <TextInput
                    style={styles.input}
                    value={petForm.sex}
                    onChangeText={(value) => setPetForm((current) => ({ ...current, sex: value }))}
                    placeholder="ხვადი / ძუ"
                    placeholderTextColor="#96a59f"
                  />
                </View>
              </View>

              <View style={styles.formTwoCol}>
                <View style={styles.formHalf}>
                  <Text style={styles.inputLabel}>ზომა</Text>
                  <TextInput
                    style={styles.input}
                    value={petForm.size}
                    onChangeText={(value) => setPetForm((current) => ({ ...current, size: value }))}
                    placeholder="პატარა / საშუალო"
                    placeholderTextColor="#96a59f"
                  />
                </View>
                <View style={styles.formHalf}>
                  <Text style={styles.inputLabel}>წონა</Text>
                  <TextInput
                    style={styles.input}
                    value={petForm.weight}
                    onChangeText={(value) => setPetForm((current) => ({ ...current, weight: value }))}
                    placeholder="მაგ: 12 კგ"
                    placeholderTextColor="#96a59f"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>ფერი</Text>
              <TextInput
                style={styles.input}
                value={petForm.color}
                onChangeText={(value) => setPetForm((current) => ({ ...current, color: value }))}
                placeholder="ფერი"
                placeholderTextColor="#96a59f"
              />

              <Text style={styles.inputLabel}>ლოკაცია</Text>
              <TextInput
                style={styles.input}
                value={petForm.location}
                onChangeText={(value) => setPetForm((current) => ({ ...current, location: value }))}
                placeholder="ქალაქი / უბანი"
                placeholderTextColor="#96a59f"
              />

              <Text style={styles.inputLabel}>აღწერა</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={petForm.description}
                onChangeText={(value) => setPetForm((current) => ({ ...current, description: value }))}
                placeholder="დამატებითი ინფორმაცია"
                placeholderTextColor="#96a59f"
                multiline
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={savePet}
                disabled={savingPet}
                activeOpacity={0.88}
              >
                {savingPet ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                    <Text style={styles.saveButtonText}>დამატება</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={medModalVisible} transparent animationType="slide" onRequestClose={closeMedForm}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.medSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>{activeMedPet?.name || 'ცხოველი'}</Text>
                <Text style={styles.sheetTitle}>{medForm.id ? 'ჩანაწერის შეცვლა' : 'ახალი მედ ჩანაწერი'}</Text>
              </View>
              <TouchableOpacity style={styles.sheetClose} onPress={closeMedForm} activeOpacity={0.84}>
                <Ionicons name="close" size={20} color="#16352c" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>ტიპი</Text>
              <View style={styles.typeGrid}>
                {MEDICAL_TYPES.map((type) => {
                  const active = medForm.record_type === type.id;
                  return (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.typeChip,
                        active && { backgroundColor: type.bg, borderColor: type.color },
                      ]}
                      onPress={() => setMedForm((current) => ({ ...current, record_type: type.id }))}
                      activeOpacity={0.84}
                    >
                      <Ionicons name={type.icon} size={17} color={active ? type.color : '#667c73'} />
                      <Text style={[styles.typeChipText, active && { color: type.color }]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>დასახელება</Text>
              <TextInput
                style={styles.input}
                value={medForm.record_name}
                onChangeText={(value) => setMedForm((current) => ({ ...current, record_name: value }))}
                placeholder="მაგ: Nobivac, Bravecto, ოპერაცია..."
                placeholderTextColor="#96a59f"
              />

              <Text style={styles.inputLabel}>თარიღი</Text>
              <TextInput
                style={styles.input}
                value={medForm.date_administered}
                onChangeText={(value) =>
                  setMedForm((current) => ({ ...current, date_administered: value }))
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#96a59f"
              />

              <Text style={styles.inputLabel}>შემდეგი შეხსენება</Text>
              <View style={styles.reminderRow}>
                {REMINDERS.map((item) => {
                  const active = medForm.reminder === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.reminderChip, active && styles.reminderChipActive]}
                      onPress={() => setMedForm((current) => ({ ...current, reminder: item.id }))}
                      activeOpacity={0.84}
                    >
                      <Text style={[styles.reminderText, active && styles.reminderTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveMedRecord}
                disabled={savingMed}
                activeOpacity={0.88}
              >
                {savingMed ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                    <Text style={styles.saveButtonText}>შენახვა</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f4f8f6',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 18,
    paddingBottom: 112,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  eyebrow: {
    color: '#2e8b57',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 5,
    color: '#16352c',
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 6,
    color: '#667c73',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 270,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#2e8b57',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2e8b57',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },
  addPetCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e3ebe6',
  },
  addPetIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#eefaf3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addPetCopy: {
    flex: 1,
    paddingRight: 8,
  },
  addPetTitle: {
    color: '#16352c',
    fontSize: 16,
    fontWeight: '900',
  },
  addPetText: {
    marginTop: 4,
    color: '#6c8279',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 26,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e3ebe6',
  },
  emptyTitle: {
    marginTop: 12,
    color: '#16352c',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 7,
    color: '#6c8279',
    textAlign: 'center',
    lineHeight: 20,
  },
  petCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e4eee8',
    shadowColor: '#10231a',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  petCardExpanded: {
    borderColor: '#bfe4ce',
  },
  petSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petPhotoWrap: {
    width: 78,
    height: 78,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#dde7e2',
    marginRight: 14,
  },
  petPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  petPhotoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  petInfo: {
    flex: 1,
    paddingRight: 10,
  },
  petName: {
    color: '#16352c',
    fontSize: 20,
    fontWeight: '900',
  },
  petMeta: {
    marginTop: 5,
    color: '#6c8279',
    fontSize: 13,
    fontWeight: '700',
  },
  petCodeBadge: {
    alignSelf: 'flex-start',
    marginTop: 9,
    backgroundColor: '#eefaf3',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  petCodeText: {
    color: '#2e8b57',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  expandIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#f1f6f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedArea: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#edf2ef',
    paddingTop: 14,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  factCard: {
    width: '32%',
    backgroundColor: '#f6faf8',
    borderRadius: 16,
    padding: 11,
  },
  factLabel: {
    color: '#75887f',
    fontSize: 10,
    fontWeight: '800',
  },
  factValue: {
    marginTop: 5,
    color: '#16352c',
    fontSize: 13,
    fontWeight: '900',
  },
  passportBlock: {
    backgroundColor: '#f8fbf9',
    borderRadius: 22,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9f1ed',
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  blockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blockTitle: {
    marginLeft: 8,
    color: '#16352c',
    fontSize: 15,
    fontWeight: '900',
  },
  smallAction: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: '#eefaf3',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionText: {
    marginLeft: 5,
    color: '#2e8b57',
    fontSize: 12,
    fontWeight: '900',
  },
  passportTouchable: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  passportImage: {
    width: '100%',
    height: 224,
    borderRadius: 18,
    backgroundColor: '#dfe8e4',
    resizeMode: 'cover',
  },
  passportEmpty: {
    minHeight: 150,
    borderRadius: 18,
    backgroundColor: '#edf3ef',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderWidth: 1,
    borderColor: '#dbe7e1',
    borderStyle: 'dashed',
  },
  passportEmptyText: {
    marginTop: 8,
    color: '#6c8279',
    fontWeight: '800',
    textAlign: 'center',
  },
  medBlock: {
    backgroundColor: '#fffafa',
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f2e4e4',
  },
  medAction: {
    backgroundColor: '#fff1f2',
  },
  medActionText: {
    color: '#dc2626',
  },
  medEmpty: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
  },
  medEmptyTitle: {
    color: '#16352c',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  medEmptyText: {
    marginTop: 5,
    color: '#6c8279',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 19,
  },
  medRecord: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  medIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  medInfo: {
    flex: 1,
    paddingRight: 8,
  },
  medTitle: {
    color: '#16352c',
    fontSize: 15,
    fontWeight: '900',
  },
  medDate: {
    marginTop: 4,
    color: '#6c8279',
    fontSize: 12,
    fontWeight: '700',
  },
  medNext: {
    marginTop: 3,
    color: '#2e8b57',
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(9, 24, 19, 0.42)',
  },
  medSheet: {
    maxHeight: '88%',
    backgroundColor: '#f7faf8',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 10,
  },
  petSheet: {
    maxHeight: '92%',
    backgroundColor: '#f7faf8',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#d5e0da',
    marginBottom: 14,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sheetEyebrow: {
    color: '#2e8b57',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sheetTitle: {
    marginTop: 5,
    color: '#16352c',
    fontSize: 24,
    fontWeight: '900',
  },
  sheetClose: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#e9f0ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 42 : 28,
  },
  photoPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  photoPickerBox: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#edf5f0',
    borderWidth: 1,
    borderColor: '#dfeae4',
  },
  photoPickerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPickerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPickerText: {
    marginTop: 8,
    color: '#2e8b57',
    fontSize: 13,
    fontWeight: '900',
  },
  formTwoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  formHalf: {
    width: '48%',
  },
  inputLabel: {
    color: '#526960',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
    marginTop: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeChip: {
    width: '48.5%',
    minHeight: 50,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#e3ebe6',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  typeChipText: {
    marginLeft: 8,
    color: '#667c73',
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e3ebe6',
    paddingHorizontal: 15,
    paddingVertical: 15,
    color: '#16352c',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  reminderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  reminderChip: {
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3ebe6',
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginRight: 8,
    marginBottom: 8,
  },
  reminderChipActive: {
    backgroundColor: '#eefaf3',
    borderColor: '#2e8b57',
  },
  reminderText: {
    color: '#667c73',
    fontSize: 12,
    fontWeight: '900',
  },
  reminderTextActive: {
    color: '#2e8b57',
  },
  saveButton: {
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: '#16352c',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 8,
  },
});
