import { db } from './firebase.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { toast } from 'sonner';

/**
 * Subscribes to the /admin_notifications collection in real time, ordered by
 * timestamp descending. Calls `callback` with a mapped array on every snapshot.
 *
 * @param {function(Array): void} callback - Receives the mapped notifications array.
 * @returns {function(): void} Firestore unsubscribe function.
 */
export function subscribeToAdminNotifications(callback) {
  const q = query(
    collection(db, 'admin_notifications'),
    orderBy('timestamp', 'desc')
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map((document) => ({
        id: document.id,
        relatedReportId: document.data().relatedReportId ?? null,
        message: document.data().message ?? '',
        isRead: document.data().isRead ?? false,
        timestamp: document.data().timestamp ?? null,
        title: document.data().title ?? '',
        type: document.data().type ?? '',
      }));
      callback(notifications);
    },
    (error) => {
      console.error(error);
      toast.error('Failed to load notifications');
    }
  );

  return unsubscribe;
}

/**
 * Marks a notification as read by setting `isRead` to `true`.
 * Errors propagate to the caller.
 *
 * @param {string} notificationId - The Firestore document ID of the notification.
 * @returns {Promise<void>}
 */
export async function markNotificationRead(notificationId) {
  await updateDoc(doc(db, 'admin_notifications', notificationId), {
    isRead: true,
  });
}

/**
 * Permanently deletes a notification document from Firestore.
 * Errors propagate to the caller.
 *
 * @param {string} notificationId - The Firestore document ID of the notification.
 * @returns {Promise<void>}
 */
export async function deleteNotification(notificationId) {
  await deleteDoc(doc(db, 'admin_notifications', notificationId));
}
