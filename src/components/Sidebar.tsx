import React, { useState, useRef, useEffect } from 'react';
import type { Edge } from '@xyflow/react';
import type { CustomNode, NodeColor, NodeShape } from '../types';
import { COLOR_SCHEMES } from '../constants/theme';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SyntaxHandbookModal } from './SyntaxHandbookModal';
import {
  Trash2,
  Eye,
  Edit3,
  Columns,
  Bold,
  Italic,
  Sigma,
  Image as ImageIcon,
  List,
  Heading1,
  Sparkles,
  Link as LinkIcon,
  BoxSelect,
  BookOpen,
  ChevronDown,
  ChevronUp,
  X,
  GitBranch,
  ArrowRight,
  ArrowLeft,
  Network,
  Plus,
} from 'lucide-react';

interface SidebarProps {
  selectedNode: CustomNode | null;
  allNodes?: CustomNode[];
  edges?: Edge[];
  onAddEdge?: (sourceId: string, targetId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onSelectNodeById?: (nodeId: string) => void;
  attachments?: Record<string, string>;
  isMobile?: boolean;
  onUpdateNode: (id: string, updates: Partial<CustomNode['data']>) => void;
  onDeleteNode: (id: string) => void;
  onClose: () => void;
  onSaveAttachment: (id: string, base64: string) => void;
}

type ViewMode = 'edit' | 'preview' | 'split';

export const Sidebar: React.FC<SidebarProps> = ({
  selectedNode,
  allNodes = [],
  edges = [],
  onAddEdge,
  onDeleteEdge,
  onSelectNodeById,
  attachments = {},
  isMobile = false,
  onUpdateNode,
  onDeleteNode,
  onClose,
  onSaveAttachment,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'edit' : 'split');
  const [showFormulaMenu, setShowFormulaMenu] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showHandbookModal, setShowHandbookModal] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [targetConnectId, setTargetConnectId] = useState<string>('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  // Mobile Drag Gesture States
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const startTouchY = useRef(0);
  const currentY = useRef(0);
  const startTime = useRef(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset drag position when selectedNode changes
  useEffect(() => {
    setDragOffsetY(0);
    setIsDragging(false);
    setIsExpanded(false);
    if (isMobile) {
      setViewMode('edit');
    }
  }, [selectedNode?.id, isMobile]);

  if (!selectedNode) return null;

  const { data } = selectedNode;
  const currentColor = data.color || 'purple';
  const currentShape = data.shape || 'pill';

  // Connections for current selected node
  const outgoingEdges = edges.filter((e) => e.source === selectedNode.id);
  const incomingEdges = edges.filter((e) => e.target === selectedNode.id);
  const candidateNodes = allNodes.filter(
    (n) => n.id !== selectedNode.id && !outgoingEdges.some((e) => e.target === n.id)
  );

  const insertTextAtCursor = (prefix: string, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = data.content || '';
    const selectedText = currentVal.substring(start, end);

    const replacement = prefix + selectedText + suffix;
    const newContent = currentVal.substring(0, start) + replacement + currentVal.substring(end);

    onUpdateNode(selectedNode.id, { content: newContent });

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            const attachId = `img-${Date.now()}`;
            onSaveAttachment(attachId, base64);
            insertTextAtCursor(`\n![Ảnh chụp](attachment:${attachId})\n`);
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const attachId = `img-${Date.now()}`;
        onSaveAttachment(attachId, base64);
        insertTextAtCursor(`\n![${file.name}](attachment:${attachId})\n`);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInsertLink = (e: React.FormEvent) => {
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

  // Styling container based on mobile vs desktop
  const containerClasses = isMobile
    ? 'fixed inset-x-0 bottom-0 bg-[#16161b]/98 backdrop-blur-2xl border-t border-[#363647] rounded-t-3xl shadow-[0_-12px_45px_rgba(0,0,0,0.85)] z-50 flex flex-col will-change-transform'
    : 'fixed top-0 right-0 h-full w-[500px] max-w-[95vw] bg-[#16161b]/98 backdrop-blur-xl border-l border-[#2e2e3a] shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-in-out select-text';

  return (
    <>
      {/* Nền mờ phía sau trên điện thoại */}
      {isMobile && (
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
          height: isMobile ? (isExpanded ? '96vh' : '86vh') : undefined,
          transform: isMobile ? `translateY(${dragOffsetY}px)` : undefined,
          transition: isDragging
            ? 'none'
            : 'transform 0.26s cubic-bezier(0.16, 1, 0.3, 1), height 0.26s cubic-bezier(0.16, 1, 0.3, 1)',
          paddingBottom: isMobile ? 'max(env(safe-area-inset-bottom, 0px), 16px)' : undefined,
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

        {/* Hidden file input for images */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageFileChange}
          accept="image/*"
          className="hidden"
        />

        {/* Top Header (Cũng có thể chạm kéo ở đây) */}
        <div
          onTouchStart={isMobile ? handleTouchStart : undefined}
          onTouchMove={isMobile ? handleTouchMove : undefined}
          onTouchEnd={isMobile ? handleTouchEnd : undefined}
          className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-[#2e2e3a] bg-[#1a1a22]/70 touch-none select-none"
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${COLOR_SCHEMES[currentColor].dot} shadow-[0_0_8px_currentColor]`}
            />
            <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">
              {isMobile ? 'Ghi chú' : 'Chi tiết ghi chú'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Syntax Handbook Button */}
            <button
              onClick={() => setShowHandbookModal(true)}
              title="Mở Sổ tay cú pháp (in đậm, đóng ô, công thức, link...)"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-xs font-semibold border border-purple-500/30 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Sổ tay</span>
            </button>

            <button
              onClick={() => {
                if (confirm('Bạn có chắc muốn xóa ô ghi chú này không?')) {
                  onDeleteNode(selectedNode.id);
                }
              }}
              title="Xóa nút này"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={handleDismiss}
              title="Đóng ghi chú"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              {isMobile ? <ChevronDown className="w-5 h-5 text-zinc-300" /> : <X className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Title & Metadata */}
        <div className="px-4 sm:px-5 py-3 space-y-3 border-b border-[#272733] bg-[#141419]/50">
          <div>
            <input
              type="text"
              value={data.label}
              onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
              placeholder="Tiêu đề ghi chú..."
              className="w-full bg-transparent text-base sm:text-lg font-bold text-white placeholder-zinc-500 border-none outline-none focus:ring-0 px-0"
            />
          </div>

          {/* Shape & Color Settings */}
          <div className="flex items-center justify-between gap-2 pt-0.5 overflow-x-auto">
            {/* Shape Picker */}
            <div className="flex items-center gap-1 bg-[#1c1c24] p-0.5 rounded-lg border border-zinc-800 text-[11px] shrink-0">
              {(['pill', 'circle', 'card'] as NodeShape[]).map((shape) => (
                <button
                  key={shape}
                  onClick={() => onUpdateNode(selectedNode.id, { shape })}
                  className={`px-2 py-1 rounded-md capitalize font-medium transition-colors ${
                    currentShape === shape
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {shape === 'pill' ? 'Thẻ' : shape === 'circle' ? 'Chấm' : 'Hộp'}
                </button>
              ))}
            </div>

            {/* Color Palette */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 pl-1">
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
        </div>

        {/* Quản lý liên kết các ô (Kết nối bằng 1 chạm, không cần kéo thả) */}
        <div className="px-4 sm:px-5 py-2 border-b border-[#272733] bg-[#16161f] space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowConnections(!showConnections)}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <Network className="w-3.5 h-3.5 text-purple-400" />
              <span>Liên kết ({outgoingEdges.length + incomingEdges.length})</span>
              {showConnections ? (
                <ChevronUp className="w-3 h-3 text-zinc-500" />
              ) : (
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              )}
            </button>

            {!showConnections && candidateNodes.length > 0 && onAddEdge && (
              <button
                type="button"
                onClick={() => setShowConnections(true)}
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Nối tới ô khác</span>
              </button>
            )}
          </div>

          {showConnections && (
            <div className="space-y-2 pt-1 animate-in fade-in duration-100">
              {/* Nối nhanh tới ô khác */}
              {candidateNodes.length > 0 && onAddEdge ? (
                <div className="flex items-center gap-2">
                  <select
                    value={targetConnectId}
                    onChange={(e) => setTargetConnectId(e.target.value)}
                    className="flex-1 bg-[#101016] border border-[#2e2e40] focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none truncate"
                  >
                    <option value="">-- Chọn ô muốn nối tới --</option>
                    {candidateNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.data.label || 'Chưa đặt tên'}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={!targetConnectId}
                    onClick={() => {
                      if (targetConnectId) {
                        onAddEdge(selectedNode.id, targetConnectId);
                        setTargetConnectId('');
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold text-xs transition-colors shrink-0 shadow-sm cursor-pointer disabled:cursor-not-allowed"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Nối ➔</span>
                  </button>
                </div>
              ) : (
                <div className="text-[11px] text-zinc-500 italic">
                  {allNodes.length <= 1
                    ? 'Bạn cần có ít nhất 2 ô trên sơ đồ để tạo liên kết.'
                    : 'Ô này đã được nối tới tất cả các ô khác.'}
                </div>
              )}

              {/* Danh sách các ô đang trỏ tới (Outgoing) */}
              {outgoingEdges.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">
                    Trỏ tới ({outgoingEdges.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {outgoingEdges.map((edge) => {
                      const targetNode = allNodes.find((n) => n.id === edge.target);
                      return (
                        <div
                          key={edge.id}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1e1e2d] border border-purple-500/30 text-xs text-zinc-200"
                        >
                          <ArrowRight className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                          <span
                            onClick={() => onSelectNodeById?.(edge.target)}
                            className="cursor-pointer hover:text-purple-300 font-medium truncate max-w-[120px]"
                            title="Bấm để chọn ô này"
                          >
                            {targetNode?.data.label || edge.target}
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeleteEdge?.(edge.id)}
                            title="Hủy liên kết"
                            className="text-zinc-500 hover:text-rose-400 p-0.5 ml-0.5 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Danh sách các ô trỏ vào ô này (Incoming) */}
              {incomingEdges.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">
                    Được trỏ từ ({incomingEdges.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {incomingEdges.map((edge) => {
                      const srcNode = allNodes.find((n) => n.id === edge.source);
                      return (
                        <div
                          key={edge.id}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1e1e2d] border border-cyan-500/30 text-xs text-zinc-200"
                        >
                          <ArrowLeft className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                          <span
                            onClick={() => onSelectNodeById?.(edge.source)}
                            className="cursor-pointer hover:text-cyan-300 font-medium truncate max-w-[120px]"
                            title="Bấm để chọn ô này"
                          >
                            {srcNode?.data.label || edge.source}
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeleteEdge?.(edge.id)}
                            title="Hủy liên kết"
                            className="text-zinc-500 hover:text-rose-400 p-0.5 ml-0.5 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {outgoingEdges.length === 0 && incomingEdges.length === 0 && (
                <div className="text-[11px] text-zinc-500 italic py-0.5">
                  Ô này chưa có mũi tên liên kết nào. Hãy chọn một ô ở trên để nối ngay!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Editor & Preview Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#272733] bg-[#181820] overflow-x-auto">
          {/* Formatting buttons */}
          <div className="flex items-center gap-1 flex-nowrap shrink-0">
            <button
              onClick={() => insertTextAtCursor('**', '**')}
              title="In đậm (Bold)"
              className="p-1.5 rounded text-zinc-300 hover:text-white bg-zinc-800/60 text-xs font-bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertTextAtCursor('*', '*')}
              title="In nghiêng (Italic)"
              className="p-1.5 rounded text-zinc-300 hover:text-white bg-zinc-800/60"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertTextAtCursor('# ')}
              title="Tiêu đề (H1)"
              className="p-1.5 rounded text-zinc-300 hover:text-white bg-zinc-800/60"
            >
              <Heading1 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertTextAtCursor('- ')}
              title="Danh sách gạch đầu dòng"
              className="p-1.5 rounded text-zinc-300 hover:text-white bg-zinc-800/60"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            
            {/* ĐÓNG Ô */}
            <button
              onClick={() => insertTextAtCursor('\n> 📌 **Ghi chú quan trọng:**\n> ')}
              title="Đóng ô / Khung điểm nhấn"
              className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-medium border border-amber-500/30"
            >
              <BoxSelect className="w-3.5 h-3.5" />
              <span>Đóng ô</span>
            </button>

            {/* CHÈN LINK GOOGLE DOCS / WEB */}
            <button
              onClick={() => setShowLinkModal(true)}
              title="Chèn liên kết Google Docs"
              className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 text-xs font-medium border border-blue-500/30"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Link</span>
            </button>

            {/* LaTeX menu button */}
            <div className="relative">
              <button
                onClick={() => setShowFormulaMenu(!showFormulaMenu)}
                title="Chèn công thức Toán"
                className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-xs font-semibold border border-purple-500/30"
              >
                <Sigma className="w-3.5 h-3.5" />
                <span>Toán</span>
              </button>

              {showFormulaMenu && (
                <div className="absolute left-0 top-8 w-48 bg-[#1f1f28] border border-zinc-700 rounded-lg shadow-xl py-1.5 z-50 text-xs text-zinc-300">
                  <button
                    onClick={() => {
                      insertTextAtCursor('$', '$');
                      setShowFormulaMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-purple-600/30 hover:text-white flex justify-between"
                  >
                    <span>Công thức dòng</span>
                    <code className="text-purple-400">$x$</code>
                  </button>
                  <button
                    onClick={() => {
                      insertTextAtCursor('\n$$\n', '\n$$\n');
                      setShowFormulaMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-purple-600/30 hover:text-white flex justify-between"
                  >
                    <span>Khối công thức</span>
                    <code className="text-purple-400">$$...$$</code>
                  </button>
                  <button
                    onClick={() => {
                      insertTextAtCursor('$$\\frac{a}{b}$$');
                      setShowFormulaMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-purple-600/30 hover:text-white flex justify-between"
                  >
                    <span>Phân số</span>
                    <code className="text-purple-400">\\frac{'{a}'}{'{b}'}</code>
                  </button>
                  <button
                    onClick={() => {
                      insertTextAtCursor('$$\\int_{a}^{b} f(x) dx$$');
                      setShowFormulaMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-purple-600/30 hover:text-white flex justify-between"
                  >
                    <span>Tích phân</span>
                    <code className="text-purple-400">\\int</code>
                  </button>
                </div>
              )}
            </div>

            {/* Upload image */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Chèn ảnh"
              className="p-1.5 rounded text-emerald-400 hover:bg-emerald-500/10 bg-zinc-800/60"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#121217] p-0.5 rounded-lg border border-zinc-800 text-xs shrink-0 ml-2">
            <button
              onClick={() => setViewMode('edit')}
              title="Soạn thảo"
              className={`p-1.5 rounded ${
                viewMode === 'edit' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            {!isMobile && (
              <button
                onClick={() => setViewMode('split')}
                title="Song song"
                className={`p-1.5 rounded ${
                  viewMode === 'split' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setViewMode('preview')}
              title="Xem trước"
              className={`p-1.5 rounded ${
                viewMode === 'preview' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Editor & Preview Area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-[#121216]">
          {/* EDIT ONLY */}
          {viewMode === 'edit' && (
            <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto">
              <textarea
                ref={textareaRef}
                value={data.content || ''}
                onChange={(e) => onUpdateNode(selectedNode.id, { content: e.target.value })}
                onPaste={handlePaste}
                placeholder="Gõ ghi chú tại đây... Hỗ trợ Markdown, $E = mc^2$, hoặc chụp ảnh rồi dán (Ctrl+V)."
                className="w-full h-full bg-transparent text-zinc-200 text-base sm:text-sm font-mono leading-relaxed resize-none outline-none focus:ring-0 placeholder-zinc-600"
              />
            </div>
          )}

          {/* PREVIEW ONLY */}
          {viewMode === 'preview' && (
            <div className="flex-1 p-4 sm:p-5 overflow-y-auto select-text">
              <MarkdownRenderer content={data.content || ''} attachments={attachments} />
            </div>
          )}

          {/* SPLIT VIEW (Desktop only) */}
          {viewMode === 'split' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="h-1/2 p-4 border-b border-[#252530] overflow-y-auto">
                <textarea
                  ref={textareaRef}
                  value={data.content || ''}
                  onChange={(e) => onUpdateNode(selectedNode.id, { content: e.target.value })}
                  onPaste={handlePaste}
                  placeholder="Gõ ghi chú tại đây... Dán ảnh bằng Ctrl+V."
                  className="w-full h-full bg-transparent text-zinc-200 text-sm font-mono leading-relaxed resize-none outline-none focus:ring-0 placeholder-zinc-600"
                />
              </div>
              <div className="h-1/2 p-4 overflow-y-auto bg-[#141419]/80 select-text">
                <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>Xem trước trực tiếp</span>
                </div>
                <MarkdownRenderer content={data.content || ''} attachments={attachments} />
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mini Modal Chèn Link Google Docs / Web (Responsive) */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181822] border border-[#2e2e3d] rounded-2xl w-full max-w-sm sm:max-w-md shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Chèn liên kết Google Docs</h3>
              </div>
              <button
                onClick={() => setShowLinkModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInsertLink} className="space-y-3">
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
                  className="w-full bg-[#121218] border border-zinc-700 rounded-lg px-3 py-2.5 text-base sm:text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-blue-500"
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
                  placeholder="https://docs.google.com/..."
                  className="w-full bg-[#121218] border border-zinc-700 rounded-lg px-3 py-2.5 text-base sm:text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-blue-600/30"
                >
                  Chèn link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sổ tay cú pháp Modal */}
      <SyntaxHandbookModal
        isOpen={showHandbookModal}
        onClose={() => setShowHandbookModal(false)}
        onInsertSyntax={(syntax) => insertTextAtCursor(syntax)}
      />
    </>
  );
};
