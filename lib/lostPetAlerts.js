import { supabase } from './supabase';

async function normalizeFunctionError(error) {
  if (!error?.context) return error;

  try {
    const payload = await error.context.clone().json();
    if (payload?.error) return new Error(payload.error);
  } catch (_error) {
    // Fall back to the original function error.
  }

  return error;
}

async function invokeLostPetAction(body) {
  const result = await supabase.functions.invoke('manage-lost-pet-alert', { body });

  return {
    data: result.data,
    error: result.error ? await normalizeFunctionError(result.error) : null,
  };
}

export function updateLostPetMode(petId, shouldEnable) {
  return invokeLostPetAction({
    action: shouldEnable ? 'request' : 'cancel',
    petId,
  });
}

export function approveLostPetAlert(requestId) {
  return invokeLostPetAction({
    action: 'approve',
    requestId,
  });
}
