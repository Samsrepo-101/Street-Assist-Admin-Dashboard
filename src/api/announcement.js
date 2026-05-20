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
  getDoc,
  deleteField,
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
export function mapRawAnnouncementStatus(status) {
  if (!status) return 'Reported';
  const s = String(status).trim();
  if (s === 'Reported' || s === 'Verified by Police' || s === 'Search Ongoing' || s === 'Resolved' || s === 'Case Closed') {
    return s;
  }
  const lower = s.toLowerCase();
  if (lower === 'verified' || lower === 'verified by police' || lower === 'verified_by_police') return 'Verified by Police';
  if (lower === 'ongoing' || lower === 'search ongoing' || lower === 'search_ongoing') return 'Search Ongoing';
  if (lower === 'resolved') return 'Resolved';
  if (lower === 'closed' || lower === 'case closed' || lower === 'case_closed') return 'Case Closed';
  if (lower === 'open') return 'Reported';
  return 'Reported';
}

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
        evidenceUrl: document.data().evidenceUrl ?? '',
        evidenceUrls: document.data().evidenceUrls ?? (document.data().evidenceUrl ? [document.data().evidenceUrl] : []),
        status: mapRawAnnouncementStatus(document.data().status ?? ''),
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
export async function createAnnouncement({ title, content, imageUrl, status, ...rest }) {
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
    status: status ? mapRawAnnouncementStatus(status) : 'Reported',
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

  const annRef = doc(db, 'announcements', announcementId);
  const annSnap = await getDoc(annRef);
  if (annSnap.exists()) {
    const annData = annSnap.data();
    if (annData && mapRawAnnouncementStatus(annData.status) === 'Case Closed') {
      throw new Error('This case has been closed and can no longer receive updates.');
    }
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
export async function updateAnnouncementStatus(announcementId, status, evidenceUrls = []) {
  const mapped = mapRawAnnouncementStatus(status);
  const annRef = doc(db, 'announcements', announcementId);

  const updatePayload = { status: mapped };
  if (evidenceUrls === null || (Array.isArray(evidenceUrls) && evidenceUrls.length === 0)) {
    updatePayload.evidenceUrl = deleteField();
    updatePayload.evidenceUrls = deleteField();
  } else {
    updatePayload.evidenceUrls = Array.isArray(evidenceUrls) ? evidenceUrls : [evidenceUrls];
    updatePayload.evidenceUrl = Array.isArray(evidenceUrls) ? (evidenceUrls[0] || '') : evidenceUrls;
  }

  await updateDoc(annRef, updatePayload);
}

/**
 * Updates an announcement document in the /announcements collection.
 * Validates that the title is non-empty if it is being updated.
 *
 * @param {string} announcementId - The ID of the announcement to update.
 * @param {object} fields - The fields to update.
 * @returns {Promise<void>}
 */
export async function updateAnnouncement(announcementId, fields) {
  if (fields.title !== undefined && (!fields.title || !fields.title.trim())) {
    throw new TypeError('Announcement title cannot be empty');
  }

  const annRef = doc(db, 'announcements', announcementId);

  const updatedData = { ...fields };
  if (fields.title) updatedData.title = fields.title.trim();
  if (fields.status) updatedData.status = mapRawAnnouncementStatus(fields.status);

  await updateDoc(annRef, updatedData);
}
