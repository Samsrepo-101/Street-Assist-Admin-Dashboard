/**
 * Collect report / announcement media URLs from common Firestore field names.
 */
export function collectMediaUrls(data = {}, { includeProof = false } = {}) {
  const urls = [];

  const add = (value) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    if (typeof value === 'string' && value.trim()) {
      urls.push(value.trim());
    }
  };

  add(data.photoUrl);
  add(data.photoURL);
  add(data.image_url);
  add(data.imageUrl);
  add(data.photoUrls);
  add(data.imageUrls);
  add(data.images);
  add(data.attachments);
  add(data.mediaUrls);
  add(data.media);
  add(data.media_url);
  add(data.evidenceUrl);
  add(data.evidenceUrls);

  if (includeProof) {
    add(data.proofImages);
    add(data.proof_urls);
  }

  return [...new Set(urls.filter(Boolean))];
}

export function isVideoUrl(url = '') {
  const value = String(url).toLowerCase().trim();
  if (!value) return false;
  if (value.includes('/video/upload/')) return true;
  if (value.includes('resource_type=video')) return true;
  if (/\.(mp4|mov|webm|m4v|avi|mkv)(\?|#|$)/i.test(value)) return true;
  if (/\/upload\/[^/]*v\d+\/[^/]+\.(mp4|mov|webm)/i.test(value)) return true;
  if (value.includes('/f_mp4') || value.includes('/f_webm') || value.includes(',f_mp4')) return true;
  if (value.includes('cloudinary.com') && /video|\.mp4|\.mov|\.webm/.test(value)) return true;
  return false;
}

/**
 * Normalize Cloudinary (and other) URLs for reliable image/video playback in the browser.
 */
export function normalizeMediaUrl(url = '') {
  const value = String(url).trim();
  if (!value) return '';

  let normalized = value.replace(/^http:\/\//i, 'https://');

  if (!isVideoUrl(normalized)) {
    return normalized;
  }

  if (normalized.includes('res.cloudinary.com')) {
    if (normalized.includes('/image/upload/')) {
      normalized = normalized.replace('/image/upload/', '/video/upload/');
    }
    if (!/\.(mp4|webm|mov)(\?|#|$)/i.test(normalized) && normalized.includes('/upload/')) {
      normalized = normalized.replace('/upload/', '/upload/f_mp4/');
    }
  }

  return normalized;
}
