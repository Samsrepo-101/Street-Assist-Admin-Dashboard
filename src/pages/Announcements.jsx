import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { subscribeToAnnouncements, deleteAnnouncement, archiveAnnouncement, updateAnnouncementStatus } from '../api/announcement.js';
import { uploadMediaToCloudinary } from '../api/cloudinary.js';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plus, Search, Camera, Upload, Video } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { isAfter, subDays } from 'date-fns';
import AnnouncementCard from '../components/announcement/AnnouncementCard';
import AddAnnouncementDialog from '../components/announcement/AddAnnouncementDialog';
import CommentsDialog from '../components/announcement/CommentsDialog';
import { useAuth } from '../lib/AuthContext';
import { canAccessAnnouncement, isMissingAnimalsAdminRole, isMissingPersonAdminRole, isScopedAnnouncementAdminRole } from '../lib/adminRoles.js';
import ProofMediaPreview from '../components/shared/ProofMediaPreview';
import { PROOF_MEDIA_ACCEPT, filterValidProofFiles, getProofMediaLabel, isVideoFile } from '../utils/proofMedia.js';

function ProofGallery({ images }) {
  const [current, setCurrent] = useState(0);

  if (!images || images.length === 0) return null;

  const prev = (e) => {
    e.stopPropagation();
    setCurrent(i => (i - 1 + images.length) % images.length);
  };
  const next = (e) => {
    e.stopPropagation();
    setCurrent(i => (i + 1) % images.length);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border bg-slate-50">
      <ProofMediaPreview
        src={images[current]}
        alt={`Proof media ${current + 1}`}
        className="w-full h-44 object-cover"
      />
      {images.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white z-10">
            <span className="text-xs">◀</span>
          </button>
          <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white z-10">
            <span className="text-xs">▶</span>
          </button>
          <span className="absolute bottom-2 right-2 text-[10px] font-semibold bg-black/50 text-white px-2 py-0.5 rounded-full z-10">
            {current + 1} / {images.length}
          </span>
        </>
      )}
      <div className="px-3 py-2 text-[11px] text-slate-600 bg-white/80">
        Proof media
      </div>
    </div>
  );
}

