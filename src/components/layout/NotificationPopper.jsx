/**
 * NotificationPopper
 * Listens to /admin_notifications in real time.
 * When a NEW unread notification arrives (not seen before in this session),
 * it fires a sonner toast with the message and a click-to-navigate action.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { subscribeToAdminNotifications, markNotificationRead } from '../../api/notifications.js';

export default function NotificationPopper() {
  const navigate = useNavigate();
  // Track IDs we've already toasted so we don't re-toast on re-renders
  const seenIds = useRef(new Set());
  // Track whether this is the initial load (don't toast existing notifications)
  const initialLoad = useRef(true);

  useEffect(() => {
    const unsub = subscribeToAdminNotifications((notifications) => {
      if (initialLoad.current) {
        // On first snapshot, just record existing IDs — don't toast them
        notifications.forEach(n => seenIds.current.add(n.id));
        initialLoad.current = false;
        return;
      }

      // On subsequent snapshots, toast any new unread notifications
      notifications.forEach(notif => {
        if (seenIds.current.has(notif.id)) return;
        if (notif.isRead) {
          seenIds.current.add(notif.id);
          return;
        }

        seenIds.current.add(notif.id);

        const typeLabel =
          notif.type === 'new_report'    ? 'New Report' :
          notif.type === 'status_update' ? 'Status Update' :
          notif.type === 'new_comment'   ? 'New Comment' :
          'Notification';

        toast(notif.title || typeLabel, {
          description: notif.message || '',
          duration: 6000,
          action: {
            label: 'View',
            onClick: () => {
              markNotificationRead(notif.id).catch(() => {});
              if (notif.type === 'new_report' || notif.relatedReportId) {
                navigate('/reports');
              } else if (notif.type === 'new_comment') {
                navigate('/announcements');
              } else {
                navigate('/notifications');
              }
            },
          },
          onDismiss: () => {
            markNotificationRead(notif.id).catch(() => {});
          },
        });
      });
    });

    return unsub;
  }, [navigate]);

  return null; // renders nothing — side-effect only
}
