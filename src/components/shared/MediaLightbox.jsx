import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ExternalLink, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { isVideoUrl, normalizeMediaUrl } from '../../utils/proofMedia.js';

export default function MediaLightbox({
  open,
  onClose,
  media = [],
  initialIndex = 0,
}) {
  const [current, setCurrent] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Sync index if it changes externally
  useEffect(() => {
    setCurrent(initialIndex);
  }, [initialIndex, open]);

  // Reset zoom/rotation when switching media
  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [current]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && media.length > 1) next();
      if (e.key === 'ArrowLeft' && media.length > 1) prev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, current, media]);

  if (!open || !media || media.length === 0) return null;

  const mediaList = (Array.isArray(media) ? media : [media])
    .map(normalizeMediaUrl)
    .filter(Boolean);
  const activeUrl = mediaList[current];
  const isVideo = isVideoUrl(activeUrl);

  const prev = (e) => {
    e?.stopPropagation();
    setCurrent((i) => (i - 1 + mediaList.length) % mediaList.length);
  };

  const next = (e) => {
    e?.stopPropagation();
    setCurrent((i) => (i + 1) % mediaList.length);
  };

  const handleZoomIn = (e) => {
    e?.stopPropagation();
    setZoom((z) => Math.min(z + 0.25, 3));
  };

  const handleZoomOut = (e) => {
    e?.stopPropagation();
    setZoom((z) => Math.max(z - 0.25, 0.5));
  };

  const handleRotate = (e) => {
    e?.stopPropagation();
    setRotation((r) => (r + 90) % 360);
  };

  const handleDownload = async (e) => {
    e?.stopPropagation();
    try {
      const response = await fetch(activeUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Generate a reasonable file name
      const filename = activeUrl.split('/').pop()?.split('?')[0] || (isVideo ? 'video.mp4' : 'image.jpg');
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      // Fallback: Open in a new tab if fetch fails (e.g. CORS issues)
      window.open(activeUrl, '_blank');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col justify-between bg-black/95 text-white backdrop-blur-md transition-all duration-300 animate-in fade-in"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div className="flex h-16 items-center justify-between px-4 md:px-6 bg-gradient-to-b from-black/60 to-transparent z-10">
        <div className="flex items-center gap-3">
          {mediaList.length > 1 && (
            <span className="text-sm font-semibold tracking-wider text-neutral-300 bg-neutral-800/60 px-3 py-1 rounded-full">
              {current + 1} / {mediaList.length}
            </span>
          )}
          <span className="text-xs text-neutral-400 hidden sm:inline truncate max-w-[200px] md:max-w-xs">
            {activeUrl.split('/').pop()?.split('?')[0]}
          </span>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {!isVideo && (
            <>
              <button
                onClick={handleZoomOut}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-300 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <button
                onClick={handleZoomIn}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-300 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                onClick={handleRotate}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-300 hover:text-white"
                title="Rotate"
              >
                <RotateCw className="h-5 w-5" />
              </button>
            </>
          )}
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-300 hover:text-white"
            title="Download Media"
          >
            <Download className="h-5 w-5" />
          </button>
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-300 hover:text-white flex items-center justify-center"
            title="Open Original in New Tab"
          >
            <ExternalLink className="h-5 w-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white ml-2"
            title="Close Lightbox"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="relative flex-1 flex items-center justify-center px-4 overflow-hidden">
        {/* Navigation Arrows */}
        {mediaList.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-4 z-10 p-3 md:p-4 rounded-full bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-700/50 hover:scale-105 transition-all text-white flex items-center justify-center focus:outline-none"
              title="Previous"
            >
              <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" />
            </button>
            <button
              onClick={next}
              className="absolute right-4 z-10 p-3 md:p-4 rounded-full bg-neutral-900/60 hover:bg-neutral-800/80 border border-neutral-700/50 hover:scale-105 transition-all text-white flex items-center justify-center focus:outline-none"
              title="Next"
            >
              <ChevronRight className="h-6 w-6 md:h-8 md:w-8" />
            </button>
          </>
        )}

        {/* Media Container */}
        <div
          className="max-h-[80vh] max-w-[90vw] flex items-center justify-center transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {isVideo ? (
            <video
              src={activeUrl}
              className="max-h-[75vh] max-w-[85vw] rounded-lg shadow-2xl"
              controls
              autoPlay
              playsInline
              preload="auto"
            />
          ) : (
            <img
              src={activeUrl}
              alt={`Media ${current + 1}`}
              className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-2xl select-none"
              draggable="false"
            />
          )}
        </div>
      </div>

      {/* Footer bar */}
      <div className="h-16 flex items-center justify-center bg-gradient-to-t from-black/60 to-transparent z-10">
        <p className="text-xs text-neutral-400">
          Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px]">ESC</kbd> to close · Use Arrow keys to navigate
        </p>
      </div>
    </div>
  );
}
