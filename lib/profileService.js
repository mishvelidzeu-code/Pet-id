import { supabase } from './supabase';

function safeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function ensureProfileRow(user, overrides = {}) {
  const userId = user?.id;

  if (!userId) {
    return { data: null, error: new Error('მომხმარებლის id ვერ მოიძებნა.') };
  }

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('full_name, phone_number')
    .eq('id', userId)
    .maybeSingle();

  if (existingProfileError) {
    return { data: null, error: existingProfileError };
  }

  const fullName =
    safeString(overrides.full_name) ||
    safeString(existingProfile?.full_name) ||
    safeString(user?.user_metadata?.full_name) ||
    safeString(user?.user_metadata?.name) ||
    '';

  const phoneNumber =
    safeString(overrides.phone_number) ||
    safeString(existingProfile?.phone_number) ||
    safeString(user?.phone) ||
    safeString(user?.user_metadata?.phone_number) ||
    '';

  return supabase
    .from('profiles')
    .upsert(
      [
        {
          id: userId,
          full_name: fullName,
          phone_number: phoneNumber,
        },
      ],
      {
        onConflict: 'id',
      }
    )
    .select()
    .maybeSingle();
}
