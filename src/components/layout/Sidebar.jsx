import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Megaphone, Trash2, Bell, LogOut, X, User, Archive } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { subscribeToAdminNotifications } from '../../api/notifications.js';
import { subscribeToReports } from '../../api/reports.js';
import { subscribeToAnnouncements } from '../../api/announcement.js';
import { collectionGroup, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../api/firebase.js';
import { canAccessAnnouncement, canAccessReport, isHomelessAdminRole, isMissingAnimalsAdminRole, isMissingPersonAdminRole } from '../../lib/adminRoles.js';

const navItems = [
  { path: '/',              label: 'Dashboard',    icon: LayoutDashboard },
  { path: '/reports',       label: 'All Reports',  icon: FileText },
  { path: '/announcements', label: 'Announcements',icon: Megaphone },
  { path: '/archive',       label: 'Archive',      icon: Archive },
  { path: '/trash',         label: 'Trash',        icon: Trash2 },
  { path: '/notifications', label: 'Notifications',icon: Bell, badge: true },
];

const S = {
  bg:           'hsl(213 55% 10%)',
  border:       'hsl(213 45% 16%)',
  labelColor:   'hsl(213 25% 42%)',
  inactiveNav:  'hsl(213 35% 58%)',
  activeBg:     'linear-gradient(90deg, hsl(213 80% 58% / 0.18), hsl(213 80% 58% / 0.06))',
  activeColor:  'hsl(213 80% 68%)',
  activeBorder: 'hsl(213 80% 58%)',
  logoutColor:  'hsl(213 25% 42%)',
  subtitleColor:'hsl(213 60% 65%)',
};

export default function Sidebar({ open, onClose }) {
  const location = useLocation();
  const { logout, adminRole } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadReportsCount, setUnreadReportsCount] = useState(0);
  const [unreadCommentsCount, setUnreadCommentsCount] = useState(0);

  useEffect(() => {
    const isMissingAnimalsAdmin = isMissingAnimalsAdminRole(adminRole);

    // 1. Unread notifications
    const unsub = isMissingAnimalsAdmin ? null : subscribeToAdminNotifications(notifs => {
      setUnreadCount(notifs.filter(n => !n.isRead).length);
    });

    // 2. Unread reports count (admin_seen: false, excluding deleted/archived)
    const unsubReports = subscribeToReports(reports => {
      setUnreadReportsCount(reports.filter(r => !r.admin_seen && !r.deleted_at && !r.archived_at && canAccessReport(r, adminRole)).length);
    });

    // 3. Unread comments count across announcements
    const commentsQ = query(collectionGroup(db, 'comments'));
    let activeAnnouncements = [];
    
    const calculateUnreadComments = (commentsList) => {
      const accessibleAnnouncementIds = new Set(
        activeAnnouncements
          .filter(ann => !ann.archived_at && canAccessAnnouncement(ann, adminRole))
          .map(ann => ann.id)
      );
      const unreadAnns = new Set();
      commentsList.forEach(docSnap => {
        const comment = docSnap.data();
        if (comment.userId === 'admin') return;

        const announcementId = docSnap.ref.parent.parent?.id;
        if (!announcementId) return;

        const timestamp = comment.timestamp;
        const commentTime = timestamp ? (timestamp.toDate ? timestamp.toDate().getTime() : new Date(timestamp).getTime()) : Date.now();

        const lastViewedStr = localStorage.getItem(`last_viewed_comments_${announcementId}`);
        const lastViewed = lastViewedStr ? parseInt(lastViewedStr, 10) : 0;
        const canCountComment = !isMissingAnimalsAdmin || accessibleAnnouncementIds.has(announcementId);

        if (canCountComment && commentTime > lastViewed) {
          unreadAnns.add(announcementId);
        }
      });
      setUnreadCommentsCount(unreadAnns.size);
    };

    let activeCommentsDocs = [];
    const unsubAnnouncements = subscribeToAnnouncements(announcements => {
      activeAnnouncements = announcements;
      calculateUnreadComments(activeCommentsDocs);
    });
    const unsubComments = onSnapshot(commentsQ, (snapshot) => {
      activeCommentsDocs = snapshot.docs;
      calculateUnreadComments(activeCommentsDocs);
    });

    // Listen to local marks (e.g. from CommentsDialog.jsx closing/viewing comments)
    const handleStorageChange = () => {
      calculateUnreadComments(activeCommentsDocs);
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      unsub?.();
      unsubReports();
      unsubAnnouncements();
      unsubComments();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [adminRole]);

  const visibleNavItems = isMissingAnimalsAdminRole(adminRole)
    ? navItems.filter(item => item.path === '/reports' || item.path === '/announcements' || item.path === '/archive' || item.path === '/trash')
    : isHomelessAdminRole(adminRole)
    ? navItems.filter(item => item.path === '/reports' || item.path === '/archive' || item.path === '/trash')
    : isMissingPersonAdminRole(adminRole)
    ? navItems.filter(item => item.path === '/announcements' || item.path === '/archive' || item.path === '/trash')
    : navItems;

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen w-64 flex flex-col
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: S.bg }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: S.border }}>
          <img src="/streetassist.png" alt="StreetAssist" className="h-9 w-9 rounded-lg shrink-0 object-cover" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white leading-tight">StreetAssist</h1>
            <p className="text-[10px] font-medium truncate" style={{ color: S.subtitleColor }}>
              Camarines Norte · Admin
            </p>
          </div>
          <button onClick={onClose} className="ml-auto lg:hidden text-white/40 hover:text-white shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Main nav */}
        <div className="px-5 pt-4 pb-1.5">
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: S.labelColor }}>
            Main Menu
          </p>
        </div>
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-2">
          {visibleNavItems.map(({ path, label, icon: Icon, badge }) => {
            const isActive = location.pathname === path;
            const showBadge = badge && unreadCount > 0;
            return (
              <Link
                key={path}
                to={path}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={
                  isActive
                    ? { background: S.activeBg, color: S.activeColor, borderLeft: `2px solid ${S.activeBorder}` }
                    : { color: S.inactiveNav, borderLeft: '2px solid transparent' }
                }
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = S.inactiveNav; }}
              >
                <div className="relative shrink-0">
                  <Icon className="h-4 w-4" />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                {label}
                {label === 'All Reports' && unreadReportsCount > 0 && (
                  <span className="ml-auto h-4 min-w-[16px] px-1.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unreadReportsCount}
                  </span>
                )}
                {label === 'Announcements' && unreadCommentsCount > 0 && (
                  <span className="ml-auto h-4 min-w-[16px] px-1.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unreadCommentsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Account section */}
        <div className="px-3 pb-4 pt-2 border-t" style={{ borderColor: S.border }}>
          <p className="text-[10px] uppercase tracking-widest font-semibold px-3 pt-2 pb-1.5" style={{ color: S.labelColor }}>
            Account
          </p>
          {[{ path: '/profile', label: 'My Profile', icon: User }].map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-0.5"
                style={
                  isActive
                    ? { background: S.activeBg, color: S.activeColor, borderLeft: `2px solid ${S.activeBorder}` }
                    : { color: S.inactiveNav, borderLeft: '2px solid transparent' }
                }
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = S.inactiveNav; }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full transition-colors hover:text-red-400 hover:bg-red-500/10 mt-0.5"
            style={{ color: S.logoutColor }}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
