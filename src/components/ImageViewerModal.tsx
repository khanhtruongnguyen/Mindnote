import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  Minimize2,
  Download,
  Copy,
  Check,
  RefreshCw,
  FlipHorizontal,
} from 'lucide-react';

export interface ImageViewerDetail {
  src: string;
  alt?: string;
  title?: string;
}

export function openImageViewer(detail: ImageViewerDetail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mindnote:open-image-viewer', { detail }));
  }
}

interface ImageViewerModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  image?: ImageViewerDetail | null;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  image: propImage,
}) => {
  const [isOpen, setIsOpen] = useState(Boolean(propIsOpen));
  const [currentImage, setCurrentImage] = useState<ImageViewerDetail | null>(propImage || null);

  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Dragging state
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch gesture state (Pinch to zoom)
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef<number>(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Sync prop changes
  useEffect(() => {
    if (propIsOpen !== undefined) {
      setIsOpen(propIsOpen);
    }
  }, [propIsOpen]);

  useEffect(() => {
    if (propImage) {
      setCurrentImage(propImage);
      resetView();
    }
  }, [propImage]);

  // Listen for global custom event
  useEffect(() => {
    const handleOpenEvent = (e: CustomEvent<ImageViewerDetail>) => {
      if (e.detail?.src) {
        setCurrentImage(e.detail);
        resetView();
        setIsOpen(true);
      }
    };

    window.addEventListener('mindnote:open-image-viewer' as any, handleOpenEvent);
    return () => {
      window.removeEventListener('mindnote:open-image-viewer' as any, handleOpenEvent);
    };
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
    setFlipH(false);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    resetView();
    propOnClose?.();
  }, [propOnClose, resetView]);

  // Keyboard shortcuts (Escape, +, -, 0, R)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === '=' || e.key === '+') {
        handleZoom(0.25);
      } else if (e.key === '-' || e.key === '_') {
        handleZoom(-0.25);
      } else if (e.key === '0' || e.key.toLowerCase() === 'r') {
        resetView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, resetView]);

  const handleZoom = (delta: number) => {
    setScale((prev) => {
      const next = Math.max(0.2, Math.min(10, prev + delta));
      return Math.round(next * 100) / 100;
    });
  };

  // Wheel zoom centered on cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const zoomFactor = e.deltaY < 0 ? 1.18 : 0.85;

    setScale((prevScale) => {
      const newScale = Math.max(0.2, Math.min(10, prevScale * zoomFactor));

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        setPosition((prevPos) => ({
          x: mouseX - (mouseX - prevPos.x) * (newScale / prevScale),
          y: mouseY - (mouseY - prevPos.y) * (newScale / prevScale),
        }));
      }

      return Math.round(newScale * 100) / 100;
    });
  };

  // Double click toggles between 1x and 2.5x zoom
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (scale > 1.2) {
      resetView();
    } else {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;
        setScale(2.5);
        setPosition({ x: -mouseX * 1.5, y: -mouseY * 1.5 });
      } else {
        setScale(2.5);
      }
    }
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Chỉ chuột trái
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { ...position };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: initialPosRef.current.x + dx,
      y: initialPosRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Touch handlers for mobile
  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      initialPosRef.current = { ...position };
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      touchStartDistRef.current = getTouchDistance(e.touches[0], e.touches[1]);
      touchStartScaleRef.current = scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPosition({
        x: initialPosRef.current.x + dx,
        y: initialPosRef.current.y + dy,
      });
    } else if (e.touches.length === 2 && touchStartDistRef.current) {
      const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
      const factor = currentDist / touchStartDistRef.current;
      const newScale = Math.max(0.2, Math.min(10, touchStartScaleRef.current * factor));
      setScale(Math.round(newScale * 100) / 100);
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    touchStartDistRef.current = null;
  };

  const handleRotate = (angle: number) => {
    setRotation((prev) => (prev + angle + 360) % 360);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Download image
  const handleDownload = () => {
    if (!currentImage?.src) return;
    const link = document.createElement('a');
    link.href = currentImage.src;
    const fileName =
      (currentImage.title || currentImage.alt || 'mindnote-image')
        .replace(/[\\/:*?"<>|]/g, '_')
        .slice(0, 40) + '.png';
    link.download = fileName;
    link.click();
  };

  // Copy image to clipboard
  const handleCopyImage = async () => {
    if (!currentImage?.src) return;
    try {
      const res = await fetch(currentImage.src);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type || 'image/png']: blob,
        }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy src text
      try {
        await navigator.clipboard.writeText(currentImage.src);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.warn('Copy image failed:', err);
      }
    }
  };

  if (!isOpen || !currentImage?.src) return null;

  const imageTitle = currentImage.title || currentImage.alt || 'Hình ảnh ghi chú';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trình xem & phóng to ảnh"
      className="fixed inset-0 z-50 flex flex-col bg-black/92 backdrop-blur-md animate-in fade-in duration-200 select-none overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#121217]/90 border-b border-[#252533] text-zinc-200 z-20 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 pr-3">
          <div className="p-1.5 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 shrink-0">
            <Maximize2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-md">
              {imageTitle}
            </div>
            <div className="text-[10px] text-zinc-400 flex items-center gap-2">
              <span>Tỷ lệ: {Math.round(scale * 100)}%</span>
              {rotation !== 0 && <span>• Xoay {rotation}°</span>}
              {flipH && <span>• Lật ngang</span>}
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyImage}
            title="Sao chép ảnh vào clipboard"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1c1c26] hover:bg-[#282836] border border-zinc-700/60 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] text-emerald-400 hidden sm:inline">Đã chép</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[11px] hidden sm:inline">Sao chép</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title="Tải ảnh về máy"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1c1c26] hover:bg-[#282836] border border-zinc-700/60 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-[11px] hidden sm:inline">Tải về</span>
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            title="Toàn màn hình"
            className="p-1.5 rounded-lg bg-[#1c1c26] hover:bg-[#282836] border border-zinc-700/60 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleClose}
            title="Đóng (Phím Esc)"
            className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 border border-rose-500/30 text-rose-300 hover:text-white transition-colors cursor-pointer ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Interactive Viewer Canvas */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`,
            transformOrigin: 'center center',
            transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out',
          }}
          className="inline-block relative select-none will-change-transform"
        >
          <img
            ref={imageRef}
            src={currentImage.src}
            alt={currentImage.alt || 'Hình ảnh phóng to'}
            draggable={false}
            className="max-w-[90vw] max-h-[82vh] object-contain rounded-lg shadow-2xl shadow-black pointer-events-none select-none"
          />
        </div>

        {/* Subtle Watermark hint */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none text-[11px] text-zinc-400/70 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-zinc-800/80 shadow-md">
          Cuộn chuột hoặc nhấp đúp để phóng to • Kéo để di chuyển • Phím Esc để đóng
        </div>
      </div>

      {/* Bottom Floating Control Dock */}
      <div className="p-3 pb-4 sm:pb-3 flex justify-center z-20 shrink-0 pointer-events-none">
        <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-2xl bg-[#14141d]/95 backdrop-blur-xl border border-zinc-700/80 shadow-2xl pointer-events-auto">
          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => handleZoom(-0.25)}
            title="Thu nhỏ (-)"
            className="p-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Scale Indicator / Reset Button */}
          <button
            type="button"
            onClick={resetView}
            title="Nhấp để đặt lại kích thước gốc 100%"
            className="px-2.5 py-1 rounded-xl bg-zinc-800/80 hover:bg-purple-600/30 hover:border-purple-500/50 border border-transparent text-xs font-mono font-semibold text-zinc-200 transition-all cursor-pointer min-w-[55px] text-center"
          >
            {Math.round(scale * 100)}%
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={() => handleZoom(0.25)}
            title="Phóng to (+)"
            className="p-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-5 bg-zinc-700 mx-0.5" />

          {/* Rotate CCW */}
          <button
            type="button"
            onClick={() => handleRotate(-90)}
            title="Xoay ngược chiều kim đồng hồ (90°)"
            className="p-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Rotate CW */}
          <button
            type="button"
            onClick={() => handleRotate(90)}
            title="Xoay theo chiều kim đồng hồ (90°)"
            className="p-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Flip Horizontal */}
          <button
            type="button"
            onClick={() => setFlipH((prev) => !prev)}
            title="Lật ảnh ngang (Flip)"
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              flipH
                ? 'bg-purple-600/30 border-purple-500/50 text-purple-300'
                : 'bg-zinc-800/80 border-transparent hover:bg-zinc-700 text-zinc-300 hover:text-white'
            }`}
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-5 bg-zinc-700 mx-0.5" />

          {/* Reset / Fit View */}
          <button
            type="button"
            onClick={resetView}
            title="Đặt lại ban đầu (Phím R)"
            className="p-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
