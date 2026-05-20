import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';
import { createAnnouncement, updateAnnouncement } from '../../api/announcement.js';
import { uploadImageToCloudinary } from '../../api/cloudinary.js';
import MapPickerField from '../shared/MapPickerField';

const EMPTY_FORM = {
  title: '', category: 'Missing Person', subtitle: '', name: '', age: '', sex: 'Unknown',
  contact: '', incident_date: '', incident_time: '', location_address: '',
  latitude: null, longitude: null,
};

export default function AddAnnouncementDialog({ open, onClose, announcement }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [clearProof, setClearProof] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const proofInputRef = useRef(null);

  useEffect(() => {
    if (announcement) {
      setForm({
        title: announcement.title || '',
        category: announcement.category || 'Missing Person',
        subtitle: announcement.subtitle || '',
        name: announcement.name || '',
        age: announcement.age || '',
        sex: announcement.sex || 'Unknown',
        contact: announcement.contact || '',
        incident_date: announcement.incident_date || '',
        incident_time: announcement.incident_time || '',
        location_address: announcement.location_address || '',
        latitude: announcement.latitude ?? null,
        longitude: announcement.longitude ?? null,
      });
      setImagePreview(announcement.imageUrl || announcement.image_url || null);
      setProofPreview(announcement.evidenceUrl || null);
    } else {
      setForm(EMPTY_FORM);
      setImagePreview(null);
      setProofPreview(null);
    }
    setImageFile(null);
    setProofFile(null);
    setClearProof(false);
  }, [announcement, open]);

  const update = (field, value) => setForm(p => ({ ...p, [field]: value }));

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) {
      toast.error('Only JPG and PNG images are supported');
      return;
    }

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProofChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) {
      toast.error('Only JPG and PNG images are supported');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
    setClearProof(false);
  };

  const removeProof = () => {
    setProofFile(null);
    setProofPreview(null);
    setClearProof(true);
    if (proofInputRef.current) proofInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    let finalImageUrl = announcement ? (announcement.imageUrl || announcement.image_url || '') : '';
    let finalProofUrl = announcement ? (announcement.evidenceUrl || '') : '';

    // Upload image to Cloudinary first if one was selected
    if (imageFile) {
      setUploading(true);
      try {
        finalImageUrl = await uploadImageToCloudinary(imageFile, (pct) => {
          setUploadProgress(pct);
        });
      } catch (err) {
        console.error('Image upload failed:', err);
        toast.error('Image upload failed');
        setSaving(false);
        return;
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    } else if (!imagePreview) {
      finalImageUrl = '';
    }

    if (proofFile) {
      setUploading(true);
      try {
        finalProofUrl = await uploadImageToCloudinary(proofFile, (pct) => {
          setUploadProgress(pct);
        });
      } catch (err) {
        console.error('Proof upload failed:', err);
        toast.error('Proof upload failed');
        setSaving(false);
        return;
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    } else if (clearProof) {
      finalProofUrl = '';
    }

    try {
      if (announcement) {
        await updateAnnouncement(announcement.id, {
          ...form,
          imageUrl: finalImageUrl,
          image_url: finalImageUrl,
          evidenceUrl: finalProofUrl,
        });
        toast.success('Announcement updated successfully');
      } else {
        await createAnnouncement({
          ...form,
          status: 'Reported',
          imageUrl: finalImageUrl,
          ...(finalProofUrl ? { evidenceUrl: finalProofUrl } : {}),
        });
        toast.success('Announcement posted successfully');
      }
      setForm(EMPTY_FORM);
      removeImage();
      onClose();
    } catch (err) {
      console.error('Failed to save announcement:', err);
      toast.error(err.message || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving || uploading) return; // prevent closing mid-submit
    setForm(EMPTY_FORM);
    removeImage();
    onClose();
  };

  const isSubmitting = saving || uploading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{announcement ? 'Edit Announcement' : 'Create Announcement'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input
                value={form.title}
                onChange={e => update('title', e.target.value)}
                placeholder="Announcement title"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => update('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Missing Person">Missing Person</SelectItem>
                  <SelectItem value="Missing Animal">Missing Animal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sex</Label>
              <Select value={form.sex} onValueChange={v => update('sex', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject Name</Label>
              <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Name" />
            </div>
            <div>
              <Label>Age</Label>
              <Input value={form.age} onChange={e => update('age', e.target.value)} placeholder="Age" />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={form.subtitle}
              onChange={e => update('subtitle', e.target.value)}
              placeholder="Brief description..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contact</Label>
              <Input value={form.contact} onChange={e => update('contact', e.target.value)} placeholder="Phone or email" />
            </div>
            <div>
              <Label>Location Address</Label>
              <Input value={form.location_address} onChange={e => update('location_address', e.target.value)} placeholder="e.g. Brgy. San Jose, Daet" />
            </div>
            <div>
              <Label>Incident Date</Label>
              <Input type="date" value={form.incident_date} onChange={e => update('incident_date', e.target.value)} />
            </div>
            <div>
              <Label>Incident Time</Label>
              <Input type="time" value={form.incident_time} onChange={e => update('incident_time', e.target.value)} />
            </div>
          </div>

          {/* Map picker */}
          <div>
            <Label className="mb-2 block">
              Pin Location on Map <span className="text-muted-foreground font-normal text-xs">(Camarines Norte)</span>
            </Label>
            <MapPickerField
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(lat, lng) => setForm(p => ({ ...p, latitude: lat, longitude: lng }))}
            />
          </div>

          {/* Image upload */}
          <div>
            <Label className="mb-2 block">Image <span className="text-muted-foreground font-normal text-xs">(JPG, PNG · max 5MB)</span></Label>

            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-48 object-cover"
                />
                {/* Upload progress overlay */}
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                    <span className="text-white text-sm font-medium">{uploadProgress}%</span>
                    <div className="w-32 h-1.5 bg-white/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                {/* Remove button */}
                {!uploading && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">Click to upload image</span>
                <span className="text-xs text-muted-foreground/60">JPG, PNG up to 5MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </label>
            )}
          </div>

          {announcement && (
            <div>
              <Label className="mb-2 block">Proof image <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              {proofPreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img
                    src={proofPreview}
                    alt="Proof preview"
                    className="w-full h-48 object-cover"
                  />
                  {!uploading && (
                    <button
                      type="button"
                      onClick={removeProof}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                  <span className="text-sm text-muted-foreground">Click to upload proof image</span>
                  <span className="text-xs text-muted-foreground/60">JPG, PNG up to 5MB</span>
                  <input
                    ref={proofInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    className="hidden"
                    onChange={handleProofChange}
                  />
                </label>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploading ? `Uploading ${uploadProgress}%…` : announcement ? 'Saving…' : 'Posting…'}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1.5" />
                  {announcement ? 'Save Changes' : 'Post Announcement'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
