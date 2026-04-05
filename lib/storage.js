import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { CONTENT_MEDIA_BUCKET } from './adminConfig';

function getExtensionFromUri(uri = '') {
  const cleanUri = uri.split('?')[0];
  const parts = cleanUri.split('.');
  const extension = parts[parts.length - 1];

  if (!extension || extension.includes('/')) {
    return 'jpg';
  }

  return extension.toLowerCase();
}

function getMimeType(asset, extension) {
  if (asset?.mimeType) {
    return asset.mimeType;
  }

  if (extension === 'jpg' || extension === 'jpeg') {
    return 'image/jpeg';
  }

  if (extension === 'png') {
    return 'image/png';
  }

  if (extension === 'webp') {
    return 'image/webp';
  }

  if (extension === 'heic') {
    return 'image/heic';
  }

  return `image/${extension}`;
}

export async function uploadImageAsset(
  asset,
  { bucket = CONTENT_MEDIA_BUCKET, folder = 'uploads', prefix = 'image' } = {}
) {
  if (!asset?.base64) {
    throw new Error('სურათის მონაცემები ვერ მოიძებნა.');
  }

  const extension = getExtensionFromUri(asset.uri);
  const fileName = `${folder}/${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage.from(bucket).upload(fileName, decode(asset.base64), {
    contentType: getMimeType(asset, extension),
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}
