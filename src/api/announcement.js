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
  if (lower === 'active' || lower === 'published') return 'Reported';
  if (lower === 'verified' || lower === 'verified by police' || lower === 'verified_by_police') return 'Verified by Police';
  if (lower === 'ongoing' || lower === 'search ongoing' || lower === 'search_ongoing') return 'Search Ongoing';
  if (lower === 'resolved' || lower === 'closed' || lower === 'case closed' || lower === 'case_closed') return 'Case Closed';
  if (lower === 'open') return 'Reported';
  return 'Reported';
}

const syncedHiddenAnnouncementIds = new Set();
const LIFECYCLE_STATUSES = new Set(['active', 'archived', 'deleted']);

function getAnnouncementVisibilityStatus(data) {
  const status = String(data?.status ?? '').trim().toLowerCase();
  if (status === 'archived' || status === 'deleted') return status;
  if (data?.deleted_at || data?.deletedAt || data?.deleted === true || data?.isDeleted === true || data?.is_deleted === true) return 'deleted';
  if (data?.archived_at || data?.archivedAt || data?.archived === true || data?.isArchived === true || data?.is_archived === true) return 'archived';
  return 'active';
}

function getResidentVisibilityPayload(isHidden, hiddenAt = null, { isDeleted = false } = {}) {
  return {
    archived_at: isHidden ? hiddenAt : null,
    archivedAt: isHidden ? hiddenAt : null,
    archived: isHidden,
    isArchived: isHidden,
    is_archived: isHidden,
    deleted: isDeleted,
    isDeleted,
    is_deleted: isDeleted,
    hidden: isHidden,
    is_hidden: isHidden,
    isHidden: isHidden,
    hidden_from_residents: isHidden,
    hiddenFromResidents: isHidden,
    visible_to_residents: !isHidden,
    visibleToResidents: !isHidden,
    isVisible: !isHidden,
    visible: !isHidden,
    active: !isHidden,
    isActive: !isHidden,
    published: !isHidden,
    isPublished: !isHidden,
    public: !isHidden,
    isPublic: !isHidden,
    show_to_residents: !isHidden,
    showToResidents: !isHidden,
    resident_visible: !isHidden,
    residentVisible: !isHidden,
    isPublicFeed: !isHidden,
    is_public_feed: !isHidden,
    resident_visibility_synced: true,
  };
}

function isAnnouncementHiddenFromResidents(data) {
  return getAnnouncementVisibilityStatus(data) !== 'active';
}

function getStorablePreviousStatus(data) {
  const status = String(data?.status ?? '').trim().toLowerCase();
  if (LIFECYCLE_STATUSES.has(status)) {
    return mapRawAnnouncementStatus(data?.case_status ?? data?.caseStatus ?? data?.previous_status ?? 'Reported');
  }
  return mapRawAnnouncementStatus(data?.case_status ?? data?.caseStatus ?? data?.previous_status ?? data?.status ?? 'Reported');
}

function mapAnnouncementStatus(data) {
  const status = String(data?.status ?? '').trim().toLowerCase();
  const fallback = LIFECYCLE_STATUSES.has(status) ? 'Reported' : data?.status;
  return mapRawAnnouncementStatus(data?.case_status ?? data?.caseStatus ?? data?.previous_status ?? fallback);
}

function getArchiveStatusUpdate(isHidden, hiddenAt, { isDeleted = false, previousStatus = 'Reported' } = {}) {
  return {
    ...getResidentVisibilityPayload(isHidden, hiddenAt, { isDeleted }),
    status: isHidden ? (isDeleted ? 'deleted' : 'archived') : previousStatus,
    case_status: previousStatus,
    caseStatus: previousStatus,
    previous_status: isHidden ? previousStatus : null,
  };
}

function needsResidentVisibilitySync(data) {
  if (!isAnnouncementHiddenFromResidents(data)) return false;
  if (data.resident_visibility_synced === true) return false;

  const status = String(data?.status ?? '').trim().toLowerCase();
  if (status !== 'archived' && status !== 'deleted') return true;

  const isHidden = true;
  return (
    data.visible_to_residents !== false ||
    data.visibleToResidents !== false ||
    data.isVisible !== false ||
    data.visible !== false ||
    data.active !== false ||
    data.isActive !== false ||
    data.published !== false ||
    data.isPublished !== false ||
    data.public !== false ||
    data.isPublic !== false ||
    data.archived !== isHidden ||
    data.isArchived !== isHidden ||
    data.is_archived !== isHidden ||
    data.hidden !== isHidden ||
    data.show_to_residents !== false ||
    data.showToResidents !== false
  );
}

