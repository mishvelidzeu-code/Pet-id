import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export default function AppUpdateManager() {
  const lastCheckRef = useRef(0);
  const isCheckingRef = useRef(false);
  const promptedUpdateIdRef = useRef(null);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) {
      return undefined;
    }

    let isMounted = true;

    async function promptReload(updateId) {
      if (!isMounted || promptedUpdateIdRef.current === updateId) {
        return;
      }

      promptedUpdateIdRef.current = updateId;

      Alert.alert(
        'ახალი განახლება მზადაა',
        'აპის ახალი ვერსია ჩაიტვირთა. გინდა ახლავე განახლდეს?',
        [
          { text: 'მოგვიანებით', style: 'cancel' },
          {
            text: 'განახლება',
            onPress: async () => {
              try {
                await Updates.reloadAsync();
              } catch (error) {
                Alert.alert(
                  'განახლება ვერ ჩაირთო',
                  error?.message || 'ცადე აპის თავიდან გახსნა.'
                );
              }
            },
          },
        ]
      );
    }

    async function checkForUpdates(force = false) {
      const now = Date.now();

      if (isCheckingRef.current) {
        return;
      }

      if (!force && now - lastCheckRef.current < CHECK_INTERVAL_MS) {
        return;
      }

      isCheckingRef.current = true;
      lastCheckRef.current = now;

      try {
        const update = await Updates.checkForUpdateAsync();

        if (!update.isAvailable) {
          return;
        }

        const fetched = await Updates.fetchUpdateAsync();

        if (!fetched.isNew && !fetched.isRollBackToEmbedded) {
          return;
        }

        const updateId = fetched.isNew
          ? fetched.manifest?.id || update.manifest?.id || 'downloaded-update'
          : 'embedded-rollback';

        await promptReload(updateId);
      } catch (error) {
        console.log('OTA update check skipped:', error?.message || error);
      } finally {
        isCheckingRef.current = false;
      }
    }

    checkForUpdates(true);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkForUpdates();
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return null;
}
