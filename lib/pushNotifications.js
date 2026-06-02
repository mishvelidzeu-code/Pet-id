import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { supabase } from './supabase';

const PROJECT_ID =
  Constants?.expoConfig?.extra?.eas?.projectId ||
  Constants?.easConfig?.projectId ||
  '33bbcaea-a2b0-4237-95f6-e1eae6b591c6';

export const APP_TAB_ROUTES = ['Search', 'Help', 'Shop', 'Profile', 'Events', 'Clinics', 'Admin'];

export function normalizeNotificationTarget(data = {}) {
  const screen = typeof data?.screen === 'string' ? data.screen : null;

  if (!screen || !APP_TAB_ROUTES.includes(screen)) {
    return null;
  }

  if (screen === 'Events') {
    return {
      screen: 'Search',
      params: {
        searchView: 'events',
      },
    };
  }

  if (screen === 'Clinics') {
    return {
      screen: 'Search',
      params: {
        searchView: 'clinics',
      },
    };
  }

  return {
    screen,
    params: data?.params && typeof data.params === 'object' ? data.params : undefined,
  };
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2e8b57',
  });
}

export async function registerPushToken(userId) {
  if (!userId || !Device.isDevice) {
    return null;
  }

  await ensureAndroidChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const permission = await Notifications.requestPermissionsAsync();
    finalStatus = permission.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({
    projectId: PROJECT_ID,
  });

  const payload = {
    user_id: userId,
    expo_push_token: tokenResponse.data,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    device_name: Device.modelName || null,
    app_version: Constants?.expoConfig?.version || Constants?.manifest2?.extra?.expoClient?.version || null,
    channel: Updates.channel || null,
    is_active: true,
    last_seen_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('push_tokens')
    .upsert(payload, { onConflict: 'expo_push_token' });

  if (error) {
    throw error;
  }

  return tokenResponse.data;
}

export async function deactivatePushToken(expoPushToken) {
  if (!expoPushToken) {
    return;
  }

  await supabase
    .from('push_tokens')
    .update({ is_active: false })
    .eq('expo_push_token', expoPushToken);
}
