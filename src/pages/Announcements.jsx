import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { subscribeToAnnouncements, deleteAnnouncement, updateAnnouncementStatus } from '../api/announcement.js';
import { uploadImageToCloudinary } from '../api/cloudinary.js';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { isAfter, subDays } from 'date-fns';
import AnnouncementCard from '../components/announcement/AnnouncementCard';
import AddAnnouncementDialog from '../components/announcement/AddAnnouncementDialog';
import CommentsDialog from '../components/announcement/CommentsDialog';

export default function Announcements() {
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [commentsTarget, setCommentsTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidencePreview, setEvidencePreview] = useState(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [evidenceUploadProgress, setEvidenceUploadProgress] = useState(0);
  const statusTargetIsClosed = statusTarget?.status === 'Case Closed';
  const fileInputRef = useRef(null);

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

  const handleEvidenceSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEvidenceFile(file);
    setEvidencePreview(URL.createObjectURL(file));
  };

  const handleStatusSelection = (value) => {
    setNewStatus(value);
    if (value === 'Resolved' || value === 'Case Closed') {
      setEvidenceFile(null);
      setEvidencePreview(null);
      fileInputRef.current?.click();
    } else {
      setEvidenceFile(null);
      setEvidencePreview(null);
    }
  };

  const handleUpdateStatus = async () => {
    if (!statusTarget || !newStatus || statusTargetIsClosed) return;
    if ((newStatus === 'Resolved' || newStatus === 'Case Closed') && !evidenceFile && !statusTarget?.evidenceUrl) {
      toast.error('Please select a proof image before marking this announcement resolved or closed.');
      return;
    }
    let evidenceUrl = '';

    if (evidenceFile) {
      setUploadingEvidence(true);
      try {
        toast.info('Uploading evidence image...');
        evidenceUrl = await uploadImageToCloudinary(evidenceFile, (pct) => {
          setEvidenceUploadProgress(pct);
        });
      } catch (err) {
        console.error('Evidence upload failed:', err);
        toast.error('Failed to upload evidence image');
        setUploadingEvidence(false);
        return;
      }
      setUploadingEvidence(false);
      setEvidenceUploadProgress(0);
    }

    try {
      await updateAnnouncementStatus(statusTarget.id, newStatus, evidenceUrl);
      toast.success('Status updated');
      setStatusTarget(null);
      setNewStatus('');
      setEvidenceFile(null);
      setEvidencePreview(null);
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const filtered = useMemo(() => {
    // 1. Filter
    let result = announcements.filter(ann => {
      const matchSearch = !search ||
        ann.title?.toLowerCase().includes(search.toLowerCase()) ||
        ann.content?.toLowerCase().includes(search.toLowerCase()) ||
        ann.subtitle?.toLowerCase().includes(search.toLowerCase());

      const itemCategory = ann.category || 'Missing Person';
      const matchCategory = categoryFilter === 'All Categories' || itemCategory === categoryFilter;

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
  }, [announcements, search, categoryFilter, dateFilter, statusFilter]);

  if (isLoading) {
    return <div className="space-y-4 w-full">{[1,2].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-5 w-full">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20">
          {filtered.length} announcement{filtered.length !== 1 ? 's' : ''}
        </span>
        <Button onClick={() => setShowAdd(true)} className="h-9 text-sm font-semibold">
          <Plus className="h-4 w-4 mr-1.5" /> New Announcement
        </Button>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-border p-4">
        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by title, description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm bg-muted/40 border-0 focus-visible:ring-1"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44 h-9 text-sm bg-muted/40 border-0">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Categories">All Categories</SelectItem>
              <SelectItem value="Missing Person">Missing Person</SelectItem>
              <SelectItem value="Missing Animal">Missing Animal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-40 h-9 text-sm bg-muted/40 border-0">
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 h-9 text-sm bg-muted/40 border-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Statuses">All Statuses</SelectItem>
              <SelectItem value="Reported">Reported</SelectItem>
              <SelectItem value="Verified by Police">Verified by Police</SelectItem>
              <SelectItem value="Search Ongoing">Search Ongoing</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
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
              onEdit={setEditTarget}
            />
          ))
        )}
      </div>

      <AddAnnouncementDialog open={showAdd} onClose={() => setShowAdd(false)} />
      <AddAnnouncementDialog open={!!editTarget} announcement={editTarget} onClose={() => setEditTarget(null)} />
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
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Current Status:</span>
                <span className="font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">{statusTarget.status}</span>
              </div>
              {statusTarget.evidenceUrl && (
                <div className="rounded-2xl overflow-hidden border border-border bg-slate-50">
                  <img
                    src={statusTarget.evidenceUrl}
                    alt="Evidence proof"
                    className="w-full h-44 object-cover"
                  />
                  <div className="px-3 py-2 text-[11px] text-slate-600 bg-white/80">
                    Existing proof image
                  </div>
                </div>
              )}
            </div>
          )}
          {statusTargetIsClosed ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              This announcement is already closed and cannot be updated.
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">New Status:</p>
              <Select value={newStatus} onValueChange={handleStatusSelection}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Verified by Police">Verified by Police</SelectItem>
                  <SelectItem value="Search Ongoing">Search Ongoing</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Case Closed">Case Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={handleEvidenceSelected}
          />

          {(newStatus === 'Resolved' || newStatus === 'Case Closed') && (
            <div className="rounded-xl border border-border bg-slate-50 p-3 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Evidence required</p>
                  <p className="text-xs text-muted-foreground">As soon as you pick Resolved or Case Closed, the file picker opens for evidence upload.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose image
                </Button>
              </div>
              {evidenceFile ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold truncate">{evidenceFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEvidenceFile(null);
                        setEvidencePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                  {evidencePreview && (
                    <img
                      src={evidencePreview}
                      alt="Selected evidence preview"
                      className="w-full max-h-52 object-cover rounded-lg border border-border"
                    />
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No file selected yet.</p>
              )}
              {uploadingEvidence && (
                <p className="mt-2 text-xs text-muted-foreground">Uploading evidence: {evidenceUploadProgress}%</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setStatusTarget(null)}>Cancel</Button>
            <Button onClick={handleUpdateStatus} disabled={uploadingEvidence || statusTargetIsClosed}>Update</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
