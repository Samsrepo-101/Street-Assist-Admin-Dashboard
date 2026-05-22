import React, { useState, useEffect, useMemo } from 'react';
import { subscribeToAdminNotifications, markNotificationRead, deleteNotification } from '../api/notifications.js';
import { subscribeToReports, STATUS_CONFIG } from '../api/reports.js';
import { subscribeToAnnouncements } from '../api/announcement.js';
import { Button } from '@/components/ui/button';
import {
  Trash2, FileText, Megaphone, RefreshCw, Bell,
  CheckCheck, AlertCircle, MapPin, User, Tag,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getTimestamp(item) {
  const ts = item.seenAt ?? item.timestamp ?? item.createdAt ?? null;
  if (!ts) return null;
  return ts?.toDate ? ts.toDate() : new Date(ts);
}

function formatTime(date) {
  if (!date) return 'N/A';
  try {
    return format(date, 'MMM dd, yyyy · hh:mm a');
  } catch { return 'N/A'; }
}

function timeAgo(date) {
  if (!date) return '';
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch { return ''; }
}

// Status badge colours matching the rest of the dashboard
const STATUS_BADGE = {
  'pending':     'bg-amber-50 text-amber-700 border border-amber-200',
  'on_progress': 'bg-teal-50 text-teal-700 border border-teal-200',
  'resolved':    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'rejected':    'bg-red-50 text-red-700 border border-red-200',
  'Pending':     'bg-amber-50 text-amber-700 border border-amber-200',
  'In Review':   'bg-teal-50 text-teal-700 border border-teal-200',
  'Resolved':    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Rejected':    'bg-red-50 text-red-700 border border-red-200',
};

// ---------------------------------------------------------------------------
// Feed item renderers
// ---------------------------------------------------------------------------

function ReportFeedItem({ report }) {
  const date = getTimestamp(report);
  const statusStyle = STATUS_BADGE[report.status] ?? 'bg-muted text-muted-foreground border border-border';

  return (
    <Link
      to="/reports"
      className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
    >
      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <FileText className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-xs font-semibold text-primary font-mono">
            {report.reportId || report.report_id || report.id}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusStyle}`}>
            {STATUS_CONFIG[report.status]?.label || report.status}
          </span>
          {report.reportType && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {report.reportType}
            </span>
          )}
        </div>
        <p className="text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {report.description || 'No description'}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
          {(report.fullName || report.reporter_name) && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {report.fullName || report.reporter_name}
            </span>
          )}
          {(report.locationAddress || report.location_address) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {report.locationAddress || report.location_address}
            </span>
          )}
          <span className="w-full sm:ml-auto sm:w-auto">{timeAgo(date)}</span>
        </div>
      </div>
    </Link>
  );
}

function AnnouncementFeedItem({ ann }) {
  const date = getTimestamp(ann);

  return (
    <Link
      to="/announcements"
      className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
    >
      <div className="h-8 w-8 rounded bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
        <Megaphone className="h-4 w-4 text-emerald-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
            Announcement
          </span>
          {ann.category && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {ann.category}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {ann.title || 'Untitled'}
        </p>
        {ann.subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{ann.subtitle}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
          {ann.locationAddress && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />{ann.locationAddress}
            </span>
          )}
          <span className="w-full sm:ml-auto sm:w-auto">{timeAgo(date)}</span>
        </div>
      </div>
    </Link>
  );
}

function AdminNotifFeedItem({ notif, onMarkRead, onDelete }) {
  const date = getTimestamp(notif);
  const typeLabel = notif.type === 'new_report' ? 'New Report'
    : notif.type === 'status_update' ? 'Status Update'
    : notif.type === 'new_comment' ? 'Comment'
    : 'Alert';

  return (
    <div
      onClick={() => onMarkRead(notif)}
      className={`flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-colors hover:bg-muted/30 ${!notif.isRead ? 'bg-primary/[0.03]' : ''}`}
    >
      <div className="h-8 w-8 rounded bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
        <Bell className="h-4 w-4 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className={`text-sm leading-snug ${!notif.isRead ? 'font-semibold text-foreground' : 'text-foreground'}`}>
            {notif.title || typeLabel}
          </span>
          {!notif.isRead && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
          )}
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide sm:ml-auto">
            {typeLabel}
          </span>
        </div>
        {notif.message && (
          <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
        )}
        <p className="text-[11px] text-muted-foreground/70 mt-1">{timeAgo(date)}</p>
      </div>
      <button
        className="shrink-0 h-7 w-7 flex items-center justify-center rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
        onClick={e => { e.stopPropagation(); onDelete(notif); }}
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
const TABS = [
  { key: 'all',           label: 'All Activity' },
  { key: 'reports',       label: 'Reports' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'notifications', label: 'System Alerts' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Notifications() {
  const [adminNotifs, setAdminNotifs]     = useState([]);
  const [reports, setReports]             = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [activeTab, setActiveTab]         = useState('all');

  useEffect(() => {
    let loaded = 0;
    const checkDone = () => { if (++loaded >= 3) setIsLoading(false); };

    const unsubNotifs = subscribeToAdminNotifications(data => {
      setAdminNotifs(data);
      checkDone();
    });
    const unsubReports = subscribeToReports(data => {
      setReports(data.filter(r => !r.deleted_at && !r.archived_at));
      checkDone();
    });
    const unsubAnn = subscribeToAnnouncements(data => {
      setAnnouncements(data.filter(ann => !ann.archived_at));
      checkDone();
    });

    return () => { unsubNotifs(); unsubReports(); unsubAnn(); };
  }, []);

  const markAsRead = async (notif) => {
    if (notif.isRead) return;
    try { await markNotificationRead(notif.id); }
    catch { toast.error('Failed to mark as read'); }
  };

  const markAllRead = async () => {
    const unread = adminNotifs.filter(n => !n.isRead);
    try {
      await Promise.all(unread.map(n => markNotificationRead(n.id)));
      toast.success('All marked as read');
    } catch { toast.error('Failed to mark all as read'); }
  };

  const deleteNotif = async (notif) => {
    try {
      await deleteNotification(notif.id);
      toast.success('Notification deleted');
    } catch { toast.error('Failed to delete notification'); }
  };

  // Build unified feed sorted by timestamp desc
  const allFeed = useMemo(() => {
    const items = [
      ...reports.map(r => ({ _type: 'report', _ts: getTimestamp(r), data: r })),
      ...announcements.map(a => ({ _type: 'announcement', _ts: getTimestamp(a), data: a })),
      ...adminNotifs.map(n => ({ _type: 'notification', _ts: getTimestamp(n), data: n })),
    ];
    return items.sort((a, b) => {
      const ta = a._ts?.getTime() ?? 0;
      const tb = b._ts?.getTime() ?? 0;
      return tb - ta;
    });
  }, [reports, announcements, adminNotifs]);

  const filteredFeed = useMemo(() => {
    if (activeTab === 'all') return allFeed;
    if (activeTab === 'reports') return allFeed.filter(i => i._type === 'report');
    if (activeTab === 'announcements') return allFeed.filter(i => i._type === 'announcement');
    if (activeTab === 'notifications') return allFeed.filter(i => i._type === 'notification');
    return allFeed;
  }, [allFeed, activeTab]);

  const unreadCount = adminNotifs.filter(n => !n.isRead).length;

  if (isLoading) {
    return (
      <div className="space-y-2 w-full">
        {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded" />)}
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">Activity Feed</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allFeed.length} total items — reports, announcements, and system alerts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unreadCount > 0 && (
            <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded border border-primary/20">
              {unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}
            </span>
          )}
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="h-8 text-xs">
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Mark alerts read
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.key === 'reports' && (
              <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                {reports.length}
              </span>
            )}
            {tab.key === 'announcements' && (
              <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                {announcements.length}
              </span>
            )}
            {tab.key === 'notifications' && unreadCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="bg-white border border-border rounded overflow-hidden">
        {filteredFeed.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Nothing here yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              {activeTab === 'all' ? 'No activity recorded yet' : `No ${activeTab} to display`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredFeed.map((item, idx) => {
              if (item._type === 'report') {
                return <ReportFeedItem key={`r-${item.data.id}`} report={item.data} />;
              }
              if (item._type === 'announcement') {
                return <AnnouncementFeedItem key={`a-${item.data.id}`} ann={item.data} />;
              }
              return (
                <AdminNotifFeedItem
                  key={`n-${item.data.id}`}
                  notif={item.data}
                  onMarkRead={markAsRead}
                  onDelete={deleteNotif}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Summary footer */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" /> {reports.length} report{reports.length !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5">
          <Megaphone className="h-3.5 w-3.5" /> {announcements.length} announcement{announcements.length !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" /> {adminNotifs.length} system alert{adminNotifs.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
