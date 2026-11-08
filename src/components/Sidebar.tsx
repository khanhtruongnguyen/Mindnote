import React, { useState, useRef, useEffect } from 'react';
import type { Edge } from '@xyflow/react';
import type { CustomNode, NodeColor, NodeShape, AppSettings } from '../types';
import { COLOR_SCHEMES } from '../constants/theme';
import { UnifiedNoteEditor } from './UnifiedNoteEditor';
import { ErrorBoundary } from './ErrorBoundary';
import { AiService } from '../services/aiService';
import {
  Trash2,
  Sparkles,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  X,
  Wand2,
  Loader2,
  Check,
  Brain,
  Camera,
  ScanText,
  Upload,
  Palette,
  Compass,
  Globe,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface SidebarProps {
  selectedNode: CustomNode | null;
  activeMapId?: string;
  allNodes?: CustomNode[];
  edges?: Edge[];
  settings?: AppSettings;
  mapName?: string;
  mapContext?: string;
  onOpenContextModal?: () => void;
  onAddBranchNodes?: (parentNode: CustomNode, branches: Array<{ label: string; content: string }>) => void;
  onAddEdge?: (sourceId: string, targetId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onSelectNodeById?: (nodeId: string) => void;
  onNavigate?: (mapId?: string, noteId?: string) => void;
  attachments?: Record<string, string>;
  isMobile?: boolean;
  onUpdateNode: (id: string, updates: Partial<CustomNode['data']>) => void;
  onDeleteNode: (id: string) => void;
  onClose: () => void;
  onSaveAttachment: (id: string, base64: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedNode,
  activeMapId,
  allNodes = [],
  settings,
  mapContext,
  onOpenContextModal,
  attachments = {},
  isMobile = false,
  onUpdateNode,
  onDeleteNode,
  onClose,
  onSaveAttachment,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalTab, setLinkModalTab] = useState<'internal' | 'external'>('internal');
  const [selectedInternalNodeId, setSelectedInternalNodeId] = useState<string>('');
  const [internalLinkSyntax, setInternalLinkSyntax] = useState<'wiki' | 'markdown'>('wiki');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [copiedNoteLink, setCopiedNoteLink] = useState(false);

  // UI Frame Collapse Toggles (Chống tràn viền và tinh gọn giao diện)
  const [showStyleSettings, setShowStyleSettings] = useState(true);
  const [showVisionBox, setShowVisionBox] = useState(false);
  const [showAiPresets, setShowAiPresets] = useState(true);

  // AI Note Writing Assistant states
  const [showAiWriter, setShowAiWriter] = useState(false);
  const [aiWriterLoading, setAiWriterLoading] = useState(false);
  const [aiWriterResult, setAiWriterResult] = useState<string | null>(null);
  const [aiCustomInstruction, setAiCustomInstruction] = useState('');
  const [aiWriterError, setAiWriterError] = useState<string | null>(null);
  const [tempVisionImage, setTempVisionImage] = useState<string | null>(null);
  const visionFileInputRef = useRef<HTMLInputElement>(null);

  // Mobile Drag Gesture States
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const startTouchY = useRef(0);
  const currentY = useRef(0);
  const startTime = useRef(0);

  // Lắng nghe phím Escape để thoát chế độ Toàn màn hình
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Reset drag position when selectedNode changes
  useEffect(() => {
    setDragOffsetY(0);
    setIsDragging(false);
    setIsExpanded(false);
  }, [selectedNode?.id]);

  if (!selectedNode) return null;

  const { data } = selectedNode;
  const currentColor = data.color || 'purple';
  const currentShape = data.shape || 'pill';

  const insertTextAtCursor = (textToInsert: string) => {
    const currentVal = data.content || '';
    const newContent = currentVal ? `${currentVal.trimEnd()}\n${textToInsert}\n` : textToInsert;
    onUpdateNode(selectedNode.id, { content: newContent });
  };

  const handleCopyNoteLink = () => {
    if (!selectedNode) return;
    try {
      const url = new URL(window.location.href);
      if (activeMapId) {
        url.searchParams.set('map', activeMapId);
      }
      url.searchParams.set('note', selectedNode.id);
      navigator.clipboard.writeText(url.toString());
      setCopiedNoteLink(true);
      setTimeout(() => setCopiedNoteLink(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  // Xử lý ảnh tạm cho AI Vision / OCR mà không cần lưu vào note
  const handleVisionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setTempVisionImage(base64);
      };
      reader.readAsDataURL(file);
    }
    if (visionFileInputRef.current) visionFileInputRef.current.value = '';
  };

  // AI Note Writing Handlers
  const handleRunAiWriter = async (
    mode:
      | 'expand'
      | 'summarize'
      | 'formula'
      | 'polish'
      | 'custom'
      | 'explain_image'
      | 'format_table_css'
      | 'ocr_image'
      | 'describe_image',
    overrideImage?: string
  ) => {
    if (!selectedNode) return;
    setAiWriterLoading(true);
    setAiWriterError(null);
    setAiWriterResult(null);

    try {
      const baseUrl = settings?.aiBaseUrl || 'https://api.xah.io/v1';
      const apiKey = settings?.aiApiKey || 'sk-6e5bd68e2310d13bcf3747838f1cf8138d68e14e318e4e7e68cfb62a30aff59b';
      const model = settings?.aiModel || 'dungcsnd113/gemini-flash-3.8';

      let imageList: string[] = [];
      if (overrideImage) {
        imageList = [overrideImage];
      } else {
        // Trích xuất hình ảnh đính kèm trong note nếu có
        const imageRegex = /attachment:([^\s)]+)/g;
        const imageMatches = [...(selectedNode.data.content || '').matchAll(imageRegex)];
        imageList = imageMatches
          .map((m) => attachments[m[1]])
          .filter((b64): b64 is string => Boolean(b64));
      }

      const result = await AiService.refineNoteContent({
        baseUrl,
        apiKey,
        model,
        nodeLabel: selectedNode.data.label || 'Ghi chú',
        currentContent: selectedNode.data.content || '',
        mode,
        customInstruction: aiCustomInstruction.trim(),
        mapContext,
        images: imageList.length > 0 ? imageList : undefined,
      });

      setAiWriterResult(result);
    } catch (err: unknown) {
      const e = err as Error;
      setAiWriterError(e.message || 'Lỗi khi yêu cầu AI viết');
    } finally {
      setAiWriterLoading(false);
    }
  };

  const handleApplyAiContent = (type: 'replace' | 'append') => {
    if (!selectedNode || !aiWriterResult) return;
    if (type === 'replace') {
      onUpdateNode(selectedNode.id, { content: aiWriterResult });
    } else {
      const existing = selectedNode.data.content ? selectedNode.data.content.trimEnd() + '\n\n' : '';
      onUpdateNode(selectedNode.id, { content: existing + aiWriterResult });
    }
    setAiWriterResult(null);
    setShowAiWriter(false);
  };

  const handleInsertInternalLink = (e: React.FormEvent) => {
    e.preventDefault();
    const targetNode = allNodes.find((n) => n.id === selectedInternalNodeId);
    const targetLabel = targetNode?.data.label || selectedInternalNodeId || 'Ghi chú';
    const displayTitle = linkTitle.trim();

    if (internalLinkSyntax === 'wiki') {
      if (!displayTitle || displayTitle === targetLabel) {
        insertTextAtCursor(`[[${targetLabel}]]`);
      } else {
        insertTextAtCursor(`[[${targetLabel}|${displayTitle}]]`);
      }
    } else {
      insertTextAtCursor(`[${displayTitle || targetLabel}](node:${selectedInternalNodeId || targetLabel})`);
    }

    setLinkTitle('');
    setSelectedInternalNodeId('');
    setShowLinkModal(false);
  };

  const handleInsertExternalLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    const title = linkTitle.trim() || 'Tài liệu liên kết';
    insertTextAtCursor(`[${title}](${linkUrl.trim()})`);
    setLinkTitle('');
    setLinkUrl('');
    setShowLinkModal(false);
  };

  // TOUCH DRAG GESTURE HANDLERS (Vùng kéo trượt trên ảnh 2)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    startTouchY.current = e.touches[0].clientY;
    currentY.current = 0;
    startTime.current = Date.now();
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || !isDragging) return;
    const deltaY = e.touches[0].clientY - startTouchY.current;
    if (deltaY > 0) {
      // Kéo xuống: trang ghi chú trôi xuống theo ngón tay
      currentY.current = deltaY;
      setDragOffsetY(deltaY);
    } else if (deltaY < 0 && !isExpanded) {
      // Kéo lên: mở rộng thêm chiều cao
      currentY.current = deltaY;
      setDragOffsetY(deltaY * 0.3);
    }
  };

  const handleTouchEnd = () => {
    if (!isMobile || !isDragging) return;
    setIsDragging(false);
    const deltaY = currentY.current;
    const elapsed = Date.now() - startTime.current;
    const velocity = deltaY / Math.max(1, elapsed); // Tốc độ vuốt

    // Nếu kéo xuống quá 85px hoặc vuốt nhanh xuống -> Đóng êm ái
    if (deltaY > 85 || velocity > 0.4) {
      setDragOffsetY(window.innerHeight);
      setTimeout(() => {
        onClose();
        setDragOffsetY(0);
      }, 240);
    } else if (deltaY < -45) {
      // Nếu kéo lên trên -> Mở rộng toàn màn hình
      setIsExpanded(true);
      setDragOffsetY(0);
    } else {
      // Chưa đủ ngưỡng -> Bật ngược trở lại vị trí cũ
      setDragOffsetY(0);
    }
  };

  const handleDismiss = () => {
    if (isMobile) {
      setDragOffsetY(window.innerHeight);
      setTimeout(() => {
        onClose();
        setDragOffsetY(0);
      }, 240);
    } else {
      onClose();
    }
  };

  // Styling container based on mobile vs desktop vs fullscreen (Chế độ toàn màn hình cho từng ô note)
  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-[100] w-screen h-screen bg-[#121217] flex flex-col will-change-transform overflow-hidden box-border'
    : isMobile
    ? 'fixed inset-x-0 bottom-0 bg-[#16161b]/98 backdrop-blur-2xl border-t border-[#363647] rounded-t-3xl shadow-[0_-12px_45px_rgba(0,0,0,0.85)] z-50 flex flex-col will-change-transform overflow-hidden box-border'
    : 'fixed top-0 right-0 h-full w-full sm:w-[500px] max-w-[100vw] sm:max-w-[500px] bg-[#16161b]/98 backdrop-blur-xl border-l border-[#2e2e3a] shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-in-out select-text overflow-x-hidden overflow-y-hidden box-border';

  return (
    <>
      {/* Nền mờ phía sau trên điện thoại */}
      {isMobile && !isFullscreen && (
        <div
          onClick={handleDismiss}
          style={{
            opacity: isDragging ? Math.max(0, 1 - dragOffsetY / 350) : 1,
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
        />
      )}

      <aside
        aria-label="Thanh bên ghi chú"
        className={containerClasses}
        style={{
          height: isFullscreen ? '100vh' : isMobile ? (isExpanded ? '96vh' : '86vh') : undefined,
          transform: isMobile && !isFullscreen ? `translateY(${dragOffsetY}px)` : undefined,
          transition: isDragging
            ? 'none'
            : 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1), height 0.26s cubic-bezier(0.16, 1, 0.3, 1)',
          paddingBottom: isMobile && !isFullscreen ? 'max(env(safe-area-inset-bottom, 0px), 16px)' : undefined,
        }}
      >
        {/* VÙNG KÉO TRƯỢT LÊN XUỐNG BẰNG TAY (Circled in red in Image 2) */}
        {isMobile && (
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="w-full flex flex-col items-center pt-3 pb-1.5 touch-none select-none cursor-grab active:cursor-grabbing active:bg-zinc-800/30 rounded-t-3xl transition-colors"
          >
            <div className="w-14 h-1.5 rounded-full bg-zinc-500/80 shadow-sm" />
            <span className="text-[10px] text-zinc-500 mt-1 font-medium tracking-tight">
              {isExpanded ? 'Vuốt xuống để thu nhỏ' : 'Vuốt xuống để đóng • Vuốt lên để mở rộng'}
            </span>
          </div>
        )}

        {/* Top Header */}
        <div
          onTouchStart={isMobile && !isFullscreen ? handleTouchStart : undefined}
          onTouchMove={isMobile && !isFullscreen ? handleTouchMove : undefined}
          onTouchEnd={isMobile && !isFullscreen ? handleTouchEnd : undefined}
          className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-[#2e2e3a] bg-[#1a1a22]/70 touch-none select-none shrink-0"
        >
          {/* Nút Toàn màn hình thay thế cho nhãn cũ */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Thu nhỏ lại thanh bên (Esc)' : 'Mở rộng toàn màn hình để viết tập trung'}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#20202d] hover:bg-[#28283a] text-xs font-semibold text-zinc-300 hover:text-white border border-zinc-700/60 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Thu nhỏ (Esc)</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Toàn màn hình</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Nút Sao chép liên kết trực tiếp đến ô này (Deep Link) */}
            <button
              type="button"
              onClick={handleCopyNoteLink}
              title="Sao chép đường link dẫn thẳng đến ô ghi chú này"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                copiedNoteLink
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700'
              }`}
            >
              {copiedNoteLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Đã chép link</span>
                </>
              ) : (
                <>
                  <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Lấy link</span>
                </>
              )}
            </button>

            {/* Nút Xóa ô */}
            <button
              onClick={() => {
                if (confirm('Bạn có chắc muốn xóa ô ghi chú này không?')) {
                  onDeleteNode(selectedNode.id);
                }
              }}
              title="Xóa nút này"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Nút Đóng ghi chú */}
            <button
              onClick={handleDismiss}
              title="Đóng ghi chú"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {isMobile && !isFullscreen ? <ChevronDown className="w-5 h-5 text-zinc-300" /> : <X className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Title & Metadata */}
        <div className="px-4 sm:px-5 py-2.5 space-y-2.5 border-b border-[#272733] bg-[#141419]/50 max-w-full">
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              value={data.label}
              onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
              placeholder="Tiêu đề ghi chú..."
              className="flex-1 min-w-0 bg-transparent text-base sm:text-lg font-bold text-white placeholder-zinc-500 border-none outline-none focus:ring-0 px-0"
            />
            {/* Nút ẩn/hiện khung Hình dáng & Màu sắc */}
            <button
              type="button"
              onClick={() => setShowStyleSettings(!showStyleSettings)}
              title={showStyleSettings ? 'Ẩn khung kiểu dáng & màu sắc' : 'Hiện khung kiểu dáng & màu sắc'}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-zinc-200 bg-[#1b1b24] hover:bg-[#232330] border border-zinc-800 shrink-0 transition-colors cursor-pointer"
            >
              <Palette className="w-3 h-3 text-purple-400" />
              <span className="hidden sm:inline">Kiểu dáng</span>
              {showStyleSettings ? <ChevronUp className="w-3 h-3 text-zinc-500" /> : <ChevronDown className="w-3 h-3 text-zinc-500" />}
            </button>
          </div>

          {/* Shape & Color Settings */}
          {showStyleSettings && (
            <div className="flex items-center justify-between gap-2 pt-0.5 overflow-x-auto max-w-full animate-in fade-in duration-150">
              {/* Shape Picker */}
              <div className="flex items-center gap-1 bg-[#1c1c24] p-0.5 rounded-lg border border-zinc-800 text-[11px] shrink-0">
                {(['pill', 'circle', 'card', 'full'] as NodeShape[]).map((shape) => (
                  <button
                    key={shape}
                    onClick={() => onUpdateNode(selectedNode.id, { shape })}
                    className={`px-2 py-1 rounded-md capitalize font-medium transition-colors ${
                      currentShape === shape
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {shape === 'pill' ? 'Thẻ' : shape === 'circle' ? 'Chấm' : shape === 'card' ? 'Hộp' : 'Toàn bộ'}
                  </button>
                ))}
              </div>

              {/* Color Palette */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 pl-1 shrink-0">
                {(Object.keys(COLOR_SCHEMES) as NodeColor[]).map((colorKey) => {
                  const scheme = COLOR_SCHEMES[colorKey];
                  const isSelected = currentColor === colorKey;
                  return (
                    <button
                      key={colorKey}
                      onClick={() => onUpdateNode(selectedNode.id, { color: colorKey })}
                      title={scheme.name}
                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${scheme.dot} transition-transform shrink-0 ${
                        isSelected
                          ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#141419]'
                          : 'hover:scale-110 opacity-70 hover:opacity-100'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* AI Writer Assistant Panel (Tối ưu chống tràn viền & hỗ trợ ẩn các khung) */}
        {showAiWriter && (
          <div className="p-3 bg-[#14141e] border-b border-[#2d2d3e] space-y-2.5 animate-in fade-in duration-150 shrink-0 max-h-[48vh] overflow-y-auto overflow-x-hidden custom-scrollbar max-w-full box-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                <span>Trợ lý AI viết & trau chuốt</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Nút ẩn/hiện các gợi ý AI */}
                <button
                  type="button"
                  onClick={() => setShowAiPresets(!showAiPresets)}
                  title={showAiPresets ? 'Thu gọn gợi ý thao tác nhanh' : 'Mở rộng gợi ý thao tác nhanh'}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>{showAiPresets ? 'Ẩn gợi ý' : 'Hiện gợi ý'}</span>
                  {showAiPresets ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAiWriter(false);
                    setAiWriterResult(null);
                    setAiWriterError(null);
                  }}
                  className="text-zinc-500 hover:text-white text-xs cursor-pointer p-0.5"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Trạng thái Ngữ cảnh Sổ tay của Map */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#191924] border border-[#2b2b3d] text-[11px] max-w-full">
              <div className="flex items-center gap-1.5 text-zinc-300 min-w-0">
                <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate">
                  Ngữ cảnh AI:{' '}
                  {mapContext && mapContext.trim() ? (
                    <span className="text-emerald-400 font-medium">Đang kích hoạt</span>
                  ) : (
                    <span className="text-zinc-500 italic">Chưa thiết lập</span>
                  )}
                </span>
              </div>
              {onOpenContextModal && (
                <button
                  type="button"
                  onClick={onOpenContextModal}
                  className="text-purple-400 hover:text-purple-300 underline font-medium cursor-pointer shrink-0 ml-2"
                >
                  {mapContext && mapContext.trim() ? 'Xem/Sửa' : '+ Thêm đề cương'}
                </button>
              )}
            </div>

            {/* Preset Action Chips */}
            {showAiPresets && (
              <div className="flex flex-wrap gap-1.5 max-w-full animate-in fade-in duration-100">
                <button
                  type="button"
                  disabled={aiWriterLoading}
                  onClick={() => handleRunAiWriter('expand')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1f1f2e] hover:bg-[#28283d] text-zinc-200 border border-[#303046] hover:border-purple-500/50 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span>🪄 Khai triển ý</span>
                </button>

                <button
                  type="button"
                  disabled={aiWriterLoading}
                  onClick={() => handleRunAiWriter('summarize')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1f1f2e] hover:bg-[#28283d] text-zinc-200 border border-[#303046] hover:border-purple-500/50 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span>📋 Tóm tắt</span>
                </button>

                <button
                  type="button"
                  disabled={aiWriterLoading}
                  onClick={() => handleRunAiWriter('formula')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1f1f2e] hover:bg-[#28283d] text-zinc-200 border border-[#303046] hover:border-purple-500/50 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span>📐 KaTeX Toán</span>
                </button>

                <button
                  type="button"
                  disabled={aiWriterLoading}
                  onClick={() => handleRunAiWriter('format_table_css')}
                  title="Tự động chuẩn hóa bảng biểu, đóng khung callout box và ký tự khó dạng văn bản đẹp mắt"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-200 border border-cyan-500/40 hover:border-cyan-400 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <span>📊 Bảng & Ký tự đẹp (CSS)</span>
                </button>

                <button
                  type="button"
                  disabled={aiWriterLoading}
                  onClick={() => handleRunAiWriter('polish')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1f1f2e] hover:bg-[#28283d] text-zinc-200 border border-[#303046] hover:border-purple-500/50 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span>✍️ Sửa lỗi</span>
                </button>

                {/* Nếu note đã có ảnh, hiển thị các nút thao tác ảnh */}
                {selectedNode?.data.content?.includes('![') && (
                  <>
                    <button
                      type="button"
                      disabled={aiWriterLoading}
                      onClick={() => handleRunAiWriter('ocr_image')}
                      title="Trích xuất toàn bộ chữ, số liệu và bảng trong ảnh thành văn bản Markdown"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/50 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      <span>🔍 Trích chữ (OCR)</span>
                    </button>

                    <button
                      type="button"
                      disabled={aiWriterLoading}
                      onClick={() => handleRunAiWriter('describe_image')}
                      title="Nhìn ảnh và viết mô tả trực quan chi tiết để thay thế ảnh (Tiết kiệm dung lượng)"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 border border-amber-500/50 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      <span>📝 Mô tả ảnh</span>
                    </button>

                    <button
                      type="button"
                      disabled={aiWriterLoading}
                      onClick={() => handleRunAiWriter('explain_image')}
                      title="AI Gemini Vision đọc ảnh đính kèm và phân tích thành bài học"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/50 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      <span>🖼️ Giải thích ảnh</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Trí tuệ Thị giác AI: Khung nhìn ảnh có nút thu gọn/ẩn tiện lợi */}
            <div className="rounded-xl bg-[#171724] border border-[#2c2c40] overflow-hidden max-w-full">
              <button
                type="button"
                onClick={() => setShowVisionBox(!showVisionBox)}
                className="w-full flex items-center justify-between px-2.5 py-2 text-[11px] font-bold text-zinc-300 hover:text-white hover:bg-purple-500/5 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <Camera className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">AI Nhìn ảnh (OCR / Mô tả thay thế ảnh)</span>
                  {tempVisionImage && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-zinc-400 font-normal shrink-0 ml-2">
                  <span>{showVisionBox ? 'Ẩn' : 'Hiện'}</span>
                  {showVisionBox ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </span>
              </button>

              {(showVisionBox || tempVisionImage) && (
                <div className="p-2.5 pt-0 space-y-2 border-t border-[#232334] animate-in fade-in duration-100 max-w-full">
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] text-zinc-400">
                      Chỉ lưu chữ trích xuất, 0 KB dung lượng ảnh
                    </span>
                    {tempVisionImage && (
                      <button
                        type="button"
                        onClick={() => setTempVisionImage(null)}
                        className="text-[10px] text-zinc-400 hover:text-rose-400 cursor-pointer"
                      >
                        ✕ Hủy ảnh
                      </button>
                    )}
                  </div>

                  {!tempVisionImage ? (
                    <div>
                      <input
                        type="file"
                        ref={visionFileInputRef}
                        onChange={handleVisionFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => visionFileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-purple-500/40 hover:border-purple-400 bg-purple-500/5 hover:bg-purple-500/10 text-xs text-purple-200 font-medium cursor-pointer transition-colors text-center break-words"
                      >
                        <Upload className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span>Tải ảnh lên để AI đọc chữ hoặc mô tả</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 bg-[#111119] p-2 rounded-lg border border-zinc-800 max-w-full">
                      <img
                        src={tempVisionImage}
                        alt="Ảnh tạm"
                        className="w-14 h-14 object-cover rounded-lg border border-zinc-700 shrink-0"
                      />
                      <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={aiWriterLoading}
                          onClick={() => handleRunAiWriter('ocr_image', tempVisionImage)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 text-cyan-200 border border-cyan-500/50 text-[11px] font-semibold cursor-pointer disabled:opacity-50 shadow-sm"
                        >
                          <ScanText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>Trích xuất chữ (OCR)</span>
                        </button>
                        <button
                          type="button"
                          disabled={aiWriterLoading}
                          onClick={() => handleRunAiWriter('describe_image', tempVisionImage)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-500/50 text-[11px] font-semibold cursor-pointer disabled:opacity-50 shadow-sm"
                        >
                          <span>📝 Mô tả thay ảnh</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Custom Instruction Input */}
            <div className="flex items-center gap-1.5 pt-0.5 max-w-full">
              <input
                type="text"
                value={aiCustomInstruction}
                onChange={(e) => setAiCustomInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRunAiWriter('custom');
                }}
                placeholder="Hoặc gõ yêu cầu riêng (vd: Viết ví dụ, bài tập...)"
                className="min-w-0 flex-1 bg-[#181824] border border-[#2e2e40] focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
              />
              <button
                type="button"
                disabled={aiWriterLoading || !aiCustomInstruction.trim()}
                onClick={() => handleRunAiWriter('custom')}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                Viết
              </button>
            </div>

            {/* Loading Indicator */}
            {aiWriterLoading && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-purple-300 text-xs animate-pulse max-w-full">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span className="truncate">AI đang suy nghĩ và biên soạn nội dung...</span>
              </div>
            )}

            {/* Error message */}
            {aiWriterError && (
              <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs break-words max-w-full">
                ⚠️ {aiWriterError}
              </div>
            )}

            {/* Result Preview Box with Apply Actions */}
            {aiWriterResult && !aiWriterLoading && (
              <div className="space-y-2 p-2.5 rounded-xl bg-[#191926] border border-purple-500/40 shadow-lg max-w-full overflow-hidden">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 border-b border-zinc-800 pb-1.5">
                  <span className="font-semibold text-purple-300">Bản xem trước do AI soạn:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500">{aiWriterResult.length} ký tự</span>
                    <button
                      type="button"
                      onClick={() => setAiWriterResult(null)}
                      title="Đóng bản xem trước"
                      className="text-zinc-500 hover:text-white text-xs cursor-pointer p-0.5"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto overflow-x-hidden p-2 bg-[#101016] rounded-lg text-xs font-mono text-zinc-300 whitespace-pre-wrap break-words leading-relaxed select-text">
                  {aiWriterResult}
                </div>

                <div className="flex items-center justify-end flex-wrap gap-2 pt-1 max-w-full">
                  <button
                    type="button"
                    onClick={() => setAiWriterResult(null)}
                    className="px-2.5 py-1 rounded-lg text-zinc-400 hover:text-white text-xs cursor-pointer"
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyAiContent('append')}
                    className="px-2.5 py-1 rounded-lg bg-[#252538] hover:bg-[#303046] text-purple-200 border border-purple-500/30 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Chèn vào cuối
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyAiContent('replace')}
                    className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    Thay thế nội dung
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BỘ SOẠN THẢO DUY NHẤT & HIỂN THỊ TRỰC TIẾP (UNIFIED SINGLE EDITOR) */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-[#121217]">
          <ErrorBoundary fallbackTitle="Không thể tải bộ soạn thảo ghi chú">
            <UnifiedNoteEditor
              content={data.content || ''}
              onChange={(newContent) => onUpdateNode(selectedNode.id, { content: newContent })}
              attachments={attachments}
              onSaveAttachment={onSaveAttachment}
              onOpenLinkModal={() => {
                const otherNodes = allNodes.filter((n) => n.id !== selectedNode.id);
                if (otherNodes.length > 0 && !selectedInternalNodeId) {
                  setSelectedInternalNodeId(otherNodes[0].id);
                  setLinkTitle(otherNodes[0].data.label || '');
                }
                setShowLinkModal(true);
              }}
              onToggleAiWriter={() => setShowAiWriter(!showAiWriter)}
              showAiWriter={showAiWriter}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
              isMobile={isMobile}
            />
          </ErrorBoundary>
        </div>
      </aside>

      {/* Mini Modal Chèn Liên Kết: Nội Bộ (Ở lại cùng tab) hoặc Web Ngoài */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181822] border border-[#2e2e3d] rounded-2xl w-full max-w-sm sm:max-w-md shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Chèn liên kết</h3>
              </div>
              <button
                onClick={() => setShowLinkModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chuyển đổi Tab: Link Nội Bộ vs Link Web Ngoài */}
            <div className="flex rounded-lg bg-[#121218] p-1 border border-zinc-800">
              <button
                type="button"
                onClick={() => setLinkModalTab('internal')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  linkModalTab === 'internal'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Link Nội Bộ (Cùng tab)</span>
              </button>
              <button
                type="button"
                onClick={() => setLinkModalTab('external')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  linkModalTab === 'external'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Link Web Ngoài</span>
              </button>
            </div>

            {/* TAB 1: LIÊN KẾT NỘI BỘ (Ở LẠI CÙNG TAB) */}
            {linkModalTab === 'internal' ? (
              <form onSubmit={handleInsertInternalLink} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Chọn ô ghi chú muốn liên kết đến *
                  </label>
                  {allNodes.filter((n) => n.id !== selectedNode.id).length > 0 ? (
                    <select
                      value={selectedInternalNodeId}
                      onChange={(e) => {
                        setSelectedInternalNodeId(e.target.value);
                        const found = allNodes.find((n) => n.id === e.target.value);
                        if (found) {
                          setLinkTitle(found.data.label || '');
                        }
                      }}
                      className="w-full bg-[#121218] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-purple-500"
                    >
                      <option value="">-- Chọn một ô ghi chú --</option>
                      {allNodes
                        .filter((n) => n.id !== selectedNode.id)
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.data.label || 'Chưa đặt tên'}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <p className="text-xs text-amber-400/80 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                      Chưa có ô ghi chú nào khác trên bản đồ. Bạn có thể tự gõ cú pháp [[Tên ô]] vào văn bản sau khi tạo ô mới!
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Tên hiển thị (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="Mặc định lấy theo tên ô ghi chú"
                    className="w-full bg-[#121218] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-purple-500"
                  />
                </div>

                {/* Chọn định dạng cú pháp */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                    Định dạng cú pháp:
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setInternalLinkSyntax('wiki')}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        internalLinkSyntax === 'wiki'
                          ? 'border-purple-500 bg-purple-500/15 text-purple-200'
                          : 'border-zinc-800 bg-[#121218] text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="font-bold">[[Wiki-link]]</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">Chuẩn Obsidian gọn gàng</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInternalLinkSyntax('markdown')}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        internalLinkSyntax === 'markdown'
                          ? 'border-purple-500 bg-purple-500/15 text-purple-200'
                          : 'border-zinc-800 bg-[#121218] text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="font-bold">[Tên](node:id)</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">Markdown định danh ID</div>
                    </button>
                  </div>
                </div>

                {/* Xem trước cú pháp */}
                {selectedInternalNodeId && (
                  <div className="bg-[#121218] border border-zinc-800/80 rounded-lg p-2.5">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                      Cú pháp sẽ chèn:
                    </div>
                    <code className="text-xs font-mono text-purple-300 break-all select-all">
                      {(() => {
                        const targetNode = allNodes.find((n) => n.id === selectedInternalNodeId);
                        const targetLabel = targetNode?.data.label || selectedInternalNodeId;
                        const display = linkTitle.trim();
                        if (internalLinkSyntax === 'wiki') {
                          return !display || display === targetLabel
                            ? `[[${targetLabel}]]`
                            : `[[${targetLabel}|${display}]]`;
                        } else {
                          return `[${display || targetLabel}](node:${selectedInternalNodeId})`;
                        }
                      })()}
                    </code>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setShowLinkModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedInternalNodeId}
                    className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-colors"
                  >
                    Chèn link nội bộ
                  </button>
                </div>
              </form>
            ) : (
              /* TAB 2: LIÊN KẾT NGOÀI (GOOGLE DOCS, WEB) */
              <form onSubmit={handleInsertExternalLink} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Tên hiển thị
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="Ví dụ: Google Docs Bài Giảng"
                    className="w-full bg-[#121218] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Đường dẫn (URL) *
                  </label>
                  <input
                    type="url"
                    required
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://docs.google.com/... hoặc https://..."
                    className="w-full bg-[#121218] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setShowLinkModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={!linkUrl.trim()}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-colors"
                  >
                    Chèn link web ngoài
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
