import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const SUPPORT_EMAIL = 'geogeorgia150@gmail.com';

type ShopProductRow = {
  id: string;
  title: string;
  description: string | null;
  price_value: number | null;
  currency: string | null;
  is_active: boolean | null;
};

type PushTokenRow = {
  id: string;
  user_id: string;
  expo_push_token: string;
};

type OrderRequestPayload = {
  product_id?: string;
  buyer_name?: string;
  phone?: string;
  quantity?: number;
  note?: string | null;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function formatPrice(value: number | null, currency: string | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'ფასი შეთანხმებით';
  }

  const formatted = Number(value).toFixed(2);
  return (currency ?? 'GEL') === 'USD' ? `$${formatted}` : `${formatted} ₾`;
}

async function resolveAdminUserIds(adminClient: ReturnType<typeof createClient>) {
  const adminUserIds = new Set<string>();

  const { data: adminProfiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('is_admin', true);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  for (const item of adminProfiles ?? []) {
    if (typeof item?.id === 'string') {
      adminUserIds.add(item.id);
    }
  }

  const { data: usersPage, error: usersError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (usersError) {
    throw new Error(usersError.message);
  }

  const supportUser = usersPage?.users?.find(
    (item) => (item.email ?? '').toLowerCase() === SUPPORT_EMAIL
  );

  if (supportUser?.id) {
    adminUserIds.add(supportUser.id);
  }

  return Array.from(adminUserIds);
}

async function sendAdminOrderPush({
  adminClient,
  orderId,
  buyerName,
  phone,
  quantity,
  note,
  product,
}: {
  adminClient: ReturnType<typeof createClient>;
  orderId: string;
  buyerName: string;
  phone: string;
  quantity: number;
  note: string | null;
  product: ShopProductRow;
}) {
  const adminUserIds = await resolveAdminUserIds(adminClient);

  if (!adminUserIds.length) {
    return {
      sentCount: 0,
      failedCount: 0,
      warning: 'ადმინის მომხმარებელი ვერ მოიძებნა push შეტყობინებისთვის.',
    };
  }

  const { data: tokenRows, error: tokenError } = await adminClient
    .from('push_tokens')
    .select('id, user_id, expo_push_token')
    .eq('is_active', true)
    .in('user_id', adminUserIds);

  if (tokenError) {
    return {
      sentCount: 0,
      failedCount: 0,
      warning: tokenError.message,
    };
  }

  const uniqueTokens = Array.from(
    new Map(
      (tokenRows ?? []).map((item: PushTokenRow) => [
        item.expo_push_token,
        item,
      ])
    ).values()
  );

  if (!uniqueTokens.length) {
    return {
      sentCount: 0,
      failedCount: 0,
      warning: 'ადმინის აქტიური push token ვერ მოიძებნა.',
    };
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const tokenChunk of chunkArray(uniqueTokens, 100)) {
    const messages = tokenChunk.map((item) => ({
      to: item.expo_push_token,
      sound: 'default',
      title: 'ახალი შეკვეთა',
      body: `${buyerName} • ${product.title}`,
      data: {
        screen: 'Admin',
        params: {
          adminTab: 'shop',
        },
        type: 'shop_order',
        orderId,
        productId: product.id,
        buyerName,
        phone,
        quantity,
        note: note ?? '',
      },
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    let payload: Record<string, unknown> = {};

    try {
      payload = await response.json();
    } catch (_error) {
      payload = {};
    }

    if (!response.ok) {
      failedCount += tokenChunk.length;
      continue;
    }

    const resultItems = Array.isArray(payload?.data) ? payload.data : [];

    resultItems.forEach((item) => {
      const result = item && typeof item === 'object'
        ? (item as Record<string, unknown>)
        : null;

      if (result?.status === 'ok') {
        sentCount += 1;
      } else {
        failedCount += 1;
      }
    });
  }

  return {
    sentCount,
    failedCount,
    warning:
      sentCount > 0
        ? null
        : 'push შეტყობინება ვერ გაიგზავნა ადმინის მოწყობილობაზე.',
  };
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: 'Supabase environment is not configured.' });
  }

  const authHeader = request.headers.get('Authorization') ?? '';

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader
        ? {
            Authorization: authHeader,
          }
        : {},
    },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  let buyerUserId: string | null = null;

  if (authHeader) {
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (!userError && user?.id) {
      buyerUserId = user.id;
    }
  }

  let payload: OrderRequestPayload;

  try {
    payload = await request.json();
  } catch (_error) {
    return jsonResponse(400, { error: 'Invalid JSON body.' });
  }

  const productId = payload.product_id?.trim();
  const buyerName = payload.buyer_name?.trim();
  const phone = payload.phone?.trim();
  const quantity = Number(payload.quantity ?? 1);
  const note = payload.note?.trim() || null;

  if (!productId) {
    return jsonResponse(400, { error: 'product_id is required.' });
  }

  if (!buyerName) {
    return jsonResponse(400, { error: 'buyer_name is required.' });
  }

  if (!phone) {
    return jsonResponse(400, { error: 'phone is required.' });
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    return jsonResponse(400, { error: 'quantity must be an integer greater than 0.' });
  }

  const { data: product, error: productError } = await adminClient
    .from('shop_products')
    .select('id, title, description, price_value, currency, is_active')
    .eq('id', productId)
    .maybeSingle<ShopProductRow>();

  if (productError) {
    return jsonResponse(500, { error: productError.message });
  }

  if (!product || product.is_active === false) {
    return jsonResponse(404, { error: 'Product not found.' });
  }

  const { data: orderRecord, error: orderError } = await adminClient
    .from('shop_orders')
    .insert([
      {
        product_id: product.id,
        buyer_id: buyerUserId,
        buyer_name: buyerName,
        phone,
        quantity,
        note,
        status: 'new',
        product_title: product.title,
        product_price: product.price_value,
      },
    ])
    .select('id')
    .single();

  if (orderError || !orderRecord) {
    return jsonResponse(500, {
      error: orderError?.message || 'Order could not be created.',
    });
  }

  let pushResult = {
    sentCount: 0,
    failedCount: 0,
    warning: null as string | null,
  };

  try {
    pushResult = await sendAdminOrderPush({
      adminClient,
      orderId: orderRecord.id,
      buyerName,
      phone,
      quantity,
      note,
      product,
    });
  } catch (error) {
    pushResult = {
      sentCount: 0,
      failedCount: 0,
      warning:
        error instanceof Error
          ? error.message
          : 'Admin notification could not be delivered.',
    };
  }

  return jsonResponse(200, {
    orderId: orderRecord.id,
    adminNotified: pushResult.sentCount > 0,
    sentCount: pushResult.sentCount,
    failedCount: pushResult.failedCount,
    productTitle: product.title,
    productPrice: formatPrice(product.price_value, product.currency),
    warning: pushResult.warning,
  });
});
