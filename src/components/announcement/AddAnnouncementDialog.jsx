import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, X, ImageIcon, Loader2, Camera, Video } from 'lucide-react';
import { createAnnouncement, updateAnnouncement } from '../../api/announcement.js';
import { uploadImageToCloudinary, uploadMediaToCloudinary } from '../../api/cloudinary.js';
import MapPickerField from '../shared/MapPickerField';
import ProofMediaPreview from '../shared/ProofMediaPreview';
import { PROOF_MEDIA_ACCEPT, filterValidProofFiles, getProofMediaLabel, isVideoFile } from '../../utils/proofMedia.js';

const EMPTY_FORM = {
  title: '', category: 'Missing Person', subtitle: '', name: '', age: '', sex: 'Unknown',
  contact: '', incident_date: '', incident_time: '', location_address: '',
  latitude: null, longitude: null,
};

export default function AddAnnouncementDialog({ open, onClose, announcement, forcedCategory = null }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [proofFiles, setProofFiles] = useState([]);
  const [proofPreviews, setProofPreviews] = useState([]);
  const [existingProofImages, setExistingProofImages] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const proofInputRef = useRef(null);
  const cameraProofRef = useRef(null);
  const cameraVideoProofRef = useRef(null);

  useEffect(() => {
    const urls = proofFiles.map(file => URL.createObjectURL(file));
    setProofPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [proofFiles]);

  useEffect(() => {
    if (announcement) {
      setForm({
        title: announcement.title || '',
        category: forcedCategory || announcement.category || 'Missing Person',
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
      setExistingProofImages(announcement.evidenceUrls || (announcement.evidenceUrl ? [announcement.evidenceUrl] : []));
    } else {
      setForm({ ...EMPTY_FORM, category: forcedCategory || EMPTY_FORM.category });
      setImagePreview(null);
      setExistingProofImages([]);
    }
    setImageFile(null);
    setProofFiles([]);
  }, [announcement, open, forcedCategory]);

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

  const handleProofChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = await filterValidProofFiles(files, (message) => toast.error(message));

    setProofFiles(prev => [...prev, ...validFiles]);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }

    const category = forcedCategory || form.category;
    if (forcedCategory && form.category !== forcedCategory) {
      setForm(p => ({ ...p, category: forcedCategory }));
      toast.error(`This admin can only create ${forcedCategory.toLowerCase()} announcements`);
      return;
    }

    setSaving(true);
    let finalImageUrl = announcement ? (announcement.imageUrl || announcement.image_url || '') : '';

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
        setUploading(false);
        return;
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    } else if (!imagePreview) {
      finalImageUrl = '';
    }

    let uploadedUrls = [];
    if (proofFiles.length > 0) {
      setUploading(true);
      try {
        for (const file of proofFiles) {
          const url = await uploadMediaToCloudinary(file);
          uploadedUrls.push(url);
        }
      } catch (err) {
        console.error('Proof upload failed:', err);
        toast.error('Proof upload failed');
        setSaving(false);
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    const finalEvidenceUrls = [...existingProofImages, ...uploadedUrls];

    try {
      if (announcement) {
        await updateAnnouncement(announcement.id, {
          ...form,
          category,
          imageUrl: finalImageUrl,
          image_url: finalImageUrl,
          evidenceUrl: finalEvidenceUrls[0] || '',
          evidenceUrls: finalEvidenceUrls,
        });
        toast.success('Announcement updated successfully');
      } else {
        await createAnnouncement({
          ...form,
          category,
          status: 'Reported',
          imageUrl: finalImageUrl,
          evidenceUrl: finalEvidenceUrls[0] || '',
          evidenceUrls: finalEvidenceUrls,
        });
        toast.success('Announcement posted successfully');
      }
      setForm({ ...EMPTY_FORM, category: forcedCategory || EMPTY_FORM.category });
      removeImage();
      setProofFiles([]);
      setExistingProofImages([]);
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
    setForm({ ...EMPTY_FORM, category: forcedCategory || EMPTY_FORM.category });
    removeImage();
    setProofFiles([]);
    setExistingProofImages([]);
    onClose();
  };

  const isSubmitting = saving || uploading;
  const isClosed = announcement && announcement.status === 'Case Closed';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{announcement ? 'Edit Announcement' : 'Create Announcement'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Closed Case Notice Banner */}
          {isClosed && (
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 flex items-start gap-2.5">
              <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs">ℹ️</span>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-700">Case Closed</p>
                <p className="text-[11px] leading-normal text-slate-500">
                  This announcement is closed. As an administrator, the original details are locked, but you can still edit the proof/evidence images.
                </p>
              </div>
            </div>
          )}

          {/* Basic info */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input
                value={form.title}
                onChange={e => update('title', e.target.value)}
                placeholder="Announcement title"
                disabled={isClosed}
              />
            </div>
            <div>
              <Label>Category</Label>
              {forcedCategory ? (
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
                  {forcedCategory}
                </div>
              ) : (
                <Select value={form.category} onValueChange={v => update('category', v)} disabled={isClosed}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Missing Person">Missing Person</SelectItem>
                    <SelectItem value="Missing Animal">Missing Animal</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Sex</Label>
              <Select value={form.sex} onValueChange={v => update('sex', v)} disabled={isClosed}>
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
              <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Name" disabled={isClosed} />
            </div>
            <div>
              <Label>Age</Label>
              <Input value={form.age} onChange={e => update('age', e.target.value)} placeholder="Age" disabled={isClosed} />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={form.subtitle}
              onChange={e => update('subtitle', e.target.value)}
              placeholder="Brief description..."
              rows={2}
              disabled={isClosed}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Contact</Label>
              <Input value={form.contact} onChange={e => update('contact', e.target.value)} placeholder="Phone or email" disabled={isClosed} />
            </div>
            <div>
              <Label>Location Address</Label>
              <Input value={form.location_address} onChange={e => update('location_address', e.target.value)} placeholder="e.g. Brgy. San Jose, Daet" disabled={isClosed} />
            </div>
            <div>
              <Label>Incident Date</Label>
              <Input type="date" value={form.incident_date} onChange={e => update('incident_date', e.target.value)} disabled={isClosed} />
            </div>
            <div>
              <Label>Incident Time</Label>
              <Input type="time" value={form.incident_time} onChange={e => update('incident_time', e.target.value)} disabled={isClosed} />
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
              disabled={isClosed}
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
                {!uploading && !isClosed && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 hover:bg-black/85 flex items-center justify-center text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <label className={`flex flex-col items-center justify-center gap-2 h-32 border-2 border-dashed border-border rounded-lg transition-colors ${isClosed ? 'cursor-not-allowed opacity-60 bg-muted/20' : 'cursor-pointer hover:bg-muted/40'}`}>
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">Click to upload image</span>
                <span className="text-xs text-muted-foreground/60">JPG, PNG up to 5MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  className="hidden"
                  onChange={handleImageChange}
                  disabled={isClosed}
                />
              </label>
            )}
          </div>

          {announcement && (
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label>Proof / Evidence <span className="text-muted-foreground font-normal text-xs">(images or video up to 10 sec)</span></Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => proofInputRef.current?.click()}
                    className="h-8 text-xs font-semibold flex-1 sm:flex-none"
                    disabled={isSubmitting}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Upload File
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cameraProofRef.current?.click()}
                    className="h-8 text-xs font-semibold flex-1 sm:flex-none"
                    disabled={isSubmitting}
                  >
                    <Camera className="h-3.5 w-3.5 mr-1.5" />
                    Take Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cameraVideoProofRef.current?.click()}
                    className="h-8 text-xs font-semibold flex-1 sm:flex-none"
                    disabled={isSubmitting}
                  >
                    <Video className="h-3.5 w-3.5 mr-1.5" />
                    Record Video
                  </Button>
                </div>
              </div>
              <input
                ref={proofInputRef}
                type="file"
                multiple
                accept={PROOF_MEDIA_ACCEPT}
                className="hidden"
                onChange={handleProofChange}
              />
              {/* Camera photo capture */}
              <input
                ref={cameraProofRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleProofChange}
              />
              {/* Camera video capture */}
              <input
                ref={cameraVideoProofRef}
                type="file"
                accept="video/*"
                capture="environment"
                className="hidden"
                onChange={handleProofChange}
              />
              <div className="rounded-lg border border-dashed border-border bg-slate-50 p-3 text-sm text-slate-600">
                {existingProofImages.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-col gap-2 mb-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs font-bold text-foreground">{existingProofImages.length} existing {getProofMediaLabel(existingProofImages.length)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setExistingProofImages([])}
                        className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                      >
                        Clear existing
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {existingProofImages.map((src, i) => (
                        <div key={`existing-${i}`} className="relative rounded-md overflow-hidden border border-border bg-white">
                          <ProofMediaPreview src={src} alt={`Existing proof ${i+1}`} />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExistingProofImages(prev => prev.filter((_, idx) => idx !== i));
                            }}
                            className="absolute top-1 right-1 bg-black/60 hover:bg-black/85 text-white rounded-full h-5 w-5 flex items-center justify-center text-[10px] transition-colors z-10"
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
                        Clear new
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {proofPreviews.map((src, i) => (
                        <div key={`preview-${i}`} className="relative rounded-md overflow-hidden border border-border bg-white">
                          {isVideoFile(proofFiles[i]) ? (
                            <video src={src} className="h-20 w-full object-cover" controls muted preload="metadata" />
                          ) : (
                            <img src={src} alt={`New proof ${i+1}`} className="h-20 w-full object-cover" />
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
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
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
