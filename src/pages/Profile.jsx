import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { getUserById } from '../api/users.js';
import { updateUserProfile, updateAuthProfile, registerUser } from '../api/auth.js';
import { uploadImageToCloudinary } from '../api/cloudinary.js';
import { toast } from 'sonner';
import { User, Camera, Loader2, Shield, Clock, Hash, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { ADMIN_ROLES, getRoleLabel } from '../lib/adminRoles.js';

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
  const { currentUser, adminRole } = useAuth();
  const [userDoc, setUserDoc]           = useState(null);
  const [displayName, setDisplayName]   = useState('');
  const [saving, setSaving]             = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState(ADMIN_ROLES.MAIN);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const fileInputRef = useRef(null);
  const roleOptions = adminRole === ADMIN_ROLES.MAIN
    ? [
        ADMIN_ROLES.MAIN,
        ADMIN_ROLES.HOMELESS,
        ADMIN_ROLES.MISSING_ANIMALS,
        ADMIN_ROLES.MISSING_PERSON,
      ]
    : adminRole ? [adminRole] : [];

  useEffect(() => {
    if (roleOptions.length > 0 && !roleOptions.includes(newAdminRole)) {
      setNewAdminRole(roleOptions[0]);
    }
  }, [adminRole, newAdminRole, roleOptions]);

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

  const handleCreateAdmin = async (e) => {
    e.preventDefault();

    if (!newAdminName.trim() || !newAdminEmail.trim() || !newAdminPassword.trim()) {
      toast.error('Please provide name, email, and password for the new admin.');
      return;
    }

    if (newAdminPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setCreatingAdmin(true);
    try {
      await registerUser({
        displayName: newAdminName.trim(),
        email: newAdminEmail.trim(),
        password: newAdminPassword,
        role: roleOptions.includes(newAdminRole) ? newAdminRole : adminRole,
      });
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminRole(roleOptions[0] || ADMIN_ROLES.MAIN);
      toast.success('New admin account created successfully.');
    } catch (err) {
      console.error('[profile] create admin error:', err);
      toast.error(err?.message || 'Failed to create new admin account.');
    } finally {
      setCreatingAdmin(false);
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
  const canCreateAdmins = roleOptions.length > 0;

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

          {canCreateAdmins && (
          <div className="bg-white border border-border rounded-lg p-5 mt-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Register New Admin</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a new administrator account for the dashboard.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-muted/80 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {adminRole === ADMIN_ROLES.MAIN ? 'Admin only' : getRoleLabel(adminRole)}
              </span>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label htmlFor="newAdminName" className="block text-xs font-medium text-muted-foreground mb-1">
                  Full Name
                </label>
                <input
                  id="newAdminName"
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="New admin name"
                  required
                  className="w-full rounded border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label htmlFor="newAdminEmail" className="block text-xs font-medium text-muted-foreground mb-1">
                  Email Address
                </label>
                <input
                  id="newAdminEmail"
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  className="w-full rounded border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label htmlFor="newAdminRole" className="block text-xs font-medium text-muted-foreground mb-1">
                  Admin Role
                </label>
                <select
                  id="newAdminRole"
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value)}
                  className="w-full rounded border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                >
                  {roleOptions.map(role => (
                    <option key={role} value={role}>{getRoleLabel(role)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="newAdminPassword" className="block text-xs font-medium text-muted-foreground mb-1">
                  Password
                </label>
                <input
                  id="newAdminPassword"
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  className="w-full rounded border border-border bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={creatingAdmin}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {creatingAdmin && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {creatingAdmin ? 'Creating…' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
