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

export function mapRawStatus(status) {
  if (!status) return 'Pending';
  const s = String(status).trim();
  if (s === 'Pending' || s === 'Verified' || s === 'In Progress' || s === 'Resolved' || s === 'Closed') {
    return s;
  }
  const lower = s.toLowerCase();
  if (lower === 'pending') return 'Pending';
  if (lower === 'verified') return 'Verified';
  if (lower === 'in progress' || lower === 'in_progress' || lower === 'in review' || lower === 'in_review' || lower === 'on_progress' || lower === 'on progress') {
    return 'In Progress';
  }
  if (lower === 'resolved') return 'Resolved';
  if (lower === 'rejected' || lower === 'closed') return 'Closed';
  return 'Pending';
}

function mapReport(docSnap) {
  const d = docSnap.data();

  // Status — safe mapping of legacy/current values to required capitalized values
  const status = mapRawStatus(d.status);

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

    // Status — always exactly one of: Pending, Verified, In Progress, Resolved, Closed
    status,

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
    proofImages:          d.proofImages          ?? [],

    // Status Update History array
    statusUpdates:        d.statusUpdates        ?? [],
  };
}

// ---------------------------------------------------------------------------
// Status config — maps Firestore status strings to display labels + colours
// ---------------------------------------------------------------------------
export const STATUS_CONFIG = {
  'Pending':     { label: 'Pending',     badge: 'bg-amber-50 text-amber-700 border-amber-200',   bar: '#F59E0B', dot: 'bg-amber-400' },
  'Verified':    { label: 'Verified',    badge: 'bg-sky-50 text-sky-700 border-sky-200',         bar: '#0284c7', dot: 'bg-sky-500' },
  'In Progress': { label: 'In Progress', badge: 'bg-purple-50 text-purple-700 border-purple-200', bar: '#7c3aed', dot: 'bg-purple-500' },
  'Resolved':    { label: 'Resolved',    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: '#10B981', dot: 'bg-emerald-400' },
  'Closed':      { label: 'Closed',      badge: 'bg-slate-50 text-slate-700 border-slate-200',   bar: '#64748b', dot: 'bg-slate-400' },
  
  // Legacy mappings for safe fallback usage
  'pending':     { label: 'Pending',     badge: 'bg-amber-50 text-amber-700 border-amber-200',   bar: '#F59E0B', dot: 'bg-amber-400' },
  'verified':    { label: 'Verified',    badge: 'bg-sky-50 text-sky-700 border-sky-200',         bar: '#0284c7', dot: 'bg-sky-500' },
  'in_progress': { label: 'In Progress', badge: 'bg-purple-50 text-purple-700 border-purple-200', bar: '#7c3aed', dot: 'bg-purple-500' },
  'on_progress': { label: 'In Progress', badge: 'bg-purple-50 text-purple-700 border-purple-200', bar: '#7c3aed', dot: 'bg-purple-500' },
  'in review':   { label: 'In Progress', badge: 'bg-purple-50 text-purple-700 border-purple-200', bar: '#7c3aed', dot: 'bg-purple-500' },
  'in_review':   { label: 'In Progress', badge: 'bg-purple-50 text-purple-700 border-purple-200', bar: '#7c3aed', dot: 'bg-purple-500' },
  'resolved':    { label: 'Resolved',    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: '#10B981', dot: 'bg-emerald-400' },
  'rejected':    { label: 'Closed',      badge: 'bg-slate-50 text-slate-700 border-slate-200',   bar: '#64748b', dot: 'bg-slate-400' },
  'closed':      { label: 'Closed',      badge: 'bg-slate-50 text-slate-700 border-slate-200',   bar: '#64748b', dot: 'bg-slate-400' },
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
export const REPORT_STATUSES = ['Pending', 'In Progress', 'Resolved', 'Closed'];

export async function updateReportStatus(reportId, newStatus) {
  const mapped = mapRawStatus(newStatus);
  if (!REPORT_STATUSES.includes(mapped)) {
    throw new TypeError(
      `Invalid status: "${newStatus}". Must be one of: ${REPORT_STATUSES.join(', ')}`
    );
  }
  const reportRef = doc(db, 'reports', reportId);
  const reportSnap = await getDoc(reportRef);
  if (reportSnap.exists() && mapRawStatus(reportSnap.data().status) === 'Closed') {
    throw new Error('This report has been closed and can no longer be modified.');
  }
  await updateDoc(reportRef, { status: mapped });
}

export async function addReportStatusUpdate(reportId, status, message, proofUrls = []) {
  const reportRef = doc(db, 'reports', reportId);
  const reportSnap = await getDoc(reportRef);
  if (!reportSnap.exists()) throw new Error('Report not found');
  
  const d = reportSnap.data();
  if (mapRawStatus(d.status) === 'Closed') {
    throw new Error('This report has been closed and can no longer be modified.');
  }
  
  const updates = d.statusUpdates || [];
  
  updates.push({
    status,
    message: message || '',
    timestamp: new Date().toISOString(),
    proofUrls
  });

  await updateDoc(reportRef, {
    status,
    statusUpdates: updates,
    ...(proofUrls && proofUrls.length > 0 ? { proofImages: proofUrls } : {}),
    ...(status === 'Resolved' ? { resolutionTimestamp: new Date() } : {})
  });
}

export async function updateReportMeta(reportId, fields) {
  const reportRef = doc(db, 'reports', reportId);
  const reportSnap = await getDoc(reportRef);
  if (reportSnap.exists() && mapRawStatus(reportSnap.data().status) === 'Closed') {
    // Only allow updating admin_seen or seenAt
    const allowedKeys = ['admin_seen', 'seenAt'];
    const keys = Object.keys(fields);
    const hasRestricted = keys.some(k => !allowedKeys.includes(k));
    if (hasRestricted) {
      throw new Error('This report has been closed and can no longer be modified.');
    }
  }
  await updateDoc(reportRef, fields);
}

export async function moveReportToTrash(reportId) {
  const reportRef = doc(db, 'reports', reportId);
  const reportSnap = await getDoc(reportRef);
  if (reportSnap.exists() && mapRawStatus(reportSnap.data().status) === 'Closed') {
    throw new Error('This report has been closed and can no longer be modified.');
  }
  await updateDoc(reportRef, {
    deleted_at: new Date().toISOString(),
  });
}
