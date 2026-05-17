import { db } from './firebase.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collectionGroup,
} from 'firebase/firestore';
import { toast } from 'sonner';

/**
 * Subscribes to the /announcements collection ordered by timestamp descending.
 * Calls callback with a mapped array of plain objects on every snapshot.
 * Returns the Firestore unsubscribe function.
 *
 * @param {function} callback - Called with the mapped announcements array on each update.
 * @returns {function} Firestore unsubscribe function.
 */
export function subscribeToAnnouncements(callback) {
  const q = query(
    collection(db, 'announcements'),
    orderBy('timestamp', 'desc')
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const announcements = snapshot.docs.map((document) => ({
        id: document.id,
        title: document.data().title ?? '',
        content: document.data().content ?? '',
        timestamp: document.data().timestamp ?? null,
        category: document.data().category ?? '',
        subtitle: document.data().subtitle ?? '',
        name: document.data().name ?? '',
        age: document.data().age ?? '',
        sex: document.data().sex ?? '',
        contact: document.data().contact ?? '',
        incident_date: document.data().incident_date ?? '',
        incident_time: document.data().incident_time ?? '',
        location_address: document.data().location_address ?? '',
        latitude: document.data().latitude ?? null,
        longitude: document.data().longitude ?? null,
        image_url: document.data().image_url ?? '',
        imageUrl: document.data().imageUrl ?? document.data().image_url ?? '',
        status: document.data().status ?? '',
      }));

      callback(announcements);
    },
    (error) => {
      console.error(error);
      toast.error('Failed to load announcements');
    }
  );

  return unsubscribe;
}

/**
 * Creates a new announcement in the /announcements collection.
 * Validates that title is non-empty before any Firestore call.
 * The `content` field is optional — the form uses `subtitle` for description.
 *
 * @param {{ title: string, imageUrl?: string, [key: string]: any }} params
 * @returns {Promise<void>}
 * @throws {TypeError} If title is empty or whitespace-only.
 */
export async function createAnnouncement({ title, content, imageUrl, ...rest }) {
  if (!title || !title.trim()) {
    throw new TypeError('Announcement title cannot be empty');
  }
  if (content !== undefined && (!content || !content.trim())) {
    throw new TypeError('Announcement content cannot be empty');
  }

  await addDoc(collection(db, 'announcements'), {
    title: title.trim(),
    // content is optional — store it if provided, otherwise omit
    ...(content && content.trim() ? { content: content.trim() } : {}),
    // imageUrl from Cloudinary upload
    ...(imageUrl ? { imageUrl } : {}),
    ...rest,
    timestamp: serverTimestamp(),
  });
}

/**
 * Subscribes to the /announcements/{announcementId}/comments subcollection
 * ordered by timestamp ascending.
 * Calls callback with a mapped array of plain objects on every snapshot.
 * Returns the Firestore unsubscribe function.
 *
 * @param {string} announcementId - The ID of the parent announcement document.
 * @param {function} callback - Called with the mapped comments array on each update.
 * @returns {function} Firestore unsubscribe function.
 * @throws {TypeError} If announcementId is empty or falsy.
 */
export function subscribeToComments(announcementId, callback) {
  if (!announcementId || !String(announcementId).trim()) {
    throw new TypeError('announcementId cannot be empty');
  }

  const q = query(
    collection(db, 'announcements', announcementId, 'comments'),
    orderBy('timestamp', 'asc')
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map((document) => ({
      id: document.id,
      userId: document.data().userId ?? '',
      text: document.data().text ?? '',
      timestamp: document.data().timestamp ?? null,
    }));

    callback(comments);
  });

  return unsubscribe;
}

/**
 * Posts a new comment to the /announcements/{announcementId}/comments subcollection.
 * Validates that announcementId is non-empty before any Firestore call.
 *
 * @param {string} announcementId - The ID of the parent announcement document.
 * @param {{ userId: string, text: string }} comment - The comment data.
 * @returns {Promise<void>}
 * @throws {TypeError} If announcementId is empty or falsy.
 */
export async function postComment(announcementId, { userId, text }) {
  if (!announcementId || !String(announcementId).trim()) {
    throw new TypeError('announcementId cannot be empty');
  }

  await addDoc(collection(db, 'announcements', announcementId, 'comments'), {
    userId,
    text,
    timestamp: serverTimestamp(),
  });
}

/**
 * Deletes an announcement document from the /announcements collection.
 *
 * @param {string} announcementId - The ID of the announcement to delete.
 * @returns {Promise<void>}
 */
export async function deleteAnnouncement(announcementId) {
  await deleteDoc(doc(db, 'announcements', announcementId));
}

/**
 * Updates the status field of an announcement document.
 *
 * @param {string} announcementId - The ID of the announcement to update.
 * @param {string} status - The new status value.
 * @returns {Promise<void>}
 */
export async function updateAnnouncementStatus(announcementId, status) {
  await updateDoc(doc(db, 'announcements', announcementId), { status });
}
