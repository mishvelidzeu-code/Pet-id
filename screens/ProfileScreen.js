import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Alert, 
  ScrollView, 
  ActivityIndicator, 
  Switch, 
  Modal, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  Image,
  Keyboard,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '../lib/supabase';
import { uploadImageAsset } from '../lib/storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ნოთიფიკაციების ქცევის კონფიგურაცია
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ==========================================
// Dashboard - ძირითადი პანელი (Profile Screen)
// ==========================================
function Dashboard({ session }) {
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState([]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [isMedModalVisible, setMedModalVisible] = useState(false);
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // პასპორტის სურათის სრულ ეკრანზე სანახავი state
  const [viewerImage, setViewerImage] = useState(null);

  // მონაცემები
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petSex, setPetSex] = useState(''); 
  const [petColor, setPetColor] = useState('');
  const [petWeight, setPetWeight] = useState('');
  const [petLocation, setPetLocation] = useState(''); 
  const [petDesc, setPetDesc] = useState('');
  const [dogImage, setDogImage] = useState(null);
  const [passportImage, setPassportImage] = useState(null);
  const [editingPet, setEditingPet] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [selectedPet, setSelectedPet] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [recordType, setRecordType] = useState('vaccine');
  const [recordInfo, setRecordInfo] = useState('');
  const [reminder, setReminder] = useState('none');
  const [editingMedId, setEditingMedId] = useState(null);
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
  const [existingNextDueDate, setExistingNextDueDate] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => { 
    if (session) {
      fetchData(); 
      setupNotifications();
    }
  }, [session]);

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
          title: 'DOG ID',
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
    const userId = session.user.id;
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (prof) { setFullName(prof.full_name || ''); setPhone(prof.phone_number || ''); }
    const { data: pts } = await supabase.from('pets').select('*').eq('owner_id', userId).order('created_at', { ascending: false });
    setPets(pts || []);
    setLoading(false);
  }

  async function saveProfile() {
    if (!session?.user?.id) return;

    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, full_name: fullName, phone_number: phone });

    setSavingProfile(false);

    if (error) {
      Alert.alert('პროფილი ვერ შეინახა', error.message);
      return;
    }

    Alert.alert('წარმატება', 'მონაცემები შენახულია');
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
    setUploading(true);

    try {
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
      weight: petWeight,
      location: petLocation,
      description: petDesc,
      photo_url: dogUrl,
      passport_photo_url: passUrl,
    };

    let error;
    if (editingPet) {
      const res = await supabase.from('pets').update(petObj).eq('id', editingPet.id);
      error = res.error;
    } else {
      petObj.short_code = Math.random().toString(36).substring(2, 8).toUpperCase();
      petObj.is_lost = false;
      const res = await supabase.from('pets').insert([petObj]);
      error = res.error;
    }

    if (!error) {
      setEditModalVisible(false); setAddModalVisible(false);
      resetForm(); fetchData();
    } else {
      Alert.alert("შეცდომა", error.message);
    }
    } catch (error) {
      Alert.alert('სურათი ვერ აიტვირთა', error.message);
    } finally {
      setUploading(false);
    }
  }

  function resetForm() {
    setPetName(''); setPetBreed(''); setPetSex(''); setPetColor(''); setPetWeight(''); setPetLocation(''); setPetDesc('');
    setDogImage(null); setPassportImage(null); setEditingPet(null);
  }

  function startEdit(pet) {
    setEditingPet(pet);
    setPetName(pet.name);
    setPetBreed(pet.breed || '');
    setPetSex(pet.sex || '');
    setPetColor(pet.color || '');
    setPetWeight(pet.weight || '');
    setPetLocation(pet.location || '');
    setPetDesc(pet.description || '');
    setEditModalVisible(true);
  }

  async function confirmToggleLost(id, currentStatus) {
    const newStatus = !currentStatus;
    const question = newStatus ? "ნამდვილად დაკარგეთ ძაღლი/კატა?" : "ნამდვილად იპოვეთ ძაღლი/კატა?";
    
    Alert.alert("სტატუსის შეცვლა", question, [
      { text: "არა", style: "cancel" },
      { text: "დიახ", onPress: async () => {
          const { error } = await supabase.from('pets').update({ is_lost: newStatus }).eq('id', id);
          if (error) Alert.alert("შეცდომა", error.message);
          fetchData();
        }
      }
    ]);
  }

  async function deletePet(id) {
    Alert.alert("წაშლა", "ნამდვილად გსურთ წაშლა?", [
      { text: "არა" },
      { text: "დიახ", style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('pets').delete().eq('id', id);
          if (error) Alert.alert("შეცდომა", error.message);
          fetchData();
      }}
    ]);
  }

  // ==========================================
  // სამედიცინო ბარათის ლოგიკა
  // ==========================================
  async function openMedicalCard(pet) {
    setSelectedPet(pet);
    resetMedForm();
    setMedModalVisible(true);
    const { data, error } = await supabase.from('medical_records').select('*').eq('pet_id', pet.id).order('date_administered', { ascending: false });
    if (error) Alert.alert("შეცდომა ჩატვირთვისას", error.message);
    setMedicalRecords(data || []);
  }

  function resetMedForm() {
    setRecordInfo('');
    setRecordType('vaccine');
    setRecordDate(todayIso());
    setReminder('none');
    setEditingMedId(null);
    setExistingNextDueDate(null);
  }

  function startEditMed(record) {
    setEditingMedId(record.id);
    setRecordInfo(record.record_name || (record.record_type || '').split(': ')[1] || '');
    setRecordDate(record.date_administered || todayIso());
    setExistingNextDueDate(record.next_due_date || null);
    
    if ((record.record_type || '').includes('აცრა')) setRecordType('vaccine');
    else if ((record.record_type || '').includes('ჭია')) setRecordType('worm');
    else if ((record.record_type || '').includes('გარე პარაზიტები')) setRecordType('parasite');
    else setRecordType('other');

    setReminder('none'); 
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
          openMedicalCard(selectedPet);
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
      record_type: `${label}: ${recordInfo}`,
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

    resetMedForm();
    Keyboard.dismiss();
    openMedicalCard(selectedPet);
  }

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

        {pets.map((pet, index) => (
          <View key={index} style={styles.petCard}>
            <View style={styles.petMainInfo}>
              <Image source={{ uri: pet.photo_url }} style={styles.petImg} />
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.petName} numberOfLines={1}>{pet.name}</Text>
                <Text style={styles.petBreedText} numberOfLines={1}>
                  {pet.sex ? `${pet.sex} • ` : ''}{pet.breed} {pet.location ? `• 📍 ${pet.location}` : ''}
                </Text>
                <View style={styles.idBadge}>
                  <Text style={styles.codeText}>ID: {pet.short_code}</Text>
                </View>
              </View>
              <View style={styles.petActions}>
                <TouchableOpacity onPress={() => startEdit(pet)} style={styles.actionBtn}><Text style={{fontSize: 14}}>✏️</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => deletePet(pet.id)} style={[styles.actionBtn, {backgroundColor: '#ffeef0'}]}><Text style={{fontSize: 14}}>🗑️</Text></TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.petBottomRow}>
               <TouchableOpacity style={styles.featureBtn} onPress={() => openMedicalCard(pet)} activeOpacity={0.7}>
                 <Text style={styles.featureBtnText}>🩺 ბარათი</Text>
               </TouchableOpacity>
               
               {pet.passport_photo_url && (
                 <TouchableOpacity 
                   style={[styles.featureBtn, {backgroundColor: '#fef6e5'}]} 
                   onPress={() => setViewerImage(pet.passport_photo_url)} 
                   activeOpacity={0.7}
                 >
                   <Text style={[styles.featureBtnText, {color: '#d97706'}]}>📄 პასპორტი</Text>
                 </TouchableOpacity>
               )}
               
               <View style={styles.lostSwitchContainer}>
                  <Text style={{fontSize: 11, fontWeight: '700', color: pet.is_lost ? '#ff4d4d' : '#888', marginRight: 5, flexShrink: 1}}>
                    {pet.is_lost ? '🚨 იძებნება' : '✅ დაცულია'}
                  </Text>
                  <Switch 
                    trackColor={{ false: '#e0e0e0', true: '#ffcccc' }}
                    thumbColor={pet.is_lost ? '#ff4d4d' : '#f4f3f4'}
                    scaleX={0.75} scaleY={0.75} 
                    value={pet.is_lost} 
                    onValueChange={() => confirmToggleLost(pet.id, pet.is_lost)} 
                  />
               </View>
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
            <TextInput style={styles.input} placeholder="მაგ: გიორგი მაისურაძე" value={fullName} onChangeText={setFullName} placeholderTextColor="#aaa" />
            
            <Text style={styles.inputLabel}>ტელეფონის ნომერი</Text>
            <TextInput style={styles.input} placeholder="მაგ: 599 12 34 56" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor="#aaa" />
            
            <TouchableOpacity style={styles.saveProfileBtn} onPress={saveProfile} disabled={savingProfile} activeOpacity={0.8}>
              <Text style={styles.saveProfileBtnText}>{savingProfile ? 'ინახება...' : 'შენახვა'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => supabase.auth.signOut()} style={styles.logoutBtn}>
              <Text style={styles.logoutBtnText}>სისტემიდან გამოსვლა</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ==========================================
          რედაქტირების / დამატების მოდალი 
          ========================================== */}
      <Modal visible={isEditModalVisible || isAddModalVisible} animationType="slide">
        <View style={{flex: 1, backgroundColor: '#f9fbfd', paddingTop: Platform.OS === 'ios' ? 50 : 20}}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
            
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
        <View style={{flex: 1, backgroundColor: '#f9fbfd', paddingTop: Platform.OS === 'ios' ? 50 : 20}}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🩺 {selectedPet?.name}-ის ბარათი</Text>
              <TouchableOpacity style={styles.closeIconBtn} onPress={() => setMedModalVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 40 }} 
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {medicalRecords.length === 0 && (
                <View style={styles.emptyMedContainer}>
                   <Text style={{fontSize: 40, marginBottom: 10}}>📋</Text>
                   <Text style={{color: '#999', fontSize: 16, fontWeight: '500'}}>ისტორია ცარიელია</Text>
                </View>
              )}
              
              {medicalRecords.map((r, i) => (
                <TouchableOpacity key={i} style={styles.medItem} onPress={() => startEditMed(r)} activeOpacity={0.7}>
                  <View style={{flex: 1}}>
                    <Text style={styles.medItemTitle}>{r.record_type || r.record_name}</Text>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 6}}>
                      <View style={styles.medDateBadge}>
                        <Text style={styles.medItemDate}>{r.date_administered}</Text>
                      </View>
                      {r.next_due_date && (
                        <View style={[styles.medDateBadge, {backgroundColor: '#eefcf5', marginLeft: 8}]}>
                          <Text style={[styles.medItemDate, {color: '#2e8b57'}]}>შემდეგი: {r.next_due_date}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={{fontSize: 18, color: '#ccc'}}>✏️</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.medForm}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                 <Text style={styles.inputLabel}>{editingMedId ? 'ჩანაწერის რედაქტირება' : 'ახალი ჩანაწერის დამატება'}</Text>
                 {editingMedId && (
                   <View style={{flexDirection: 'row'}}>
                     <TouchableOpacity onPress={() => deleteMedRecord(editingMedId)} style={{marginRight: 15}}><Text style={{color: 'red', fontSize: 12, fontWeight: 'bold'}}>წაშლა</Text></TouchableOpacity>
                     <TouchableOpacity onPress={resetMedForm}><Text style={{color: '#888', fontSize: 12, fontWeight: 'bold'}}>გაუქმება</Text></TouchableOpacity>
                   </View>
                 )}
              </View>

              <View style={styles.typeSelector}>
                {[
                  { id: 'vaccine', label: '💉 აცრა' },
                  { id: 'worm', label: '💊 ჭია' },
                  { id: 'parasite', label: '🦟 გარე პარაზიტები' },
                  { id: 'other', label: '📝 სხვა' }
                ].map(t => (
                  <TouchableOpacity key={t.id} onPress={() => setRecordType(t.id)} style={[styles.typeBtn, recordType === t.id && styles.typeBtnActive]} activeOpacity={0.7}>
                    <Text style={[styles.typeBtnText, recordType === t.id && {color: '#fff'}]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={[styles.inputLabel, {marginTop: 5}]}>შეხსენება მომავალში</Text>
              <View style={styles.typeSelector}>
                {[
                  { id: 'none', label: 'არ მინდა' },
                  { id: '1_month', label: '1 თვეში' },
                  { id: '3_months', label: '3 თვეში' },
                  { id: '1_year', label: '1 წელში' }
                ].map(r => (
                  <TouchableOpacity key={r.id} onPress={() => setReminder(r.id)} style={[styles.remBtn, reminder === r.id && styles.remBtnActive]} activeOpacity={0.7}>
                    <Text style={[styles.remBtnText, reminder === r.id && {color: '#2e8b57'}]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.medInputRow}>
                <TextInput 
                  style={[styles.input, {flex: 1, marginBottom: 0, marginRight: 10}]} 
                  placeholder="პრეპარატის დასახელება..." 
                  value={recordInfo} 
                  onChangeText={setRecordInfo} 
                  placeholderTextColor="#aaa" 
                />
                <TouchableOpacity style={[styles.medSaveBtn, editingMedId && {backgroundColor: '#0066cc'}]} onPress={addMedical} activeOpacity={0.8}>
                  <Text style={[styles.medSaveBtnText, editingMedId && {fontSize: 16}]}>{editingMedId ? 'შენახვა' : '+'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            
          </KeyboardAvoidingView>
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

export default function ProfileScreen({ session: externalSession = null }) {
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

  return <Dashboard session={session} />;
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
  petCard: { backgroundColor: '#fff', borderRadius: 28, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, elevation: 3 },
  petMainInfo: { flexDirection: 'row', alignItems: 'center' },
  petImg: { width: 80, height: 80, borderRadius: 22, backgroundColor: '#f0f0f0' },
  petName: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  petBreedText: { fontSize: 13, color: '#666', marginTop: 4, fontWeight: '600' },
  idBadge: { backgroundColor: '#eefcf5', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
  codeText: { fontSize: 11, color: '#2e8b57', fontWeight: '800', letterSpacing: 0.5 },
  petActions: { flexDirection: 'row' },
  actionBtn: { width: 38, height: 38, backgroundColor: '#f8f9fa', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  
  // ქვედა ზოლის გასწორება - featureBtn და lostSwitchContainer
  petBottomRow: { flexDirection: 'row', marginTop: 15, paddingTop: 15, borderTopWidth: 1.5, borderTopColor: '#f4f5f7', alignItems: 'center', justifyContent: 'space-between' },
  featureBtn: { flex: 1, backgroundColor: '#f0f7ff', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, alignItems: 'center', marginRight: 10 },
  featureBtnText: { fontSize: 13, color: '#0066cc', fontWeight: '800' },
  lostSwitchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fafafa', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },

  // Profile Section
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 22, borderRadius: 20, marginTop: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  profileHeaderText: { fontWeight: '800', fontSize: 17, color: '#333' },
  profileChevronBtn: { backgroundColor: '#f0f0f0', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  
  profileContent: { backgroundColor: '#fff', padding: 24, borderRadius: 28, marginTop: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  saveProfileBtn: { backgroundColor: '#2e8b57', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 15 },
  saveProfileBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  logoutBtn: { marginTop: 25, padding: 10, alignItems: 'center' },
  logoutBtnText: { color: '#ff4d4d', fontWeight: '700', fontSize: 15 },

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
  emptyMedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
  medItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 14, borderLeftWidth: 5, borderLeftColor: '#2e8b57', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  medItemTitle: { fontWeight: '800', fontSize: 15, color: '#222' },
  medDateBadge: { backgroundColor: '#f4f6f9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  medItemDate: { fontSize: 11, color: '#666', fontWeight: '600' },
  
  medForm: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, elevation: 10 },
  typeSelector: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
  typeBtn: { width: '48%', padding: 10, alignItems: 'center', backgroundColor: '#f4f6f9', margin: '1%', borderRadius: 12 },
  typeBtnActive: { backgroundColor: '#2e8b57' },
  typeBtnText: { fontSize: 12, color: '#666', fontWeight: '700' },
  
  remBtn: { width: '23%', padding: 10, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', margin: '1%', borderRadius: 10 },
  remBtnActive: { borderColor: '#2e8b57', backgroundColor: '#eefcf5' },
  remBtnText: { fontSize: 10, color: '#888', fontWeight: '700' },

  medInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  medSaveBtn: { backgroundColor: '#2e8b57', minWidth: 55, height: 55, paddingHorizontal: 15, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#2e8b57', shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 },
  medSaveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 26, lineHeight: 28 },

  // Passport Image Viewer
  viewerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  viewerScrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  viewerCloseBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 30, right: 20, zIndex: 10, width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  viewerCloseText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  viewerImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8, resizeMode: 'contain' }
});
