import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {
  normalizeNotificationTarget,
  registerPushToken,
} from '../lib/pushNotifications';
import {
  flushPendingNotificationTarget,
  navigateFromNotification,
  setPendingNotificationTarget,
} from '../lib/navigation';

export default function PushNotificationManager({ session }) {
  const registeredUserIdRef = useRef(null);
  const handledResponseIdRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function syncPushToken() {
      if (!session?.user?.id || registeredUserIdRef.current === session.user.id) {
        return;
      }

      try {
        await registerPushToken(session.user.id);
        if (isMounted) {
          registeredUserIdRef.current = session.user.id;
        }
      } catch (error) {
        console.log('Push token registration skipped:', error?.message || error);
      }
    }

    syncPushToken();

    if (!session?.user?.id) {
      registeredUserIdRef.current = null;
    }

    return () => {
      isMounted = false;
    };
  }, [session]);

  useEffect(() => {
    async function handleInitialResponse() {
      const response = await Notifications.getLastNotificationResponseAsync();
      const responseId = response?.notification?.request?.identifier;

      if (!responseId || handledResponseIdRef.current === responseId) {
        return;
      }

      const target = normalizeNotificationTarget(
        response?.notification?.request?.content?.data
      );

      if (!target) {
        return;
      }

      handledResponseIdRef.current = responseId;
      setPendingNotificationTarget(target);
      flushPendingNotificationTarget();
    }

    handleInitialResponse().catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const responseId = response?.notification?.request?.identifier;

        if (!responseId || handledResponseIdRef.current === responseId) {
          return;
        }

        const target = normalizeNotificationTarget(
          response?.notification?.request?.content?.data
        );

        handledResponseIdRef.current = responseId;

        if (!target) {
          return;
        }

        navigateFromNotification(target);
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    flushPendingNotificationTarget();
  }, [session]);

  return null;
}
