const SUPABASE_URL = 'https://qclzhlftlkjhgmuqrawk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uh0AkTmoH-tDL4epEywDKA_6Xxf-sF9';

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  user: null,
  isAdmin: false,
  businesses: [],
  activeBusinessId: null,
  products: [],
  services: [],
  orders: [],
  requests: [],
  assistantMessages: [],
  adminProducts: [],
  adminServices: [],
  adminOrders: [],
  adminRequests: [],
  adminPets: [],
  adminMedicalRecords: [],
  adminProfiles: [],
  adminPartnerKind: 'all',
  expandedAdminPets: [],
};

const $ = (id) => document.getElementById(id);

const views = [
  'dashboard',
  'profile',
  'products',
  'services',
  'orders',
  'requests',
  'assistant',
  'approvals',
  'admin-stats',
  'admin-partners',
  'admin-products',
  'admin-services',
  'admin-pets',
];
const pageTitles = {
  dashboard: 'დეშბორდი',
  profile: 'ბიზნეს პროფილი',
  products: 'პროდუქტები',
  services: 'სერვისები',
  orders: 'შეკვეთები',
  requests: 'მოთხოვნები',
  assistant: 'ასისტენტი',
  approvals: 'დადასტურება',
  'admin-stats': 'სტატისტიკა',
  'admin-partners': 'პარტნიორები',
  'admin-products': 'ყველა პროდუქტი',
  'admin-services': 'ყველა სერვისი',
  'admin-pets': 'ცხოველები',
};

const productCategoryLabels = {
  food: 'საკვები',
  medicine: 'წამლები',
  treats: 'სასუსნავი',
  toys: 'სათამაშო',
  care: 'ჰიგიენა / მოვლა',
  accessories: 'აქსესუარი',
  beds: 'საწოლი / სახლი',
  bowls: 'ჯამები',
};

function activeBusiness() {
  return state.businesses.find((item) => item.id === state.activeBusinessId) || null;
}

function showMessage(text, type = 'success') {
  const box = $('message');
  box.textContent = text;
  const messageType = type === true ? 'error' : type || 'success';
  box.classList.toggle('is-error', messageType === 'error');
  box.classList.toggle('is-warning', messageType === 'warning');
  box.classList.toggle('is-success', messageType === 'success');
  box.classList.remove('is-hidden');
  window.setTimeout(() => box.classList.add('is-hidden'), 4200);
}

function setBadge(id, value) {
  const badge = $(id);
  if (!badge) return;
  badge.textContent = value > 99 ? '99+' : String(value);
  badge.classList.toggle('is-hidden', !value);
}

function statusLabel(status) {
  const labels = {
    new: 'ახალი',
    confirmed: 'დადასტურებული',
    done: 'შესრულებული',
    cancelled: 'უარყოფილი',
    active: 'აქტიური',
    hidden: 'დამალული',
    approved: 'დადასტურებული',
    waiting: 'ელოდება',
  };
  return labels[status] || status || 'ახალი';
}

function statusTone(status) {
  if (status === 'confirmed' || status === 'done' || status === 'approved' || status === 'active') return 'success';
  if (status === 'cancelled' || status === 'hidden') return 'danger';
  return 'warning';
}

function parseNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractGoogleMapsCoordinates(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const decoded = decodeURIComponent(text);
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  return null;
}

