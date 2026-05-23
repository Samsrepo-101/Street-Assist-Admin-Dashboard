import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Calendar, User, Phone, Map, ImageIcon, ChevronLeft, ChevronRight, Tag, Download, Loader2, X, Play, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { updateReportStatus, addReportStatusUpdate, updateReportMeta, enrichReportWithUser, getStatusConfig, REPORT_STATUSES } from '../../api/reports.js';
import { exportReportPDF } from '../../utils/exportReportPDF.js';
import { toast } from 'sonner';
import MapViewModal from '../shared/MapViewModal';
import { Input } from '@/components/ui/input';
import { uploadMediaToCloudinary } from '../../api/cloudinary.js';
import ProofMediaPreview from '../shared/ProofMediaPreview';
import { PROOF_MEDIA_ACCEPT, filterValidProofFiles, getProofMediaLabel, isVideoFile, isVideoUrl } from '../../utils/proofMedia.js';
import MediaLightbox from '../shared/MediaLightbox';

// ---------------------------------------------------------------------------
// Attachment gallery — handles single photoUrl or array
// ---------------------------------------------------------------------------
function AttachmentGallery({ attachments }) {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!attachments || attachments.length === 0) {
    return (
      <div className="w-full h-32 rounded-lg border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-1.5">
        <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No image attached</p>
      </div>
    );
  }

  const prev = (e) => {
    e.stopPropagation();
    setCurrent(i => (i - 1 + attachments.length) % attachments.length);
  };

  const next = (e) => {
    e.stopPropagation();
    setCurrent(i => (i + 1) % attachments.length);
  };

  const activeUrl = attachments[current];
  const isVideo = isVideoUrl(activeUrl);

  return (
    <div className="space-y-2">
      <div
        className="relative rounded-lg overflow-hidden border border-border bg-muted/20 group cursor-pointer"
        onClick={() => setLightboxOpen(true)}
      >
        {isVideo ? (
          <video
            src={activeUrl}
            className="w-full h-52 object-cover transition-transform duration-300 group-hover:scale-105"
            muted
            preload="metadata"
            playsInline
          />
        ) : (
          <img
            src={activeUrl}
            alt={`Attachment ${current + 1}`}
            className="w-full h-52 object-cover transition-transform duration-300 group-hover:scale-105"
            onError={e => {
              e.target.style.display = 'none';
              e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
            }}
          />
        )}
        <div className="hidden w-full h-52 items-center justify-center bg-muted/30 flex-col gap-1.5">
          <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Attachment unavailable</p>
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-white">
          {isVideo ? (
            <div className="flex flex-col items-center gap-1.5">
              <Play className="h-8 w-8 fill-white text-white drop-shadow-md animate-in zoom-in-75 duration-200" />
              <span className="text-xs font-semibold drop-shadow">Click to Play Video</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <Eye className="h-8 w-8 text-white drop-shadow-md animate-in zoom-in-75 duration-200" />
              <span className="text-xs font-semibold drop-shadow">Click to Zoom</span>
            </div>
          )}
        </div>

        {attachments.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white z-10 transition-transform active:scale-95">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white z-10 transition-transform active:scale-95">
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="absolute bottom-2 right-2 text-[10px] font-semibold bg-black/50 text-white px-2 py-0.5 rounded-full z-10">
              {current + 1} / {attachments.length}
            </span>
          </>
        )}
      </div>

      <MediaLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        media={attachments}
        initialIndex={current}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------
