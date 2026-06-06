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
};

const $ = (id) => document.getElementById(id);

const views = ['dashboard', 'profile', 'products', 'services', 'orders', 'requests', 'approvals'];
const pageTitles = {
  dashboard: 'დეშბორდი',
  profile: 'ბიზნეს პროფილი',
  products: 'პროდუქტები',
  services: 'სერვისები',
  orders: 'შეკვეთები',
  requests: 'მოთხოვნები',
  approvals: 'დადასტურება',
};

function activeBusiness() {
  return state.businesses.find((item) => item.id === state.activeBusinessId) || null;
}

function showMessage(text, isError = false) {
  const box = $('message');
  box.textContent = text;
  box.classList.toggle('is-error', isError);
  box.classList.remove('is-hidden');
  window.setTimeout(() => box.classList.add('is-hidden'), 4200);
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
  await Promise.all([loadProducts(), loadServices(), loadOrders(), loadRequests()]);
  renderAll();
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
  renderApprovals();
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
  $('stat-businesses').textContent = state.businesses.length;
  $('stat-products').textContent = state.products.length;
  $('stat-services').textContent = state.services.length;
  $('stat-orders').textContent = state.orders.length + state.requests.length;
  if ($('stat-pending')) $('stat-pending').textContent = pendingCount;
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
      (item) => `
        <article class="list-item">
          <img class="list-thumb" src="${escapeHtml(item.image_url || '')}" alt="" />
          <div>
            <h3 class="list-title">${escapeHtml(item.title)}</h3>
            <p class="list-meta">${escapeHtml(item.category || 'კატეგორია არ აქვს')} · ${formatPrice(item.price_value, item.currency)}</p>
            <span class="chip">${item.is_active ? 'აქტიური' : 'გამორთული'}</span>
          </div>
          <div class="item-actions">
            <button class="secondary-button" type="button" data-edit-product="${item.id}">რედაქტირება</button>
            <button class="danger-button" type="button" data-delete-product="${item.id}">წაშლა</button>
          </div>
        </article>
      `
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
            <span class="chip">${escapeHtml(item.status || 'new')}</span>
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
            <span class="chip">${escapeHtml(item.status || 'new')}</span>
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

async function updateRequestStatus(id, status) {
  const { error } = await client.from('business_booking_requests').update({ status }).eq('id', id);
  if (error) throw error;
  showMessage('მოთხოვნის სტატუსი განახლდა.');
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
            <span class="chip">${item.is_approved ? 'approved' : 'waiting'}</span>
            <span class="chip">${item.is_active ? 'active' : 'hidden'}</span>
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

  const uploadedUrl = await uploadFile('product-image-file', 'products');
  const payload = {
    business_id: business.id,
    title: $('product-title').value.trim(),
    description: $('product-description').value.trim() || null,
    image_url: uploadedUrl || $('product-image-url').value.trim() || null,
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
  $('product-image-url').value = item.image_url || '';
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
  showMessage('შეკვეთის სტატუსი განახლდა.');
  await loadOrders();
  renderOrders();
}

async function updateBusinessModeration(id, payload) {
  if (!state.isAdmin) {
    showMessage('ეს მოქმედება მხოლოდ ადმინისთვისაა.', true);
    return;
  }

  const { error } = await client.from('business_profiles').update(payload).eq('id', id);
  if (error) throw error;
  showMessage('ბიზნესის სტატუსი განახლდა.');
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