function formatPrice(value, currency = 'GEL') {
  if (value === null || value === undefined || value === '') return 'ფასი შეთანხმებით';
  return `${Number(value).toFixed(2)} ${currency === 'USD' ? '$' : '₾'}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeImageUrls(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean).slice(0, 3);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  return [];
}

function productImageUrls(product) {
  const urls = normalizeImageUrls(product?.image_urls);
  if (urls.length) return urls;
  return product?.image_url ? [product.image_url] : [];
}

function businessKindLabel(kind) {
  const labels = {
    shop: 'ზოო შოპი',
    clinic: 'კლინიკა',
    hotel: 'სასტუმრო',
    taxi: 'Pet Taxi',
    grooming: 'გრუმინგი & ბარბერი',
  };
  return labels[kind] || kind || 'ბიზნესი';
}

function assistantSnapshot() {
  const business = activeBusiness();
  const missingProfile = [];
  if (!business?.name) missingProfile.push('სახელი');
  if (!business?.phone) missingProfile.push('ტელეფონი');
  if (!business?.address) missingProfile.push('მისამართი');
  if (!business?.lat || !business?.lng) missingProfile.push('Google Maps ლოკაცია');
  if (!business?.image_url) missingProfile.push('სურათი');
  if (!business?.working_hours) missingProfile.push('სამუშაო საათები');

  const categories = [...new Set(state.products.map((item) => item.category).filter(Boolean))];
  const lowStock = state.products.filter((item) => Number(item.stock_quantity) <= 3);
  const missingImages = state.products.filter((item) => !productImageUrls(item).length);
  const pendingOrders = state.orders.filter((item) => item.status === 'new');
  const pendingRequests = state.requests.filter((item) => item.status === 'new');

  return { business, missingProfile, categories, lowStock, missingImages, pendingOrders, pendingRequests };
}

function generateAssistantReply(prompt = '') {
  const { business, missingProfile, categories, lowStock, missingImages, pendingOrders, pendingRequests } = assistantSnapshot();

  if (!business) {
    return [
      'ჯერ შექმენი ბიზნეს პროფილი.',
      'მინიმუმ შეავსე: ტიპი, სახელი, ტელეფონი, Google Maps ლოკაცია, სამუშაო საათები და სურათი.',
    ].join('\n');
  }

  const normalized = prompt.toLowerCase();
  const lines = [
    `${businessKindLabel(business.kind)}: ${business.name}`,
    business.is_approved ? 'სტატუსი: დადასტურებულია და აპში გამოჩნდება, თუ აქტიურია.' : 'სტატუსი: ელოდება ადმინის დადასტურებას.',
  ];

  if (missingProfile.length) {
    lines.push(`პროფილში დასამატებელია: ${missingProfile.join(', ')}.`);
  } else {
    lines.push('პროფილი კარგად არის შევსებული.');
  }

  if (business.kind === 'shop') {
    lines.push(`პროდუქტები: ${state.products.length}. კატეგორიები: ${categories.length ? categories.map((item) => productCategoryLabels[item] || item).join(', ') : 'ჯერ არ არის'}.`);
    if (missingImages.length) lines.push(`${missingImages.length} პროდუქტს სურათი აკლია. პროდუქტის ბარათზე 2-3 სურათი უკეთ ყიდის.`);
    if (lowStock.length) lines.push(`დაბალი მარაგია ${lowStock.length} პროდუქტზე. გადაამოწმე მარაგი, რომ შეკვეთები არ გაწყდეს.`);
    if (normalized.includes('ფას') || normalized.includes('კონკურენტ')) {
      lines.push('ფასებზე: დაამატე ფასდაკლებული ფასი პოპულარულ პროდუქტებზე და შეადარე მინიმუმ 3 კონკურენტის ანალოგ პროდუქტს. შემდეგი AI ეტაპი ამას ავტომატურად შეგიკრებს.');
    }
  } else {
    lines.push(`სერვისები: ${state.services.length}. კარგი იქნება თითო სერვისს ჰქონდეს ფასი, ხანგრძლივობა და მოკლე აღწერა.`);
    if (!state.services.length) lines.push('დაამატე მინიმუმ 3 სერვისი, რომ მომხმარებელმა სწრაფად გაიგოს რას სთავაზობ.');
  }

  if (pendingOrders.length) lines.push(`ახალი შეკვეთები: ${pendingOrders.length}. ჯობია სწრაფად გადაიყვანო confirmed-ზე.`);
  if (pendingRequests.length) lines.push(`ახალი მოთხოვნები: ${pendingRequests.length}. დაურეკე ან WhatsApp-ით დაუკავშირდი და სტატუსი განაახლე.`);

  lines.push('შემდეგ ეტაპზე ასისტენტს დავამატებთ: კონკურენტების ფასების შედარება, პროდუქტის აღწერის გენერაცია, აქციების იდეები, მოთხოვნებზე ავტომატური პასუხის შაბლონები და გაყიდვების პროგნოზი.');
  return lines.join('\n');
}

async function generateCompetitorComparisonReply(prompt = '') {
  const business = activeBusiness();
  if (!business) return generateAssistantReply(prompt);

  if (business.kind === 'shop') {
    const { data, error } = await client
      .from('shop_products')
      .select('title, category, price_value, discount_price, business_id')
      .eq('is_active', true)
      .neq('business_id', business.id);

    if (error) return `${generateAssistantReply(prompt)}\n\nკონკურენტების პროდუქტების წამოღება ვერ მოხერხდა: ${error.message}`;

    const ownByCategory = state.products.reduce((acc, item) => {
      const category = item.category || 'other';
      acc[category] = acc[category] || [];
      acc[category].push(Number(item.discount_price ?? item.price_value ?? 0));
      return acc;
    }, {});
    const competitorByCategory = (data || []).reduce((acc, item) => {
      const category = item.category || 'other';
      acc[category] = acc[category] || [];
      acc[category].push(Number(item.discount_price ?? item.price_value ?? 0));
      return acc;
    }, {});

    const lines = [`კონკურენტებთან შედარება: ${business.name}`];
    const categories = Object.keys(ownByCategory);
    if (!categories.length) lines.push('შედარებისთვის ჯერ დაამატე პროდუქტები და კატეგორიები.');

    categories.forEach((category) => {
      const ownPrices = ownByCategory[category].filter(Boolean);
      const competitorPrices = (competitorByCategory[category] || []).filter(Boolean);
      const ownAvg = ownPrices.reduce((sum, value) => sum + value, 0) / Math.max(ownPrices.length, 1);
      const competitorAvg =
        competitorPrices.reduce((sum, value) => sum + value, 0) / Math.max(competitorPrices.length, 1);
      const label = productCategoryLabels[category] || category;

      if (!competitorPrices.length) {
        lines.push(`${label}: კონკურენტის საკმარისი პროდუქტი ჯერ არ ჩანს ამ კატეგორიაში.`);
        return;
      }

      const diff = ownAvg - competitorAvg;
      const advice =
        Math.abs(diff) < 2
          ? 'ფასი ბაზართან ახლოსაა.'
          : diff > 0
            ? 'შენ საშუალოდ ძვირი ხარ; დაამატე ფასდაკლება ან უკეთესი აღწერა/სურათები.'
            : 'შენ საშუალოდ იაფი ხარ; შეგიძლია პოპულარულ პროდუქტებზე ფასი ოდნავ აწიო ან bundle გააკეთო.';
      lines.push(`${label}: შენი საშუალო ${ownAvg.toFixed(2)} ₾, კონკურენტები ${competitorAvg.toFixed(2)} ₾. ${advice}`);
    });

    lines.push('შედარება ახლა ეფუძნება ბაზაში არსებულ პარტნიორ პროდუქტებს. შემდეგ AI ვერსიაში დავამატებთ გარე ბაზრის/ონლაინ კონკურენტების ფასებსაც.');
    return lines.join('\n');
  }

  const { data, error } = await client
    .from('business_services')
    .select('title, category, price_value, business_id')
    .eq('is_active', true)
    .neq('business_id', business.id);

  if (error) return `${generateAssistantReply(prompt)}\n\nკონკურენტების სერვისების წამოღება ვერ მოხერხდა: ${error.message}`;

  const competitorServices = data || [];
  const ownAvg =
    state.services.reduce((sum, item) => sum + Number(item.price_value || 0), 0) /
    Math.max(state.services.filter((item) => item.price_value !== null && item.price_value !== undefined).length, 1);
  const competitorAvg =
    competitorServices.reduce((sum, item) => sum + Number(item.price_value || 0), 0) /
    Math.max(competitorServices.filter((item) => item.price_value !== null && item.price_value !== undefined).length, 1);

  return [
    `კონკურენტებთან შედარება: ${business.name} (${businessKindLabel(business.kind)})`,
    `შენი სერვისები: ${state.services.length}. კონკურენტების ხილული სერვისები: ${competitorServices.length}.`,
    competitorServices.length
      ? `საშუალო ფასი: შენი ${ownAvg.toFixed(2)} ₾, კონკურენტები ${competitorAvg.toFixed(2)} ₾.`
      : 'ამ კატეგორიაში კონკურენტის სერვისები ჯერ საკმარისად არ ჩანს.',
    ownAvg > competitorAvg && competitorServices.length
      ? 'თუ ფასი მაღალია, სერვისის აღწერაში აუცილებლად აჩვენე რას იღებს მომხმარებელი დამატებით.'
      : 'კარგი იქნება სერვისებს დაუმატო პაკეტები: basic, standard, premium.',
    'შემდეგ AI ვერსიაში დავამატებთ გარე კონკურენტების და რეალური ბაზრის ფასების მოძიებასაც.',
  ].join('\n');
}

function isCompetitorPrompt(text) {
  const normalized = String(text || '').toLowerCase();
  return normalized.includes('კონკურ') || normalized.includes('შეადარ');
}

function addAssistantMessage(role, text) {
  state.assistantMessages.push({ role, text });
  renderAssistant();
}

function setView(view) {
  views.forEach((name) => {
    $(name).classList.toggle('is-hidden', name !== view);
  });

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === view);
  });

  $('page-title').textContent = pageTitles[view] || pageTitles.dashboard;
}

function setAuthenticated(isAuthenticated) {
  $('auth-view').classList.toggle('is-hidden', isAuthenticated);
  $('panel-view').classList.toggle('is-hidden', !isAuthenticated);
  $('active-email').textContent = state.user?.email || 'არ ხართ შესული';
  document.querySelectorAll('.admin-only').forEach((item) => {
    item.classList.toggle('is-hidden', !state.isAdmin);
  });
}

async function loadSession() {
  const { data } = await client.auth.getSession();
  state.user = data.session?.user || null;
  state.isAdmin = false;
  setAuthenticated(Boolean(state.user));

  if (state.user) {
    await loadUserRole();
    await loadAll();
    if (state.isAdmin) setView('approvals');
  }
}

async function loadUserRole() {
  const { data, error } = await client
    .from('profiles')
    .select('is_admin')
    .eq('id', state.user.id)
    .maybeSingle();

  state.isAdmin = !error && data?.is_admin === true;
  setAuthenticated(true);
}

async function loadAll() {
  await loadBusinesses();
  await Promise.all([loadProducts(), loadServices(), loadOrders(), loadRequests(), loadAdminData()]);
  renderAll();
}

async function loadAdminData() {
  if (!state.isAdmin) {
    state.adminProducts = [];
    state.adminServices = [];
    state.adminPets = [];
    state.adminMedicalRecords = [];
    state.adminProfiles = [];
    return;
  }

  const [productsResult, servicesResult, ordersResult, requestsResult, petsResult, medicalResult, profilesResult] = await Promise.all([
    client
      .from('shop_products')
      .select('*, business_profiles(name, kind, phone, address)')
      .order('created_at', { ascending: false }),
    client
      .from('business_services')
      .select('*, business_profiles(name, kind, phone, address)')
      .order('created_at', { ascending: false }),
    client.from('shop_orders').select('*').order('created_at', { ascending: false }),
    client.from('business_booking_requests').select('*').order('created_at', { ascending: false }),
    client.from('pets').select('*').order('created_at', { ascending: false }),
    client.from('medical_records').select('*').order('date_administered', { ascending: false }),
    client.from('profiles').select('*'),
  ]);

  if (productsResult.error) throw productsResult.error;
  if (servicesResult.error) throw servicesResult.error;
  if (petsResult.error) throw petsResult.error;

  state.adminProducts = productsResult.data || [];
  state.adminServices = servicesResult.data || [];
  state.adminOrders = ordersResult.error ? [] : ordersResult.data || [];
  state.adminRequests = requestsResult.error ? [] : requestsResult.data || [];
  state.adminPets = petsResult.data || [];
  state.adminMedicalRecords = medicalResult.error ? [] : medicalResult.data || [];
  state.adminProfiles = profilesResult.error ? [] : profilesResult.data || [];
}

async function loadBusinesses() {
  const { data, error } = await client
    .from('business_profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;

  state.businesses = data || [];
  if (!state.activeBusinessId || !state.businesses.some((item) => item.id === state.activeBusinessId)) {
    state.activeBusinessId = state.businesses[0]?.id || null;
  }
}

async function loadProducts() {
  const business = activeBusiness();
  if (!business || business.kind !== 'shop') {
    state.products = [];
    return;
  }

  const { data, error } = await client
    .from('shop_products')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  state.products = data || [];
}

async function loadServices() {
  const business = activeBusiness();
  if (!business) {
    state.services = [];
    return;
  }

  const { data, error } = await client
    .from('business_services')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  state.services = data || [];
}

async function loadOrders() {
  const business = activeBusiness();
  if (!business) {
    state.orders = [];
    return;
  }

  const { data, error } = await client
    .from('shop_orders')
    .select('*, shop_products(title, image_url)')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  state.orders = data || [];
}

async function loadRequests() {
  const business = activeBusiness();
  if (!business) {
    state.requests = [];
    return;
  }

  const { data, error } = await client
    .from('business_booking_requests')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  state.requests = data || [];
}

function renderAll() {
  renderBusinessSelect();
  renderDashboard();
  renderBusinessForm();
  renderProducts();
  renderServices();
  renderOrders();
  renderRequests();
  renderAssistant();
  renderApprovals();
  renderAdminStats();
  renderAdminPartners();
  renderAdminProducts();
  renderAdminServices();
  renderAdminPets();
}

function renderBusinessSelect() {
  const select = $('business-select');
  select.innerHTML = '';

  if (!state.businesses.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'ბიზნესი ჯერ არ არის';
    select.appendChild(option);
    return;
  }

  state.businesses.forEach((business) => {
    const option = document.createElement('option');
    option.value = business.id;
    option.textContent = `${business.name} · ${business.kind}`;
    option.selected = business.id === state.activeBusinessId;
    select.appendChild(option);
  });
}

function renderDashboard() {
  const pendingCount = state.businesses.filter((item) => !item.is_approved).length;
  const ordersForCount = state.isAdmin ? state.adminOrders : state.orders;
  const requestsForCount = state.isAdmin ? state.adminRequests : state.requests;
  const newOrdersCount = ordersForCount.filter((item) => item.status === 'new').length;
  const newRequestsCount = requestsForCount.filter((item) => item.status === 'new').length;
  $('stat-businesses').textContent = state.businesses.length;
  $('stat-products').textContent = state.products.length;
  $('stat-services').textContent = state.services.length;
  $('stat-orders').textContent = state.orders.length + state.requests.length;
  if ($('stat-pending')) $('stat-pending').textContent = pendingCount;
  setBadge('nav-orders-badge', newOrdersCount);
  setBadge('nav-requests-badge', newRequestsCount);
  setBadge('nav-approvals-badge', state.isAdmin ? pendingCount : 0);
}

function renderBusinessForm() {
  const business = activeBusiness();
  const hasBusiness = Boolean(business);
  $('delete-business').disabled = !hasBusiness;
  renderBusinessStatus(business);

  $('business-kind').value = business?.kind || 'shop';
  $('business-name').value = business?.name || '';
  $('business-phone').value = business?.phone || '';
  $('business-whatsapp').value = business?.whatsapp || '';
  $('business-address').value = business?.address || '';
  $('business-google-maps-url').value = business?.google_maps_url || '';
  $('business-working-hours').value = business?.working_hours || '';
  $('business-lat').value = business?.lat ?? '';
  $('business-lng').value = business?.lng ?? '';
  $('business-description').value = business?.description || '';
  $('business-image-url').value = business?.image_url || '';
  $('business-active').checked = business?.is_active !== false;
  renderWorkingHoursPreset();
}

function renderWorkingHoursPreset() {
  const value = $('business-working-hours')?.value || '';
  document.querySelectorAll('[data-working-hours]').forEach((button) => {
    const preset = button.dataset.workingHours || '';
    button.classList.toggle('is-active', preset && preset === value);
  });
}

function renderBusinessStatus(business) {
  const box = $('business-status-card');
  if (!box) return;

  if (!business) {
    box.className = 'status-card wide is-muted';
    box.innerHTML = '<strong>ახალი ბიზნესი</strong><span>შეავსეთ ფორმა და შენახვის შემდეგ ადმინი შეძლებს დადასტურებას.</span>';
    return;
  }

  if (business.is_active === false) {
    box.className = 'status-card wide is-hidden-status';
    box.innerHTML = '<strong>დამალულია</strong><span>ეს ბიზნესი public აპში არ ჩანს, სანამ Active არ ჩაირთვება.</span>';
    return;
  }

  if (business.is_approved === true) {
    box.className = 'status-card wide is-approved';
    box.innerHTML = '<strong>დადასტურებულია</strong><span>ეს ბიზნესი public აპში ჩანს და მომხმარებლები შეძლებენ ნახვას.</span>';
    return;
  }

  box.className = 'status-card wide is-pending';
  box.innerHTML = '<strong>ელოდება დადასტურებას</strong><span>ბიზნესი შენახულია, მაგრამ public აპში გამოჩნდება მხოლოდ ადმინის approval-ის შემდეგ.</span>';
}

function renderProducts() {
  const business = activeBusiness();
  const container = $('products-list');

  if (!business) {
    container.innerHTML = '<div class="surface">ჯერ შექმენით ბიზნესი.</div>';
    return;
  }

  if (business.kind !== 'shop') {
    container.innerHTML = '<div class="surface">პროდუქტები მხოლოდ ზოო შოპის ტიპზეა აქტიური.</div>';
    return;
  }

  if (!state.products.length) {
    container.innerHTML = '<div class="surface">პროდუქტები ჯერ არ არის დამატებული.</div>';
    return;
  }

  container.innerHTML = state.products
    .map(
      (item) => {
        const images = productImageUrls(item);
        return `
        <article class="list-item">
          <img class="list-thumb" src="${escapeHtml(images[0] || '')}" alt="" />
          <div>
            <h3 class="list-title">${escapeHtml(item.title)}</h3>
            <p class="list-meta">${escapeHtml(productCategoryLabels[item.category] || item.category || 'კატეგორია არ აქვს')} · ${formatPrice(item.price_value, item.currency)} · ${images.length} სურათი</p>
            <span class="chip">${item.is_active ? 'აქტიური' : 'გამორთული'}</span>
          </div>
          <div class="item-actions">
            <button class="secondary-button" type="button" data-edit-product="${item.id}">რედაქტირება</button>
            <button class="danger-button" type="button" data-delete-product="${item.id}">წაშლა</button>
          </div>
        </article>
      `;
      }
    )
    .join('');
}

function renderServices() {
  const business = activeBusiness();
  const container = $('services-list');

  if (!business) {
    container.innerHTML = '<div class="surface">ჯერ შექმენით ბიზნესი.</div>';
    return;
  }

  if (!state.services.length) {
    container.innerHTML = '<div class="surface">სერვისები ჯერ არ არის დამატებული.</div>';
    return;
  }

  container.innerHTML = state.services
    .map(
      (item) => `
        <article class="list-item">
          <div class="list-thumb"></div>
          <div>
            <h3 class="list-title">${escapeHtml(item.title)}</h3>
            <p class="list-meta">${escapeHtml(item.category || 'სერვისი')} · ${formatPrice(item.price_value, item.currency)}</p>
            <span class="chip">${item.is_active ? 'აქტიური' : 'გამორთული'}</span>
          </div>
          <div class="item-actions">
            <button class="secondary-button" type="button" data-edit-service="${item.id}">რედაქტირება</button>
            <button class="danger-button" type="button" data-delete-service="${item.id}">წაშლა</button>
          </div>
        </article>
      `
    )
    .join('');
}

function renderOrders() {
  const container = $('orders-list');

  if (!activeBusiness()) {
    container.innerHTML = '<div class="surface">ჯერ შექმენით ბიზნესი.</div>';
    return;
  }

  if (!state.orders.length) {
    container.innerHTML = '<div class="surface">შეკვეთები ჯერ არ არის.</div>';
    return;
  }

  container.innerHTML = state.orders
    .map(
      (item) => `
        <article class="list-item">
          <img class="list-thumb" src="${escapeHtml(item.shop_products?.image_url || '')}" alt="" />
          <div>
            <h3 class="list-title">${escapeHtml(item.product_title || item.shop_products?.title || 'შეკვეთა')}</h3>
            <p class="list-meta">${escapeHtml(item.buyer_name)} · ${escapeHtml(item.phone)} · ${item.quantity || 1} ცალი</p>
            <span class="chip chip-${statusTone(item.status || 'new')}">${escapeHtml(statusLabel(item.status || 'new'))}</span>
          </div>
          <div class="item-actions">
            <select data-order-status="${item.id}">
              <option value="new" ${item.status === 'new' ? 'selected' : ''}>ახალი</option>
              <option value="confirmed" ${item.status === 'confirmed' ? 'selected' : ''}>დადასტურებული</option>
              <option value="done" ${item.status === 'done' ? 'selected' : ''}>შესრულებული</option>
              <option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>გაუქმებული</option>
            </select>
          </div>
        </article>
      `
    )
    .join('');
}

function renderRequests() {
  const container = $('requests-list');
  if (!container) return;

  if (!activeBusiness()) {
    container.innerHTML = '<div class="surface">ჯერ შექმენით ბიზნესი.</div>';
    return;
  }

  if (!state.requests.length) {
    container.innerHTML = '<div class="surface">დაჯავშნის მოთხოვნები ჯერ არ არის.</div>';
    return;
  }

  container.innerHTML = state.requests
    .map(
      (item) => `
        <article class="list-item">
          <div class="list-thumb"></div>
          <div>
            <h3 class="list-title">${escapeHtml(item.requester_name)}</h3>
            <p class="list-meta">${escapeHtml(item.phone)} · ${escapeHtml(item.note || 'შენიშვნა არ არის')}</p>
            <span class="chip chip-${statusTone(item.status || 'new')}">${escapeHtml(statusLabel(item.status || 'new'))}</span>
          </div>
          <div class="item-actions">
            <select data-request-status="${item.id}">
              <option value="new" ${item.status === 'new' ? 'selected' : ''}>ახალი</option>
              <option value="confirmed" ${item.status === 'confirmed' ? 'selected' : ''}>დადასტურებული</option>
              <option value="done" ${item.status === 'done' ? 'selected' : ''}>შესრულებული</option>
              <option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>გაუქმებული</option>
            </select>
          </div>
        </article>
      `
    )
    .join('');
}

function renderAssistant() {
  const container = $('assistant-messages');
  if (!container) return;

  if (!state.assistantMessages.length) {
    state.assistantMessages = [
      {
        role: 'assistant',
        text: generateAssistantReply('დამიწყე შეფასება'),
      },
    ];
  }

  container.innerHTML = state.assistantMessages
    .map(
      (message) => `
        <div class="assistant-message ${message.role === 'user' ? 'is-user' : 'is-assistant'}">
          <span>${message.role === 'user' ? 'შენ' : 'ასისტენტი'}</span>
          <p>${escapeHtml(message.text).replaceAll('\n', '<br />')}</p>
        </div>
      `
    )
    .join('');

  container.scrollTop = container.scrollHeight;
}

async function askAssistant(prompt) {
  const text = String(prompt || '').trim();
  if (!text) return;

  addAssistantMessage('user', text);
  try {
    const reply = isCompetitorPrompt(text)
      ? await generateCompetitorComparisonReply(text)
      : generateAssistantReply(text);
    addAssistantMessage('assistant', reply);
  } catch (error) {
    addAssistantMessage('assistant', error.message || 'პასუხის მომზადება ვერ მოხერხდა.');
  }
}

async function updateRequestStatus(id, status) {
  const { error } = await client.from('business_booking_requests').update({ status }).eq('id', id);
  if (error) throw error;
  showMessage('მოთხოვნის სტატუსი განახლდა.', statusTone(status) === 'danger' ? 'error' : statusTone(status));
  await loadRequests();
  renderDashboard();
  renderRequests();
}

function renderApprovals() {
  const container = $('approvals-list');
  if (!container) return;

  if (!state.isAdmin) {
    container.innerHTML = '<div class="surface">ეს გვერდი მხოლოდ ადმინისთვისაა.</div>';
    return;
  }

  if (!state.businesses.length) {
    container.innerHTML = '<div class="surface">პარტნიორი ბიზნესი ჯერ არ არის.</div>';
    return;
  }

  container.innerHTML = state.businesses
    .map(
      (item) => `
        <article class="list-item">
          <img class="list-thumb" src="${escapeHtml(item.image_url || '')}" alt="" />
          <div>
            <h3 class="list-title">${escapeHtml(item.name)}</h3>
            <p class="list-meta">${escapeHtml(item.kind)} · ${escapeHtml(item.address || 'მისამართი არ არის')}</p>
            <span class="chip chip-${statusTone(item.is_approved ? 'approved' : 'waiting')}">${statusLabel(item.is_approved ? 'approved' : 'waiting')}</span>
            <span class="chip chip-${statusTone(item.is_active ? 'active' : 'hidden')}">${statusLabel(item.is_active ? 'active' : 'hidden')}</span>
          </div>
          <div class="item-actions">
            <button class="secondary-button" type="button" data-approve-business="${item.id}">
              ${item.is_approved ? 'Approve off' : 'Approve'}
            </button>
            <button class="secondary-button" type="button" data-toggle-business="${item.id}">
              ${item.is_active ? 'Hide' : 'Activate'}
            </button>
          </div>
        </article>
      `
    )
    .join('');
}

function profileById(id) {
  return state.adminProfiles.find((profile) => profile.id === id) || null;
}

function recordsForPet(petId) {
  return state.adminMedicalRecords.filter((record) => record.pet_id === petId);
}

function renderAdminStats() {
  const container = $('admin-stats-grid');
  if (!container) return;

  if (!state.isAdmin) {
    container.innerHTML = '<article class="surface">ეს გვერდი მხოლოდ ადმინისთვისაა.</article>';
    return;
  }

  const pendingBusinesses = state.businesses.filter((item) => !item.is_approved).length;
  const activeBusinesses = state.businesses.filter((item) => item.is_active !== false && item.is_approved).length;
  const newOrders = state.adminOrders.filter((item) => item.status === 'new').length;
  const newRequests = state.adminRequests.filter((item) => item.status === 'new').length;
  const lostPets = state.adminPets.filter((pet) => pet.is_lost).length;

  const stats = [
    ['პარტნიორები', state.businesses.length],
    ['აქტიური public-ში', activeBusinesses],
    ['დასადასტურებელი', pendingBusinesses],
    ['პროდუქტები', state.adminProducts.length],
    ['სერვისები', state.adminServices.length],
    ['ცხოველები', state.adminPets.length],
    ['დაკარგული ცხოველები', lostPets],
    ['ახალი მოთხოვნები', newOrders + newRequests],
  ];

  container.innerHTML = stats
    .map(([label, value]) => `<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`)
    .join('');
}

function renderAdminPartners() {
  const filters = $('admin-partner-filters');
  const container = $('admin-partners-list');
  if (!filters || !container) return;

  const kinds = [
    ['all', 'ყველა'],
    ['shop', 'მაღაზიები'],
    ['clinic', 'კლინიკები'],
    ['hotel', 'სასტუმროები'],
    ['taxi', 'ტაქსი'],
    ['grooming', 'გრუმინგი'],
  ];

  filters.innerHTML = kinds
    .map(([kind, label]) => {
      const count = kind === 'all' ? state.businesses.length : state.businesses.filter((item) => item.kind === kind).length;
      return `<button type="button" class="${state.adminPartnerKind === kind ? 'is-active' : ''}" data-admin-kind="${kind}">${label} <span>${count}</span></button>`;
    })
    .join('');

  const items =
    state.adminPartnerKind === 'all'
      ? state.businesses
      : state.businesses.filter((item) => item.kind === state.adminPartnerKind);

  if (!items.length) {
    container.innerHTML = '<div class="surface">ამ კატეგორიაში პარტნიორი ჯერ არ არის.</div>';
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <article class="list-item">
          <img class="list-thumb" src="${escapeHtml(item.image_url || '')}" alt="" />
          <div>
            <h3 class="list-title">${escapeHtml(item.name)}</h3>
            <p class="list-meta">${businessKindLabel(item.kind)} · ${escapeHtml(item.phone || 'ტელეფონი არ არის')} · ${escapeHtml(item.address || 'მისამართი არ არის')}</p>
            <span class="chip chip-${statusTone(item.is_approved ? 'approved' : 'waiting')}">${statusLabel(item.is_approved ? 'approved' : 'waiting')}</span>
            <span class="chip chip-${statusTone(item.is_active ? 'active' : 'hidden')}">${statusLabel(item.is_active ? 'active' : 'hidden')}</span>
          </div>
          <div class="item-actions">
            <button class="secondary-button" type="button" data-approve-business="${item.id}">${item.is_approved ? 'დადასტურების მოხსნა' : 'დადასტურება'}</button>
            <button class="secondary-button" type="button" data-toggle-business="${item.id}">${item.is_active ? 'დამალვა' : 'გააქტიურება'}</button>
          </div>
        </article>
      `
    )
    .join('');
}

