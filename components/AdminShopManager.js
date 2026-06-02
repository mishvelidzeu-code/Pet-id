import React, { useEffect, useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { uploadImageAsset } from '../lib/storage';
import {
  deleteShopProduct,
  fetchAdminShopOrders,
  fetchAdminShopProducts,
  formatOrderStatus,
  formatProductPrice,
  saveShopProduct,
  SHOP_ORDER_STATUSES,
  updateShopOrderStatus,
} from '../lib/shopService';

const emptyProduct = () => ({
  title: '',
  description: '',
  price_value: '',
  currency: 'GEL',
  imageAsset: null,
  image_url: '',
  is_active: true,
});

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

export default function AdminShopManager({ visible }) {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(emptyProduct());

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  async function loadData(withRefresh = false) {
    if (withRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const [productsResult, ordersResult] = await Promise.all([
      fetchAdminShopProducts(),
      fetchAdminShopOrders(),
    ]);

    if (productsResult.error) {
      Alert.alert('მაღაზიის მართვა', productsResult.error.message);
    } else {
      setProducts(productsResult.data || []);
    }

    if (ordersResult.error) {
      Alert.alert('შეკვეთები', ordersResult.error.message);
    } else {
      setOrders(ordersResult.data || []);
    }

    setLoading(false);
    setRefreshing(false);
  }

  function openCreate() {
    setEditingProduct(null);
    setProductForm(emptyProduct());
    setFormVisible(true);
  }

  function openEdit(item) {
    setEditingProduct(item);
    setProductForm({
      title: item.title || '',
      description: item.description || '',
      price_value:
        item.price_value === null || item.price_value === undefined
          ? ''
          : String(item.price_value),
      currency: item.currency || 'GEL',
      imageAsset: null,
      image_url: item.image_url || '',
      is_active: item.is_active !== false,
    });
    setFormVisible(true);
  }

  function closeForm() {
    setFormVisible(false);
    setEditingProduct(null);
    setProductForm(emptyProduct());
  }

  async function attachImage() {
    try {
      const asset = await pickImage();
      if (!asset) return;
      setProductForm((current) => ({ ...current, imageAsset: asset }));
    } catch (error) {
      Alert.alert('სურათი', error.message);
    }
  }

  async function persistProduct() {
    if (!productForm.title.trim()) {
      return Alert.alert('პროდუქტი', 'სათაური სავალდებულოა.');
    }

    setSaving(true);

    try {
      const imageUrl = productForm.imageAsset
        ? await uploadImageAsset(productForm.imageAsset, {
            folder: 'admin/shop',
            prefix: 'shop_product',
          })
        : productForm.image_url || null;

      const result = await saveShopProduct(
        {
          title: productForm.title,
          description: productForm.description,
          price_value: productForm.price_value,
          currency: productForm.currency,
          image_url: imageUrl,
          is_active: productForm.is_active,
        },
        editingProduct?.id || null
      );

      if (result.error) {
        throw result.error;
      }

      await loadData(true);
      closeForm();
    } catch (error) {
      Alert.alert('პროდუქტი ვერ შეინახა', error.message);
    } finally {
      setSaving(false);
    }
  }

  function removeProduct(id) {
    Alert.alert('პროდუქტის წაშლა', 'ნამდვილად გინდა ამ პროდუქტის წაშლა?', [
      { text: 'არა', style: 'cancel' },
      {
        text: 'დიახ',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteShopProduct(id);

          if (result.error) {
            return Alert.alert('პროდუქტი', result.error.message);
          }

          await loadData(true);
        },
      },
    ]);
  }

  async function setOrderStatus(orderId, status) {
    const result = await updateShopOrderStatus(orderId, status);

    if (result.error) {
      Alert.alert('შეკვეთის სტატუსი', result.error.message);
      return;
    }

    await loadData(true);
  }

  if (!visible) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2e8b57" />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.sectionCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.sectionTitle}>პროდუქტები</Text>
            <Text style={styles.sectionSubtitle}>
              დაამატე, შეცვალე და დამალე მაღაზიის ნივთები.
            </Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={openCreate}>
            <Text style={styles.primaryButtonText}>პროდუქტის დამატება</Text>
          </TouchableOpacity>
        </View>

        {refreshing ? <Text style={styles.refreshText}>განახლება...</Text> : null}

        {!products.length ? (
          <Text style={styles.emptyText}>პროდუქტები ჯერ არ არის.</Text>
        ) : (
          products.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]}>
                  <Text style={styles.imagePlaceholderText}>ფოტო</Text>
                </View>
              )}

              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemMeta}>{formatProductPrice(item)}</Text>
                <Text style={styles.itemDescription} numberOfLines={3}>
                  {item.description || 'აღწერა არ არის მითითებული.'}
                </Text>
                <Text style={styles.itemMeta}>
                  {item.is_active ? 'აქტიურია' : 'დამალულია'}
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => openEdit(item)}
                >
                  <Text style={styles.secondaryButtonText}>რედაქტირება</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeProduct(item.id)}
                >
                  <Text style={styles.deleteButtonText}>წაშლა</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>შეკვეთები</Text>
        <Text style={styles.sectionSubtitle}>
          აქ გამოჩნდება მომხმარებლის ყველა მოთხოვნა.
        </Text>

        {!orders.length ? (
          <Text style={styles.emptyText}>შეკვეთები ჯერ არ არის.</Text>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <Text style={styles.orderTitle}>
                {order.product_title || 'პროდუქტი'}
              </Text>
              <Text style={styles.orderMeta}>
                მყიდველი: {order.buyer_name || 'უცნობი'}
              </Text>
              <Text style={styles.orderMeta}>ტელეფონი: {order.phone || '-'}</Text>
              <Text style={styles.orderMeta}>რაოდენობა: {order.quantity || 1}</Text>
              <Text style={styles.orderMeta}>
                სტატუსი: {formatOrderStatus(order.status)}
              </Text>
              {order.note ? (
                <Text style={styles.orderNote}>შენიშვნა: {order.note}</Text>
              ) : null}

              <View style={styles.statusGrid}>
                {SHOP_ORDER_STATUSES.map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusChip,
                      order.status === status && styles.statusChipActive,
                    ]}
                    onPress={() => setOrderStatus(order.id, status)}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        order.status === status && styles.statusChipTextActive,
                      ]}
                    >
                      {formatOrderStatus(status)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        )}
      </View>

      <Modal visible={formVisible} animationType="slide" onRequestClose={closeForm}>
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingProduct ? 'პროდუქტის რედაქტირება' : 'პროდუქტის დამატება'}
            </Text>
            <TouchableOpacity onPress={closeForm}>
              <Text style={styles.closeText}>დახურვა</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <TouchableOpacity style={styles.imagePicker} onPress={attachImage}>
              {productForm.imageAsset?.uri || productForm.image_url ? (
                <Image
                  source={{
                    uri: productForm.imageAsset?.uri || productForm.image_url,
                  }}
                  style={styles.imagePickerImage}
                />
              ) : (
                <Text style={styles.imagePickerText}>ფოტოს ატვირთვა</Text>
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="პროდუქტის სათაური"
              value={productForm.title}
              onChangeText={(value) =>
                setProductForm((current) => ({ ...current, title: value }))
              }
              placeholderTextColor="#8ea19a"
            />

            <TextInput
              style={styles.input}
              placeholder="ფასი"
              value={productForm.price_value}
              onChangeText={(value) =>
                setProductForm((current) => ({
                  ...current,
                  price_value: value.replace(/[^0-9.]/g, ''),
                }))
              }
              keyboardType="numbers-and-punctuation"
              placeholderTextColor="#8ea19a"
            />

            <View style={styles.currencyRow}>
              <TouchableOpacity
                style={[
                  styles.currencyButton,
                  productForm.currency === 'GEL' && styles.currencyButtonActive,
                ]}
                onPress={() =>
                  setProductForm((current) => ({ ...current, currency: 'GEL' }))
                }
              >
                <Text
                  style={[
                    styles.currencyButtonText,
                    productForm.currency === 'GEL' &&
                      styles.currencyButtonTextActive,
                  ]}
                >
                  GEL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.currencyButton,
                  productForm.currency === 'USD' && styles.currencyButtonActive,
                ]}
                onPress={() =>
                  setProductForm((current) => ({ ...current, currency: 'USD' }))
                }
              >
                <Text
                  style={[
                    styles.currencyButtonText,
                    productForm.currency === 'USD' &&
                      styles.currencyButtonTextActive,
                  ]}
                >
                  USD
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="აღწერა"
              value={productForm.description}
              onChangeText={(value) =>
                setProductForm((current) => ({ ...current, description: value }))
              }
              multiline
              placeholderTextColor="#8ea19a"
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>აქტიური პროდუქტი</Text>
              <Switch
                value={productForm.is_active}
                onValueChange={(value) =>
                  setProductForm((current) => ({ ...current, is_active: value }))
                }
              />
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={persistProduct}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'ინახება...' : 'შენახვა'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#16352c',
  },
  sectionSubtitle: {
    color: '#6a7d76',
    marginTop: 4,
    maxWidth: 220,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: '#16352c',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    marginLeft: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  refreshText: {
    color: '#70837c',
    marginTop: 12,
  },
  emptyText: {
    color: '#70837c',
    textAlign: 'center',
    paddingVertical: 24,
    fontWeight: '700',
  },
  itemCard: {
    borderTopWidth: 1,
    borderTopColor: '#edf2ef',
    paddingTop: 14,
    marginTop: 14,
  },
  image: {
    width: '100%',
    height: 180,
    borderRadius: 20,
    backgroundColor: '#d9e3df',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: '#6a7d76',
    fontWeight: '800',
  },
  itemContent: {
    marginTop: 12,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#16352c',
  },
  itemMeta: {
    color: '#58706a',
    marginTop: 6,
    fontWeight: '600',
  },
  itemDescription: {
    color: '#6a7d76',
    marginTop: 8,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#eff5f2',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginRight: 8,
  },
  secondaryButtonText: {
    color: '#16352c',
    fontWeight: '700',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#fff0f0',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#cf4a4a',
    fontWeight: '800',
  },
  orderCard: {
    borderTopWidth: 1,
    borderTopColor: '#edf2ef',
    paddingTop: 14,
    marginTop: 14,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#16352c',
  },
  orderMeta: {
    color: '#5d726c',
    marginTop: 6,
  },
  orderNote: {
    color: '#38524a',
    marginTop: 8,
    lineHeight: 19,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  statusChip: {
    backgroundColor: '#f2f7f5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: 8,
    marginBottom: 8,
  },
  statusChipActive: {
    backgroundColor: '#16352c',
  },
  statusChipText: {
    color: '#49635b',
    fontSize: 12,
    fontWeight: '700',
  },
  statusChipTextActive: {
    color: '#fff',
  },
  modal: {
    flex: 1,
    backgroundColor: '#f3f6f5',
  },
  modalHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 58 : 24,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#16352c',
  },
  closeText: {
    color: '#2e8b57',
    fontWeight: '800',
  },
  modalContent: {
    padding: 16,
  },
  imagePicker: {
    height: 210,
    backgroundColor: '#dfe8e4',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 14,
  },
  imagePickerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePickerText: {
    color: '#5b6f68',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#16352c',
    marginBottom: 12,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  currencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  currencyButton: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  currencyButtonActive: {
    backgroundColor: '#16352c',
  },
  currencyButtonText: {
    color: '#50645d',
    fontWeight: '700',
  },
  currencyButtonTextActive: {
    color: '#fff',
  },
  switchRow: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchText: {
    color: '#16352c',
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#16352c',
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});
