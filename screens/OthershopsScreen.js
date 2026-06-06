import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import * as Location from 'expo-location';
import { fetchPublicZooShops } from '../lib/contentService';
import {
  createShopOrder,
  fetchPublicShopProducts,
  formatProductPrice,
} from '../lib/shopService';

const TEST_PRODUCTS = [
  {
    id: 'test-food-1',
    title: 'Premium საკვები პატარა ჯიშისთვის',
    description: 'სატესტო პროდუქტი. რეალურ პროდუქტებს მოგვიანებით ჩაანაცვლებ.',
    image_url: 'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/1.webp',
    price_value: 38,
    currency: 'GEL',
    isLocal: true,
  },
  {
    id: 'test-toy-1',
    title: 'სათამაშო ბურთი',
    description: 'რბილი და გამძლე სათამაშო ძაღლისთვის.',
    image_url: 'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/2.webp',
    price_value: 14,
    currency: 'GEL',
    isLocal: true,
  },
  {
    id: 'test-shampoo-1',
    title: 'შამპუნი მგრძნობიარე კანისთვის',
    description: 'სატესტო ჰიგიენის პროდუქტი.',
    image_url: 'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/3.webp',
    price_value: 22,
    currency: 'GEL',
    isLocal: true,
  },
  {
    id: 'test-collar-1',
    title: 'საყელური M ზომა',
    description: 'სატესტო აქსესუარი. ფერი და ზომა მოგვიანებით დაემატება.',
    image_url: 'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/4.webp',
    price_value: 18,
    currency: 'GEL',
    isLocal: true,
  },
  {
    id: 'test-medicine-1',
    title: 'ვიტამინები ბეწვისთვის',
    description: 'სატესტო წამლები და დანამატები ვეტთან შეთანხმებით.',
    image_url: 'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/1.webp',
    price_value: 32,
    currency: 'GEL',
    isLocal: true,
  },
  {
    id: 'test-treat-1',
    title: 'სასუსნავი ქათმით',
    description: 'სატესტო გემრიელი ჯილდო ვარჯიშისთვის.',
    image_url: 'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/2.webp',
    price_value: 12,
    currency: 'GEL',
    isLocal: true,
  },
  {
    id: 'test-bed-1',
    title: 'რბილი საწოლი S/M',
    description: 'სატესტო საწოლი სახლში კომფორტისთვის.',
    image_url: 'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/3.webp',
    price_value: 55,
    currency: 'GEL',
    isLocal: true,
  },
  {
    id: 'test-bowl-1',
    title: 'ჯამი წყლისთვის',
    description: 'სატესტო ჯამი საკვებისა და წყლისთვის.',
    image_url: 'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/4.webp',
    price_value: 16,
    currency: 'GEL',
    isLocal: true,
  },
];

const emptyOrder = {
  buyer_name: '',
  phone: '',
  quantity: '1',
  note: '',
};

const PRODUCT_FILTERS = [
  { id: 'all', label: 'ყველა', icon: 'grid-outline' },
  { id: 'food', label: 'საკვები', icon: 'nutrition-outline' },
  { id: 'medicine', label: 'წამლები', icon: 'medical-outline' },
  { id: 'treats', label: 'სასუსნავი', icon: 'ribbon-outline' },
  { id: 'toys', label: 'სათამაშო', icon: 'tennisball-outline' },
  { id: 'care', label: 'ჰიგიენა', icon: 'sparkles-outline' },
  { id: 'accessories', label: 'აქსესუარი', icon: 'pricetag-outline' },
  { id: 'beds', label: 'საწოლი', icon: 'bed-outline' },
  { id: 'bowls', label: 'ჯამები', icon: 'restaurant-outline' },
];

