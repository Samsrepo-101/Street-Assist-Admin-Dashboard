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
  if (s === 'Reported' || s === 'Verified by Police' || s === 'Search Ongoing' || s === 'Case Closed') {
    return s;
  }
  const lower = s.toLowerCase();
  if (lower === 'verified' || lower === 'verified by police' || lower === 'verified_by_police') return 'Verified by Police';
  if (lower === 'ongoing' || lower === 'search ongoing' || lower === 'search_ongoing') return 'Search Ongoing';
  if (lower === 'resolved' || lower === 'closed' || lower === 'case closed' || lower === 'case_closed') return 'Case Closed';
  if (lower === 'open') return 'Reported';
  return 'Reported';
}

function getResidentVisibilityPayload(isArchived, archivedAt = null) {
  return {
    archived_at: archivedAt,
    archivedAt,
    archived: isArchived,
    isArchived,
    is_archived: isArchived,
    visible_to_residents: !isArchived,
    visibleToResidents: !isArchived,
    isVisible: !isArchived,
    visible: !isArchived,
    active: !isArchived,
    isActive: !isArchived,
    published: !isArchived,
    isPublished: !isArchived,
    public: !isArchived,
    isPublic: !isArchived,
  };
}

function needsHiddenVisibilitySync(announcement) {
  return !announcement?.resident_visibility_synced;
}

export function subscribeToAnnouncements(callback) {
  const q = query(
    collection(db, 'announcements'),
    orderBy('timestamp', 'desc')
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const announcements = snapshot.docs.map((document) => {
        const data = document.data();
        const isArchived = !!data.archived_at || !!data.deleted_at;

        return {
          id: document.id,
          title: data.title ?? '',
          content: data.content ?? '',
          timestamp: data.timestamp ?? null,
          category: data.category ?? '',
          subtitle: data.subtitle ?? '',
          name: data.name ?? '',
          age: data.age ?? '',
          sex: data.sex ?? '',
          contact: data.contact ?? '',
          incident_date: data.incident_date ?? '',
          incident_time: data.incident_time ?? '',
          location_address: data.location_address ?? '',
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          image_url: data.image_url ?? '',
          imageUrl: data.imageUrl ?? data.image_url ?? '',
          evidenceUrl: data.evidenceUrl ?? '',
          evidenceUrls: data.evidenceUrls ?? (data.evidenceUrl ? [data.evidenceUrl] : []),
          status: mapRawAnnouncementStatus(data.status ?? ''),
          deleted_at: data.deleted_at ?? null,
          archived_at: data.archived_at ?? null,
          archivedAt: data.archivedAt ?? data.archived_at ?? null,
          archived: data.archived ?? isArchived,
          isArchived: data.isArchived ?? isArchived,
          is_archived: data.is_archived ?? isArchived,
          visible_to_residents: data.visible_to_residents ?? !isArchived,
          visibleToResidents: data.visibleToResidents ?? data.visible_to_residents ?? !isArchived,
          isVisible: data.isVisible ?? data.visible_to_residents ?? !isArchived,
          visible: data.visible ?? !isArchived,
          active: data.active ?? !isArchived,
          isActive: data.isActive ?? !isArchived,
          published: data.published ?? !isArchived,
          isPublished: data.isPublished ?? !isArchived,
          public: data.public ?? !isArchived,
          isPublic: data.isPublic ?? !isArchived,
          resident_visibility_synced:
            (!isArchived || data.archivedAt != null) &&
            data.archived === isArchived &&
            data.isArchived === isArchived &&
            data.is_archived === isArchived &&
            data.visible_to_residents === !isArchived &&
            data.visibleToResidents === !isArchived &&
            data.isVisible === !isArchived &&
            data.visible === !isArchived &&
            data.active === !isArchived &&
            data.isActive === !isArchived &&
            data.published === !isArchived &&
            data.isPublished === !isArchived &&
            data.public === !isArchived &&
            data.isPublic === !isArchived,
        };
      });

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
    ...getResidentVisibilityPayload(false),
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
    const comments = snapshot.docs.map((document) => {
      const data = document.data();
      const latitude =
        data.latitude ??
        data.lat ??
        data.location?.latitude ??
        data.location?.lat ??
        data.locationData?.latitude ??
        data.locationData?.lat ??
        null;
      const longitude =
        data.longitude ??
        data.lng ??
        data.lon ??
        data.location?.longitude ??
        data.location?.lng ??
        data.location?.lon ??
        data.locationData?.longitude ??
        data.locationData?.lng ??
        data.locationData?.lon ??
        null;

      return {
        id: document.id,
        userId: data.userId ?? data.author_name ?? data.authorName ?? '',
        text: data.text ?? data.content ?? '',
        timestamp: data.timestamp ?? null,
        latitude: latitude == null ? null : Number(latitude),
        longitude: longitude == null ? null : Number(longitude),
        location_address:
          data.location_address ??
          data.locationAddress ??
          data.address ??
          data.location?.address ??
          data.locationData?.address ??
          '',
      };
    });

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
 * Moves an announcement document to trash.
 *
 * @param {string} announcementId - The ID of the announcement to delete.
 * @returns {Promise<void>}
 */
export async function deleteAnnouncement(announcementId) {
  await moveAnnouncementToTrash(announcementId);
}

export async function moveAnnouncementToTrash(announcementId) {
  await updateDoc(doc(db, 'announcements', announcementId), {
    deleted_at: new Date().toISOString(),
    ...getResidentVisibilityPayload(true, new Date().toISOString()),
  });
}

export async function restoreDeletedAnnouncement(announcementId) {
  await updateDoc(doc(db, 'announcements', announcementId), {
    deleted_at: null,
    ...getResidentVisibilityPayload(false),
  });
}

export async function permanentlyDeleteAnnouncement(announcementId) {
  await deleteDoc(doc(db, 'announcements', announcementId));
}

export async function archiveAnnouncement(announcementId) {
  await updateDoc(doc(db, 'announcements', announcementId), getResidentVisibilityPayload(true, new Date().toISOString()));
}

export async function restoreArchivedAnnouncement(announcementId) {
  await updateDoc(doc(db, 'announcements', announcementId), getResidentVisibilityPayload(false));
}

export async function syncArchivedAnnouncementVisibility(announcement) {
  if (!announcement?.id || (!announcement.archived_at && !announcement.deleted_at) || !needsHiddenVisibilitySync(announcement)) return;

  await updateDoc(
    doc(db, 'announcements', announcement.id),
    getResidentVisibilityPayload(true, announcement.archived_at || announcement.deleted_at)
  );
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
