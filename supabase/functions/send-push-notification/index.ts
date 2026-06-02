import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const SUPPORT_EMAIL = 'geogeorgia150@gmail.com';

type PushTokenRow = {
  id: string;
  expo_push_token: string;
  user_id: string;
};

type NotificationPayload = {
  title?: string;
  body?: string;
  targetType?: 'all' | 'user';
  targetUserId?: string | null;
  data?: Record<string, unknown>;
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

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
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
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin =
    Boolean(profile?.is_admin) ||
    (user.email ?? '').toLowerCase() === SUPPORT_EMAIL;

  if (!isAdmin) {
    return jsonResponse(403, { error: 'Admin access required.' });
  }

  let payload: NotificationPayload;

  try {
    payload = await request.json();
  } catch (_error) {
    return jsonResponse(400, { error: 'Invalid JSON body.' });
  }

  const title = payload.title?.trim();
  const body = payload.body?.trim();
  const targetType = payload.targetType === 'user' ? 'user' : 'all';
  const targetUserId = targetType === 'user' ? payload.targetUserId ?? null : null;
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};

  if (!title || !body) {
    return jsonResponse(400, { error: 'Title and body are required.' });
  }

  if (targetType === 'user' && !targetUserId) {
    return jsonResponse(400, { error: 'targetUserId is required for user notifications.' });
  }

  const { data: notificationRecord, error: notificationInsertError } = await adminClient
    .from('admin_notifications')
    .insert([
      {
        created_by: user.id,
        title,
        body,
        target_type: targetType,
        target_user_id: targetUserId,
        data,
        status: 'draft',
      },
    ])
    .select('id')
    .single();

  if (notificationInsertError || !notificationRecord) {
    return jsonResponse(500, {
      error: notificationInsertError?.message || 'Failed to create notification record.',
    });
  }

  let tokensQuery = adminClient
    .from('push_tokens')
    .select('id, expo_push_token, user_id')
    .eq('is_active', true);

  if (targetType === 'user' && targetUserId) {
    tokensQuery = tokensQuery.eq('user_id', targetUserId);
  }

  const { data: tokenRows, error: tokenError } = await tokensQuery;

  if (tokenError) {
    return jsonResponse(500, { error: tokenError.message });
  }

  const dedupedTokens = Array.from(
    new Map(
      (tokenRows ?? []).map((item: PushTokenRow) => [
        item.expo_push_token,
        item,
      ])
    ).values()
  );

  if (!dedupedTokens.length) {
    await adminClient
      .from('admin_notifications')
      .update({
        status: 'failed',
        sent_count: 0,
        failed_count: 0,
        sent_at: new Date().toISOString(),
      })
      .eq('id', notificationRecord.id);

    return jsonResponse(200, {
      notificationId: notificationRecord.id,
      sentCount: 0,
      failedCount: 0,
      message: 'No active push tokens found.',
    });
  }

  const receiptRows: Record<string, unknown>[] = [];

  for (const tokenChunk of chunkArray(dedupedTokens, 100)) {
    const messages = tokenChunk.map((item) => ({
      to: item.expo_push_token,
      sound: 'default',
      title,
      body,
      data,
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

    const expoResponse = await response.json();

    if (!response.ok) {
      return jsonResponse(500, {
        error: expoResponse?.errors?.[0]?.message || 'Expo push request failed.',
      });
    }

    const resultItems = Array.isArray(expoResponse?.data) ? expoResponse.data : [];

    resultItems.forEach((item: Record<string, unknown>, index: number) => {
      const source = tokenChunk[index];
      const status = item?.status === 'ok' ? 'pending' : 'error';
      const message =
        typeof item?.message === 'string'
          ? item.message
          : typeof item?.details === 'object' && item?.details
            ? JSON.stringify(item.details)
            : null;

      receiptRows.push({
        notification_id: notificationRecord.id,
        push_token_id: source?.id ?? null,
        expo_push_token: source?.expo_push_token ?? null,
        status,
        ticket_id: typeof item?.id === 'string' ? item.id : null,
        error_message: message,
      });
    });
  }

  if (receiptRows.length) {
    await adminClient.from('notification_receipts').insert(receiptRows);
  }

  const sentCount = receiptRows.filter((item) => item.status === 'pending').length;
  const failedCount = receiptRows.filter((item) => item.status === 'error').length;

  await adminClient
    .from('admin_notifications')
    .update({
      status: sentCount > 0 ? 'sent' : 'failed',
      sent_count: sentCount,
      failed_count: failedCount,
      sent_at: new Date().toISOString(),
    })
    .eq('id', notificationRecord.id);

  return jsonResponse(200, {
    notificationId: notificationRecord.id,
    sentCount,
    failedCount,
  });
});
