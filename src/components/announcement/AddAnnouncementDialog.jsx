import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Camera, ImageIcon, Loader2, Upload, Video, X } from 'lucide-react';
import { createAnnouncement, updateAnnouncement } from '../../api/announcement.js';
import { uploadMediaToCloudinary } from '../../api/cloudinary.js';
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

  // Main announcement media: multiple images + optional single 10s video
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [existingVideoUrl, setExistingVideoUrl] = useState('');

  // Proof/evidence (used when editing / closing cases)
  const [proofFiles, setProofFiles] = useState([]);
  const [proofPreviews, setProofPreviews] = useState([]);
  const [existingProofImages, setExistingProofImages] = useState([]);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const mediaInputRef = useRef(null);
  const proofInputRef = useRef(null);
  const cameraProofRef = useRef(null);
  const cameraVideoProofRef = useRef(null);

  useEffect(() => {
    const urls = mediaFiles.map(file => URL.createObjectURL(file));
    setMediaPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [mediaFiles]);

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

      const imgs = Array.isArray(announcement.imageUrls) && announcement.imageUrls.length > 0
        ? announcement.imageUrls
        : (announcement.imageUrl || announcement.image_url) ? [announcement.imageUrl || announcement.image_url] : [];
      setExistingImages(imgs);
      setExistingVideoUrl(announcement.videoUrl || announcement.video_url || '');
      setExistingProofImages(announcement.evidenceUrls || (announcement.evidenceUrl ? [announcement.evidenceUrl] : []));
    } else {
      setForm({ ...EMPTY_FORM, category: forcedCategory || EMPTY_FORM.category });
      setExistingImages([]);
      setExistingVideoUrl('');
      setExistingProofImages([]);
    }

    setMediaFiles([]);
    setProofFiles([]);
    setUploadProgress(0);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
    if (proofInputRef.current) proofInputRef.current.value = '';
  }, [announcement, open, forcedCategory]);

  const isSubmitting = saving || uploading;
  const isClosed = !!(announcement && announcement.status === 'Case Closed');

  const updateField = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleMediaChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = await filterValidProofFiles(files, (message) => toast.error(message));

    setMediaFiles((prev) => {
      const next = [...prev];
      for (const file of validFiles) {
        const addingVideo = isVideoFile(file);
        const alreadyHasVideo = next.some((f) => isVideoFile(f)) || !!existingVideoUrl;
        if (addingVideo && alreadyHasVideo) {
          toast.error('Only one video is allowed');
          continue;
        }
        next.push(file);
      }
      return next;
    });

    e.target.value = '';
  };

  const clearNewMedia = () => {
    setMediaFiles([]);
    setUploadProgress(0);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
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

    // 1) Upload main media
    let finalImageUrls = [...existingImages];
    let finalVideoUrl = existingVideoUrl || '';

    if (mediaFiles.length > 0) {
      setUploading(true);
      try {
        for (const file of mediaFiles) {
          const url = await uploadMediaToCloudinary(file, (pct) => setUploadProgress(pct));
          if (isVideoFile(file)) finalVideoUrl = url;
          else finalImageUrls.push(url);
        }
      } catch (err) {
        console.error('Media upload failed:', err);
        toast.error('Media upload failed');
        setSaving(false);
        setUploading(false);
        return;
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    }

    // 2) Upload proof/evidence (only used on edit/close flow)
    let uploadedProof = [];
    if (proofFiles.length > 0) {
      setUploading(true);
      try {
        for (const file of proofFiles) {
          const url = await uploadMediaToCloudinary(file);
          uploadedProof.push(url);
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

    const finalEvidenceUrls = [...existingProofImages, ...uploadedProof];

    try {
      if (announcement) {
        await updateAnnouncement(announcement.id, {
          ...form,
          category,
          imageUrl: finalImageUrls[0] || '',
          image_url: finalImageUrls[0] || '',
          imageUrls: finalImageUrls,
          videoUrl: finalVideoUrl || '',
          evidenceUrl: finalEvidenceUrls[0] || '',
          evidenceUrls: finalEvidenceUrls,
        });
        toast.success('Announcement updated successfully');
      } else {
        await createAnnouncement({
          ...form,
          category,
          imageUrl: finalImageUrls[0] || '',
          imageUrls: finalImageUrls,
          videoUrl: finalVideoUrl || '',
          evidenceUrl: finalEvidenceUrls[0] || '',
          evidenceUrls: finalEvidenceUrls,
        });
        toast.success('Announcement posted successfully');
      }

      setForm({ ...EMPTY_FORM, category: forcedCategory || EMPTY_FORM.category });
      clearNewMedia();
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
    if (isSubmitting) return;
    setForm({ ...EMPTY_FORM, category: forcedCategory || EMPTY_FORM.category });
    clearNewMedia();
    setProofFiles([]);
    setExistingProofImages([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{announcement ? 'Edit Announcement' : 'Create Announcement'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isClosed && (
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 flex items-start gap-2.5">
              <div className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs">i</span>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-700">Case Closed</p>
                <p className="text-[11px] leading-normal text-slate-500">
                  This announcement is closed. The original details are locked, but proof/evidence can still be updated.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input value={form.title} onChange={(e) => updateField('title', e.target.value)} placeholder="Announcement title" disabled={isClosed} />
            </div>

            <div>
              <Label>Category</Label>
              {forcedCategory ? (
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
                  {forcedCategory}
                </div>
              ) : (
                <Select value={form.category} onValueChange={(v) => updateField('category', v)} disabled={isClosed}>
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
              <Select value={form.sex} onValueChange={(v) => updateField('sex', v)} disabled={isClosed}>
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
              <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Name" disabled={isClosed} />
            </div>
            <div>
              <Label>Age</Label>
              <Input value={form.age} onChange={(e) => updateField('age', e.target.value)} placeholder="Age" disabled={isClosed} />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={form.subtitle} onChange={(e) => updateField('subtitle', e.target.value)} placeholder="Brief description..." rows={2} disabled={isClosed} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Contact</Label>
              <Input value={form.contact} onChange={(e) => updateField('contact', e.target.value)} placeholder="Phone or email" disabled={isClosed} />
            </div>
            <div>
              <Label>Location Address</Label>
              <Input value={form.location_address} onChange={(e) => updateField('location_address', e.target.value)} placeholder="e.g. Brgy. San Jose, Daet" disabled={isClosed} />
            </div>
            <div>
              <Label>Incident Date</Label>
              <Input type="date" value={form.incident_date} onChange={(e) => updateField('incident_date', e.target.value)} disabled={isClosed} />
            </div>
            <div>
              <Label>Incident Time</Label>
              <Input type="time" value={form.incident_time} onChange={(e) => updateField('incident_time', e.target.value)} disabled={isClosed} />
            </div>
          </div>

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

          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label className="mb-0">
                Media <span className="text-muted-foreground font-normal text-xs">(multiple images, optional 1 video up to 10 sec)</span>
              </Label>
              {!isClosed && (
                <Button type="button" variant="outline" size="sm" onClick={() => mediaInputRef.current?.click()} className="h-8 text-xs font-semibold" disabled={isSubmitting}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload Media
                </Button>
              )}
            </div>

            <input ref={mediaInputRef} type="file" multiple accept={PROOF_MEDIA_ACCEPT} className="hidden" onChange={handleMediaChange} disabled={isClosed} />

            {(existingImages.length > 0 || existingVideoUrl) && (
              <div className="mt-3">
                <div className="flex flex-col gap-2 mb-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-bold text-foreground">
                    Existing media ({existingImages.length} image{existingImages.length !== 1 ? 's' : ''}{existingVideoUrl ? ', 1 video' : ''})
                  </span>
                  {!isClosed && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setExistingImages([]); setExistingVideoUrl(''); }} className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 px-2">
                      Clear existing
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {existingImages.map((src, i) => (
                    <div key={`existing-img-${i}`} className="relative rounded-md overflow-hidden border border-border bg-white">
                      <img src={src} alt={`Existing image ${i + 1}`} className="h-20 w-full object-cover" />
                      {!isClosed && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setExistingImages(prev => prev.filter((_, idx) => idx !== i)); }}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-black/85 text-white rounded-full h-5 w-5 flex items-center justify-center text-[10px] transition-colors z-10"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {existingVideoUrl && (
                    <div className="relative rounded-md overflow-hidden border border-border bg-white">
                      <video src={existingVideoUrl} className="h-20 w-full object-cover" controls muted preload="metadata" />
                      {!isClosed && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setExistingVideoUrl(''); }}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-black/85 text-white rounded-full h-5 w-5 flex items-center justify-center text-[10px] transition-colors z-10"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {mediaFiles.length > 0 && (
              <div className="mt-3">
                <div className="flex flex-col gap-2 mb-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-bold text-foreground">{mediaFiles.length} new file(s) selected</span>
                  <Button type="button" variant="ghost" size="sm" onClick={clearNewMedia} className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 px-2">
                    Clear new
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {mediaPreviews.map((src, i) => (
                    <div key={`media-preview-${i}`} className="relative rounded-md overflow-hidden border border-border bg-white">
                      {isVideoFile(mediaFiles[i]) ? (
                        <video src={src} className="h-20 w-full object-cover" controls muted preload="metadata" />
                      ) : (
                        <img src={src} alt={`New media ${i + 1}`} className="h-20 w-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...mediaFiles];
                          next.splice(i, 1);
                          setMediaFiles(next);
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

            {uploading && mediaFiles.length > 0 && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading media {uploadProgress}%
              </div>
            )}

            {existingImages.length === 0 && !existingVideoUrl && mediaFiles.length === 0 && (
              <label className={`mt-3 flex flex-col items-center justify-center gap-2 h-32 border-2 border-dashed border-border rounded-lg transition-colors ${isClosed ? 'cursor-not-allowed opacity-60 bg-muted/20' : 'cursor-pointer hover:bg-muted/40'}`}>
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">Click to upload media</span>
                <span className="text-xs text-muted-foreground/60">Images or 10 sec max video</span>
                <input ref={mediaInputRef} type="file" multiple accept={PROOF_MEDIA_ACCEPT} className="hidden" onChange={handleMediaChange} disabled={isClosed} />
              </label>
            )}
          </div>

          {announcement && (
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label>Proof / Evidence <span className="text-muted-foreground font-normal text-xs">(images or video up to 10 sec)</span></Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => proofInputRef.current?.click()} className="h-8 text-xs font-semibold flex-1 sm:flex-none" disabled={isSubmitting}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Upload File
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => cameraProofRef.current?.click()} className="h-8 text-xs font-semibold flex-1 sm:flex-none" disabled={isSubmitting}>
                    <Camera className="h-3.5 w-3.5 mr-1.5" />
                    Take Photo
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => cameraVideoProofRef.current?.click()} className="h-8 text-xs font-semibold flex-1 sm:flex-none" disabled={isSubmitting}>
                    <Video className="h-3.5 w-3.5 mr-1.5" />
                    Record Video
                  </Button>
                </div>
              </div>

              <input ref={proofInputRef} type="file" multiple accept={PROOF_MEDIA_ACCEPT} className="hidden" onChange={handleProofChange} />
              <input ref={cameraProofRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleProofChange} />
              <input ref={cameraVideoProofRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handleProofChange} />

              <div className="bg-muted/10 border border-border rounded-xl p-3 space-y-3">
                {existingProofImages.length > 0 && (
                  <div>
                    <div className="flex flex-col gap-2 mb-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs font-bold text-foreground">{existingProofImages.length} existing {getProofMediaLabel(existingProofImages.length)}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setExistingProofImages([])} className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 px-2">
                        Clear existing
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {existingProofImages.map((src, i) => (
                        <div key={`existing-proof-${i}`} className="relative rounded-md overflow-hidden border border-border bg-white">
                          <ProofMediaPreview src={src} alt={`Existing proof ${i + 1}`} />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setExistingProofImages(prev => prev.filter((_, idx) => idx !== i)); }}
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
                      <Button type="button" variant="ghost" size="sm" onClick={() => setProofFiles([])} className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 px-2">
                        Clear new
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {proofPreviews.map((src, i) => (
                        <div key={`preview-proof-${i}`} className="relative rounded-md overflow-hidden border border-border bg-white">
                          {isVideoFile(proofFiles[i]) ? (
                            <video src={src} className="h-20 w-full object-cover" controls muted preload="metadata" />
                          ) : (
                            <img src={src} alt={`New proof ${i + 1}`} className="h-20 w-full object-cover" />
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...proofFiles];
                              next.splice(i, 1);
                              setProofFiles(next);
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

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploading ? `Uploading ${uploadProgress}%...` : announcement ? 'Saving...' : 'Posting...'}
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
