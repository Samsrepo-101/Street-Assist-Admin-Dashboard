export const PROOF_MEDIA_ACCEPT = 'image/jpeg,image/jpg,image/png,video/mp4,video/quicktime,video/webm';
export const MAX_PROOF_VIDEO_SECONDS = 10;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export function isVideoFile(file) {
  return VIDEO_TYPES.has(file?.type);
}

export { isVideoUrl, normalizeMediaUrl } from './mediaUrls.js';

export function getProofMediaLabel(count) {
  return `proof media item${count === 1 ? '' : 's'}`;
}

export function validateProofFile(file) {
  if (IMAGE_TYPES.has(file.type)) {
    if (file.size > 5 * 1024 * 1024) {
      return Promise.resolve(`${file.name} is larger than 5MB`);
    }
    return Promise.resolve('');
  }

  if (VIDEO_TYPES.has(file.type)) {
    if (file.size > 100 * 1024 * 1024) {
      return Promise.resolve(`${file.name} is larger than 100MB`);
    }
    return getVideoDuration(file).then((duration) => {
      if (duration > MAX_PROOF_VIDEO_SECONDS) {
        return `${file.name} is longer than ${MAX_PROOF_VIDEO_SECONDS} seconds`;
      }
      return '';
    });
  }

  return Promise.resolve(`${file.name} is not supported (JPG, PNG, MP4, MOV, or WebM only)`);
}

export async function filterValidProofFiles(files, onInvalid) {
  const valid = [];
  for (const file of files) {
    const error = await validateProofFile(file);
    if (error) {
      onInvalid?.(error);
    } else {
      valid.push(file);
    }
  }
  return valid;
}

function getVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration || 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(Number.POSITIVE_INFINITY);
    };
    video.src = url;
  });
}
