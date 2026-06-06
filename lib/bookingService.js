import { supabase } from './supabase';

export const BOOKING_REQUEST_STATUSES = ['new', 'confirmed', 'done', 'cancelled'];

export function formatBookingStatus(status) {
  if (status === 'confirmed') return 'დადასტურებული';
  if (status === 'done') return 'შესრულებული';
  if (status === 'cancelled') return 'გაუქმებული';
  return 'ახალი';
}

export async function createBookingRequest(payload) {
  const requestPayload = {
    business_id: payload.business_id,
    requester_id: payload.requester_id ?? null,
    requester_name: payload.requester_name?.trim() ?? '',
    phone: payload.phone?.trim() ?? '',
    note: payload.note?.trim() || null,
    status: 'new',
  };

  return supabase.from('business_booking_requests').insert([requestPayload]).select('id').single();
}
