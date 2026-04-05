import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  Modal, 
  Linking,
  RefreshControl,
  Keyboard,
  Platform // აი, ეს აკლდა!
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

export default function SearchScreen() {
  const [code, setCode] = useState('');
  const [petData, setPetData] = useState(null);
  const [lostPets, setLostPets] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isZoomVisible, setIsZoomVisible] = useState(false);
  const [zoomImage, setZoomImage] = useState(null);

  const fetchLostPets = useCallback(async () => {
    const { data, error } = await supabase
      .from('pets')
      .select('*, profiles(full_name, phone_number)')
      .eq('is_lost', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLostPets(data);
    }
  }, []);

  useEffect(() => {
    fetchLostPets();
  }, [fetchLostPets]);

  const onRefresh = async () => {
    setRefreshing(true);
    setCode('');
    setPetData(null);
    await fetchLostPets();
    setRefreshing(false);
  };

  const handleRestart = () => {
    setCode('');
    setPetData(null);
    fetchLostPets();
  };

  const handleSearch = async () => {
    if (code.length < 6) return Alert.alert('ყურადღება', 'შეიყვანეთ 6-ნიშნა კოდი');
    
    Keyboard.dismiss(); 
    setLoading(true);
    
    const { data, error } = await supabase
      .from('pets')
      .select('*, profiles(full_name, phone_number)')
      .eq('short_code', code.toUpperCase())
      .single();

    setLoading(false);

    if (error || !data) {
      Alert.alert('ვერ მოიძებნა', 'კოდი არასწორია ან ძაღლი არ არის რეგისტრირებული.');
    } else {
      setPetData(data);
      setCode(''); 
    }
  };

  const makeCall = (phoneNumber) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert("შეცდომა", "ნომერი არ არის მითითებული");
    }
  };

  const openZoom = (url) => {
    setZoomImage(url);
    setIsZoomVisible(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f4f6f9' }} edges={['top']}>
      
      {/* Header */}
      <TouchableOpacity activeOpacity={0.8} onPress={handleRestart} style={styles.header}>
        <Text style={styles.mainTitle}>Pet ID's 🔍</Text>
        <Text style={styles.refreshHint}>დააფინანსე შენი რჩეული</Text>
      </TouchableOpacity>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2e8b57']} />
        }
      >
        {/* საძიებო ველი */}
        <View style={styles.searchBox}>
          <TextInput
            style={styles.input}
            placeholder="შეიყვანე კოდი (მაგ: AB12CD)"
            maxLength={6}
            autoCapitalize="characters"
            value={code}
            onChangeText={setCode}
            placeholderTextColor="#aaa"
          />
          <TouchableOpacity 
            style={styles.searchBtn} 
            onPress={handleSearch}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>ძებნა</Text>}
          </TouchableOpacity>
        </View>

        {petData ? (
          /* ==========================================
             ძიების შედეგი (სრული ბარათი)
             ========================================== */
          <View style={styles.resultCard}>
            <TouchableOpacity onPress={() => openZoom(petData.photo_url)} activeOpacity={0.9}>
              <Image source={{ uri: petData.photo_url }} style={styles.petImage} />
              <View style={[styles.statusBadge, { backgroundColor: petData.is_lost ? '#ff4d4d' : '#2e8b57' }]}>
                <Text style={styles.statusText}>{petData.is_lost ? '🚨 იძებნება' : '✅ დაცულია'}</Text>
              </View>
            </TouchableOpacity>
            
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <View style={{flex: 1}}>
                   <Text style={styles.petName}>{petData.name}</Text>
                   <Text style={styles.petBreed}>
                     {petData.sex ? `${petData.sex} • ` : ''}{petData.breed || 'ჯიში არაა მითითებული'}
                   </Text>
                </View>
                {petData.location && (
                  <View style={styles.locBadge}>
                    <Text style={styles.locText}>📍 {petData.location}</Text>
                  </View>
                )}
              </View>

              {petData.is_lost ? (
                <View style={styles.lostDetails}>
                  {/* დეტალების გრიდი: სქესი, ფერი, წონა */}
                  <View style={styles.grid}>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>სქესი</Text>
                      <Text style={styles.gridVal}>{petData.sex || '-'}</Text>
                    </View>
                    <View style={[styles.gridItem, styles.gridBorder]}>
                      <Text style={styles.gridLabel}>ფერი</Text>
                      <Text style={styles.gridVal}>{petData.color || '-'}</Text>
                    </View>
                    <View style={[styles.gridItem, styles.gridBorder]}>
                      <Text style={styles.gridLabel}>წონა</Text>
                      <Text style={styles.gridVal}>{petData.weight || '-'}</Text>
                    </View>
                  </View>

                  {petData.description && (
                    <View style={styles.descBox}>
                      <Text style={styles.descText}>"{petData.description}"</Text>
                    </View>
                  )}

                  <TouchableOpacity style={styles.callBtn} onPress={() => makeCall(petData.profiles?.phone_number)} activeOpacity={0.8}>
                    <Text style={styles.callBtnText}>📞 დარეკვა პატრონთან</Text>
                    <Text style={styles.ownerNameText}>{petData.profiles?.full_name}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.safeBox}>
                   <Text style={styles.safeText}>🛡️ ძაღლი უსაფრთხოდაა. დამატებითი ინფორმაცია დაცულია.</Text>
                </View>
              )}
              
              <TouchableOpacity onPress={() => setPetData(null)} style={styles.backBtn} activeOpacity={0.7}>
                <Text style={styles.backBtnText}>უკან დაბრუნება</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ==========================================
             დაკარგული ძაღლების ლენტა
             ========================================== */
          <View>
            <Text style={styles.feedTitle}>🚨 ამჟამად იძებნებიან:</Text>
            {lostPets.length === 0 ? (
              <View style={styles.emptyFeed}>
                <Text style={{fontSize: 40, marginBottom: 10}}>✨</Text>
                <Text style={styles.emptyFeedText}>ამჟამად ყველა ძაღლი უსაფრთხოდაა</Text>
              </View>
            ) : (
              lostPets.map((pet) => (
                <TouchableOpacity 
                  key={pet.id} 
                  style={styles.miniCard} 
                  onPress={() => setPetData(pet)} 
                  activeOpacity={0.9}
                >
                  <Image source={{ uri: pet.photo_url }} style={styles.miniImg} />
                  <View style={styles.miniInfo}>
                    <View style={styles.rowBetween}>
                       <Text style={styles.miniName} numberOfLines={1}>{pet.name}</Text>
                       {pet.location && <Text style={styles.miniLoc}>📍 {pet.location}</Text>}
                    </View>
                    
                    <Text style={styles.miniBreed} numberOfLines={1}>
                      {pet.sex ? `${pet.sex} • ` : ''}{pet.breed}
                    </Text>
                    
                    <View style={styles.miniBottomRow}>
                      <View style={styles.miniIdBadge}>
                        <Text style={styles.miniCode}>ID: {pet.short_code}</Text>
                      </View>
                      <View style={styles.miniCall}>
                        <Text style={styles.miniCallText}>სრულად ნახვა</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Zoom Modal */}
      <Modal visible={isZoomVisible} transparent={true} animationType="fade">
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

// ==========================================
// სტილები (Modern UI)
// ==========================================
const styles = StyleSheet.create({
  header: { 
    paddingVertical: 18, 
    backgroundColor: '#fff', 
    alignItems: 'center', 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 3
  },
  mainTitle: { fontSize: 26, fontWeight: '800', color: '#2e8b57', letterSpacing: 0.5 },
  refreshHint: { fontSize: 12, color: '#888', marginTop: 4, fontWeight: '600' },
  
  scrollContainer: { padding: 20, paddingBottom: 80 },
  
  searchBox: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 8, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 15,
    elevation: 4, 
    marginBottom: 30 
  },
  input: { flex: 1, paddingHorizontal: 16, fontSize: 16, fontWeight: '700', color: '#333', letterSpacing: 1 },
  searchBtn: { backgroundColor: '#2e8b57', paddingHorizontal: 28, paddingVertical: 16, borderRadius: 16, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  // დიდი ბარათი (ძიებისას)
  resultCard: { backgroundColor: '#fff', borderRadius: 32, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 25, elevation: 8 },
  petImage: { width: '100%', height: 320, resizeMode: 'cover' },
  statusBadge: { position: 'absolute', top: 20, right: 20, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  statusText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  
  content: { padding: 25 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  petName: { fontSize: 30, fontWeight: '800', color: '#1a1a1a' },
  petBreed: { fontSize: 15, color: '#666', marginTop: 6, fontWeight: '600' },
  locBadge: { backgroundColor: '#f0f7ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  locText: { fontSize: 12, fontWeight: '800', color: '#0066cc' },
  
  lostDetails: { borderTopWidth: 1.5, borderTopColor: '#f4f5f7', paddingTop: 25, marginTop: 5 },
  grid: { flexDirection: 'row', backgroundColor: '#fff5f5', borderRadius: 20, padding: 18, marginBottom: 20 },
  gridItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gridBorder: { borderLeftWidth: 1.5, borderLeftColor: '#fce8e8' },
  gridLabel: { fontSize: 12, color: '#888', marginBottom: 6, fontWeight: '700' },
  gridVal: { fontWeight: '800', fontSize: 15, color: '#222' },
  
  descBox: { backgroundColor: '#f8f9fa', padding: 18, borderRadius: 20, marginBottom: 25 },
  descText: { fontStyle: 'italic', color: '#555', textAlign: 'center', lineHeight: 22, fontSize: 14 },
  
  callBtn: { backgroundColor: '#ff4d4d', padding: 20, borderRadius: 20, alignItems: 'center', shadowColor: '#ff4d4d', shadowOpacity: 0.3, shadowRadius: 15, elevation: 5 },
  callBtnText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  ownerNameText: { color: '#fff', fontSize: 13, opacity: 0.9, marginTop: 6, fontWeight: '600' },

  safeBox: { backgroundColor: '#eefcf5', padding: 25, borderRadius: 20, alignItems: 'center', marginTop: 10 },
  safeText: { fontSize: 14, color: '#2e8b57', textAlign: 'center', fontWeight: '700', lineHeight: 22 },
  
  backBtn: { marginTop: 25, padding: 16, alignItems: 'center', backgroundColor: '#f4f6f9', borderRadius: 16 },
  backBtnText: { color: '#555', fontWeight: '800', fontSize: 15 },

  // დაკარგულების ლენტა
  feedTitle: { fontSize: 22, fontWeight: '800', marginBottom: 18, color: '#1a1a1a', paddingLeft: 5 },
  miniCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 24, padding: 14, marginBottom: 18, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 15, elevation: 3 },
  miniImg: { width: 110, height: 110, borderRadius: 18, backgroundColor: '#f0f0f0' },
  miniInfo: { flex: 1, marginLeft: 16, justifyContent: 'space-between', paddingVertical: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  miniName: { fontSize: 19, fontWeight: '800', color: '#1a1a1a', flex: 1 },
  miniLoc: { fontSize: 11, color: '#ff4d4d', fontWeight: '800', marginLeft: 10 },
  miniBreed: { fontSize: 13, color: '#666', fontWeight: '600', marginTop: 4 },
  
  miniBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  miniIdBadge: { backgroundColor: '#eefcf5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  miniCode: { color: '#2e8b57', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  miniCall: { backgroundColor: '#f8f9fa', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  miniCallText: { color: '#555', fontSize: 12, fontWeight: '800' },
  
  emptyFeed: { padding: 50, alignItems: 'center', backgroundColor: '#fff', borderRadius: 28, marginTop: 10, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 10, elevation: 2 },
  emptyFeedText: { color: '#888', fontSize: 15, fontWeight: '700' },

  // Zoom Modal
  zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  fullImage: { width: width, height: height * 0.8 },
  closeZoom: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, right: 20, paddingHorizontal: 16, paddingVertical: 12, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20 },
  closeZoomText: { color: '#fff', fontWeight: 'bold', fontSize: 15 }
});