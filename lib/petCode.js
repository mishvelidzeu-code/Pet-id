import { supabase } from './supabase';

export const PET_CODE_MIN_LENGTH = 3;

export function normalizePetCode(value = '') {
  return String(value).trim();
}

export function validatePetCode(value) {
  const normalized = normalizePetCode(value);

  if (!normalized) {
    return 'Pet ID სავალდებულოა.';
  }

  if (normalized.length < PET_CODE_MIN_LENGTH) {
    return `Pet ID უნდა იყოს მინიმუმ ${PET_CODE_MIN_LENGTH} სიმბოლო.`;
  }

  return null;
}

export async function ensurePetCodeIsUnique(code, currentId = null) {
  const normalized = normalizePetCode(code);
  const validationError = validatePetCode(normalized);

  if (validationError) {
    throw new Error(validationError);
  }

  const { data, error } = await supabase.rpc('is_pet_code_available', {
    pet_code: normalized,
    current_pet_id: currentId,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('ეს Pet ID უკვე გამოყენებულია სხვა ცხოველისთვის.');
  }

  return normalized;
}
