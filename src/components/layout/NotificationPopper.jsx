import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { collection, collectionGroup, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../api/firebase.js';

export default function NotificationPopper() {
  const navigate = useNavigate();
  // Track IDs we've already toasted so we don't re-toast on updates
  const seenReportIds = useRef(new Set());
  const seenCommentIds = useRef(new Set());
  
  // Track session start to only toast new items
  const sessionStart = useRef(Date.now());

  useEffect(() => {
    const getDocumentTimestamp = (docSnap, fallbackField) => {
      const raw = fallbackField ?? null;
      if (raw) {
        return raw.toDate ? raw.toDate().getTime() : new Date(raw).getTime();
      }
      return docSnap.createTime ? docSnap.createTime.toMillis() : null;
    };

    // 1. Subscribe to reports
    const reportsQ = query(collection(db, 'reports'));
    const unsubReports = onSnapshot(reportsQ, (snapshot) => {
      snapshot.docs.forEach((docSnap) => {
        const id = docSnap.id;
        const d = docSnap.data();
        
        // Exclude deleted or archived reports
        if (d.deleted_at || d.archived_at) return;

        // Skip if already seen in this session
        if (seenReportIds.current.has(id)) return;
        seenReportIds.current.add(id);

        const docTime = getDocumentTimestamp(docSnap, d.seenAt ?? d.timestamp ?? null);
        if (!docTime) return;

        // Only toast if added after session start
        if (docTime > sessionStart.current) {
          toast.success("New Incident Report", {
            description: d.description || "A new incident was reported.",
            duration: 8000,
            action: {
              label: 'View',
              onClick: () => {
                navigate('/reports', { state: { selectedReportId: id } });
              },
            },
          });
        }
      });
    });

    // 2. Subscribe to comments (collectionGroup)
    const commentsQ = query(collectionGroup(db, 'comments'));
    const unsubComments = onSnapshot(commentsQ, (snapshot) => {
      snapshot.docs.forEach((docSnap) => {
        const id = docSnap.id;
        const d = docSnap.data();

        // Skip if already seen in this session
        if (seenCommentIds.current.has(id)) return;
        seenCommentIds.current.add(id);

        const docTime = getDocumentTimestamp(docSnap, d.timestamp ?? null);
        if (!docTime) return;

        // Get announcementId from path: /announcements/{announcementId}/comments/{commentId}
        const announcementId = docSnap.ref.parent.parent?.id;

        // Only toast if added after session start and not authored by the admin
        if (docTime > sessionStart.current && d.userId !== 'admin' && announcementId) {
          toast.info("New Comment Added", {
            description: d.text || "Someone commented on an announcement.",
            duration: 8000,
            action: {
              label: 'View',
              onClick: () => {
                navigate('/announcements', { state: { selectedAnnouncementId: announcementId } });
              },
            },
          });
        }
      });
    });

    return () => {
      unsubReports();
      unsubComments();
    };
  }, [navigate]);

  return null; // side-effect only
}
