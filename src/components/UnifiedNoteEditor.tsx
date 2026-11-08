import React, { useState, useRef, useCallback, useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  Bold,
  Italic,
  Underline,
  Type,
  List,
  Indent,
  Outdent,
  Code2,
  Sigma,
  Image as ImageIcon,
  Link as LinkIcon,
  Sparkles,
  Maximize2,
  Minimize2,
  Play,
  ChevronDown,
  Palette,
} from 'lucide-react';

interface UnifiedNoteEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  attachments?: Record<string, string>;
  onSaveAttachment?: (id: string, base64: string) => void;
  onOpenLinkModal?: () => void;
  onToggleAiWriter?: () => void;
  showAiWriter?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isMobile?: boolean;
}

// Preset color styles for Code Boxes (Hộp mã CSS)
const CODE_BOX_PRESETS = [
  {
    name: 'Tím Neon',
    color: '#a855f7',
    css: 'background: rgba(147, 51, 234, 0.15); border: 1px solid #a855f7; border-radius: 12px; padding: 14px; color: #f3e8ff;',
    title: '📌 Ghi chú quan trọng',
  },
  {
    name: 'Xanh Ngọc',
    color: '#06b6d4',
    css: 'background: rgba(6, 182, 212, 0.15); border: 1px solid #06b6d4; border-radius: 12px; padding: 14px; color: #cffafe;',
    title: '💡 Điểm cốt lõi',
  },
  {
    name: 'Hổ Phách',
    color: '#f59e0b',
    css: 'background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; border-radius: 12px; padding: 14px; color: #fef3c7;',
    title: '⚠️ Lưu ý đặc biệt',
  },
  {
    name: 'Xanh Biển',
    color: '#3b82f6',
    css: 'background: rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6; border-radius: 12px; padding: 14px; color: #dbeafe;',
    title: '📘 Kiến thức mở rộng',
  },
  {
    name: 'Đỏ Hồng',
    color: '#f43f5e',
    css: 'background: rgba(244, 63, 94, 0.15); border: 1px solid #f43f5e; border-radius: 12px; padding: 14px; color: #ffe4e6;',
    title: '⛔ Chống chỉ định / Bệnh lý',
  },
];

