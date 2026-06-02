import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const SUPPORT_EMAIL = 'geogeorgia150@gmail.com';

type Payload = {
  action?: 'request' | 'cancel' | 'approve';
  petId?: string;
  requestId?: string;
};

type PushTokenRow = {
  expo_push_token: string;
  user_id: string;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function resolveAdminUserIds(adminClient: ReturnType<typeof createClient>) {
  const adminIds = new Set<string>();
  const { data: profiles, error } = await adminClient
    .from('profiles')
    .select('id')
    .eq('is_admin', true);

  if (error) throw new Error(error.message);
  for (const item of profiles ?? []) {
    if (typeof item?.id === 'string') adminIds.add(item.id);
  }

  const { data: usersPage, error: usersError } =
    await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw new Error(usersError.message);

  for (const item of usersPage?.users ?? []) {
    if ((item.email ?? '').toLowerCase() === SUPPORT_EMAIL) {
      adminIds.add(item.id);
    }
  }

  return Array.from(adminIds);
}

async function sendPush(
  adminClient: ReturnType<typeof createClient>,
  userIds: string[] | null,
  message: Record<string, unknown>
) {
  let query = adminClient
    .from('push_tokens')
    .select('expo_push_token, user_id')
    .eq('is_active', true);

  if (userIds) {
    if (!userIds.length) return { sentCount: 0, failedCount: 0 };
    query = query.in('user_id', userIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const tokens = Array.from(
    new Map(
      (data ?? []).map((item: PushTokenRow) => [item.expo_push_token, item])
    ).values()
  );

  let sentCount = 0;
  let failedCount = 0;

  for (const chunk of chunkArray(tokens, 100)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk.map((item) => ({ ...message, to: item.expo_push_token }))),
    });

    const payload = await response.json().catch(() => ({}));
    const results = Array.isArray(payload?.data) ? payload.data : [];

    if (!response.ok) {
      failedCount += chunk.length;
      continue;
    }

    results.forEach((item: Record<string, unknown>) => {
      if (item?.status === 'ok') sentCount += 1;
      else failedCount += 1;
    });
  }

  return { sentCount, failedCount };
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Supabase environment is not configured.' });
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return jsonResponse(401, { error: 'Unauthorized.' });

  const payload = await request.json().catch(() => ({})) as Payload;
  const action = payload.action;

  if (action === 'request' || action === 'cancel') {
    const petId = payload.petId;
    if (!petId) return jsonResponse(400, { error: 'petId is required.' });

    const { data: pet } = await adminClient
      .from('pets')
      .select('id, owner_id, name, breed, short_code')
      .eq('id', petId)
      .maybeSingle();

    if (!pet || pet.owner_id !== user.id) return jsonResponse(403, { error: 'Pet owner access required.' });

    if (action === 'cancel') {
      await adminClient.from('pets').update({ is_lost: false }).eq('id', pet.id);
      await adminClient
        .from('lost_pet_alert_requests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('pet_id', pet.id)
        .eq('status', 'pending');
      return jsonResponse(200, { petId: pet.id, isLost: false });
    }

    await adminClient.from('pets').update({ is_lost: true }).eq('id', pet.id);
    const { data: existing } = await adminClient
      .from('lost_pet_alert_requests')
      .select('id')
      .eq('pet_id', pet.id)
      .eq('status', 'pending')
      .maybeSingle();

    let requestId = existing?.id;
    if (!requestId) {
      const { data: created, error } = await adminClient
        .from('lost_pet_alert_requests')
        .insert([{ pet_id: pet.id, requested_by: user.id }])
        .select('id')
        .single();
      if (error || !created) return jsonResponse(500, { error: error?.message ?? 'Request could not be created.' });
      requestId = created.id;
    }

    const adminIds = await resolveAdminUserIds(adminClient);
    const result = await sendPush(adminClient, adminIds, {
      sound: 'default',
      title: 'დაკარგული ცხოველი - დასადასტურებელია',
      body: `${pet.name || 'ცხოველი'} მონიშნულია დაკარგულად. გადაამოწმე და დაადასტურე საერთო შეტყობინება.`,
      data: { screen: 'Admin', params: { adminTab: 'notifications' }, type: 'lost_pet_review', requestId, petId: pet.id },
    });

    return jsonResponse(200, { requestId, petId: pet.id, isLost: true, adminNotified: result.sentCount > 0, ...result });
  }

  if (action === 'approve') {
    const requestId = payload.requestId;
    if (!requestId) return jsonResponse(400, { error: 'requestId is required.' });

    const { data: profile } = await adminClient.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    const isAdmin = Boolean(profile?.is_admin) || (user.email ?? '').toLowerCase() === SUPPORT_EMAIL;
    if (!isAdmin) return jsonResponse(403, { error: 'Admin access required.' });

    const { data: alertRequest } = await adminClient
      .from('lost_pet_alert_requests')
      .select('id, status, pet_id, pets(name, breed, location, short_code, is_lost)')
      .eq('id', requestId)
      .maybeSingle();

    const pet = alertRequest?.pets as Record<string, unknown> | null;
    if (!alertRequest || alertRequest.status !== 'pending' || !pet || pet.is_lost !== true) {
      return jsonResponse(400, { error: 'Pending lost pet request was not found.' });
    }

    const result = await sendPush(adminClient, null, {
      sound: 'default',
      title: 'დაკარგული ცხოველი',
      body: `${pet.name || 'ცხოველი'} დაიკარგა${pet.location ? ` - ${pet.location}` : ''}. დახმარებისთვის გახსენი აპი.`,
      data: { screen: 'Search', params: { searchView: 'lost' }, type: 'lost_pet_alert', petId: alertRequest.pet_id },
    });

    await adminClient
      .from('lost_pet_alert_requests')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sent_count: result.sentCount,
        failed_count: result.failedCount,
      })
      .eq('id', alertRequest.id);

    return jsonResponse(200, { requestId: alertRequest.id, ...result });
  }

  return jsonResponse(400, { error: 'Unsupported action.' });
});
