import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { getUserById } from '../api/users.js';
import { updateUserProfile, updateAuthProfile } from '../api/auth.js';
import { uploadImageToCloudinary } from '../api/cloudinary.js';
import { toast } from 'sonner';
import { User, Camera, Loader2, Shield, Clock, Hash, Mail } from 'lucide-react';
import { format } from 'date-fns';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTs(ts) {
  if (!ts) return '—';
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return format(d, 'MMM dd, yyyy · hh:mm a');
  } catch {
    return '—';
  }
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="h-7 w-7 rounded bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm text-foreground mt-0.5 break-all">{value || '—'}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Profile() {
  const { currentUser } = useAuth();
  const [userDoc, setUserDoc]           = useState(null);
  const [displayName, setDisplayName]   = useState('');
  const [saving, setSaving]             = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    getUserById(currentUser.uid).then(doc => {
      if (doc) {
        setUserDoc(doc);
        setDisplayName(doc.displayName ?? '');
      }
    });
  }, [currentUser]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) { toast.error('Display name cannot be empty'); return; }
    setSaving(true);
    try {
      await updateAuthProfile(currentUser, { displayName: displayName.trim() });
      await updateUserProfile(currentUser.uid, { displayName: displayName.trim() });
      setUserDoc(prev => ({ ...prev, displayName: displayName.trim() }));
      toast.success('Profile updated successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      toast.error('Only JPG and PNG images are supported');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const url = await uploadImageToCloudinary(file, pct => setUploadProgress(pct));
      await updateAuthProfile(currentUser, { photoURL: url });
      await updateUserProfile(currentUser.uid, { photoURL: url });
      setUserDoc(prev => ({ ...prev, photoURL: url }));
      toast.success('Profile photo updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!userDoc) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const photoURL = userDoc.photoURL || currentUser?.photoURL || '';

  return (
    <div className="w-full space-y-5">
      {/* Page header */}
      <div className="border-b border-border pb-4">
        <h1 className="text-base font-semibold text-foreground">My Profile</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your account information and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left: Avatar + account info ── */}
        <div className="space-y-4">

          {/* Avatar card */}
          <div className="bg-white border border-border rounded-lg overflow-hidden">
            {/* Green header strip */}
            <div className="h-16 bg-primary/10" />
            <div className="px-5 pb-5">
              {/* Avatar — overlaps the strip */}
              <div className="relative -mt-8 mb-3">
                <div className="relative inline-block">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt="Profile"
                      className="h-16 w-16 rounded-full object-cover border-4 border-white shadow-sm"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-muted border-4 border-white shadow-sm flex items-center justify-center">
                      <User className="h-7 w-7 text-muted-foreground/50" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center border-2 border-white hover:bg-primary/90 transition-colors disabled:opacity-60"
                    title="Change photo"
                  >
                    {uploading
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Camera className="h-3 w-3" />
                    }
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </div>
              </div>

              <p className="text-sm font-semibold text-foreground leading-tight">
                {userDoc.displayName || 'Admin'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{userDoc.email}</p>
              {userDoc.role && (
                <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {userDoc.role}
                </span>
              )}
              {uploading && (
                <p className="text-xs text-primary mt-2">Uploading {uploadProgress}%…</p>
              )}
            </div>
          </div>

          {/* Account details */}
          <div className="bg-white border border-border rounded-lg p-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Account Details
            </h2>
            <div className="mt-2">
              <InfoRow icon={Hash}   label="User ID"     value={currentUser?.uid} />
              <InfoRow icon={Shield} label="Role"        value={userDoc.role} />
              <InfoRow icon={Mail}   label="Email"       value={userDoc.email} />
              <InfoRow icon={Clock}  label="Created"     value={formatTs(userDoc.createdAt)} />
              <InfoRow icon={Clock}  label="Last Sign-in" value={formatTs(userDoc.lastSignInAt)} />
            </div>
          </div>
        </div>

        {/* ── Right: Edit form ── */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 pb-3 border-b border-border">
              Edit Profile
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Display name */}
              <div>
                <label htmlFor="displayName" className="block text-xs font-medium text-muted-foreground mb-1">
                  Display Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  required
                  className="w-full rounded border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </div>

              {/* Email — read-only */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Email Address
                </label>
                <div className="w-full rounded border border-border bg-muted/40 px-3 py-2 text-sm text-foreground/60">
                  {userDoc.email}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Email changes require re-authentication. Contact your system administrator.
                </p>
              </div>

              {/* Profile photo note */}
              <div className="rounded border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-xs font-medium text-foreground mb-0.5">Profile Photo</p>
                <p className="text-[11px] text-muted-foreground">
                  Click the camera icon on your avatar to upload a new photo (JPG/PNG, max 5MB).
                  Images are stored via Cloudinary.
                </p>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