export default function Announcements() {
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [commentsTarget, setCommentsTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [evidencePreviews, setEvidencePreviews] = useState([]);
  const [existingEvidenceImages, setExistingEvidenceImages] = useState([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [evidenceUploadProgress, setEvidenceUploadProgress] = useState(0);
  const [isReplacingEvidence, setIsReplacingEvidence] = useState(false);
  const [clearEvidence, setClearEvidence] = useState(false);
  const statusTargetIsClosed = statusTarget?.status === 'Case Closed';
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const cameraVideoInputRef = useRef(null);
  const { adminRole } = useAuth();
  const isMissingAnimalsAdmin = isMissingAnimalsAdminRole(adminRole);
  const isMissingPersonAdmin = isMissingPersonAdminRole(adminRole);
  const isScopedAnnouncementAdmin = isScopedAnnouncementAdminRole(adminRole);
  const forcedAnnouncementCategory =
    isMissingAnimalsAdmin ? 'Missing Animal' :
    isMissingPersonAdmin ? 'Missing Person' :
    null;

  useEffect(() => {
    const urls = evidenceFiles.map(file => URL.createObjectURL(file));
    setEvidencePreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [evidenceFiles]);

  useEffect(() => {
    if (statusTarget) {
      setExistingEvidenceImages(statusTarget.evidenceUrls || (statusTarget.evidenceUrl ? [statusTarget.evidenceUrl] : []));
      setEvidenceFiles([]);
      setEvidencePreviews([]);
      setIsReplacingEvidence(false);
      setClearEvidence(false);
    }
  }, [statusTarget]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [dateFilter, setDateFilter] = useState('All Dates');
  const [statusFilter, setStatusFilter] = useState('All Statuses');

  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const location = useLocation();

  useEffect(() => {
    const unsub = subscribeToAnnouncements((data) => {
      setAnnouncements(data);
      setIsLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (location.state?.selectedAnnouncementId && announcements.length > 0) {
      const found = announcements.find(a => a.id === location.state.selectedAnnouncementId);
      if (found) {
        setCommentsTarget(found);
      }
    }
  }, [location.state?.selectedAnnouncementId, announcements]);

  const handleDelete = async (ann) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await deleteAnnouncement(ann.id);
      toast.success('Announcement deleted');
    } catch (err) {
      toast.error('Failed to delete announcement');
    }
  };

  const handleArchive = async (ann) => {
    try {
      await archiveAnnouncement(ann.id);
      toast.success('Announcement archived');
    } catch (err) {
      toast.error('Failed to archive announcement');
    }
  };

  const handleEvidenceSelected = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const validFiles = await filterValidProofFiles(files, (message) => toast.error(message));

    setEvidenceFiles(prev => [...prev, ...validFiles]);
    setIsReplacingEvidence(true);
    setClearEvidence(false);
    event.target.value = '';
  };

  const handleStatusSelection = (value) => {
    setNewStatus(value);
  };

  const handleUpdateStatus = async () => {
    if (!statusTarget || !newStatus) return;
    const uploadedUrls = [];
    if (isReplacingEvidence && evidenceFiles.length > 0) {
      setUploadingEvidence(true);
      try {
        toast.info('Uploading evidence media...');
        for (const file of evidenceFiles) {
          const url = await uploadMediaToCloudinary(file);
          uploadedUrls.push(url);
        }
      } catch (err) {
        console.error('Evidence upload failed:', err);
        toast.error('Failed to upload evidence media');
        setUploadingEvidence(false);
        return;
      }
      setUploadingEvidence(false);
    }

    const finalEvidenceUrls = clearEvidence ? [] : [...existingEvidenceImages, ...uploadedUrls];

    try {
      await updateAnnouncementStatus(statusTarget.id, newStatus, finalEvidenceUrls);
      toast.success('Status updated');
      setStatusTarget(null);
      setNewStatus('');
      setEvidenceFiles([]);
      setExistingEvidenceImages([]);
      setIsReplacingEvidence(false);
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const filtered = useMemo(() => {
    // 1. Filter
    let result = announcements.filter(ann => {
      if (ann.archived_at) return false;
      if (!canAccessAnnouncement(ann, adminRole)) return false;

      const matchSearch = !search ||
        ann.title?.toLowerCase().includes(search.toLowerCase()) ||
        ann.content?.toLowerCase().includes(search.toLowerCase()) ||
        ann.subtitle?.toLowerCase().includes(search.toLowerCase());

      const itemCategory = ann.category || 'Missing Person';
      const matchCategory = isScopedAnnouncementAdmin || categoryFilter === 'All Categories' || itemCategory === categoryFilter;

      let matchDate = true;
      if (dateFilter === 'Today' || dateFilter === 'This Week' || dateFilter === 'This Month') {
        const now = new Date();
        const created = ann.timestamp?.toDate ? ann.timestamp.toDate() : new Date(ann.timestamp || 0);
        
        if (dateFilter === 'Today') {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          matchDate = isAfter(created, startOfToday);
        } else if (dateFilter === 'This Week') {
          matchDate = isAfter(created, subDays(now, 7));
        } else if (dateFilter === 'This Month') {
          matchDate = isAfter(created, subDays(now, 30));
        }
      }

      const matchStatus = statusFilter === 'All Statuses' || ann.status === statusFilter;

      return matchSearch && matchCategory && matchDate && matchStatus;
    });

    // 2. Sort
    result.sort((a, b) => {
      const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp || 0).getTime();
      const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp || 0).getTime();

      if (dateFilter === 'Oldest') {
        return timeA - timeB;
      } else {
        // Default to newest first
        return timeB - timeA;
      }
    });

    return result;
  }, [announcements, search, categoryFilter, dateFilter, statusFilter, adminRole, isScopedAnnouncementAdmin]);

  if (isLoading) {
    return <div className="space-y-4 w-full">{[1,2].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20">
          {filtered.length} announcement{filtered.length !== 1 ? 's' : ''}
        </span>
        <Button onClick={() => setShowAdd(true)} className="h-9 w-full text-sm font-semibold sm:w-auto">
          <Plus className="h-4 w-4 mr-1.5" /> New Announcement
        </Button>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-border p-4">
        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="relative w-full sm:min-w-[200px] sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by title, description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm bg-muted/40 border-0 focus-visible:ring-1"
            />
          </div>
          {isScopedAnnouncementAdmin ? (
            <span className="h-9 inline-flex items-center rounded-md bg-blue-50 px-3 text-sm font-semibold text-blue-700">
              {isMissingPersonAdmin ? 'Missing person only' : 'Missing animal only'}
            </span>
          ) : (
            <Select value={categoryFilter} onValueChange={setCategoryFilter} className="w-full sm:w-auto">
              <SelectTrigger className="w-full h-9 text-sm bg-muted/40 border-0 sm:w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Categories">All Categories</SelectItem>
                <SelectItem value="Missing Person">Missing Person</SelectItem>
                <SelectItem value="Missing Animal">Missing Animal</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={dateFilter} onValueChange={setDateFilter} className="w-full sm:w-auto">
            <SelectTrigger className="w-full h-9 text-sm bg-muted/40 border-0 sm:w-40">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Dates">All Dates</SelectItem>
              <SelectItem value="Today">Today</SelectItem>
              <SelectItem value="This Week">This Week</SelectItem>
              <SelectItem value="This Month">This Month</SelectItem>
              <SelectItem value="Oldest">Oldest</SelectItem>
              <SelectItem value="Newest">Newest</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
            <SelectTrigger className="w-full h-9 text-sm bg-muted/40 border-0 sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Statuses">All Statuses</SelectItem>
              <SelectItem value="Reported">Reported</SelectItem>
              <SelectItem value="Verified by Police">Verified by Police</SelectItem>
              <SelectItem value="Search Ongoing">Search Ongoing</SelectItem>
              <SelectItem value="Case Closed">Case Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-2xl border border-border">
            <p className="text-sm font-medium text-muted-foreground">No announcements found</p>
          </div>
        ) : (
          filtered.map(ann => (
            <AnnouncementCard
              key={ann.id}
              announcement={ann}
              onViewComments={setCommentsTarget}
              onUpdateStatus={(a) => { setStatusTarget(a); setNewStatus(a.status || 'Search Ongoing'); }}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onEdit={setEditTarget}
            />
          ))
        )}
      </div>

      <AddAnnouncementDialog open={showAdd} onClose={() => setShowAdd(false)} forcedCategory={forcedAnnouncementCategory} />
      <AddAnnouncementDialog open={!!editTarget} announcement={editTarget} onClose={() => setEditTarget(null)} forcedCategory={forcedAnnouncementCategory} />
      <CommentsDialog announcement={commentsTarget} open={!!commentsTarget} onClose={() => setCommentsTarget(null)} />

      <Dialog open={!!statusTarget} onOpenChange={() => setStatusTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
          </DialogHeader>
          {statusTarget && (
            <div className="space-y-3 py-2 border-y border-border my-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Announcement:</p>
                <p className="text-sm font-bold text-foreground truncate mt-0.5">{statusTarget.title}</p>
              </div>
              <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">Current Status:</span>
                <span className="font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">{statusTarget.status}</span>
              </div>
              {((statusTarget.evidenceUrls && statusTarget.evidenceUrls.length > 0) || statusTarget.evidenceUrl) && (
                <div className="rounded-2xl overflow-hidden border border-border bg-slate-50">
                  <ProofGallery images={statusTarget.evidenceUrls && statusTarget.evidenceUrls.length > 0 ? statusTarget.evidenceUrls : [statusTarget.evidenceUrl]} />
                </div>
              )}
            </div>
          )}
          {statusTargetIsClosed && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 mb-2 font-medium">
              Note: This case is currently closed. You can change its status or update the proof below.
            </div>
          )}
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">New Status:</p>
            <Select value={newStatus} onValueChange={handleStatusSelection}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Verified by Police">Verified by Police</SelectItem>
                <SelectItem value="Search Ongoing">Search Ongoing</SelectItem>
                <SelectItem value="Case Closed">Case Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={PROOF_MEDIA_ACCEPT}
            className="hidden"
            onChange={handleEvidenceSelected}
          />
          {/* Camera photo capture input */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleEvidenceSelected}
          />
          {/* Camera video capture input */}
          <input
            ref={cameraVideoInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={handleEvidenceSelected}
          />

          {newStatus === 'Case Closed' && (
            <div className="rounded-xl border border-border bg-slate-50 p-3 text-sm text-slate-700 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-xs">Evidence required</p>
                  <p className="text-[10px] text-muted-foreground">
                    Please attach proof media for this announcement. Videos must be 30 seconds or less.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs font-semibold flex-1 sm:flex-none"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Upload File
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cameraInputRef.current?.click()}
                    className="h-8 text-xs font-semibold flex-1 sm:flex-none"
                  >
                    <Camera className="h-3.5 w-3.5 mr-1.5" />
                    Take Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cameraVideoInputRef.current?.click()}
                    className="h-8 text-xs font-semibold flex-1 sm:flex-none"
                  >
                    <Video className="h-3.5 w-3.5 mr-1.5" />
                    Record Video
                  </Button>
                </div>
              </div>

              {existingEvidenceImages.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-bold text-foreground">{existingEvidenceImages.length} existing {getProofMediaLabel(existingEvidenceImages.length)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setExistingEvidenceImages([]);
                        setClearEvidence(true);
                      }}
                      className="text-destructive h-7 text-xs hover:bg-destructive/10 px-2"
                    >
                      Clear all
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {existingEvidenceImages.map((src, i) => (
                      <div key={`existing-${i}`} className="relative rounded-md overflow-hidden border border-border bg-white">
                        <ProofMediaPreview src={src} alt={`Existing proof ${i+1}`} className="h-16 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setExistingEvidenceImages(prev => prev.filter((_, idx) => idx !== i));
                            setIsReplacingEvidence(true);
                          }}
                          className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full h-5 w-5 flex items-center justify-center text-[8px]"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {evidenceFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-bold text-foreground">{evidenceFiles.length} new {getProofMediaLabel(evidenceFiles.length)} selected</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEvidenceFiles([])}
                      className="text-destructive h-7 text-xs hover:bg-destructive/10 px-2"
                    >
                      Clear new
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {evidencePreviews.map((src, i) => (
                      <div key={`preview-${i}`} className="relative rounded-md overflow-hidden border border-border bg-white">
                        {isVideoFile(evidenceFiles[i]) ? (
                          <video src={src} className="h-16 w-full object-cover" controls muted preload="metadata" />
                        ) : (
                          <img src={src} alt={`New proof ${i+1}`} className="h-16 w-full object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const newFiles = [...evidenceFiles];
                            newFiles.splice(i, 1);
                            setEvidenceFiles(newFiles);
                          }}
                          className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full h-5 w-5 flex items-center justify-center text-[8px]"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {existingEvidenceImages.length === 0 && evidenceFiles.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground text-center py-2">No proof media selected yet.</p>
              )}

              {uploadingEvidence && (
                <p className="mt-2 text-xs text-muted-foreground animate-pulse text-center">Uploading evidence...</p>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setStatusTarget(null)}>Cancel</Button>
            <Button onClick={handleUpdateStatus} disabled={uploadingEvidence}>Update</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