function getProductCategory(product) {
  const storedCategory = String(product?.category || '').toLowerCase();
  if (PRODUCT_FILTERS.some((filter) => filter.id === storedCategory)) {
    return storedCategory;
  }

  const text = `${product?.title || ''} ${product?.description || ''}`.toLowerCase();

  if (text.includes('საკვ') || text.includes('food') || text.includes('premium')) return 'food';
  if (text.includes('წამ') || text.includes('ვიტამინ') || text.includes('დანამატ') || text.includes('medicine')) return 'medicine';
  if (text.includes('სასუსნ') || text.includes('ჯილდ') || text.includes('treat')) return 'treats';
  if (text.includes('სათამაშ') || text.includes('ბურთ') || text.includes('toy')) return 'toys';
  if (text.includes('შამპუნ') || text.includes('ჰიგიენ') || text.includes('მოვლ') || text.includes('care')) return 'care';
  if (text.includes('საყელ') || text.includes('აქსესუარ') || text.includes('accessor')) return 'accessories';
  if (text.includes('საწოლ') || text.includes('სახლ') || text.includes('bed')) return 'beds';
  if (text.includes('ჯამ') || text.includes('წყლ') || text.includes('bowl')) return 'bowls';

  return 'all';
}

function getProductImages(product) {
  if (Array.isArray(product?.image_urls) && product.image_urls.length) {
    return product.image_urls.filter(Boolean).slice(0, 3);
  }

  return product?.image_url ? [product.image_url] : [];
}

function getDistance(lat1, lon1, lat2, lon2) {
  const radius = 6371;
  const deltaLat = (lat2 - lat1) * (Math.PI / 180);
  const deltaLng = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
}

function formatDistance(value) {
  if (value == null) return null;
  if (value < 1) return `${Math.round(value * 1000)} მ`;
  return `${value.toFixed(1)} კმ`;
}

function ScreenHeader({ onBack }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={20} color="#16352c" />
        </TouchableOpacity>
      ) : null}
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>ზოომაღაზიები</Text>
        <Text style={styles.headerSubtitle}>
          აირჩიე მაღაზია, ნახე პროდუქცია და გაატარე სატესტო შეკვეთა.
        </Text>
      </View>
    </View>
  );
}

