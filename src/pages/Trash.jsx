import React, { useState, useEffect } from 'react';
import { subscribeToReports, updateReportMeta, getStatusConfig } from '../api/reports.js';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../api/firebase.js';
import { Button } from '@/components/ui/button';
import { RotateCcw, Trash2, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '../lib/AuthContext';
import { canAccessReport } from '../lib/adminRoles.js';

export default function Trash() {
  const [selected, setSelected] = useState(new Set());
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { adminRole } = useAuth();

  useEffect(() => {
    const unsub = subscribeToReports((allReports) => {
      setReports(allReports.filter(r => r.deleted_at != null && canAccessReport(r, adminRole)));
      setIsLoading(false);
    });
    return unsub;
  }, [adminRole]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const restoreSelected = async () => {
    try {
      for (const id of selected) {
        await updateReportMeta(id, { deleted_at: null });
      }
      toast.success(`${selected.size} report(s) restored`);
      setSelected(new Set());
    } catch (err) {
      toast.error('Failed to restore reports');
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`Permanently delete ${selected.size} report(s)? This cannot be undone.`)) return;
    try {
      for (const id of selected) {
        await deleteDoc(doc(db, 'reports', id));
      }
      toast.success(`${selected.size} report(s) permanently deleted`);
      setSelected(new Set());
    } catch (err) {
      toast.error('Failed to delete reports');
    }
  };

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
            {reports.length} item{reports.length !== 1 ? 's' : ''} in trash
          </p>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">Trash is empty</p>
            <p className="text-xs text-muted-foreground mt-1">Deleted reports will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {reports.map((report) => (
              <div key={report.id} className="flex flex-col gap-3 px-4 py-4 hover:bg-muted/20 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:px-6">
                <input
                  type="checkbox"
                  checked={selected.has(report.id)}
                  onChange={() => toggleSelect(report.id)}
                  className="h-4 w-4 rounded border-border accent-primary shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-muted-foreground">{report.report_id || report.id}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground/70 line-clamp-1">{report.description}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{report.locationAddress || report.location_address || 'Unknown'}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Deleted {format(new Date(report.deleted_at), 'MMM dd, yyyy')}</span>
                  </div>
                </div>
                <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${getStatusConfig(report.status).badge}`}>
                  {getStatusConfig(report.status).label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