function renderAdminProducts() {
  const container = $('admin-products-list');
  if (!container) return;

  if (!state.adminProducts.length) {
    container.innerHTML = '<div class="surface">პროდუქტები ჯერ არ არის.</div>';
    return;
  }

  container.innerHTML = state.adminProducts
    .map((item) => {
      const images = productImageUrls(item);
      const business = item.business_profiles || {};
      return `
        <article class="list-item">
          <img class="list-thumb" src="${escapeHtml(images[0] || '')}" alt="" />
          <div>
            <h3 class="list-title">${escapeHtml(item.title)}</h3>
            <p class="list-meta">${escapeHtml(business.name || 'ბიზნესი არ არის')} · ${productCategoryLabels[item.category] || item.category || 'კატეგორია არ აქვს'} · ${formatPrice(item.discount_price ?? item.price_value, item.currency)}</p>
            <span class="chip chip-${statusTone(item.is_active ? 'active' : 'hidden')}">${statusLabel(item.is_active ? 'active' : 'hidden')}</span>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderAdminServices() {
  const container = $('admin-services-list');
  if (!container) return;

  if (!state.adminServices.length) {
    container.innerHTML = '<div class="surface">სერვისები ჯერ არ არის.</div>';
    return;
  }

  container.innerHTML = state.adminServices
    .map((item) => {
      const business = item.business_profiles || {};
      return `
        <article class="list-item">
          <div class="list-thumb"></div>
          <div>
            <h3 class="list-title">${escapeHtml(item.title)}</h3>
            <p class="list-meta">${escapeHtml(business.name || 'ბიზნესი არ არის')} · ${businessKindLabel(business.kind)} · ${formatPrice(item.price_value, item.currency)}</p>
            <span class="chip chip-${statusTone(item.is_active ? 'active' : 'hidden')}">${statusLabel(item.is_active ? 'active' : 'hidden')}</span>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderAdminPets() {
  const container = $('admin-pets-list');
  if (!container) return;

  if (!state.adminPets.length) {
    container.innerHTML = '<div class="surface">ცხოველები ჯერ არ არის.</div>';
    return;
  }

  container.innerHTML = state.adminPets
    .map((pet) => {
      const owner = profileById(pet.owner_id);
      const records = recordsForPet(pet.id);
      const expanded = state.expandedAdminPets.includes(pet.id);
      return `
        <article class="admin-accordion ${expanded ? 'is-open' : ''}">
          <button class="admin-accordion-head" type="button" data-admin-pet-toggle="${pet.id}">
            <span>
              <strong>${escapeHtml(pet.name || 'უსახელო')}</strong>
              <small>${escapeHtml(pet.breed || 'ჯიში არ არის')} · ${escapeHtml(owner?.full_name || owner?.email || pet.owner_id || 'მფლობელი არ ჩანს')}</small>
            </span>
            <span class="chip chip-${pet.is_lost ? 'danger' : 'success'}">${pet.is_lost ? 'დაკარგულია' : 'უსაფრთხოდ'}</span>
          </button>
          <div class="admin-accordion-body">
            <div class="admin-pet-grid">
              <img class="admin-pet-photo" src="${escapeHtml(pet.photo_url || '')}" alt="" />
              <div>
                <p><strong>კოდი:</strong> ${escapeHtml(pet.short_code || '-')}</p>
                <p><strong>სქესი:</strong> ${escapeHtml(pet.sex || '-')} · <strong>ზომა:</strong> ${escapeHtml(pet.size || '-')} · <strong>წონა:</strong> ${escapeHtml(pet.weight || '-')}</p>
                <p><strong>ფერი:</strong> ${escapeHtml(pet.color || '-')} · <strong>ლოკაცია:</strong> ${escapeHtml(pet.location || '-')}</p>
                <p><strong>აღწერა:</strong> ${escapeHtml(pet.description || '-')}</p>
              </div>
            </div>
            <div class="admin-records">
              <strong>მედ ჩანაწერები (${records.length})</strong>
              ${
                records.length
                  ? records
                      .map(
                        (record) => `
                          <div class="admin-record">
                            <span>${escapeHtml(record.record_type || 'ჩანაწერი')}</span>
                            <span>${escapeHtml(record.title || record.name || '-')}</span>
                            <span>${escapeHtml(record.date_administered || record.created_at || '-')}</span>
                          </div>
                        `
                      )
                      .join('')
                  : '<p class="muted">მედ ჩანაწერი ჯერ არ არის.</p>'
              }
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

async function uploadFile(inputId, folder) {
  const input = $(inputId);
  const file = input.files?.[0];
  if (!file) return null;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${state.user.id}/${folder}/${Date.now()}-${safeName}`;
  const { error } = await client.storage.from('business-assets').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) throw error;

  const { data } = client.storage.from('business-assets').getPublicUrl(path);
  input.value = '';
  return data.publicUrl;
}

async function uploadFiles(inputId, folder, limit = 3) {
  const input = $(inputId);
  const files = Array.from(input.files || []).slice(0, limit);
  const urls = [];

  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${state.user.id}/${folder}/${Date.now()}-${urls.length}-${safeName}`;
    const { error } = await client.storage.from('business-assets').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) throw error;

    const { data } = client.storage.from('business-assets').getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  if (input.files?.length > limit) {
    showMessage(`მაქსიმუმ ${limit} სურათი შეინახება. დანარჩენი გამოტოვებულია.`);
  }

  input.value = '';
  return urls;
}

async function saveBusiness(event) {
  event.preventDefault();
  const uploadedUrl = await uploadFile('business-image-file', 'profiles');
  const payload = {
    owner_id: state.user.id,
    kind: $('business-kind').value,
    name: $('business-name').value.trim(),
    phone: $('business-phone').value.trim() || null,
    whatsapp: $('business-whatsapp').value.trim() || null,
    address: $('business-address').value.trim() || null,
    google_maps_url: $('business-google-maps-url').value.trim() || null,
    working_hours: $('business-working-hours').value.trim() || null,
    lat: parseNumber($('business-lat').value),
    lng: parseNumber($('business-lng').value),
    description: $('business-description').value.trim() || null,
    image_url: uploadedUrl || $('business-image-url').value.trim() || null,
    is_active: $('business-active').checked,
  };

  if (!payload.name) {
    showMessage('ბიზნესის სახელი აუცილებელია.', true);
    return;
  }

  const business = activeBusiness();
  const query = business
    ? client.from('business_profiles').update(payload).eq('id', business.id)
    : client.from('business_profiles').insert([payload]);

  const { error } = await query;
  if (error) throw error;
  showMessage('ბიზნეს პროფილი შენახულია.');
  await loadAll();
}

function parseGoogleLocation() {
  const coordinates = extractGoogleMapsCoordinates($('business-google-maps-url').value);

  if (!coordinates) {
    showMessage('Google Maps-ის ამ ბმულიდან კოორდინატები ვერ ამოვიღე. ჩასვით სრული ბმული, სადაც ჩანს @lat,lng.', true);
    return;
  }

  $('business-lat').value = coordinates.lat;
  $('business-lng').value = coordinates.lng;
  showMessage('Google Maps კოორდინატები შევსებულია.');
}

function setWorkingHoursPreset(value) {
  $('business-working-hours').value = value || '';
  $('business-working-hours').focus();
  renderWorkingHoursPreset();
}

async function createBusiness() {
  state.activeBusinessId = null;
  renderBusinessForm();
  setView('profile');
  $('business-name').focus();
}

async function deleteBusiness() {
  const business = activeBusiness();
  if (!business || !window.confirm('ბიზნესი წაიშალოს?')) return;

  const { error } = await client.from('business_profiles').delete().eq('id', business.id);
  if (error) throw error;
  state.activeBusinessId = null;
  showMessage('ბიზნესი წაიშალა.');
  await loadAll();
}

function resetProductForm() {
  $('product-id').value = '';
  $('product-title').value = '';
  $('product-category').value = '';
  $('product-price').value = '';
  $('product-discount').value = '';
  $('product-stock').value = '';
  $('product-image-url').value = '';
  $('product-image-file').value = '';
  $('product-description').value = '';
  $('product-active').checked = true;
}

async function saveProduct(event) {
  event.preventDefault();
  const business = activeBusiness();
  if (!business || business.kind !== 'shop') {
    showMessage('პროდუქტის დასამატებლად აირჩიეთ ზოო შოპი.', true);
    return;
  }

  const uploadedUrls = await uploadFiles('product-image-file', 'products', 3);
  const typedUrls = normalizeImageUrls($('product-image-url').value);
  const imageUrls = [...uploadedUrls, ...typedUrls].slice(0, 3);
  const payload = {
    business_id: business.id,
    title: $('product-title').value.trim(),
    description: $('product-description').value.trim() || null,
    image_url: imageUrls[0] || null,
    image_urls: imageUrls,
    price_value: parseNumber($('product-price').value),
    discount_price: parseNumber($('product-discount').value),
    stock_quantity: parseNumber($('product-stock').value),
    category: $('product-category').value.trim() || null,
    currency: 'GEL',
    is_active: $('product-active').checked,
  };

  if (!payload.title) {
    showMessage('პროდუქტის სახელი აუცილებელია.', true);
    return;
  }

  const id = $('product-id').value;
  const query = id
    ? client.from('shop_products').update(payload).eq('id', id)
    : client.from('shop_products').insert([payload]);

  const { error } = await query;
  if (error) throw error;
  resetProductForm();
  showMessage('პროდუქტი შენახულია.');
  await loadProducts();
  renderDashboard();
  renderProducts();
}

function editProduct(id) {
  const item = state.products.find((product) => product.id === id);
  if (!item) return;

  $('product-id').value = item.id;
  $('product-title').value = item.title || '';
  $('product-category').value = item.category || '';
  $('product-price').value = item.price_value ?? '';
  $('product-discount').value = item.discount_price ?? '';
  $('product-stock').value = item.stock_quantity ?? '';
  $('product-image-url').value = productImageUrls(item).join('\n');
  $('product-image-file').value = '';
  $('product-description').value = item.description || '';
  $('product-active').checked = item.is_active !== false;
  $('product-title').focus();
}

async function deleteProduct(id) {
  if (!window.confirm('პროდუქტი წაიშალოს?')) return;
  const { error } = await client.from('shop_products').delete().eq('id', id);
  if (error) throw error;
  showMessage('პროდუქტი წაიშალა.');
  await loadProducts();
  renderDashboard();
  renderProducts();
}

function resetServiceForm() {
  $('service-id').value = '';
  $('service-title').value = '';
  $('service-category').value = '';
  $('service-price').value = '';
  $('service-duration').value = '';
  $('service-description').value = '';
  $('service-active').checked = true;
}

async function saveService(event) {
  event.preventDefault();
  const business = activeBusiness();
  if (!business) {
    showMessage('ჯერ შექმენით ბიზნესი.', true);
    return;
  }

  const payload = {
    business_id: business.id,
    title: $('service-title').value.trim(),
    category: $('service-category').value.trim() || null,
    price_value: parseNumber($('service-price').value),
    duration_minutes: parseNumber($('service-duration').value),
    description: $('service-description').value.trim() || null,
    currency: 'GEL',
    is_active: $('service-active').checked,
  };

  if (!payload.title) {
    showMessage('სერვისის სახელი აუცილებელია.', true);
    return;
  }

  const id = $('service-id').value;
  const query = id
    ? client.from('business_services').update(payload).eq('id', id)
    : client.from('business_services').insert([payload]);

  const { error } = await query;
  if (error) throw error;
  resetServiceForm();
  showMessage('სერვისი შენახულია.');
  await loadServices();
  renderDashboard();
  renderServices();
}

function editService(id) {
  const item = state.services.find((service) => service.id === id);
  if (!item) return;

  $('service-id').value = item.id;
  $('service-title').value = item.title || '';
  $('service-category').value = item.category || '';
  $('service-price').value = item.price_value ?? '';
  $('service-duration').value = item.duration_minutes ?? '';
  $('service-description').value = item.description || '';
  $('service-active').checked = item.is_active !== false;
  $('service-title').focus();
}

async function deleteService(id) {
  if (!window.confirm('სერვისი წაიშალოს?')) return;
  const { error } = await client.from('business_services').delete().eq('id', id);
  if (error) throw error;
  showMessage('სერვისი წაიშალა.');
  await loadServices();
  renderDashboard();
  renderServices();
}

async function updateOrderStatus(id, status) {
  const { error } = await client.from('shop_orders').update({ status }).eq('id', id);
  if (error) throw error;
  showMessage('შეკვეთის სტატუსი განახლდა.', statusTone(status) === 'danger' ? 'error' : statusTone(status));
  await loadOrders();
  renderDashboard();
  renderOrders();
}

async function updateBusinessModeration(id, payload) {
  if (!state.isAdmin) {
    showMessage('ეს მოქმედება მხოლოდ ადმინისთვისაა.', true);
    return;
  }

  const { error } = await client.from('business_profiles').update(payload).eq('id', id);
  if (error) throw error;
  const type = payload.is_active === false || payload.is_approved === false ? 'warning' : 'success';
  showMessage('ბიზნესის სტატუსი განახლდა.', type);
  await loadBusinesses();
  renderAll();
}

function bindEvents() {
  $('auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: $('auth-email').value.trim(),
        password: $('auth-password').value,
      });
      if (error) throw error;
      state.user = data.user;
      await loadUserRole();
      setAuthenticated(true);
      await loadAll();
      if (state.isAdmin) setView('approvals');
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $('sign-up').addEventListener('click', async () => {
    try {
      const { data, error } = await client.auth.signUp({
        email: $('auth-email').value.trim(),
        password: $('auth-password').value,
      });
      if (error) throw error;
      state.user = data.user;
      showMessage('რეგისტრაცია შესრულდა. თუ email დადასტურება ჩართულია, შეამოწმეთ ფოსტა.');
      if (state.user) {
        await loadUserRole();
        setAuthenticated(true);
        await loadAll();
        if (state.isAdmin) setView('approvals');
      }
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  $('sign-out').addEventListener('click', async () => {
    await client.auth.signOut();
    state.user = null;
    state.isAdmin = false;
    state.businesses = [];
    state.activeBusinessId = null;
    setAuthenticated(false);
  });

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  $('business-select').addEventListener('change', async (event) => {
    state.activeBusinessId = event.target.value || null;
    await Promise.all([loadProducts(), loadServices(), loadOrders(), loadRequests()]);
    renderAll();
  });

  $('new-business').addEventListener('click', createBusiness);
  $('delete-business').addEventListener('click', () => wrap(deleteBusiness));
  $('business-form').addEventListener('submit', (event) => wrap(() => saveBusiness(event)));
  $('parse-google-location').addEventListener('click', parseGoogleLocation);
  $('business-working-hours').addEventListener('input', renderWorkingHoursPreset);
  document.querySelectorAll('[data-working-hours]').forEach((button) => {
    button.addEventListener('click', () => setWorkingHoursPreset(button.dataset.workingHours || ''));
  });

  $('product-form').addEventListener('submit', (event) => wrap(() => saveProduct(event)));
  $('reset-product').addEventListener('click', resetProductForm);
  $('products-list').addEventListener('click', (event) => {
    const editId = event.target.dataset.editProduct;
    const deleteId = event.target.dataset.deleteProduct;
    if (editId) editProduct(editId);
    if (deleteId) wrap(() => deleteProduct(deleteId));
  });

  $('service-form').addEventListener('submit', (event) => wrap(() => saveService(event)));
  $('reset-service').addEventListener('click', resetServiceForm);
  $('services-list').addEventListener('click', (event) => {
    const editId = event.target.dataset.editService;
    const deleteId = event.target.dataset.deleteService;
    if (editId) editService(editId);
    if (deleteId) wrap(() => deleteService(deleteId));
  });

  $('orders-list').addEventListener('change', (event) => {
    const orderId = event.target.dataset.orderStatus;
    if (orderId) wrap(() => updateOrderStatus(orderId, event.target.value));
  });

  $('requests-list').addEventListener('change', (event) => {
    const requestId = event.target.dataset.requestStatus;
    if (requestId) wrap(() => updateRequestStatus(requestId, event.target.value));
  });

  $('assistant-form').addEventListener('submit', (event) => {
    event.preventDefault();
    askAssistant($('assistant-input').value);
    $('assistant-input').value = '';
  });

  document.querySelectorAll('[data-assistant-prompt]').forEach((button) => {
    button.addEventListener('click', () => askAssistant(button.dataset.assistantPrompt));
  });

  $('approvals-list').addEventListener('click', (event) => {
    const approveId = event.target.dataset.approveBusiness;
    const toggleId = event.target.dataset.toggleBusiness;

    if (approveId) {
      const item = state.businesses.find((business) => business.id === approveId);
      if (item) wrap(() => updateBusinessModeration(approveId, { is_approved: !item.is_approved }));
    }

    if (toggleId) {
      const item = state.businesses.find((business) => business.id === toggleId);
      if (item) wrap(() => updateBusinessModeration(toggleId, { is_active: !item.is_active }));
    }
  });

  $('admin-partner-filters').addEventListener('click', (event) => {
    const kind = event.target.closest('[data-admin-kind]')?.dataset.adminKind;
    if (!kind) return;
    state.adminPartnerKind = kind;
    renderAdminPartners();
  });

  $('admin-partners-list').addEventListener('click', (event) => {
    const approveId = event.target.dataset.approveBusiness;
    const toggleId = event.target.dataset.toggleBusiness;

    if (approveId) {
      const item = state.businesses.find((business) => business.id === approveId);
      if (item) wrap(() => updateBusinessModeration(approveId, { is_approved: !item.is_approved }));
    }

    if (toggleId) {
      const item = state.businesses.find((business) => business.id === toggleId);
      if (item) wrap(() => updateBusinessModeration(toggleId, { is_active: !item.is_active }));
    }
  });

  $('admin-pets-list').addEventListener('click', (event) => {
    const petId = event.target.closest('[data-admin-pet-toggle]')?.dataset.adminPetToggle;
    if (!petId) return;
    state.expandedAdminPets = state.expandedAdminPets.includes(petId)
      ? state.expandedAdminPets.filter((id) => id !== petId)
      : [...state.expandedAdminPets, petId];
    renderAdminPets();
  });
}

async function wrap(task) {
  try {
    await task();
  } catch (error) {
    showMessage(error.message || 'მოქმედება ვერ შესრულდა.', true);
  }
}

bindEvents();
loadSession().catch((error) => showMessage(error.message, true));