export default function OthershopsScreen({ onBack = null, session = null, profile = null }) {
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedShop, setSelectedShop] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [activeProductFilter, setActiveProductFilter] = useState('all');
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [orderForm, setOrderForm] = useState(emptyOrder);
  const [savingOrder, setSavingOrder] = useState(false);

  const visibleShops = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return shops;

    return shops.filter((shop) => {
      const shopName = String(shop.name || '').toLowerCase();
      const shopAddress = String(shop.address || '').toLowerCase();
      return shopName.includes(normalizedQuery) || shopAddress.includes(normalizedQuery);
    });
  }, [shops, searchQuery]);

  const displayProducts =
    products.length || selectedShop?.business_id ? products : TEST_PRODUCTS;
  const visibleProducts = useMemo(() => {
    const normalizedQuery = productSearchQuery.trim().toLowerCase();

    return displayProducts.filter((product) => {
      const categoryMatches =
        activeProductFilter === 'all' || getProductCategory(product) === activeProductFilter;
      const searchableText = `${product.title || ''} ${product.description || ''} ${product.category || ''}`.toLowerCase();
      const queryMatches = !normalizedQuery || searchableText.includes(normalizedQuery);

      return categoryMatches && queryMatches;
    });
  }, [activeProductFilter, displayProducts, productSearchQuery]);
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + (Number(item.product.price_value) || 0) * item.quantity,
    0
  );

  useEffect(() => {
    loadShops();
  }, []);

  async function loadShops(withRefresh = false) {
    if (withRefresh) setRefreshing(true);
    else setLoading(true);

    const { data } = await fetchPublicZooShops();
    let nextShops = data || [];

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        nextShops = nextShops
          .map((shop) => {
            if (shop.lat == null || shop.lng == null || Number.isNaN(shop.lat) || Number.isNaN(shop.lng)) {
              return shop;
            }

            return {
              ...shop,
              distance: getDistance(
                location.coords.latitude,
                location.coords.longitude,
                shop.lat,
                shop.lng
              ),
            };
          })
          .sort((a, b) => {
            if (a.distance == null) return 1;
            if (b.distance == null) return -1;
            return a.distance - b.distance;
          });
      }
    } catch (err) {
      console.log('Shop location error:', err);
    }

    setShops(nextShops);
    setLoading(false);
    setRefreshing(false);
  }

  async function loadProducts(businessId = null) {
    setProductsLoading(true);
    const { data, error } = await fetchPublicShopProducts(businessId);
    if (!error) setProducts(data || []);
    setProductsLoading(false);
  }

  function openMaps(shop) {
    const url =
      shop.google_maps_url ||
      `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('შეცდომა', 'რუკის გახსნა ვერ მოხერხდა.')
    );
  }

  function makeCall(phone) {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('შეცდომა', 'დარეკვა ვერ მოხერხდა.')
    );
  }

  function openWhatsApp(phone) {
    if (!phone) {
      Alert.alert('შეცდომა', 'WhatsApp ნომერი მითითებული არ არის.');
      return;
    }

    const normalizedPhone = String(phone).replace(/[^\d]/g, '');
    Linking.openURL(`https://wa.me/${normalizedPhone}`).catch(() =>
      Alert.alert('შეცდომა', 'WhatsApp-ის გახსნა ვერ მოხერხდა.')
    );
  }

  function openShop(shop) {
    setSelectedShop(shop);
    setProducts([]);
    setSearchQuery('');
    setProductSearchQuery('');
    setActiveProductFilter('all');
    loadProducts(shop.business_id || null);
  }

  function closeShop() {
    setSelectedShop(null);
    setProducts([]);
    setCartItems([]);
    setCheckoutVisible(false);
    setProductSearchQuery('');
    setActiveProductFilter('all');
  }

  function addToCart(product) {
    setCartItems((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [...current, { product, quantity: 1 }];
    });
  }

  function updateCartQuantity(productId, delta) {
    setCartItems((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(item.quantity + delta, 0) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId) {
    setCartItems((current) => current.filter((item) => item.product.id !== productId));
  }

  function openCheckout() {
    if (!cartItems.length) {
      Alert.alert('კალათა', 'ჯერ დაამატე პროდუქტი კალათაში.');
      return;
    }

    setOrderForm({
      ...emptyOrder,
      buyer_name: profile?.full_name || '',
      phone: profile?.phone_number || '',
    });
    setCheckoutVisible(true);
  }

  function closeCheckout() {
    setCheckoutVisible(false);
    setOrderForm(emptyOrder);
    setSavingOrder(false);
  }

  async function submitOrder() {
    if (!cartItems.length) return;

    if (!orderForm.buyer_name.trim()) {
      Alert.alert('შეკვეთა', 'შეიყვანე სახელი.');
      return;
    }

    if (!orderForm.phone.trim()) {
      Alert.alert('შეკვეთა', 'შეიყვანე ტელეფონის ნომერი.');
      return;
    }

    setSavingOrder(true);

    try {
      const localOnly = cartItems.every((item) => item.product.isLocal);
      if (localOnly) {
        await new Promise((resolve) => setTimeout(resolve, 650));
      } else {
        for (const item of cartItems) {
          if (item.product.isLocal) continue;

          const result = await createShopOrder({
            product_id: item.product.id,
            buyer_id: session?.user?.id || null,
            buyer_name: orderForm.buyer_name,
            phone: orderForm.phone,
            quantity: item.quantity,
            note: `${selectedShop?.name || 'Zoo shop'} • კალათა${orderForm.note ? ` • ${orderForm.note}` : ''}`,
            product_title: item.product.title,
            product_price: item.product.price_value,
          });

          if (result.error) throw result.error;
        }
      }

      Alert.alert(
        'სატესტო გადახდა მიღებულია',
        'შეკვეთის flow მუშაობს. რეალურ გადახდას მოგვიანებით ჩავანაცვლებთ ბანკის ან გადახდის პროვაიდერით.'
      );
      setCartItems([]);
      closeCheckout();
    } catch (error) {
      Alert.alert('შეკვეთა ვერ გაიგზავნა', error.message || 'სცადე თავიდან.');
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader onBack={selectedShop ? closeShop : onBack} />

      {!selectedShop ? (
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color="#6a7f76" />
          <TextInput
            style={styles.searchInput}
            placeholder="მოძებნე მაღაზია"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8ca097"
          />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2e8b57" />
        </View>
      ) : selectedShop ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.shopHero}>
            {selectedShop.image_url ? (
              <Image source={{ uri: selectedShop.image_url }} style={styles.shopHeroImage} />
            ) : (
              <View style={[styles.shopHeroImage, styles.shopHeroPlaceholder]}>
                <Ionicons name="cart-outline" size={42} color="#90a49c" />
              </View>
            )}
            <View style={styles.shopHeroBody}>
              <Text style={styles.shopHeroName}>{selectedShop.name}</Text>
              <Text style={styles.shopHeroAddress}>{selectedShop.address || 'მისამართი მალე დაემატება'}</Text>
              {selectedShop.working_hours ? (
                <View style={styles.shopHoursRow}>
                  <Ionicons name="time-outline" size={15} color="#2e8b57" />
                  <Text style={styles.shopHoursText}>{selectedShop.working_hours}</Text>
                </View>
              ) : null}
              <View style={styles.shopHeroActions}>
                {selectedShop.phone ? (
                  <TouchableOpacity style={styles.callButton} onPress={() => makeCall(selectedShop.phone)}>
                    <Ionicons name="call-outline" size={16} color="#2e8b57" />
                    <Text style={styles.callText}>დარეკვა</Text>
                  </TouchableOpacity>
                ) : null}
                {selectedShop.whatsapp ? (
                  <TouchableOpacity style={styles.whatsappButton} onPress={() => openWhatsApp(selectedShop.whatsapp)}>
                    <Ionicons name="logo-whatsapp" size={16} color="#128c7e" />
                    <Text style={styles.whatsappText}>WhatsApp</Text>
                  </TouchableOpacity>
                ) : null}
                {selectedShop.google_maps_url || (selectedShop.lat != null && selectedShop.lng != null) ? (
                  <TouchableOpacity style={styles.mapButton} onPress={() => openMaps(selectedShop)}>
                    <Ionicons name="navigate-outline" size={16} color="#0066cc" />
                    <Text style={styles.mapText}>მარშრუტი</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.productsHeader}>
            <View>
              <Text style={styles.productsTitle}>პროდუქცია</Text>
              <Text style={styles.productsSubtitle}>სატესტო პროდუქტებია. რეალურით მერე ჩაანაცვლებ.</Text>
            </View>
            {productsLoading ? <ActivityIndicator color="#2e8b57" /> : null}
          </View>

          <View style={styles.productSearchBox}>
            <Ionicons name="search-outline" size={18} color="#6a7f76" />
            <TextInput
              style={styles.productSearchInput}
              value={productSearchQuery}
              onChangeText={setProductSearchQuery}
              placeholder="მოძებნე პროდუქტი"
              placeholderTextColor="#8ca097"
            />
            {productSearchQuery ? (
              <TouchableOpacity onPress={() => setProductSearchQuery('')} style={styles.clearProductSearch}>
                <Ionicons name="close" size={16} color="#6a7f76" />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productFilterRow}
          >
            {PRODUCT_FILTERS.map((filter) => {
              const active = activeProductFilter === filter.id;

              return (
                <TouchableOpacity
                  key={filter.id}
                  style={[styles.productFilterChip, active && styles.productFilterChipActive]}
                  onPress={() => setActiveProductFilter(filter.id)}
                  activeOpacity={0.84}
                >
                  <Ionicons name={filter.icon} size={15} color={active ? '#ffffff' : '#2e8b57'} />
                  <Text style={[styles.productFilterText, active && styles.productFilterTextActive]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={styles.cartSummary} onPress={openCheckout} activeOpacity={0.88}>
            <View style={styles.cartSummaryIcon}>
              <Ionicons name="cart-outline" size={22} color="#ffffff" />
              {cartItemCount > 0 ? (
                <View style={styles.cartCountBadge}>
                  <Text style={styles.cartCountText}>{cartItemCount}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cartSummaryCopy}>
              <Text style={styles.cartSummaryTitle}>კალათა</Text>
              <Text style={styles.cartSummaryText}>
                {cartItemCount
                  ? `${cartItemCount} პროდუქტი • ${cartTotal.toFixed(2)} ₾`
                  : 'დაამატე პროდუქტები და გადაიხადე ერთად'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#16352c" />
          </TouchableOpacity>

          {visibleProducts.length ? (
          <View style={styles.productsGrid}>
            {visibleProducts.map((product) => {
              const productImages = getProductImages(product);

              return (
                <TouchableOpacity
                  key={product.id}
                  style={styles.productCard}
                  onPress={() => addToCart(product)}
                  activeOpacity={0.88}
                >
                  {productImages[0] ? (
                    <View>
                      <Image source={{ uri: productImages[0] }} style={styles.productImage} />
                      {productImages.length > 1 ? (
                        <View style={styles.productImageCount}>
                          <Ionicons name="images-outline" size={13} color="#ffffff" />
                          <Text style={styles.productImageCountText}>{productImages.length}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={[styles.productImage, styles.productImageFallback]}>
                      <Ionicons name="cube-outline" size={34} color="#8aa097" />
                    </View>
                  )}
                  <View style={styles.productBody}>
                    <Text style={styles.productTitle} numberOfLines={2}>{product.title}</Text>
                    <Text style={styles.productDescription} numberOfLines={2}>
                      {product.description || 'აღწერა მალე დაემატება.'}
                    </Text>
                    <View style={styles.productFooter}>
                      <Text style={styles.productPrice}>{formatProductPrice(product)}</Text>
                      <View style={styles.productBuyBadge}>
                        <Ionicons name="add" size={16} color="#ffffff" />
                      </View>
                    </View>
                    <Text style={styles.addToCartText}>კალათაში დამატება</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          ) : (
            <View style={styles.emptyProducts}>
              <Ionicons name="search-outline" size={30} color="#90a49c" />
              <Text style={styles.emptyProductsText}>პროდუქტი ვერ მოიძებნა</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadShops(true)} />
          }
        >
          {visibleShops.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {searchQuery.trim()
                  ? 'ასეთი მაღაზია ვერ მოიძებნა.'
                  : 'აქტიური ზოომაღაზიები ჯერ არ არის დამატებული.'}
              </Text>
            </View>
          ) : (
            visibleShops.map((shop, index) => (
              <TouchableOpacity key={shop.id} style={styles.card} onPress={() => openShop(shop)} activeOpacity={0.9}>
                <View style={styles.imageWrap}>
                  {shop.image_url ? (
                    <Image source={{ uri: shop.image_url }} style={styles.image} />
                  ) : (
                    <View style={[styles.image, styles.imagePlaceholder]}>
                      <Ionicons name="cart-outline" size={40} color="#90a49c" />
                    </View>
                  )}
                  {index === 0 && shop.distance != null ? (
                    <View style={styles.closestBadge}>
                      <Text style={styles.closestBadgeText}>ყველაზე ახლო</Text>
                    </View>
                  ) : null}
                  {shop.distance != null ? (
                    <View style={styles.distanceBadge}>
                      <Text style={styles.distanceText}>{formatDistance(shop.distance)}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.name}>{shop.name}</Text>
                  <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={16} color="#0066cc" />
                    <Text style={styles.address}>{shop.address}</Text>
                  </View>
                  {shop.working_hours ? (
                    <View style={styles.addressRow}>
                      <Ionicons name="time-outline" size={16} color="#2e8b57" />
                      <Text style={styles.address}>{shop.working_hours}</Text>
                    </View>
                  ) : null}
                  <View style={styles.actions}>
                    {shop.phone ? (
                      <TouchableOpacity style={styles.callButton} onPress={() => makeCall(shop.phone)} activeOpacity={0.8}>
                        <Ionicons name="call-outline" size={16} color="#2e8b57" />
                        <Text style={styles.callText}>დარეკვა</Text>
                      </TouchableOpacity>
                    ) : null}
                    {shop.whatsapp ? (
                      <TouchableOpacity style={styles.whatsappButton} onPress={() => openWhatsApp(shop.whatsapp)} activeOpacity={0.8}>
                        <Ionicons name="logo-whatsapp" size={16} color="#128c7e" />
                        <Text style={styles.whatsappText}>WhatsApp</Text>
                      </TouchableOpacity>
                    ) : null}
                    {shop.google_maps_url || (shop.lat != null && shop.lng != null) ? (
                      <TouchableOpacity style={styles.mapButton} onPress={() => openMaps(shop)} activeOpacity={0.8}>
                        <Ionicons name="navigate-outline" size={16} color="#0066cc" />
                        <Text style={styles.mapText}>მარშრუტი</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {selectedShop ? (
        <TouchableOpacity style={styles.floatingCartButton} onPress={openCheckout} activeOpacity={0.88}>
          <Ionicons name="cart-outline" size={26} color="#ffffff" />
          {cartItemCount > 0 ? (
            <View style={styles.floatingCartBadge}>
              <Text style={styles.floatingCartBadgeText}>{cartItemCount}</Text>
            </View>
          ) : null}
          {cartItemCount > 0 ? (
            <View style={styles.floatingCartTotal}>
              <Text style={styles.floatingCartTotalText}>{cartTotal.toFixed(0)} ₾</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ) : null}

      <Modal visible={checkoutVisible} transparent animationType="slide" onRequestClose={closeCheckout}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.checkoutSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.checkoutHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.checkoutEyebrow}>{selectedShop?.name || 'Zoo shop'}</Text>
                <Text style={styles.checkoutTitle}>სატესტო გადახდა</Text>
              </View>
              <TouchableOpacity style={styles.checkoutClose} onPress={closeCheckout}>
                <Ionicons name="close" size={20} color="#16352c" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.checkoutContent} keyboardShouldPersistTaps="handled">
              <View style={styles.checkoutCartList}>
                {cartItems.map((item) => (
                  <View key={item.product.id} style={styles.checkoutProduct}>
                    {item.product.image_url ? (
                      <Image source={{ uri: item.product.image_url }} style={styles.checkoutProductImage} />
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.checkoutProductTitle}>{item.product.title}</Text>
                      <Text style={styles.checkoutProductPrice}>{formatProductPrice(item.product)}</Text>
                      <View style={styles.lineQuantityRow}>
                        <TouchableOpacity
                          style={styles.lineQuantityButton}
                          onPress={() => updateCartQuantity(item.product.id, -1)}
                        >
                          <Ionicons name="remove" size={14} color="#16352c" />
                        </TouchableOpacity>
                        <Text style={styles.lineQuantityText}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={styles.lineQuantityButton}
                          onPress={() => updateCartQuantity(item.product.id, 1)}
                        >
                          <Ionicons name="add" size={14} color="#16352c" />
                        </TouchableOpacity>
                      </View>
                  </View>
                    <View style={styles.lineRightSide}>
                      <TouchableOpacity
                        style={styles.removeLineButton}
                        onPress={() => removeFromCart(item.product.id)}
                        activeOpacity={0.84}
                      >
                        <Ionicons name="close" size={15} color="#dc2626" />
                      </TouchableOpacity>
                      <Text style={styles.lineTotalText}>
                        {((Number(item.product.price_value) || 0) * item.quantity).toFixed(2)} ₾
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.inputLabel}>სახელი</Text>
              <TextInput
                style={styles.checkoutInput}
                value={orderForm.buyer_name}
                onChangeText={(value) => setOrderForm((current) => ({ ...current, buyer_name: value }))}
                placeholder="სახელი და გვარი"
                placeholderTextColor="#96a59f"
              />

              <Text style={styles.inputLabel}>ტელეფონი</Text>
              <TextInput
                style={styles.checkoutInput}
                value={orderForm.phone}
                onChangeText={(value) => setOrderForm((current) => ({ ...current, phone: value }))}
                placeholder="599 12 34 56"
                placeholderTextColor="#96a59f"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>შენიშვნა</Text>
              <TextInput
                style={[styles.checkoutInput, styles.noteInput]}
                value={orderForm.note}
                onChangeText={(value) => setOrderForm((current) => ({ ...current, note: value }))}
                placeholder="მაგ: მიწოდება საღამოს"
                placeholderTextColor="#96a59f"
                multiline
              />

              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>სულ</Text>
                <Text style={styles.totalValue}>
                  {cartTotal > 0 ? `${cartTotal.toFixed(2)} ₾` : 'ფასი შეთანხმებით'}
                </Text>
              </View>

              <TouchableOpacity style={styles.payButton} onPress={submitOrder} disabled={savingOrder} activeOpacity={0.88}>
                {savingOrder ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="card-outline" size={20} color="#ffffff" />
                    <Text style={styles.payButtonText}>გადახდაზე გადასვლა</Text>
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
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eef1ef',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#edf4ef',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#16352c' },
  headerSubtitle: { marginTop: 6, color: '#6a7f76', lineHeight: 19 },
  searchWrap: {
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 6,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e6ece8',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: '#16352c',
    fontSize: 15,
    fontWeight: '700',
  },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 18, paddingBottom: 84 },
  empty: { backgroundColor: '#fff', borderRadius: 24, padding: 30, alignItems: 'center' },
  emptyText: { color: '#687b74', fontWeight: '700', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  imageWrap: { height: 190, backgroundColor: '#dde6e2' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { backgroundColor: '#dde6e2', justifyContent: 'center', alignItems: 'center' },
  closestBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: '#ff5b5b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  closestBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  distanceBadge: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  distanceText: { color: '#16352c', fontWeight: '800', fontSize: 11 },
  cardBody: { padding: 18 },
  name: { fontSize: 22, fontWeight: '800', color: '#16352c' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
  address: { color: '#687b74', marginLeft: 8, lineHeight: 20, flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  callButton: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#e8f6ee',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  callText: { color: '#2e8b57', fontWeight: '800', marginLeft: 8 },
  whatsappButton: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#e7f8f1',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  whatsappText: { color: '#128c7e', fontWeight: '800', marginLeft: 8 },
  mapButton: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#eef5ff',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  mapText: { color: '#0066cc', fontWeight: '800', marginLeft: 8 },
  shopHero: {
    backgroundColor: '#fff',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#0f241d',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  shopHeroImage: { width: '100%', height: 210, resizeMode: 'cover', backgroundColor: '#dfe8e4' },
  shopHeroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  shopHeroBody: { padding: 18 },
  shopHeroName: { color: '#16352c', fontSize: 26, fontWeight: '900' },
  shopHeroAddress: { marginTop: 7, color: '#687b74', lineHeight: 20, fontWeight: '700' },
  shopHoursRow: { flexDirection: 'row', alignItems: 'center', marginTop: 9 },
  shopHoursText: { marginLeft: 7, color: '#2e8b57', fontWeight: '900', flex: 1 },
  shopHeroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productsTitle: { color: '#16352c', fontSize: 24, fontWeight: '900' },
  productsSubtitle: { marginTop: 4, color: '#6a7f76', fontWeight: '700', maxWidth: 260 },
  productSearchBox: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e6ece8',
    marginBottom: 10,
  },
  productSearchInput: {
    flex: 1,
    marginLeft: 10,
    color: '#16352c',
    fontSize: 15,
    fontWeight: '700',
  },
  clearProductSearch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eef4f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productFilterRow: {
    paddingRight: 18,
    paddingBottom: 12,
  },
  productFilterChip: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce9e2',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  productFilterChipActive: {
    backgroundColor: '#2e8b57',
    borderColor: '#2e8b57',
  },
  productFilterText: {
    marginLeft: 6,
    color: '#2e8b57',
    fontSize: 12,
    fontWeight: '900',
  },
  productFilterTextActive: {
    color: '#ffffff',
  },
  cartSummary: {
    display: 'none',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e3ebe6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartSummaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: '#16352c',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cartCountBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ff5b5b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  cartCountText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  cartSummaryCopy: { flex: 1, paddingRight: 10 },
  cartSummaryTitle: { color: '#16352c', fontSize: 17, fontWeight: '900' },
  cartSummaryText: { marginTop: 4, color: '#6a7f76', fontSize: 13, fontWeight: '700' },
  floatingCartButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 94 : 82,
    right: 18,
    zIndex: 20,
    width: 58,
    height: 58,
    borderRadius: 21,
    backgroundColor: '#16352c',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10231a',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 10,
  },
  floatingCartBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff5b5b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  floatingCartBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  floatingCartTotal: {
    position: 'absolute',
    right: 48,
    minWidth: 58,
    height: 32,
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    shadowColor: '#10231a',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  floatingCartTotalText: {
    color: '#16352c',
    fontSize: 12,
    fontWeight: '900',
  },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  emptyProducts: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8efeb',
  },
  emptyProductsText: {
    marginTop: 8,
    color: '#687b74',
    fontSize: 15,
    fontWeight: '900',
  },
  productCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e8efeb',
  },
  productImage: { width: '100%', height: 132, resizeMode: 'cover', backgroundColor: '#dfe8e4' },
  productImageCount: {
    position: 'absolute',
    right: 8,
    top: 8,
    minWidth: 34,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(22, 53, 44, 0.84)',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImageCountText: { marginLeft: 4, color: '#ffffff', fontSize: 12, fontWeight: '900' },
  productImageFallback: { alignItems: 'center', justifyContent: 'center' },
  productBody: { padding: 12 },
  productTitle: { color: '#16352c', fontSize: 15, fontWeight: '900', minHeight: 38 },
  productDescription: { marginTop: 6, color: '#687b74', fontSize: 12, lineHeight: 16, minHeight: 32 },
  productFooter: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: { color: '#2e8b57', fontSize: 14, fontWeight: '900' },
  productBuyBadge: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#16352c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartText: {
    marginTop: 9,
    color: '#16352c',
    fontSize: 12,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(9, 24, 19, 0.42)',
  },
  checkoutSheet: {
    maxHeight: '90%',
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
  checkoutHeader: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  checkoutEyebrow: { color: '#2e8b57', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  checkoutTitle: { marginTop: 5, color: '#16352c', fontSize: 24, fontWeight: '900' },
  checkoutClose: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#e9f0ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutContent: { paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 42 : 28 },
  checkoutCartList: { marginBottom: 8 },
  checkoutProduct: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e3ebe6',
  },
  checkoutProductImage: { width: 70, height: 70, borderRadius: 16, marginRight: 12 },
  checkoutProductTitle: { color: '#16352c', fontSize: 16, fontWeight: '900' },
  checkoutProductPrice: { marginTop: 5, color: '#2e8b57', fontWeight: '900' },
  lineQuantityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 9 },
  lineQuantityButton: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: '#e9f0ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineQuantityText: {
    minWidth: 28,
    textAlign: 'center',
    color: '#16352c',
    fontSize: 14,
    fontWeight: '900',
  },
  lineRightSide: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  removeLineButton: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  lineTotalText: {
    color: '#16352c',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },
  inputLabel: { color: '#526960', fontSize: 13, fontWeight: '900', marginBottom: 8, marginTop: 8 },
  checkoutInput: {
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
  quantityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  quantityButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#e9f0ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityInput: {
    flex: 1,
    height: 48,
    marginHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#fff',
    textAlign: 'center',
    color: '#16352c',
    fontSize: 16,
    fontWeight: '900',
  },
  noteInput: { minHeight: 84, textAlignVertical: 'top' },
  totalBox: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  totalLabel: { color: '#687b74', fontWeight: '900' },
  totalValue: { color: '#16352c', fontSize: 18, fontWeight: '900' },
  payButton: {
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: '#16352c',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  payButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', marginLeft: 8 },
});
