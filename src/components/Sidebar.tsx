import React, { useState, useRef } from 'react';
import type { CustomNode, NodeColor, NodeShape } from '../types';
import { COLOR_SCHEMES } from '../constants/theme';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SyntaxHandbookModal } from './SyntaxHandbookModal';
import {
  X,
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
  Code,
  Sparkles,
  Link as LinkIcon,
  BoxSelect,
  BookOpen,
} from 'lucide-react';

interface SidebarProps {
  selectedNode: CustomNode | null;
  attachments?: Record<string, string>;
  onUpdateNode: (id: string, updates: Partial<CustomNode['data']>) => void;
  onDeleteNode: (id: string) => void;
  onClose: () => void;
  onSaveAttachment: (id: string, base64: string) => void;
}

type ViewMode = 'edit' | 'preview' | 'split';

export const Sidebar: React.FC<SidebarProps> = ({
  selectedNode,
  attachments = {},
  onUpdateNode,
  onDeleteNode,
  onClose,
  onSaveAttachment,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showFormulaMenu, setShowFormulaMenu] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showHandbookModal, setShowHandbookModal] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!selectedNode) return null;

  const { data } = selectedNode;
  const currentColor = data.color || 'purple';
  const currentShape = data.shape || 'pill';

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

  // Image Paste Handler: Clean Attachment ID without scary base64 wall of text
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
            insertTextAtCursor(`\n![Ảnh chụp] (attachment:${attachId})\n`.replace('] (', ']('));
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  // Image Upload Handler
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

  // Link Insertion Confirm
  const handleInsertLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    const title = linkTitle.trim() || 'Tài liệu liên kết';
    insertTextAtCursor(`[${title}](${linkUrl.trim()})`);
    setLinkTitle('');
    setLinkUrl('');
    setShowLinkModal(false);
  };

  return (
    <>
      <aside
        aria-label="Thanh bên ghi chú"
        className="fixed top-0 right-0 h-full w-[500px] max-w-[95vw] bg-[#16161b]/98 backdrop-blur-xl border-l border-[#2e2e3a] shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-in-out select-text"
      >
        {/* Hidden file input for images */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageFileChange}
          accept="image/*"
          className="hidden"
        />

        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2e2e3a] bg-[#1a1a22]/70">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${COLOR_SCHEMES[currentColor].dot} shadow-[0_0_8px_currentColor]`}
            />
            <span className="text-xs uppercase tracking-wider font-semibold text-zinc-400">
              Chi tiết ghi chú
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
              <span>Sổ tay cú pháp</span>
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
              onClick={onClose}
              title="Đóng thanh bên (Esc)"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Title & Metadata */}
        <div className="px-5 py-3.5 space-y-3 border-b border-[#272733] bg-[#141419]/50">
          <div>
            <input
              type="text"
              value={data.label}
              onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
              placeholder="Tiêu đề ghi chú..."
              className="w-full bg-transparent text-lg font-bold text-white placeholder-zinc-500 border-none outline-none focus:ring-0 px-0"
            />
          </div>

          {/* Shape & Color Settings */}
          <div className="flex items-center justify-between gap-4 pt-1">
            {/* Shape Picker */}
            <div className="flex items-center gap-1 bg-[#1c1c24] p-1 rounded-lg border border-zinc-800 text-xs">
              {(['pill', 'circle', 'card'] as NodeShape[]).map((shape) => (
                <button
                  key={shape}
                  onClick={() => onUpdateNode(selectedNode.id, { shape })}
                  className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                    currentShape === shape
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {shape === 'pill' ? 'Thẻ nhỏ' : shape === 'circle' ? 'Chấm tròn' : 'Thẻ rộng'}
                </button>
              ))}
            </div>

            {/* Color Palette */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {(Object.keys(COLOR_SCHEMES) as NodeColor[]).map((colorKey) => {
                const scheme = COLOR_SCHEMES[colorKey];
                const isSelected = currentColor === colorKey;
                return (
                  <button
                    key={colorKey}
                    onClick={() => onUpdateNode(selectedNode.id, { color: colorKey })}
                    title={scheme.name}
                    className={`w-5 h-5 rounded-full ${scheme.dot} transition-transform ${
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

        {/* Editor & Preview Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#272733] bg-[#181820]">
          {/* Formatting buttons */}
          <div className="flex items-center gap-0.5 flex-wrap">
            <button
              onClick={() => insertTextAtCursor('**', '**')}
              title="In đậm (Bold: **chữ**)"
              className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 text-xs font-bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertTextAtCursor('*', '*')}
              title="In nghiêng (Italic: *chữ*)"
              className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertTextAtCursor('# ')}
              title="Tiêu đề (H1: # Tiêu đề)"
              className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <Heading1 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertTextAtCursor('- ')}
              title="Danh sách gạch đầu dòng"
              className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            
            {/* ĐÓNG Ô / KHUNG GHI CHÚ */}
            <button
              onClick={() => insertTextAtCursor('\n> 📌 **Ghi chú quan trọng:**\n> ')}
              title="Đóng ô / Khung điểm nhấn (Callout box)"
              className="flex items-center gap-1 px-2 py-1 rounded text-amber-300 hover:bg-amber-500/20 text-xs font-medium border border-amber-500/30"
            >
              <BoxSelect className="w-3.5 h-3.5" />
              <span>Đóng ô</span>
            </button>

            {/* CHÈN LINK GOOGLE DOCS / WEB */}
            <button
              onClick={() => setShowLinkModal(true)}
              title="Chèn liên kết Google Docs hoặc Website"
              className="flex items-center gap-1 px-2 py-1 rounded text-blue-300 hover:bg-blue-500/20 text-xs font-medium border border-blue-500/30"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Chèn link</span>
            </button>

            {/* Code Block */}
            <button
              onClick={() => insertTextAtCursor('```\n', '\n```')}
              title="Khối mã nguồn (Code block)"
              className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <Code className="w-3.5 h-3.5" />
            </button>

            {/* Quick LaTeX menu button */}
            <div className="relative">
              <button
                onClick={() => setShowFormulaMenu(!showFormulaMenu)}
                title="Chèn công thức Toán (LaTeX)"
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
                  <button
                    onClick={() => {
                      insertTextAtCursor('$$\\sum_{i=1}^{n} x_i$$');
                      setShowFormulaMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-purple-600/30 hover:text-white flex justify-between"
                  >
                    <span>Tổng Sigma</span>
                    <code className="text-purple-400">\\sum</code>
                  </button>
                </div>
              )}
            </div>

            {/* Upload image */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Chèn ảnh từ file"
              className="p-1.5 rounded text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#121217] p-0.5 rounded-lg border border-zinc-800 text-xs shrink-0 ml-1">
            <button
              onClick={() => setViewMode('edit')}
              title="Chế độ soạn thảo"
              className={`p-1.5 rounded ${
                viewMode === 'edit' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('split')}
              title="Chế độ song song"
              className={`p-1.5 rounded ${
                viewMode === 'split' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('preview')}
              title="Chế độ xem trước"
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
            <div className="flex-1 p-4 overflow-y-auto">
              <textarea
                ref={textareaRef}
                value={data.content || ''}
                onChange={(e) => onUpdateNode(selectedNode.id, { content: e.target.value })}
                onPaste={handlePaste}
                placeholder="Gõ ghi chú tại đây... Hỗ trợ Markdown, $E = mc^2$, hoặc chụp ảnh rồi dán (Ctrl+V)."
                className="w-full h-full bg-transparent text-zinc-200 text-sm font-mono leading-relaxed resize-none outline-none focus:ring-0 placeholder-zinc-600"
              />
            </div>
          )}

          {/* PREVIEW ONLY */}
          {viewMode === 'preview' && (
            <div className="flex-1 p-5 overflow-y-auto select-text">
              <MarkdownRenderer content={data.content || ''} attachments={attachments} />
            </div>
          )}

          {/* SPLIT VIEW (Edit on Top, Live KaTeX/Markdown on Bottom) */}
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

        {/* Footer Info */}
        <div className="px-4 py-2 border-t border-[#252530] bg-[#15151c] flex items-center justify-between text-xs text-zinc-500">
          <span>Dán ảnh trực tiếp với <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">Ctrl + V</kbd></span>
          <span>Bấm <strong>Sổ tay cú pháp</strong> để xem thêm mẹo</span>
        </div>
      </aside>

      {/* Mini Modal Chèn Link Google Docs / Web */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181822] border border-[#2e2e3d] rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Chèn liên kết (Google Docs / Web)</h3>
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
                  Tên hiển thị liên kết
                </label>
                <input
                  type="text"
                  autoFocus
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Ví dụ: Google Docs Bài Giảng Chương 1"
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
                  placeholder="https://docs.google.com/document/d/.../edit"
                  className="w-full bg-[#121218] border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-blue-500 font-mono"
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
