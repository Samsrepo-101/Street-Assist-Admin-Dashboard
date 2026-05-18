import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { subscribeToComments, postComment } from '../../api/announcement.js';
import { useAuth } from '../../lib/AuthContext';
import { format } from 'date-fns';
import { Send, MessageCircle } from 'lucide-react';

export default function CommentsDialog({ announcement, open, onClose }) {
  const [newComment, setNewComment] = useState('');
  const { currentUser } = useAuth();

  const [comments, setComments] = useState([]);

  useEffect(() => {
    if (!announcement?.id) return;
    const isClosed = announcement.status === 'Case Closed' || announcement.status === 'closed' || announcement.status === 'Closed';
    if (isClosed) {
      setNewComment('');
    }
    const unsub = subscribeToComments(announcement.id, setComments);
    return unsub;
  }, [announcement]);

  useEffect(() => {
    if (open && announcement?.id) {
      localStorage.setItem(`last_viewed_comments_${announcement.id}`, Date.now().toString());
      window.dispatchEvent(new Event('storage'));
    }
  }, [open, announcement?.id, comments]);

  const handlePost = async () => {
    if (!newComment.trim()) return;
    const isClosed = announcement?.status === 'Case Closed' || announcement?.status === 'closed' || announcement?.status === 'Closed';
    if (isClosed) return;
    try {
      await postComment(announcement.id, {
        userId: currentUser?.uid || 'admin',
        text: newComment,
      });
      setNewComment('');
    } catch (err) {
      console.error('Failed to post comment:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> Comments
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-64 overflow-y-auto">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No comments yet</p>
          ) : comments.map(c => (
            <div key={c.id} className="bg-muted/50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">{c.userId}</span>
                <span className="text-xs text-muted-foreground">{c.timestamp?.toDate ? format(c.timestamp.toDate(), 'MMM dd, hh:mm a') : ''}</span>
              </div>
              <p className="text-sm text-foreground">{c.text}</p>
            </div>
          ))}
        </div>

        {announcement?.status === 'Case Closed' || announcement?.status === 'closed' || announcement?.status === 'Closed' ? (
          <div className="text-center py-2.5 px-4 bg-slate-100 text-slate-500 text-xs font-semibold rounded-xl border border-slate-200">
            This case has been closed and can no longer receive updates.
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              onKeyDown={(e) => e.key === 'Enter' && handlePost()}
            />
            <Button size="icon" onClick={handlePost}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
