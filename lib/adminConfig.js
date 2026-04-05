export const SUPPORT_EMAIL = 'geogeorgia150@gmail.com';

export const ADMIN_EMAILS = [SUPPORT_EMAIL];

export const CONTENT_MEDIA_BUCKET = 'pet_photos';

export function isAdminUser(session, profile) {
  const email = session?.user?.email?.toLowerCase?.() ?? '';
  const role = typeof profile?.role === 'string' ? profile.role.toLowerCase() : '';

  return Boolean(
    profile?.is_admin ||
      role === 'admin' ||
      ADMIN_EMAILS.includes(email)
  );
}
