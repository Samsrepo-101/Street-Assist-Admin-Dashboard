import React, { useState, useEffect } from 'react';
import { subscribeToAnnouncements, deleteAnnouncement, updateAnnouncementStatus } from '../api/announcement.js';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import AnnouncementCard from '../components/announcement/AnnouncementCard';
import AddAnnouncementDialog from '../components/announcement/AddAnnouncementDialog';
import CommentsDialog from '../components/announcement/CommentsDialog';

export default function Announcements() {
  const [showAdd, setShowAdd] = useState(false);
  const [commentsTarget, setCommentsTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [newStatus, setNewStatus] = useState('');

  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToAnnouncements((data) => {
      setAnnouncements(data);
      setIsLoading(false);
    });
    return unsub;
  }, []);

  const handleDelete = async (ann) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await deleteAnnouncement(ann.id);
      toast.success('Announcement deleted');
    } catch (err) {
      toast.error('Failed to delete announcement');
    }
  };

  const handleUpdateStatus = async () => {
    if (!statusTarget || !newStatus) return;
    try {
      await updateAnnouncementStatus(statusTarget.id, newStatus);
      toast.success('Status updated');
      setStatusTarget(null);
      setNewStatus('');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  if (isLoading) {
    return <div className="space-y-4 w-full">{[1,2].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-5 w-full">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20">
          {announcements.length} announcement{announcements.length !== 1 ? 's' : ''}
        </span>
        <Button onClick={() => setShowAdd(true)} className="h-9 text-sm font-semibold">
          <Plus className="h-4 w-4 mr-1.5" /> New Announcement
        </Button>
      </div>

      <div className="space-y-4">
        {announcements.map(ann => (
          <AnnouncementCard
            key={ann.id}
            announcement={ann}
            onViewComments={setCommentsTarget}
            onUpdateStatus={(a) => { setStatusTarget(a); setNewStatus(a.status || 'Reported'); }}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <AddAnnouncementDialog open={showAdd} onClose={() => setShowAdd(false)} />
      <CommentsDialog announcement={commentsTarget} open={!!commentsTarget} onClose={() => setCommentsTarget(null)} />

      <Dialog open={!!statusTarget} onOpenChange={() => setStatusTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
          </DialogHeader>
          <Select value={newStatus} onValueChange={setNewStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Reported">Reported</SelectItem>
              <SelectItem value="Under Response">Under Response</SelectItem>
              <SelectItem value="Assisted">Assisted</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStatusTarget(null)}>Cancel</Button>
            <Button onClick={handleUpdateStatus}>Update</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
