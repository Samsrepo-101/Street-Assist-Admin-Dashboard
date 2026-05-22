import React from 'react';
import { ImageIcon, Video } from 'lucide-react';
import { isVideoUrl } from '../../utils/proofMedia.js';

export default function ProofMediaPreview({ src, alt, className = 'h-20 w-full object-cover' }) {
  if (isVideoUrl(src)) {
    return (
      <video
        src={src}
        className={className}
        controls
        muted
        preload="metadata"
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt || 'Proof media'}
      className={className}
      onError={(event) => {
        event.currentTarget.style.display = 'none';
        const fallback = event.currentTarget.nextElementSibling;
        if (fallback) fallback.style.display = 'flex';
      }}
    />
  );
}

export function ProofMediaFallback() {
  return (
    <div className="hidden h-20 w-full items-center justify-center bg-muted/30">
      <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
      <Video className="h-5 w-5 text-muted-foreground/50" />
    </div>
  );
}