export default function ReportDetailDialog({ report, open, onClose }) {
  const [status, setStatus] = useState('Pending');
  const [notes, setNotes] = useState('');
  const [updateMsg, setUpdateMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [enrichedReport, setEnrichedReport] = useState(null);
  const [proofFiles, setProofFiles] = useState([]);
  const [proofPreviews, setProofPreviews] = useState([]);
  const [existingProofImages, setExistingProofImages] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const urls = proofFiles.map(file => URL.createObjectURL(file));
    setProofPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [proofFiles]);

  useEffect(() => {
    if (!report) return;
    setStatus(report.status ?? 'Pending');
    setNotes(report.adminNotes ?? '');
    setUpdateMsg('');
    setProofFiles([]);
    setExistingProofImages(report.proofImages || []);
    setEnrichedReport(report);

    // Mark as seen immediately upon opening if not already seen
    if (!report.admin_seen) {
      updateReportMeta(report.id, { admin_seen: true }).catch(err => {
        console.error('[ReportDetailDialog] failed to mark report seen:', err);
      });
    }

    // Enrich with user data only if fullName is missing
    if (!report.fullName && !report.reporter_name && report.userId) {
      enrichReportWithUser(report).then((res) => {
        setEnrichedReport(res);
      });
    }
  }, [report]);

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    const nextCanManageProof = newStatus === 'Resolved' || r.status === 'Resolved';
    if (!nextCanManageProof) {
      setProofFiles([]);
    }
    if (newStatus === 'Resolved' && status !== newStatus) {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const handleProofSelection = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    if (status !== 'Resolved' && r.status !== 'Resolved') {
      toast.error('Proof can only be added when the report is Resolved.');
      event.target.value = '';
      return;
    }
    const validFiles = await filterValidProofFiles(files, (message) => toast.error(message));
    setProofFiles((prev) => [...prev, ...validFiles]);
    event.target.value = '';
  };

  if (!report || !enrichedReport) return null;

  const r = enrichedReport;
  const isClosed = r.status === 'Closed';
  const canManageProof = status === 'Resolved' || r.status === 'Resolved';
  const statusCfg = getStatusConfig(r.status);
  const hasLocation = r.latitude != null && r.longitude != null;

  const handleSendUpdate = async () => {
    if (!status) return;
    setSaving(true);
    try {
      let proofUrls = [];
      if (proofFiles.length > 0) {
        if (!canManageProof) {
          toast.error('Proof can only be added when the report is Resolved.');
          return;
        }
        toast.info(`Uploading ${proofFiles.length} proof media item(s)...`);
        for (const file of proofFiles) {
          const url = await uploadMediaToCloudinary(file);
          proofUrls.push(url);
        }
      }

      await addReportStatusUpdate(r.id, status, updateMsg, proofUrls);
      const updatedFields = {
        adminNotes: notes,
        admin_seen: true,
        proofImages: [...existingProofImages, ...proofUrls],
      };
      if (status === 'Resolved') {
        updatedFields.resolutionTimestamp = new Date();
      }
      await updateReportMeta(r.id, updatedFields);
      toast.success('Report status updated');
      setUpdateMsg('');
      setProofFiles([]);
      onClose();
    } catch (err) {
      console.error('[ReportDetailDialog] send update error:', err);
      toast.error('Failed to send update');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let proofUrls = [];
      if (proofFiles.length > 0) {
        if (!canManageProof) {
          toast.error('Proof can only be added when the report is Resolved.');
          return;
        }
        toast.info(`Uploading ${proofFiles.length} proof media item(s)...`);
        for (const file of proofFiles) {
          const url = await uploadMediaToCloudinary(file);
          proofUrls.push(url);
        }
      }

      if (status !== r.status) {
        if (updateMsg.trim() || proofUrls.length > 0) {
          await addReportStatusUpdate(r.id, status, updateMsg, proofUrls);
        } else {
          await updateReportStatus(r.id, status);
        }
      }
      const metaUpdate = {
        adminNotes: notes,
        admin_seen: true,
        proofImages: [...existingProofImages, ...proofUrls],
        ...(status === 'Resolved' ? { resolutionTimestamp: new Date() } : {}),
      };
      await updateReportMeta(r.id, metaUpdate);
      toast.success('Report saved');
      setUpdateMsg('');
      setProofFiles([]);
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
            <DialogTitle className="flex items-center gap-2 flex-wrap justify-between w-full">
              <div className="flex items-center gap-2 flex-wrap">
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
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
              {/* Photo */}
              <AttachmentGallery attachments={r.attachments} />

              <Input
                ref={fileInputRef}
                type="file"
                multiple
                accept={PROOF_MEDIA_ACCEPT}
                className="hidden"
                onChange={handleProofSelection}
              />

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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
              <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
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

              {/* Closed Case Notice Banner */}
              {isClosed && (
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 flex items-start gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs">ℹ️</span>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-700">Case Closed</p>
                    <p className="text-[11px] leading-normal text-slate-500">
                      This report is closed, but as an administrator, you can still update its status, add proof/evidence, or edit notes.
                    </p>
                  </div>
                </div>
              )}

              {/* Update Status & Send Message Section */}
              <div className="bg-slate-50 border border-border rounded-xl p-4 space-y-3">
                <div className="flex flex-col gap-2 border-b border-border/60 pb-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">Update Status & Progress</span>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Select Status</label>
                    <Select value={status} onValueChange={handleStatusChange} disabled={isClosed}>
                      <SelectTrigger className="h-9 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REPORT_STATUSES.map(s => {
                          const cfg = getStatusConfig(s);
                          return (
                            <SelectItem key={s} value={s}>{cfg.label}</SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>


                  
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Update Message / Action Taken</label>
                    <Textarea
                      value={updateMsg}
                      onChange={e => setUpdateMsg(e.target.value)}
                      placeholder="E.g., Dispatched barangay responders and informed Barangay Captain..."
                      rows={2}
                      className="text-sm border-border bg-white"
                      disabled={isClosed}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button 
                    type="button"
                    onClick={handleSendUpdate} 
                    disabled={isClosed || saving || !status}
                    size="sm"
                    className="h-8 text-xs font-semibold"
                  >
                    {saving ? 'Sending...' : 'Send Update'}
                  </Button>
                </div>
              </div>

              {/* Status Update History Log */}
              {r.statusUpdates && r.statusUpdates.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">Status Update History</span>
                  <div className="border border-border rounded-xl bg-white divide-y divide-border overflow-hidden max-h-48 overflow-y-auto">
                    {r.statusUpdates.slice().reverse().map((upd, idx) => {
                      const cfg = getStatusConfig(upd.status);
                      return (
                        <div key={idx} className="p-3 text-xs space-y-1 bg-white">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <Badge variant="outline" className={`${cfg.badge} text-[10px] px-1.5 py-0`}>
                              {cfg.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {upd.timestamp ? format(new Date(upd.timestamp), 'MMM dd, yyyy · hh:mm a') : '—'}
                            </span>
                          </div>
                          {upd.message && (
                            <p className="text-foreground font-medium pl-0.5 mt-1 leading-relaxed">
                              {upd.message}
                            </p>
                          )}
                          {upd.proofUrls && upd.proofUrls.length > 0 && (
                            <div className="flex gap-2 mt-2 overflow-x-auto pb-1 pl-0.5">
                              {upd.proofUrls.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                  <ProofMediaPreview src={url} alt="Proof" className="h-10 w-10 object-cover rounded border border-border" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Proof / Evidence Section */}
              <div className="bg-slate-50 border border-border rounded-xl p-4 space-y-3">
                <div className="flex flex-col gap-2 border-b border-border/60 pb-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">Proof / Evidence</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Images or videos up to 30 seconds</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!canManageProof) {
                        toast.error('Set the report status to Resolved before adding proof.');
                        return;
                      }
                      fileInputRef.current?.click();
                    }}
                    disabled={!canManageProof}
                    className="h-8 text-xs font-semibold bg-white"
                  >
                    Select proof
                  </Button>
                </div>

                <div className="rounded-lg border border-dashed border-border bg-white p-3 text-sm text-muted-foreground">
                  {!canManageProof && (
                    <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 border border-amber-200">
                      Proof can be added only when the report is Resolved.
                    </p>
                  )}
                  {existingProofImages.length > 0 && (
                    <div className="mb-3">
                      <div className="flex flex-col gap-2 mb-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs font-bold text-foreground">{existingProofImages.length} existing {getProofMediaLabel(existingProofImages.length)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setExistingProofImages([])}
                          disabled={!canManageProof}
                          className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                        >
                          Clear existing
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {existingProofImages.map((src, i) => (
                          <div key={`existing-${i}`} className="relative overflow-hidden border border-border bg-white rounded-md">
                            <ProofMediaPreview src={src} alt={`Existing proof ${i + 1}`} />
                            <button
                              type="button"
                              onClick={() => setExistingProofImages(prev => prev.filter((_, idx) => idx !== i))}
                              disabled={!canManageProof}
                              className="absolute top-1 right-1 bg-black/60 hover:bg-black/85 text-white rounded-full h-5 w-5 flex items-center justify-center text-[10px] transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {proofFiles.length > 0 && (
                    <div>
                      <div className="flex flex-col gap-2 mb-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs font-bold text-foreground">{proofFiles.length} new {getProofMediaLabel(proofFiles.length)} selected</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setProofFiles([])}
                          className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                        >
                          Clear all
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {proofPreviews.map((src, i) => (
                          <div key={`preview-${i}`} className="relative overflow-hidden border border-border bg-white rounded-md">
                            {isVideoFile(proofFiles[i]) ? (
                              <video src={src} className="h-20 w-full object-cover" controls muted preload="metadata" />
                            ) : (
                              <img src={src} alt={`Proof ${i + 1}`} className="h-20 w-full object-cover" />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const newFiles = [...proofFiles];
                                newFiles.splice(i, 1);
                                setProofFiles(newFiles);
                              }}
                              className="absolute top-1 right-1 bg-black/60 hover:bg-black/85 text-white rounded-full h-5 w-5 flex items-center justify-center text-[10px] transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {existingProofImages.length === 0 && proofFiles.length === 0 && (
                    <p className="text-xs text-center py-4 text-muted-foreground">No proof media selected yet.</p>
                  )}
                </div>
              </div>

              {/* Admin notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Admin Notes</label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes about this report..."
                  rows={2}
                  className="text-sm border-border bg-white"
                />
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={exporting}
                  className="text-xs font-medium sm:mr-auto"
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
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
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
