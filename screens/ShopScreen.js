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
import {
  createShopOrder,
  fetchPublicShopProducts,
  formatProductPrice,
} from '../lib/shopService';

const emptyOrder = {
  buyer_name: '',
  phone: '',
  quantity: '1',
  note: '',
};

function StatPill({ icon, label, value, dark = false }) {
  return (
    <View style={[styles.statPill, dark && styles.statPillDark]}>
      <Ionicons
        name={icon}
        size={18}
        color={dark ? '#d7f5e4' : '#1f8b56'}
        style={{ marginRight: 8 }}
      />
      <View>
        <Text style={[styles.statPillValue, dark && styles.statPillValueDark]}>{value}</Text>
        <Text style={[styles.statPillLabel, dark && styles.statPillLabelDark]}>{label}</Text>
      </View>
    </View>
  );
}

function BenefitChip({ icon, text }) {
  return (
    <View style={styles.benefitChip}>
      <Ionicons name={icon} size={16} color="#16352c" />
      <Text style={styles.benefitChipText}>{text}</Text>
    </View>
  );
}

function InputBlock({ label, value, onChangeText, style, ...props }) {
  return (
    <View style={styles.inputBlock}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, style]}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="#8b9a95"
        {...props}
      />
    </View>
  );
}

function ProductCard({ item, onPress }) {
  const priceLabel = formatProductPrice(item);

  return (
    <TouchableOpacity style={styles.productCard} onPress={() => onPress(item)} activeOpacity={0.92}>
      <View style={styles.productImageWrap}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.productImage} />
        ) : (
          <View style={[styles.productImage, styles.productImageFallback]}>
            <Ionicons name="bag-handle-outline" size={38} color="#5d746b" />
            <Text style={styles.productImageFallbackText}>პროდუქტის ფოტო</Text>
          </View>
        )}

        <View style={styles.imageOverlay} />

        <View style={styles.imageTopRow}>
          <View style={styles.stockBadge}>
            <Ionicons name="flash" size={12} color="#16352c" />
            <Text style={styles.stockBadgeText} numberOfLines={1}>
              ონლაინ
            </Text>
          </View>

          <View style={styles.priceBadge}>
            <Text style={styles.priceBadgeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {priceLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.productBody}>
        <Text style={styles.productTitle} numberOfLines={2}>
          {item.title}
        </Text>

        <Text style={styles.productDescription} numberOfLines={3}>
          {item.description || 'აღწერა მალე დაემატება.'}
        </Text>

        <View style={styles.productMetaRow}>
          <View style={styles.productMetaChip}>
            <Ionicons name="cube-outline" size={14} color="#2e8b57" />
            <Text style={styles.productMetaChipText}>მიწოდება შეთანხმებით</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.cardFooterAction}>
            <Text style={styles.cardFooterText}>დეტალურად ნახვა</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ShopScreen({ session, profile }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [orderFormExpanded, setOrderFormExpanded] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderForm, setOrderForm] = useState(emptyOrder);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts(withRefresh = false) {
    if (withRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { data, error } = await fetchPublicShopProducts();

    if (error) {
      Alert.alert('მაღაზია', error.message);
    } else {
      setProducts(data || []);
    }

    setLoading(false);
    setRefreshing(false);
  }

  function openProduct(product) {
    setSelectedProduct(product);
    setOrderFormExpanded(false);
    setOrderForm({
      buyer_name: profile?.full_name || '',
      phone: profile?.phone_number || '',
      quantity: '1',
      note: '',
    });
    setDetailVisible(true);
  }

  function closeModal() {
    setDetailVisible(false);
    setSelectedProduct(null);
    setOrderFormExpanded(false);
    setOrderForm(emptyOrder);
  }

  async function submitOrder() {
    if (!selectedProduct) {
      return;
    }

    if (!orderForm.buyer_name.trim()) {
      return Alert.alert('შეკვეთა', 'სახელი და გვარი სავალდებულოა.');
    }

    if (!orderForm.phone.trim()) {
      return Alert.alert('შეკვეთა', 'ტელეფონის ნომერი სავალდებულოა.');
    }

    const quantity = Number(orderForm.quantity);

    if (!Number.isInteger(quantity) || quantity < 1) {
      return Alert.alert('შეკვეთა', 'რაოდენობა უნდა იყოს მინიმუმ 1.');
    }

    setSavingOrder(true);

    const { error } = await createShopOrder({
      product_id: selectedProduct.id,
      buyer_id: session?.user?.id ?? null,
      buyer_name: orderForm.buyer_name,
      phone: orderForm.phone,
      quantity,
      note: orderForm.note,
      product_title: selectedProduct.title,
      product_price: selectedProduct.price_value,
    });

    setSavingOrder(false);

    if (error) {
      Alert.alert('შეკვეთა ვერ გაიგზავნა', error.message);
      return;
    }

    closeModal();
    Alert.alert('შეკვეთა მიღებულია', 'შენს შეკვეთას მივიღებთ და მალე დაგიკავშირდებით.');
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
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadProducts(true)}
            colors={['#2e8b57']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowSecondary} />

          <View style={styles.heroHeaderRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>PET ID STORE</Text>
              <Text style={styles.heroTitle}>მაღაზია</Text>
              <Text style={styles.heroText}>

              </Text>
            </View>

            <View style={styles.heroIconWrap}>
              <Ionicons name="bag-check-outline" size={34} color="#fff" />
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <StatPill icon="pricetags-outline" label="პროდუქტი" value={String(products.length)} dark />
            <StatPill icon="grid-outline" label="განლაგება" value="2 x 2" dark />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.benefitsRow}
        >
          <BenefitChip icon="flash-outline" text="სწრაფი შეკვეთა" />
          <BenefitChip icon="expand-outline" text="დიდი დეტალები" />
          <BenefitChip icon="call-outline" text="დაკავშირება ტელეფონით" />
          <BenefitChip icon="shield-checkmark-outline" text="მარტივი ფორმა" />
        </ScrollView>

        {!products.length ? (
          <View style={styles.emptyCard}>
            <Ionicons name="bag-remove-outline" size={38} color="#5e726b" />
            <Text style={styles.emptyTitle}>პროდუქტები ჯერ დამატებული არ არის</Text>
            <Text style={styles.emptyText}>
              როგორც კი მაღაზიაში ახალი პროდუქტი დაემატება, ის აქ ავტომატურად გამოჩნდება.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>ყველა პროდუქტი</Text>
                <Text style={styles.sectionSubtitle}>

                </Text>
              </View>
            </View>

            <View style={styles.productsGrid}>
              {products.map((item) => (
                <ProductCard key={item.id} item={item} onPress={openProduct} />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={detailVisible} animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalSafe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>
                {orderFormExpanded ? 'შეკვეთის ფორმა' : 'პროდუქტის დეტალები'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {orderFormExpanded
                  ? 'შეავსე მონაცემები და გააგზავნე შეკვეთა'
                  : 'პროდუქტი გახსნილია დიდ ფანჯარაში'}
              </Text>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={closeModal} activeOpacity={0.8}>
              <Ionicons name="close" size={20} color="#16352c" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {selectedProduct ? (
              <View style={styles.modalProductCard}>
                {selectedProduct.image_url ? (
                  <Image source={{ uri: selectedProduct.image_url }} style={styles.modalProductImage} />
                ) : (
                  <View style={[styles.modalProductImage, styles.productImageFallback]}>
                    <Ionicons name="image-outline" size={36} color="#5f746d" />
                  </View>
                )}

                <View style={styles.modalProductInfo}>
                  <Text style={styles.modalProductTitle}>{selectedProduct.title}</Text>
                  <Text style={styles.modalProductPrice}>{formatProductPrice(selectedProduct)}</Text>
                  <Text style={styles.modalProductHint}>
                    {selectedProduct.description || 'პროდუქტის აღწერა მალე დაემატება.'}
                  </Text>
                </View>

                <View style={styles.modalProductMetaRow}>
                  <View style={styles.productMetaChip}>
                    <Ionicons name="cube-outline" size={14} color="#2e8b57" />
                    <Text style={styles.productMetaChipText}>მიწოდება შეთანხმებით</Text>
                  </View>
                  <View style={styles.productMetaChip}>
                    <Ionicons name="chatbubble-ellipses-outline" size={14} color="#2e8b57" />
                    <Text style={styles.productMetaChipText}>შეკვეთა აპიდან</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {!orderFormExpanded ? (
              <>
                <View style={styles.submitNote}>
                  <Ionicons name="information-circle-outline" size={18} color="#3056d3" />
                  <Text style={styles.submitNoteText}>
                    თუ ამ პროდუქტის შეკვეთა გინდა, დააჭირე ქვემოთ ღილაკს და გაიხსნება ფორმა.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={() => setOrderFormExpanded(true)}
                  activeOpacity={0.88}
                >
                  <Text style={styles.submitButtonText}>შეკვეთის დაწყება</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <InputBlock
                  label="სახელი და გვარი"
                  value={orderForm.buyer_name}
                  onChangeText={(value) =>
                    setOrderForm((current) => ({ ...current, buyer_name: value }))
                  }
                  placeholder="მაგ: გიორგი მიშველიძე"
                />

                <InputBlock
                  label="ტელეფონი"
                  value={orderForm.phone}
                  onChangeText={(value) =>
                    setOrderForm((current) => ({ ...current, phone: value }))
                  }
                  placeholder="599 00 00 00"
                  keyboardType="phone-pad"
                />

                <InputBlock
                  label="რაოდენობა"
                  value={orderForm.quantity}
                  onChangeText={(value) =>
                    setOrderForm((current) => ({
                      ...current,
                      quantity: value.replace(/[^0-9]/g, ''),
                    }))
                  }
                  placeholder="1"
                  keyboardType="number-pad"
                />

                <InputBlock
                  label="დამატებითი კომენტარი"
                  value={orderForm.note}
                  onChangeText={(value) =>
                    setOrderForm((current) => ({ ...current, note: value }))
                  }
                  placeholder="მაგ: მომწერეთ ვოთსაფზე ან დამირეკეთ საღამოს"
                  multiline
                  style={styles.noteInput}
                />

                <View style={styles.submitNote}>
                  <Ionicons name="information-circle-outline" size={18} color="#3056d3" />
                  <Text style={styles.submitNoteText}>
                    შეკვეთის გაგზავნის შემდეგ გუნდი დაგიკავშირდება დეტალების დასაზუსტებლად.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={submitOrder}
                  disabled={savingOrder}
                  activeOpacity={0.88}
                >
                  <Text style={styles.submitButtonText}>
                    {savingOrder ? 'იგზავნება...' : 'შეკვეთის გაგზავნა'}
                  </Text>
                  <Ionicons name="paper-plane-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f3f6f4',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 18,
    paddingBottom: 120,
  },
  heroCard: {
    backgroundColor: '#16352c',
    borderRadius: 30,
    padding: 22,
    marginBottom: 16,
    overflow: 'hidden',
  },
  heroGlowPrimary: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(95, 212, 157, 0.14)',
    top: -60,
    right: -30,
  },
  heroGlowSecondary: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    bottom: -50,
    left: -20,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroCopy: {
    flex: 1,
    paddingRight: 16,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#9fd8bf',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fff',
  },
  heroText: {
    marginTop: 10,
    color: '#d7e7df',
    lineHeight: 22,
    fontSize: 15,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroStatsRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    marginRight: 10,
  },
  statPillDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  statPillValue: {
    fontSize: 18,
    color: '#16352c',
    fontWeight: '900',
  },
  statPillValueDark: {
    color: '#fff',
  },
  statPillLabel: {
    fontSize: 12,
    color: '#5e726b',
    marginTop: 2,
    fontWeight: '700',
  },
  statPillLabelDark: {
    color: '#d7e7df',
  },
  benefitsRow: {
    paddingBottom: 10,
  },
  benefitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    marginRight: 10,
  },
  benefitChipText: {
    marginLeft: 8,
    color: '#16352c',
    fontWeight: '700',
  },
  sectionHeader: {
    marginTop: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#16352c',
  },
  sectionSubtitle: {
    color: '#6a7e76',
    marginTop: 4,
    lineHeight: 19,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 30,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#16352c',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: '#5e726b',
    lineHeight: 21,
    textAlign: 'center',
  },
  productCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  productImageWrap: {
    height: 168,
    backgroundColor: '#dbe4df',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productImageFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#dfe8e4',
  },
  productImageFallbackText: {
    marginTop: 10,
    color: '#5d746b',
    fontWeight: '700',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 28, 22, 0.12)',
  },
  imageTopRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#effff7',
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    minWidth: 76,
  },
  stockBadgeText: {
    marginLeft: 6,
    color: '#16352c',
    fontWeight: '800',
    fontSize: 12,
  },
  priceBadge: {
    backgroundColor: '#16352c',
    minWidth: 82,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 16,
    marginLeft: 10,
  },
  priceBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    includeFontPadding: false,
  },
  productBody: {
    padding: 14,
  },
  productTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#16352c',
    minHeight: 42,
  },
  productDescription: {
    marginTop: 8,
    color: '#60736c',
    lineHeight: 19,
    minHeight: 58,
  },
  productMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    marginBottom: 4,
  },
  productMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef7f2',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  productMetaChipText: {
    marginLeft: 6,
    color: '#246949',
    fontSize: 12,
    fontWeight: '700',
  },
  cardFooter: {
    marginTop: 4,
  },
  cardFooterAction: {
    backgroundColor: '#1f8b56',
    borderRadius: 18,
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooterText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    marginRight: 8,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: '#f4f7f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 62 : 26,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e7eeea',
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#16352c',
  },
  modalSubtitle: {
    marginTop: 5,
    color: '#6d8079',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#edf3ef',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  modalContent: {
    padding: 20,
    paddingBottom: 60,
  },
  modalProductCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
  },
  modalProductImage: {
    width: '100%',
    height: 260,
    borderRadius: 22,
    backgroundColor: '#dfe8e4',
  },
  modalProductInfo: {
    marginTop: 16,
  },
  modalProductTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#16352c',
  },
  modalProductPrice: {
    marginTop: 6,
    color: '#2e8b57',
    fontWeight: '800',
    fontSize: 17,
  },
  modalProductHint: {
    marginTop: 10,
    color: '#72867f',
    lineHeight: 21,
  },
  modalProductMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  inputBlock: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#50645d',
    marginBottom: 8,
    marginLeft: 2,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: '#e5ece8',
    fontSize: 15,
    color: '#16352c',
  },
  noteInput: {
    minHeight: 112,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  submitNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eef4ff',
    borderRadius: 18,
    padding: 14,
    marginTop: 4,
    marginBottom: 18,
  },
  submitNoteText: {
    flex: 1,
    marginLeft: 10,
    color: '#4b648f',
    lineHeight: 20,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#16352c',
    borderRadius: 20,
    paddingVertical: 17,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    marginRight: 8,
  },
});
