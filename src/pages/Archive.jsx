import React, { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeToReports, restoreArchivedReport, getStatusConfig } from '../api/reports.js';
import { subscribeToAnnouncements, restoreArchivedAnnouncement, syncArchivedAnnouncementVisibility } from '../api/announcement.js';
import { Button } from '@/components/ui/button';
import { Archive as ArchiveIcon, FileText, Megaphone, RotateCcw, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '../lib/AuthContext';
import { canAccessAnnouncement, canAccessReport } from '../lib/adminRoles.js';

function formatArchivedDate(value) {
  if (!value) return 'Unknown date';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return format(date, 'MMM dd, yyyy');
}

export default function Archive() {
  const [activeTab, setActiveTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const syncedAnnouncementIds = useRef(new Set());
  const { adminRole } = useAuth();

  useEffect(() => {
    const unsub = subscribeToReports((allReports) => {
      setReports(allReports);
      setLoadingReports(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToAnnouncements((allAnnouncements) => {
      setAnnouncements(allAnnouncements);
      setLoadingAnnouncements(false);
    });
    return unsub;
  }, []);

  const archivedReports = useMemo(
    () => reports.filter(report => report.archived_at && !report.deleted_at && canAccessReport(report, adminRole)),
    [reports, adminRole]
  );

  const archivedAnnouncements = useMemo(
    () => announcements.filter(announcement => (announcement.visibility_status === 'archived' || announcement.archived_at) && announcement.visibility_status !== 'deleted' && !announcement.deleted_at && canAccessAnnouncement(announcement, adminRole)),
    [announcements, adminRole]
  );

  useEffect(() => {
    archivedAnnouncements.forEach((announcement) => {
      if (announcement.resident_visibility_synced || syncedAnnouncementIds.current.has(announcement.id)) return;

      syncedAnnouncementIds.current.add(announcement.id);
      syncArchivedAnnouncementVisibility(announcement).catch((error) => {
        console.error('Failed to sync archived announcement visibility:', error);
        syncedAnnouncementIds.current.delete(announcement.id);
      });
    });
  }, [archivedAnnouncements]);

  const restoreReport = async (reportId) => {
    try {
      await restoreArchivedReport(reportId);
      toast.success('Report restored');
    } catch (err) {
      toast.error('Failed to restore report');
    }
  };

  const restoreAnnouncement = async (announcementId) => {
    try {
      await restoreArchivedAnnouncement(announcementId);
      toast.success('Announcement restored');
    } catch (err) {
      toast.error('Failed to restore announcement');
    }
  };

  const isLoading = loadingReports || loadingAnnouncements;

  if (isLoading) {
    return <div className="space-y-3 w-full">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={activeTab === 'reports' ? 'default' : 'outline'}
            size="sm"
            className="h-9"
            onClick={() => setActiveTab('reports')}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" /> Reports ({archivedReports.length})
          </Button>
          <Button
            type="button"
            variant={activeTab === 'announcements' ? 'default' : 'outline'}
            size="sm"
            className="h-9"
            onClick={() => setActiveTab('announcements')}
          >
            <Megaphone className="h-3.5 w-3.5 mr-1.5" /> Announcements ({archivedAnnouncements.length})
          </Button>
        </div>
        <span className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20">
          Archived items stay restorable
        </span>
      </div>

      {activeTab === 'reports' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-6 py-3.5 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {archivedReports.length} archived report{archivedReports.length !== 1 ? 's' : ''}
            </p>
          </div>
          {archivedReports.length === 0 ? (
            <EmptyArchive label="No archived reports" />
          ) : (
            <div className="divide-y divide-border">
              {archivedReports.map((report) => {
                const status = getStatusConfig(report.status);
                return (
                  <div key={report.id} className="flex flex-col gap-3 px-4 py-4 hover:bg-muted/20 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:px-6">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-primary">{report.report_id || report.id}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${status.badge}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground line-clamp-1">{report.description || 'No description'}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" /> Archived {formatArchivedDate(report.archived_at)}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 w-full text-xs sm:w-auto" onClick={() => restoreReport(report.id)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restore
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-6 py-3.5 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {archivedAnnouncements.length} archived announcement{archivedAnnouncements.length !== 1 ? 's' : ''}
            </p>
          </div>
          {archivedAnnouncements.length === 0 ? (
            <EmptyArchive label="No archived announcements" />
          ) : (
            <div className="divide-y divide-border">
              {archivedAnnouncements.map((announcement) => (
                <div key={announcement.id} className="flex flex-col gap-3 px-4 py-4 hover:bg-muted/20 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:px-6">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-primary">{announcement.category || 'Announcement'}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg border bg-slate-50 text-slate-700 border-slate-200">
                        {announcement.status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground line-clamp-1">{announcement.title || 'Untitled announcement'}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" /> Archived {formatArchivedDate(announcement.archived_at)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 w-full text-xs sm:w-auto" onClick={() => restoreAnnouncement(announcement.id)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyArchive({ label }) {
  return (
    <div className="text-center py-20">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
        <ArchiveIcon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">Archived items will appear here</p>
    </div>
  );
}