export const UnifiedNoteEditor: React.FC<UnifiedNoteEditorProps> = ({
  content,
  onChange,
  onSaveAttachment,
  onOpenLinkModal,
  onToggleAiWriter,
  showAiWriter = false,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState(false);
  const [editingBoxIndex, setEditingBoxIndex] = useState<number | null>(null);
  const [tempBoxCode, setTempBoxCode] = useState('');

  // Chèn văn bản tại vị trí con trỏ
  const insertTextAtCursor = useCallback(
    (prefix: string, suffix = '', defaultText = '') => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end) || defaultText;
      const replacement = `${prefix}${selectedText}${suffix}`;

      const newContent =
        content.substring(0, start) + replacement + content.substring(end);
      onChange(newContent);

      setTimeout(() => {
        textarea.focus();
        const cursorPosition = start + prefix.length + selectedText.length;
        textarea.setSelectionRange(
          start + prefix.length,
          cursorPosition
        );
      }, 0);
    },
    [content, onChange]
  );

  // Định dạng in đậm (Bold)
  const handleBold = useCallback(() => {
    insertTextAtCursor('**', '**', 'chữ in đậm');
  }, [insertTextAtCursor]);

  // Định dạng in nghiêng (Italic)
  const handleItalic = useCallback(() => {
    insertTextAtCursor('*', '*', 'chữ in nghiêng');
  }, [insertTextAtCursor]);

  // Định dạng gạch chân (Underline)
  const handleUnderline = useCallback(() => {
    insertTextAtCursor('<u>', '</u>', 'chữ gạch chân');
  }, [insertTextAtCursor]);

  // Cỡ chữ (Heading 1, 2, 3 hoặc văn bản thường)
  const handleApplyHeading = useCallback(
    (level: 0 | 1 | 2 | 3) => {
      setFontSizeMenuOpen(false);
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const lines = content.split('\n');

      // Tìm dòng hiện tại của con trỏ
      let charCount = 0;
      let currentLineIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        const lineLen = lines[i].length + 1; // +1 cho dấu \n
        if (start >= charCount && start < charCount + lineLen) {
          currentLineIndex = i;
          break;
        }
        charCount += lineLen;
      }

      let currentLine = lines[currentLineIndex] || '';
      // Loại bỏ dấu # cũ
      currentLine = currentLine.replace(/^#+\s*/, '');

      if (level === 1) currentLine = `# ${currentLine}`;
      else if (level === 2) currentLine = `## ${currentLine}`;
      else if (level === 3) currentLine = `### ${currentLine}`;

      lines[currentLineIndex] = currentLine;
      onChange(lines.join('\n'));

      setTimeout(() => {
        textarea.focus();
      }, 0);
    },
    [content, onChange]
  );

  // Chấm đầu dòng (Bullet List)
  const handleBulletList = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lines = content.split('\n');

    let charCount = 0;
    let currentLineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLen = lines[i].length + 1;
      if (start >= charCount && start < charCount + lineLen) {
        currentLineIndex = i;
        break;
      }
      charCount += lineLen;
    }

    let currentLine = lines[currentLineIndex] || '';
    if (currentLine.trimStart().startsWith('- ')) {
      // Đã có gạch đầu dòng -> gỡ bỏ
      currentLine = currentLine.replace(/-\s+/, '');
    } else {
      // Thêm gạch đầu dòng giữ nguyên thụt lề hiện tại
      const indentMatch = currentLine.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      currentLine = `${indent}- ${currentLine.trimStart()}`;
    }

    lines[currentLineIndex] = currentLine;
    onChange(lines.join('\n'));

    setTimeout(() => {
      textarea.focus();
    }, 0);
  }, [content, onChange]);

  // Thụt đầu dòng (Indent: +2 spaces)
  const handleIndent = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lines = content.split('\n');

    let charCount = 0;
    let currentLineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLen = lines[i].length + 1;
      if (start >= charCount && start < charCount + lineLen) {
        currentLineIndex = i;
        break;
      }
      charCount += lineLen;
    }

    lines[currentLineIndex] = `  ${lines[currentLineIndex]}`;
    onChange(lines.join('\n'));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 2, start + 2);
    }, 0);
  }, [content, onChange]);

  // Lùi đầu dòng (Outdent: -2 spaces)
  const handleOutdent = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lines = content.split('\n');

    let charCount = 0;
    let currentLineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLen = lines[i].length + 1;
      if (start >= charCount && start < charCount + lineLen) {
        currentLineIndex = i;
        break;
      }
      charCount += lineLen;
    }

    let currentLine = lines[currentLineIndex];
    if (currentLine.startsWith('  ')) {
      lines[currentLineIndex] = currentLine.substring(2);
      onChange(lines.join('\n'));
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(Math.max(0, start - 2), Math.max(0, start - 2));
      }, 0);
    }
  }, [content, onChange]);

  // Chèn công thức Toán học
  const handleInsertMath = useCallback(() => {
    insertTextAtCursor('$', '$', 'E = mc^2');
  }, [insertTextAtCursor]);

  // Chèn Hộp mã (Code Box) mới
  const handleInsertCodeBox = useCallback(() => {
    const preset = CODE_BOX_PRESETS[0];
    const boxCode = `\n\`\`\`box\nstyle: ${preset.css}\ntitle: ${preset.title}\ncontent: Nhập nội dung chi tiết bên trong ô màu tại đây...\n\`\`\`\n`;
    insertTextAtCursor(boxCode);
  }, [insertTextAtCursor]);

  // Xử lý phím tắt (Ctrl+B, Ctrl+I, Ctrl+U, Tab, Shift+Tab)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (isCtrlOrCmd && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      handleBold();
    } else if (isCtrlOrCmd && (e.key === 'i' || e.key === 'I')) {
      e.preventDefault();
      handleItalic();
    } else if (isCtrlOrCmd && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      handleUnderline();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        handleOutdent();
      } else {
        handleIndent();
      }
    }
  };

  // Dán ảnh trực tiếp từ Clipboard (Ctrl+V)
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items || !onSaveAttachment) return;

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
            insertTextAtCursor(`\n![Ảnh dán](attachment:${attachId})\n`);
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  // Chọn file ảnh từ ổ cứng/thư viện ảnh
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onSaveAttachment) {
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

  // ==========================================
  // PHÂN TÍCH VÀ QUẢN LÝ CÁC "HỘP MÃ" (CODE BOXES)
  // ==========================================
  interface CodeBoxItem {
    id: number;
    raw: string;
    style: string;
    title: string;
    content: string;
    isHtmlDiv: boolean;
  }

  const codeBoxes = useMemo(() => {
    const boxes: CodeBoxItem[] = [];
    let idCounter = 0;

    // 1. Nhận diện khối ```box ... ```
    const boxBlockRegex = /```box\s*([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = boxBlockRegex.exec(content)) !== null) {
      const inner = match[1];
      const styleMatch = inner.match(/style:\s*([^\n]+)/);
      const titleMatch = inner.match(/title:\s*([^\n]+)/);
      const contentMatch = inner.match(/content:\s*([\s\S]+)/);

      boxes.push({
        id: idCounter++,
        raw: match[0],
        style: styleMatch ? styleMatch[1].trim() : CODE_BOX_PRESETS[0].css,
        title: titleMatch ? titleMatch[1].trim() : 'Ghi chú',
        content: contentMatch ? contentMatch[1].trim() : inner.trim(),
        isHtmlDiv: false,
      });
    }

    // 2. Nhận diện các thẻ <div style="...">...</div> kiểu cũ
    const htmlDivRegex = /<div\s+style="([^"]+)">([\s\S]*?)<\/div>/g;
    while ((match = htmlDivRegex.exec(content)) !== null) {
      boxes.push({
        id: idCounter++,
        raw: match[0],
        style: match[1],
        title: 'Ô màu tùy biến',
        content: match[2].trim(),
        isHtmlDiv: true,
      });
    }

    return boxes;
  }, [content]);

  // Bắt đầu sửa một Hộp mã
  const handleOpenEditBox = (box: CodeBoxItem) => {
    setEditingBoxIndex(box.id);
    setTempBoxCode(box.raw);
  };

  // Ấn nút "▶ Chạy mã" -> Áp dụng mã và hiển thị kết quả ô vuông màu
  const handleRunCodeBox = (originalBox: CodeBoxItem) => {
    if (tempBoxCode.trim()) {
      const newContent = content.replace(originalBox.raw, tempBoxCode.trim());
      onChange(newContent);
    }
    setEditingBoxIndex(null);
  };

  // Đổi preset màu cho Hộp mã đang sửa
  const handleApplyPresetToBox = (preset: typeof CODE_BOX_PRESETS[0]) => {
    setTempBoxCode(
      `\`\`\`box\nstyle: ${preset.css}\ntitle: ${preset.title}\ncontent: ${
        codeBoxes.find((b) => b.id === editingBoxIndex)?.content || 'Nội dung ô màu...'
      }\n\`\`\``
    );
  };

  // ==========================================
  // PHÂN TÍCH VÀ HIỂN THỊ TRỰC TIẾP TOÁN HỌC (KATEX)
  // ==========================================
  interface MathItem {
    raw: string;
    formula: string;
    isBlock: boolean;
  }

  const mathFormulas = useMemo(() => {
    const list: MathItem[] = [];
    const seen = new Set<string>();

    // Khối toán lớn $$...$$
    const blockRegex = /\$\$([\s\S]+?)\$\$/g;
    let m: RegExpExecArray | null;
    while ((m = blockRegex.exec(content)) !== null) {
      const formula = m[1].trim();
      if (!seen.has(formula)) {
        seen.add(formula);
        list.push({ raw: m[0], formula, isBlock: true });
      }
    }

    // Công thức toán dòng $...$
    const inlineRegex = /\$([^\$\n]+)\$/g;
    while ((m = inlineRegex.exec(content)) !== null) {
      const formula = m[1].trim();
      if (!seen.has(formula) && !m[0].startsWith('$$')) {
        seen.add(formula);
        list.push({ raw: m[0], formula, isBlock: false });
      }
    }

    return list;
  }, [content]);

  return (
    <div className={`flex flex-col h-full bg-[#121217] text-zinc-200 select-text ${isFullscreen ? 'max-w-4xl w-full mx-auto' : 'w-full'}`}>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* ==================================================== */}
      {/* THANH CÔNG CỤ SOẠN THẢO TRỰC QUAN (SINGLE TOOLBAR)  */}
      {/* ==================================================== */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#262635] bg-[#16161f] gap-1 overflow-x-auto max-w-full select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0">
        <div className="flex items-center gap-1 shrink-0">
          {/* CỠ CHỮ DROPDOWN */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setFontSizeMenuOpen(!fontSizeMenuOpen)}
              title="Chọn cỡ chữ / Tiêu đề"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#20202c] hover:bg-[#282838] text-xs font-semibold text-zinc-200 border border-zinc-700/60 transition-colors cursor-pointer"
            >
              <Type className="w-3.5 h-3.5 text-purple-400" />
              <span>Cỡ chữ</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {fontSizeMenuOpen && (
              <div className="absolute left-0 top-9 w-44 bg-[#1a1a24] border border-[#2e2e40] rounded-xl shadow-2xl p-1.5 z-50 text-xs space-y-0.5 animate-in fade-in duration-100">
                <button
                  type="button"
                  onClick={() => handleApplyHeading(1)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-600/25 hover:text-white font-bold text-sm text-zinc-100 flex items-center justify-between"
                >
                  <span>Tiêu đề lớn (H1)</span>
                  <span className="text-[10px] text-zinc-500 font-mono">#</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyHeading(2)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-600/25 hover:text-white font-semibold text-xs text-zinc-200 flex items-center justify-between"
                >
                  <span>Tiêu đề vừa (H2)</span>
                  <span className="text-[10px] text-zinc-500 font-mono">##</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyHeading(3)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-600/25 hover:text-white font-medium text-xs text-purple-300 flex items-center justify-between"
                >
                  <span>Tiêu đề nhỏ (H3)</span>
                  <span className="text-[10px] text-zinc-500 font-mono">###</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyHeading(0)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs border-t border-zinc-800 mt-1 pt-1"
                >
                  <span>Văn bản thường</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          {/* 3 ĐỊNH DẠNG CHỮ CƠ BẢN: IN ĐẬM, IN NGHIÊNG, GẠCH CHÂN */}
          <button
            type="button"
            onClick={handleBold}
            title="In đậm (Ctrl+B)"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white border border-transparent hover:border-zinc-700/60 transition-colors cursor-pointer"
          >
            <Bold className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleItalic}
            title="In nghiêng (Ctrl+I)"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white border border-transparent hover:border-zinc-700/60 transition-colors cursor-pointer"
          >
            <Italic className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleUnderline}
            title="Gạch chân (Ctrl+U)"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white border border-transparent hover:border-zinc-700/60 transition-colors cursor-pointer"
          >
            <Underline className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          {/* CHẤM ĐẦU DÒNG & THỤT ĐẦU DÒNG */}
          <button
            type="button"
            onClick={handleBulletList}
            title="Chấm đầu dòng danh sách (- )"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white border border-transparent hover:border-zinc-700/60 transition-colors cursor-pointer"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleIndent}
            title="Thụt đầu dòng vào trong (Tab)"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white border border-transparent hover:border-zinc-700/60 transition-colors cursor-pointer"
          >
            <Indent className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleOutdent}
            title="Lùi đầu dòng ra ngoài (Shift+Tab)"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white border border-transparent hover:border-zinc-700/60 transition-colors cursor-pointer"
          >
            <Outdent className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          {/* NÚT TOÁN HỌC (KATEX) */}
          <button
            type="button"
            onClick={handleInsertMath}
            title="Chèn công thức toán học ($...$)"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/30 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Sigma className="w-3.5 h-3.5" />
            <span>Toán</span>
          </button>

          {/* NÚT HỘP MÃ (CODE BOX / Ô VUÔNG MÀU CSS) */}
          <button
            type="button"
            onClick={handleInsertCodeBox}
            title="Chèn Hộp mã: viết CSS/Mã rồi ấn Chạy mã để hiện ra ô vuông màu chứa chữ"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-semibold transition-colors cursor-pointer shadow-sm"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Hộp mã</span>
          </button>

          {/* CHÈN ẢNH */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Chèn ảnh từ máy / điện thoại (hoặc dán Ctrl+V)"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-emerald-400 hover:text-emerald-300 border border-transparent hover:border-emerald-500/30 transition-colors cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          {/* CHÈN LINK */}
          {onOpenLinkModal && (
            <button
              type="button"
              onClick={onOpenLinkModal}
              title="Chèn liên kết nội bộ / liên kết web"
              className="p-1.5 rounded-lg hover:bg-[#252535] text-blue-400 hover:text-blue-300 border border-transparent hover:border-blue-500/30 transition-colors cursor-pointer"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* PHÍA PHẢI: AI VIẾT & TOÀN MÀN HÌNH */}
        <div className="flex items-center gap-1 shrink-0">
          {onToggleAiWriter && (
            <button
              type="button"
              onClick={onToggleAiWriter}
              title="Trợ lý AI viết & trau chuốt nội dung note"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                showAiWriter
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400 shadow-sm'
                  : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border-purple-500/30'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Viết</span>
            </button>
          )}

          {/* NÚT CHUYỂN CHẾ ĐỘ TOÀN MÀN HÌNH (ZEN MODE) */}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Thu nhỏ lại thanh bên' : 'Mở rộng toàn màn hình để viết tập trung'}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#20202c] hover:bg-[#282838] text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-medium transition-colors cursor-pointer"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Thu nhỏ</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden sm:inline">Toàn màn hình</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ==================================================== */}
      {/* KHÔNG GIAN SOẠN THẢO DUY NHẤT & HIỂN THỊ TRỰC TIẾP   */}
      {/* ==================================================== */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {/* KHUNG SOẠN THẢO VĂN BẢN CHÍNH */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Bắt đầu ghi chép tại đây... Hỗ trợ in đậm (Ctrl+B), gạch chân (Ctrl+U), in nghiêng (Ctrl+I), toán học $E=mc^2$ và Hộp mã màu sắc."
            rows={isFullscreen ? 18 : 12}
            className="w-full bg-[#15151c] border border-[#272738] focus:border-purple-500/60 rounded-xl p-4 text-zinc-100 text-sm font-sans leading-relaxed outline-none transition-colors resize-none placeholder-zinc-600 shadow-inner"
          />
        </div>

        {/* ==================================================== */}
        {/* HIỂN THỊ TRỰC TIẾP CÁC "HỘP MÃ" (KẾT QUẢ Ô VUÔNG MÀU CSS) */}
        {/* ==================================================== */}
        {codeBoxes.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                <span>Kết quả Hộp mã ({codeBoxes.length} ô màu)</span>
              </span>
              <span className="text-[11px] text-zinc-500 font-normal lowercase">
                (nhấp vào ô màu để mở hộp mã sửa)
              </span>
            </div>

            <div className="space-y-3">
              {codeBoxes.map((box) => {
                const isEditing = editingBoxIndex === box.id;

                if (isEditing) {
                  return (
                    <div
                      key={box.id}
                      className="p-3.5 rounded-xl bg-[#181824] border-2 border-purple-500/60 shadow-xl space-y-2.5 animate-in fade-in duration-150"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                          <Code2 className="w-4 h-4 text-purple-400" />
                          <span>Đang sửa Hộp mã #{box.id + 1}</span>
                        </div>

                        {/* Preset màu nhanh */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-zinc-500 mr-1 hidden sm:inline">Mẫu màu:</span>
                          {CODE_BOX_PRESETS.map((preset) => (
                            <button
                              key={preset.name}
                              type="button"
                              onClick={() => handleApplyPresetToBox(preset)}
                              title={preset.name}
                              className="w-4 h-4 rounded-full border border-white/20 transition-transform hover:scale-125"
                              style={{ backgroundColor: preset.color }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Khung sửa mã */}
                      <textarea
                        value={tempBoxCode}
                        onChange={(e) => setTempBoxCode(e.target.value)}
                        rows={5}
                        className="w-full bg-[#101016] border border-[#2e2e42] focus:border-purple-400 rounded-lg p-2.5 text-xs font-mono text-zinc-200 outline-none resize-none leading-relaxed"
                        placeholder="Nhập mã CSS, style, tiêu đề và nội dung..."
                      />

                      {/* NÚT CHẠY MÃ QUAN TRỌNG */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-zinc-400 italic">
                          Điền mã xong, ấn "Chạy mã" để cập nhật ô vuông màu
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingBoxIndex(null)}
                            className="px-2.5 py-1 rounded-lg text-xs text-zinc-400 hover:text-white"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRunCodeBox(box)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs shadow-lg shadow-amber-500/25 transition-transform hover:scale-[1.02] cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>▶ Chạy mã</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Chế độ hiển thị ô vuông màu kết quả
                return (
                  <div
                    key={box.id}
                    onClick={() => handleOpenEditBox(box)}
                    title="Nhấp vào để mở Hộp mã chỉnh sửa CSS và nội dung"
                    className="group relative cursor-pointer transition-all hover:scale-[1.008] active:scale-[0.998]"
                  >
                    {/* Render ô vuông màu theo CSS */}
                    <div
                      style={{
                        ...parseCssStringToReact(box.style),
                      }}
                      className="rounded-xl shadow-lg leading-relaxed relative overflow-hidden"
                    >
                      {/* Tiêu đề ô nếu có */}
                      {box.title && (
                        <div className="font-bold text-sm mb-1.5 flex items-center justify-between">
                          <span>{box.title}</span>
                          <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 px-2 py-0.5 rounded-full border border-white/20">
                            ✏️ Nhấn để sửa mã
                          </span>
                        </div>
                      )}
                      {/* Nội dung ô màu */}
                      <div className="text-xs sm:text-sm whitespace-pre-wrap">
                        {box.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* HIỂN THỊ TRỰC TIẾP CÁC ĐỊNH DẠNG TOÁN HỌC (KATEX)    */}
        {/* ==================================================== */}
        {mathFormulas.length > 0 && (
          <div className="space-y-2.5 pt-3 border-t border-[#232332]">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Sigma className="w-3.5 h-3.5 text-purple-400" />
                <span>Hiển thị trực tiếp Toán học ({mathFormulas.length} công thức)</span>
              </span>
              <span className="text-[11px] text-zinc-500 font-normal lowercase">
                (chuẩn LaTeX / KaTeX)
              </span>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {mathFormulas.map((item, idx) => {
                const renderedHtml = renderKaTeX(item.formula, item.isBlock);
                return (
                  <div
                    key={idx}
                    className="p-2 sm:px-3 sm:py-2 rounded-xl bg-[#171722] border border-purple-500/30 shadow-md text-zinc-100 flex items-center gap-2 max-w-full overflow-x-auto"
                  >
                    <span
                      dangerouslySetInnerHTML={{ __html: renderedHtml }}
                      className="text-sm select-text"
                    />
                    <span className="text-[10px] text-zinc-500 font-mono shrink-0 ml-1">
                      ${item.formula}$
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper: Chuyển chuỗi CSS inline dạng "background: ...; border: ...;" thành React CSSProperties
function parseCssStringToReact(cssString: string): React.CSSProperties {
  const styleObj: Record<string, string> = {};
  if (!cssString) return styleObj;

  const declarations = cssString.split(';');
  for (const decl of declarations) {
    const colonIndex = decl.indexOf(':');
    if (colonIndex > 0) {
      const prop = decl.substring(0, colonIndex).trim();
      const val = decl.substring(colonIndex + 1).trim();
      if (prop && val) {
        // camelCase conversion
        const camelProp = prop.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        styleObj[camelProp] = val;
      }
    }
  }

  // Fallback defaults
  if (!styleObj.padding) styleObj.padding = '14px';
  if (!styleObj.borderRadius) styleObj.borderRadius = '12px';
  if (!styleObj.backgroundColor && !styleObj.background) {
    styleObj.backgroundColor = 'rgba(147, 51, 234, 0.15)';
  }
  if (!styleObj.border) {
    styleObj.border = '1px solid #a855f7';
  }

  return styleObj as React.CSSProperties;
}

// KaTeX safe string renderer
function renderKaTeX(formula: string, displayMode = false): string {
  try {
    return katex.renderToString(formula.trim(), {
      displayMode,
      throwOnError: false,
    });
  } catch (err: unknown) {
    const e = err as Error;
    return `<span class="text-rose-400 font-mono text-xs">[Lỗi công thức: ${e.message}]</span>`;
  }
}