function queueResidentVisibilitySync(announcementId, data) {
  if (!announcementId || !needsResidentVisibilitySync(data)) return;
  if (syncedHiddenAnnouncementIds.has(announcementId)) return;

  syncedHiddenAnnouncementIds.add(announcementId);
  const hiddenAt = data.archived_at || data.deleted_at;
  const isDeleted = !!data.deleted_at;

  const previousStatus = getStorablePreviousStatus(data);
  updateDoc(
    doc(db, 'announcements', announcementId),
    getArchiveStatusUpdate(true, hiddenAt, { isDeleted, previousStatus })
  ).catch((error) => {
    console.error('Failed to sync announcement resident visibility:', error);
    syncedHiddenAnnouncementIds.delete(announcementId);
  });
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
        queueResidentVisibilitySync(document.id, data);
        const visibilityStatus = getAnnouncementVisibilityStatus(data);
        const isArchived = visibilityStatus !== 'active';
        const caseStatus = mapAnnouncementStatus(data);

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
          status: caseStatus,
          visibility_status: visibilityStatus,
          case_status: caseStatus,
          caseStatus: caseStatus,
          previous_status: data.previous_status ?? null,
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
          resident_visibility_synced: data.resident_visibility_synced === true && !needsResidentVisibilitySync(data),
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

  const initialStatus = status ? mapRawAnnouncementStatus(status) : 'Reported';

  await addDoc(collection(db, 'announcements'), {
    title: title.trim(),
    // content is optional — store it if provided, otherwise omit
    ...(content && content.trim() ? { content: content.trim() } : {}),
    // imageUrl from Cloudinary upload
    ...(imageUrl ? { imageUrl } : {}),
    status: initialStatus,
    case_status: initialStatus,
    caseStatus: initialStatus,
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
    if (annData && getStorablePreviousStatus(annData) === 'Case Closed') {
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
  const annRef = doc(db, 'announcements', announcementId);
  const annSnap = await getDoc(annRef);
  const previousStatus = annSnap.exists() ? getStorablePreviousStatus(annSnap.data()) : 'Reported';
  const now = new Date().toISOString();

  await updateDoc(annRef, {
    deleted_at: now,
    ...getArchiveStatusUpdate(true, now, { isDeleted: true, previousStatus }),
  });
}

export async function restoreDeletedAnnouncement(announcementId) {
  const annRef = doc(db, 'announcements', announcementId);
  const annSnap = await getDoc(annRef);
  const previousStatus = annSnap.exists()
    ? mapRawAnnouncementStatus(annSnap.data()?.previous_status ?? 'Reported')
    : 'Reported';

  await updateDoc(annRef, {
    deleted_at: null,
    ...getArchiveStatusUpdate(false, null, { previousStatus }),
  });
}

export async function permanentlyDeleteAnnouncement(announcementId) {
  await deleteDoc(doc(db, 'announcements', announcementId));
}

export async function archiveAnnouncement(announcementId) {
  if (!announcementId) {
    throw new Error('Announcement ID is required');
  }

  const annRef = doc(db, 'announcements', announcementId);
  const annSnap = await getDoc(annRef);
  const previousStatus = annSnap.exists() ? getStorablePreviousStatus(annSnap.data()) : 'Reported';
  const now = new Date().toISOString();

  await updateDoc(annRef, {
    deleted_at: null,
    ...getArchiveStatusUpdate(true, now, { isDeleted: false, previousStatus }),
  });
}

export async function restoreArchivedAnnouncement(announcementId) {
  const annRef = doc(db, 'announcements', announcementId);
  const annSnap = await getDoc(annRef);
  const previousStatus = annSnap.exists()
    ? mapRawAnnouncementStatus(annSnap.data()?.previous_status ?? 'Reported')
    : 'Reported';

  await updateDoc(annRef, getArchiveStatusUpdate(false, null, { previousStatus }));
}

export async function syncArchivedAnnouncementVisibility(announcement) {
  if (!announcement?.id || !isAnnouncementHiddenFromResidents(announcement)) return;
  if (announcement.resident_visibility_synced) return;

  const hiddenAt = announcement.archived_at || announcement.deleted_at;
  const isDeleted = !!announcement.deleted_at;
  const previousStatus = mapRawAnnouncementStatus(announcement.previous_status ?? 'Reported');

  await updateDoc(
    doc(db, 'announcements', announcement.id),
    getArchiveStatusUpdate(true, hiddenAt, { isDeleted, previousStatus })
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
  const annSnap = await getDoc(annRef);
  const visibilityStatus = annSnap.exists() ? getAnnouncementVisibilityStatus(annSnap.data()) : 'active';

  const updatePayload = { case_status: mapped, caseStatus: mapped };
  if (visibilityStatus === 'active') {
    updatePayload.status = mapped;
  } else {
    updatePayload.previous_status = mapped;
  }

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
  if (fields.status) {
    const mappedStatus = mapRawAnnouncementStatus(fields.status);
    updatedData.case_status = mappedStatus;
    updatedData.caseStatus = mappedStatus;
    updatedData.status = mappedStatus;
  }

  await updateDoc(annRef, updatedData);
}
