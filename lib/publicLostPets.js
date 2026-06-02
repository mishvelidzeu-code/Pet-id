import { supabase } from './supabase';

function mapPublicLostPet(item) {
  if (!item) {
    return null;
  }

  return {
    ...item,
    profiles: {
      full_name: item.owner_full_name ?? '',
      phone_number: item.owner_phone_number ?? '',
    },
  };
}

export async function fetchPublicLostPets() {
  const { data, error } = await supabase.rpc('list_public_lost_pets');

  return {
    data: (data ?? []).map(mapPublicLostPet),
    error,
  };
}

export async function findPublicLostPetByCode(petCode) {
  const { data, error } = await supabase.rpc('find_public_lost_pet_by_code', {
    pet_code: petCode,
  });

  return {
    data: mapPublicLostPet(data?.[0] ?? null),
    error,
  };
}
