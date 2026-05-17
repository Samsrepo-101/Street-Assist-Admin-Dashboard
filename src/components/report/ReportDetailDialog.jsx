import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Calendar, User, Phone, Map, ImageIcon, ChevronLeft, ChevronRight, Tag, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { updateReportStatus, updateReportMeta, enrichReportWithUser, getStatusConfig, REPORT_STATUSES } from '../../api/reports.js';
import { exportReportPDF } from '../../utils/exportReportPDF.js';
import { toast } from 'sonner';
import MapViewModal from '../shared/MapViewModal';

// ---------------------------------------------------------------------------
// Attachment gallery — handles single photoUrl or array
// ---------------------------------------------------------------------------
function AttachmentGallery({ attachments }) {
  const [current, setCurrent] = useState(0);

  if (!attachments || attachments.length === 0) {
    return (
      <div className="w-full h-32 rounded-lg border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-1.5">
        <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No image attached</p>
      </div>
    );
  }

  const prev = () => setCurrent(i => (i - 1 + attachments.length) % attachments.length);
  const next = () => setCurrent(i => (i + 1) % attachments.length);

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg overflow-hidden border border-border bg-muted/20">
        <img
          src={attachments[current]}
          alt={`Attachment ${current + 1}`}
          className="w-full h-52 object-cover"
          onError={e => {
            e.target.style.display = 'none';
            e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
          }}
        />
        <div className="hidden w-full h-52 items-center justify-center bg-muted/30 flex-col gap-1.5">
          <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Image unavailable</p>
        </div>
        {attachments.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white">
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="absolute bottom-2 right-2 text-[10px] font-semibold bg-black/50 text-white px-2 py-0.5 rounded-full">
              {current + 1} / {attachments.length}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------
export default function ReportDetailDialog({ report, open, onClose }) {
  const [status, setStatus] = useState('Pending');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [enrichedReport, setEnrichedReport] = useState(null);

  useEffect(() => {
    if (!report) return;
    setStatus(report.status ?? 'Pending');
    setNotes(report.adminNotes ?? '');
    setEnrichedReport(report);

    // Enrich with user data only if fullName is missing
    if (!report.fullName && !report.reporter_name && report.userId) {
      enrichReportWithUser(report).then(setEnrichedReport);
    }
  }, [report]);

  if (!report || !enrichedReport) return null;

  const r = enrichedReport;
  const statusCfg = getStatusConfig(r.status);
  const hasLocation = r.latitude != null && r.longitude != null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateReportStatus(r.id, status);
      await updateReportMeta(r.id, {
        adminNotes: notes,
        admin_seen: true,
        ...(status === 'Resolved' ? { resolutionTimestamp: new Date() } : {}),
      });
      toast.success('Report updated');
      onClose();
    } catch (err) {
      console.error('[ReportDetailDialog] save error:', err);
      toast.error(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async (e) => {
    e.stopPropagation();
    setExporting(true);
    try {
      await exportReportPDF(r);
      toast.success('Report PDF exported successfully');
    } catch (err) {
      console.error('[ReportDetailDialog] export error:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  };

  // Format the timestamp — try seenAt first, then timestamp
  const displayTime = r.seenAt?.toDate
    ? format(r.seenAt.toDate(), 'MMM dd, yyyy · hh:mm a')
    : r.timestamp?.toDate
    ? format(r.timestamp.toDate(), 'MMM dd, yyyy · hh:mm a')
    : 'N/A';

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-primary text-sm font-bold">
                {r.reportId || r.report_id || r.id}
              </span>
              <Badge variant="outline" className={statusCfg.badge}>
                {statusCfg.label}
              </Badge>
              {r.reportType && (
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {r.reportType}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Photo */}
            <AttachmentGallery attachments={r.attachments} />

            {/* Description */}
            <div className="bg-muted/40 rounded-lg p-3 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                Incident Description
              </p>
              <p className="text-sm text-foreground font-medium">
                {r.description || 'No description provided'}
              </p>
              {r.assistanceDescription && r.assistanceDescription !== r.description && (
                <p className="text-xs text-muted-foreground mt-1.5 border-t border-border pt-1.5">
                  {r.assistanceDescription}
                </p>
              )}
            </div>

            {/* Subject info (approximateAge, sex, reportType) */}
            {(r.approximateAge || r.sex || r.reportType) && (
              <div className="grid grid-cols-3 gap-2">
                {r.reportType && (
                  <div className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">Type</p>
                    <div className="flex items-center gap-1">
                      <Tag className="h-3 w-3 text-primary shrink-0" />
                      <span className="text-xs font-semibold text-foreground">{r.reportType}</span>
                    </div>
                  </div>
                )}
                {r.sex && (
                  <div className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">Sex</p>
                    <span className="text-xs font-semibold text-foreground">{r.sex}</span>
                  </div>
                )}
                {r.approximateAge && (
                  <div className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">Age</p>
                    <span className="text-xs font-semibold text-foreground">~{r.approximateAge}</span>
                  </div>
                )}
              </div>
            )}

            {/* Reporter info */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">
                  Reported By
                </p>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-foreground truncate">
                    {r.fullName || r.reporter_name || 'Anonymous'}
                  </span>
                </div>
              </div>
              <div className="bg-primary/5 border border-primary/10 rounded-lg px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-0.5">
                  Contact
                </p>
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-sm text-foreground truncate">
                    {r.contactNumber || r.reporter_email || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Location + timestamp */}
            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <div className="min-w-0">
                  <span className="text-xs leading-snug break-words">
                    {r.locationAddress || r.location_address ||
                      (hasLocation ? `${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}` : 'Unknown location')}
                  </span>
                  {hasLocation && (
                    <button
                      onClick={() => setMapOpen(true)}
                      className="block text-primary hover:underline text-xs font-medium mt-0.5"
                    >
                      View on map
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-xs">{displayTime}</span>
              </div>
            </div>

            {/* Map button */}
            {hasLocation && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setMapOpen(true)}>
                <Map className="h-3.5 w-3.5 mr-2" /> View Location on Map
              </Button>
            )}

            {/* Resolution info */}
            {r.resolutionTimestamp && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700">
                Resolved on{' '}
                {r.resolutionTimestamp?.toDate
                  ? format(r.resolutionTimestamp.toDate(), 'MMM dd, yyyy · hh:mm a')
                  : '—'}
              </div>
            )}

            {/* Status update */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Update Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Admin notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Notes</label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add notes about this report..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={exporting}
                className="mr-auto text-xs font-medium"
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export PDF
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MapViewModal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        latitude={r.latitude}
        longitude={r.longitude}
        title={r.reportId || r.report_id || r.id}
        address={r.locationAddress || r.location_address}
      />
    </>
  );
}
