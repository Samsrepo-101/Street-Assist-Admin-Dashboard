import React, { useState } from 'react';
import { ImageIcon, Video, Eye, Play } from 'lucide-react';
import { isVideoUrl, normalizeMediaUrl } from '../../utils/proofMedia.js';
import MediaLightbox from './MediaLightbox';

export default function ProofMediaPreview({
  src,
  alt,
  className = 'h-20 w-full object-cover',
  allowLightbox = true,
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const mediaSrc = normalizeMediaUrl(src);
  const isVideo = isVideoUrl(mediaSrc);

  const handleClick = (e) => {
    if (!allowLightbox) return;
    e.preventDefault();
    e.stopPropagation();
    setLightboxOpen(true);
  };

  const renderMedia = () => {
    if (isVideo) {
      return (
        <video
          src={mediaSrc}
          className={`${className} transition-transform duration-300 group-hover:scale-105`}
          muted
          preload="metadata"
          playsInline
        />
      );
    }

    return (
      <img
        src={mediaSrc}
        alt={alt || 'Proof media'}
        className={`${className} transition-transform duration-300 group-hover:scale-105`}
        onError={(event) => {
          event.currentTarget.style.display = 'none';
          const fallback = event.currentTarget.nextElementSibling;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
    );
  };

  return (
    <>
      <div
        className="relative group cursor-pointer overflow-hidden rounded-md w-full h-full flex items-center justify-center bg-muted/10 border border-border/50"
        onClick={handleClick}
      >
        {renderMedia()}

        {/* Fallback container for image errors */}
        {!isVideo && <ProofMediaFallback />}

        {/* Hover Overlay */}
        {allowLightbox && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-1.5 text-white">
            {isVideo ? (
              <Play className="h-5 w-5 fill-white text-white drop-shadow-md animate-in zoom-in-75 duration-200" />
            ) : (
              <Eye className="h-5 w-5 text-white drop-shadow-md animate-in zoom-in-75 duration-200" />
            )}
          </div>
        )}
      </div>

      {allowLightbox && (
        <MediaLightbox
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          media={[mediaSrc]}
        />
      )}
    </>
  );
}

export function ProofMediaFallback() {
  return (
    <div className="hidden absolute inset-0 items-center justify-center bg-muted/30">
      <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
      <Video className="h-5 w-5 text-muted-foreground/50" />
    </div>
  );
}

