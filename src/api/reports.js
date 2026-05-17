import { db } from './firebase.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Field mapping helper — matches EXACT Firestore field names
// ---------------------------------------------------------------------------
//
// Confirmed Firestore fields (from database screenshot):
//   approximateAge        string
//   assistanceDescription string
//   contactNumber         string
//   description           string
//   fullName              string   ← reporter's name
//   latitude              number
//   locationAddress       string   ← camelCase
//   longitude             number
//   photoUrl              string   ← single image URL (Cloudinary)
//   reportId              string   ← e.g. "RPT-20260516-160136"
//   reportType            string   ← e.g. "Individual"
//   seenAt                Timestamp
//   sex                   string
//   status                string   ← e.g. "Pending" (capital P)
//
// ---------------------------------------------------------------------------

function mapReport(docSnap) {
  const d = docSnap.data();

  // Status — Firestore stores "Pending", "Resolved", etc. (capitalised)
  // Normalise to lowercase for internal use, display with label map
  const rawStatus = d.status ?? 'Pending';

  // photoUrl is a single Cloudinary URL string (not an array)
  const photoUrl = d.photoUrl ?? d.photoURL ?? d.image_url ?? '';

  // Build an attachments array for the gallery component (single item if present)
  const attachments = photoUrl ? [photoUrl] : [];

  return {
    // Document identity
    id:                   docSnap.id,
    userId:               d.userId              ?? null,

    // Report ID field (e.g. "RPT-20260516-160136")
    report_id:            d.reportId            ?? d.report_id ?? docSnap.id,
    reportId:             d.reportId            ?? d.report_id ?? docSnap.id,

    // Reporter info — stored directly on the report document
    reporter_name:        d.fullName             ?? d.reporter_name ?? '',
    fullName:             d.fullName             ?? '',
    contactNumber:        d.contactNumber        ?? d.reporter_email ?? '',
    reporter_email:       d.contactNumber        ?? d.reporter_email ?? '',

    // Incident details
    description:          d.description          ?? '',
    assistanceDescription:d.assistanceDescription ?? '',
    reportType:           d.reportType           ?? d.category ?? '',
    category:             d.reportType           ?? d.category ?? '',
    approximateAge:       d.approximateAge       ?? '',
    sex:                  d.sex                  ?? '',

    // Status — keep original capitalisation for display, also expose lowercase
    status:               rawStatus,

    // Timestamps
    timestamp:            d.seenAt               ?? d.timestamp ?? null,
    seenAt:               d.seenAt               ?? null,

    // Location — flat fields (not nested locationData)
    latitude:             d.latitude             ?? null,
    longitude:            d.longitude            ?? null,
    location_address:     d.locationAddress      ?? d.location_address ?? '',
    locationAddress:      d.locationAddress      ?? '',

    // Image — single Cloudinary URL exposed both ways
    photoUrl,
    image_url:            photoUrl,
    attachments,          // array wrapper for gallery component

    // Admin fields
    adminNotes:           d.adminNotes           ?? d.admin_notes ?? '',
    admin_seen:           d.admin_seen           ?? false,
    deleted_at:           d.deleted_at           ?? null,

    // Optional resolution fields
    resolvedByUserId:     d.resolvedByUserId      ?? null,
    resolutionTimestamp:  d.resolutionTimestamp   ?? null,
  };
}

// ---------------------------------------------------------------------------
// Status config — maps Firestore status strings to display labels + colours
// Firestore uses capitalised values: "Pending", "Resolved", etc.
// ---------------------------------------------------------------------------
export const STATUS_CONFIG = {
  'Pending':   { label: 'Pending',   badge: 'bg-amber-50 text-amber-700 border-amber-200',   bar: '#F59E0B', dot: 'bg-amber-400' },
  'Resolved':  { label: 'Resolved',  badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: '#10B981', dot: 'bg-emerald-400' },
  'In Review': { label: 'In Review', badge: 'bg-teal-50 text-teal-700 border-teal-200',       bar: '#0d9488', dot: 'bg-teal-500' },
  'Rejected':  { label: 'Rejected',  badge: 'bg-red-50 text-red-700 border-red-200',           bar: '#ef4444', dot: 'bg-red-400' },
  // lowercase aliases for safety
  'pending':   { label: 'Pending',   badge: 'bg-amber-50 text-amber-700 border-amber-200',   bar: '#F59E0B', dot: 'bg-amber-400' },
  'resolved':  { label: 'Resolved',  badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: '#10B981', dot: 'bg-emerald-400' },
  'in_review': { label: 'In Review', badge: 'bg-teal-50 text-teal-700 border-teal-200',       bar: '#0d9488', dot: 'bg-teal-500' },
  'rejected':  { label: 'Rejected',  badge: 'bg-red-50 text-red-700 border-red-200',           bar: '#ef4444', dot: 'bg-red-400' },
};

export function getStatusConfig(status) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG['Pending'];
}

// ---------------------------------------------------------------------------
// Real-time subscription
// ---------------------------------------------------------------------------

export function subscribeToReports(callback) {
  // Try ordering by seenAt first (the actual timestamp field), fall back to timestamp
  const q = query(
    collection(db, 'reports'),
    orderBy('seenAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map(mapReport));
    },
    (error) => {
      console.error('[reports] onSnapshot error:', error);
      // If seenAt index doesn't exist, fall back to unordered
      if (error.code === 'failed-precondition' || error.code === 'unimplemented') {
        const fallbackQ = query(collection(db, 'reports'));
        return onSnapshot(fallbackQ, (snap) => callback(snap.docs.map(mapReport)));
      }
      toast.error('Failed to load reports');
    }
  );
}

// ---------------------------------------------------------------------------
// User enrichment (optional — only needed if fullName is missing on the doc)
// ---------------------------------------------------------------------------

export async function enrichReportWithUser(report) {
  // If we already have the name from the document, no need to fetch
  if (report.fullName || report.reporter_name) return report;
  if (!report.userId) return report;
  try {
    const userSnap = await getDoc(doc(db, 'users', report.userId));
    if (!userSnap.exists()) return report;
    const u = userSnap.data();
    return {
      ...report,
      reporter_name:  u.displayName ?? u.email ?? '',
      reporter_email: u.email       ?? '',
      reporter_photo: u.photoURL    ?? '',
    };
  } catch {
    return report;
  }
}

// ---------------------------------------------------------------------------
// Valid status values for the update dropdown
// ---------------------------------------------------------------------------
export const REPORT_STATUSES = ['Pending', 'In Review', 'Resolved', 'Rejected'];

export async function updateReportStatus(reportId, newStatus) {
  if (!REPORT_STATUSES.includes(newStatus)) {
    throw new TypeError(
      `Invalid status: "${newStatus}". Must be one of: ${REPORT_STATUSES.join(', ')}`
    );
  }
  await updateDoc(doc(db, 'reports', reportId), { status: newStatus });
}

export async function updateReportMeta(reportId, fields) {
  await updateDoc(doc(db, 'reports', reportId), fields);
}

export async function moveReportToTrash(reportId) {
  await updateDoc(doc(db, 'reports', reportId), {
    deleted_at: new Date().toISOString(),
  });
}
