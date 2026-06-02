import AsyncStorage from '@react-native-async-storage/async-storage';

function getStorageKey(userId) {
  return `primary_pet_id:${userId}`;
}

export async function getStoredPrimaryPetId(userId) {
  if (!userId) {
    return null;
  }

  try {
    return await AsyncStorage.getItem(getStorageKey(userId));
  } catch (_error) {
    return null;
  }
}

export async function setStoredPrimaryPetId(userId, petId) {
  if (!userId) {
    return;
  }

  try {
    if (!petId) {
      await AsyncStorage.removeItem(getStorageKey(userId));
      return;
    }

    await AsyncStorage.setItem(getStorageKey(userId), String(petId));
  } catch (_error) {
    // Ignore storage errors and keep the app responsive.
  }
}
