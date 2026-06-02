import { supabase } from './supabase';

export const SHOP_ORDER_STATUSES = ['new', 'confirmed', 'done', 'cancelled'];

function parsePrice(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function normalizeFunctionError(error) {
  if (!error?.context) {
    return error;
  }

  try {
    const payload = await error.context.clone().json();
    if (payload?.error) {
      return {
        ...error,
        message: payload.error,
      };
    }
  } catch (_error) {
    try {
      const rawText = await error.context.clone().text();
      if (rawText?.trim()) {
        return {
          ...error,
          message: rawText.trim(),
        };
      }
    } catch (_textError) {
      // Fall back to the original message when the response body can't be parsed.
    }
  }

  if (error?.context?.status) {
    return {
      ...error,
      message:
        error.context.status === 401
          ? 'შეკვეთის გასაგზავნად ხელახლა შედი აპში და კიდევ სცადე.'
          : `სერვერმა დააბრუნა შეცდომა (${error.context.status}).`,
    };
  }

  return error;
}

function mapProduct(item) {
  return {
    id: item.id,
    title: item.title ?? '',
    description: item.description ?? '',
    image_url: item.image_url ?? '',
    is_active: item.is_active !== false,
    currency: item.currency ?? 'GEL',
    price_value: parsePrice(item.price_value),
    created_at: item.created_at ?? null,
  };
}

function mapOrder(item) {
  return {
    id: item.id,
    product_id: item.product_id ?? null,
    buyer_id: item.buyer_id ?? null,
    buyer_name: item.buyer_name ?? '',
    phone: item.phone ?? '',
    quantity: Number(item.quantity ?? 1),
    note: item.note ?? '',
    status: item.status ?? 'new',
    product_title: item.product_title ?? item.shop_products?.title ?? '',
    product_price: parsePrice(item.product_price),
    created_at: item.created_at ?? null,
    product_image_url: item.shop_products?.image_url ?? '',
  };
}

export function formatProductPrice(item) {
  if (item?.price_value === null || item?.price_value === undefined) {
    return 'ფასი შეთანხმებით';
  }

  if ((item.currency || 'GEL') === 'USD') {
    return `$${Number(item.price_value).toFixed(2)}`;
  }

  return `${Number(item.price_value).toFixed(2)} ₾`;
}

export function formatOrderStatus(status) {
  if (status === 'confirmed') return 'დადასტურებული';
  if (status === 'done') return 'შესრულებული';
  if (status === 'cancelled') return 'გაუქმებული';
  return 'ახალი';
}

export async function fetchPublicShopProducts() {
  const { data, error } = await supabase
    .from('shop_products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  return {
    data: (data ?? []).map(mapProduct),
    error,
  };
}

export async function fetchAdminShopProducts() {
  const { data, error } = await supabase
    .from('shop_products')
    .select('*')
    .order('created_at', { ascending: false });

  return {
    data: (data ?? []).map(mapProduct),
    error,
  };
}

export async function fetchAdminShopOrders() {
  const { data, error } = await supabase
    .from('shop_orders')
    .select('*, shop_products(title, image_url)')
    .order('created_at', { ascending: false });

  return {
    data: (data ?? []).map(mapOrder),
    error,
  };
}

export async function saveShopProduct(payload, currentId = null) {
  const productPayload = {
    title: payload.title?.trim() ?? '',
    description: payload.description?.trim() ?? '',
    image_url: payload.image_url ?? null,
    is_active: payload.is_active !== false,
    currency: payload.currency === 'USD' ? 'USD' : 'GEL',
    price_value: parsePrice(payload.price_value),
  };

  if (currentId) {
    return supabase.from('shop_products').update(productPayload).eq('id', currentId);
  }

  return supabase.from('shop_products').insert([productPayload]);
}

export async function deleteShopProduct(id) {
  return supabase.from('shop_products').delete().eq('id', id);
}

export async function createShopOrder(payload) {
  const orderPayload = {
    product_id: payload.product_id,
    buyer_id: payload.buyer_id ?? null,
    buyer_name: payload.buyer_name?.trim() ?? '',
    phone: payload.phone?.trim() ?? '',
    quantity: Number(payload.quantity ?? 1),
    note: payload.note?.trim() || null,
    status: 'new',
    product_title: payload.product_title ?? '',
    product_price: parsePrice(payload.product_price),
  };

  const result = await supabase.functions.invoke('create-shop-order', {
    body: orderPayload,
  });

  return {
    data: result.data,
    error: result.error ? await normalizeFunctionError(result.error) : null,
  };
}

export async function updateShopOrderStatus(id, status) {
  return supabase.from('shop_orders').update({ status }).eq('id', id);
}
