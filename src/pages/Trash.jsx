import React, { useState, useEffect } from 'react';
import { subscribeToReports, restoreDeletedReport, getStatusConfig } from '../api/reports.js';
import { subscribeToAnnouncements, restoreDeletedAnnouncement, permanentlyDeleteAnnouncement } from '../api/announcement.js';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../api/firebase.js';
import { Button } from '@/components/ui/button';
import { RotateCcw, Trash2, MapPin, Clock, FileText, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '../lib/AuthContext';
import { canAccessAnnouncement, canAccessReport } from '../lib/adminRoles.js';

export default function Trash() {
  const [selected, setSelected] = useState(new Set());
  const [reports, setReports] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const { adminRole } = useAuth();

  useEffect(() => {
    const unsub = subscribeToReports((allReports) => {
      setReports(allReports.filter(r => r.deleted_at != null && canAccessReport(r, adminRole)));
      setLoadingReports(false);
    });
    return unsub;
  }, [adminRole]);

  useEffect(() => {
    const unsub = subscribeToAnnouncements((allAnnouncements) => {
      setAnnouncements(allAnnouncements.filter(a => (a.status === 'deleted' || a.deleted_at != null) && canAccessAnnouncement(a, adminRole)));
      setLoadingAnnouncements(false);
    });
    return unsub;
  }, [adminRole]);

  const trashItems = [
    ...reports.map(report => ({
      ...report,
      type: 'report',
      selectionId: `report:${report.id}`,
      title: report.description || 'No description',
      label: report.report_id || report.id,
      meta: report.locationAddress || report.location_address || 'Unknown',
    })),
    ...announcements.map(announcement => ({
      ...announcement,
      type: 'announcement',
      selectionId: `announcement:${announcement.id}`,
      title: announcement.title || 'Untitled announcement',
      label: announcement.category || 'Announcement',
      meta: announcement.location_address || announcement.name || 'No location',
    })),
  ].sort((a, b) => new Date(b.deleted_at || 0).getTime() - new Date(a.deleted_at || 0).getTime());

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const restoreSelected = async () => {
    try {
      for (const selectionId of selected) {
        const [type, id] = selectionId.split(':');
        if (type === 'announcement') {
          await restoreDeletedAnnouncement(id);
        } else {
          await restoreDeletedReport(id);
        }
      }
      toast.success(`${selected.size} item(s) restored`);
      setSelected(new Set());
    } catch (err) {
      toast.error('Failed to restore items');
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`Permanently delete ${selected.size} item(s)? This cannot be undone.`)) return;
    try {
      for (const selectionId of selected) {
        const [type, id] = selectionId.split(':');
        if (type === 'announcement') {
          await permanentlyDeleteAnnouncement(id);
        } else {
          await deleteDoc(doc(db, 'reports', id));
        }
      }
      toast.success(`${selected.size} item(s) permanently deleted`);
      setSelected(new Set());
    } catch (err) {
      toast.error('Failed to delete items');
    }
  };

  const isLoading = loadingReports || loadingAnnouncements;

  if (isLoading) {
    return <div className="space-y-3 w-full">{[1,2].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-4 w-full">
      {selected.size > 0 && (
        <div className="flex flex-col gap-2 bg-white rounded-2xl p-3 shadow-sm border border-border sm:flex-row">
          <Button size="sm" onClick={restoreSelected} className="h-8 text-xs">
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restore ({selected.size})
          </Button>
          <Button variant="destructive" size="sm" onClick={deleteSelected} className="h-8 text-xs">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Permanently ({selected.size})
          </Button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="px-6 py-3.5 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {trashItems.length} item{trashItems.length !== 1 ? 's' : ''} in trash
          </p>
        </div>

        {trashItems.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">Trash is empty</p>
            <p className="text-xs text-muted-foreground mt-1">Deleted reports and announcements will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {trashItems.map((item) => (
              <div key={item.selectionId} className="flex flex-col gap-3 px-4 py-4 hover:bg-muted/20 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:px-6">
                <input
                  type="checkbox"
                  checked={selected.has(item.selectionId)}
                  onChange={() => toggleSelect(item.selectionId)}
                  className="h-4 w-4 rounded border-border accent-primary shrink-0"
                />
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {item.type === 'announcement' ? <Megaphone className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-muted-foreground">{item.label}</span>
                    <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                      {item.type === 'announcement' ? 'Announcement' : 'Report'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground/70 line-clamp-1">{item.title}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.meta}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Deleted {format(new Date(item.deleted_at), 'MMM dd, yyyy')}</span>
                  </div>
                </div>
                <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${item.type === 'announcement' ? 'bg-slate-50 text-slate-700 border-slate-200' : getStatusConfig(item.status).badge}`}>
                  {item.type === 'announcement' ? item.status : getStatusConfig(item.status).label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
