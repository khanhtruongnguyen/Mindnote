import React, { useState, useRef, useEffect, useCallback } from 'react';
import 'katex/dist/katex.min.css';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Type,
  List,
  ListOrdered,
  CheckSquare,
  Indent,
  Outdent,
  Sigma,
  Image as ImageIcon,
  Link as LinkIcon,
  Sparkles,
  Maximize2,
  Minimize2,
  Play,
  ChevronDown,
  Palette,
  Highlighter,
  Table as TableIcon,
  Quote,
  SquarePlus,
  Code2,
  Trash2,
  Plus,
  Minus,
  CornerDownLeft,
  X,
  FileCode2,
  Eye,
} from 'lucide-react';
import {
  CODE_BOX_PRESETS,
  markdownToHtml,
  htmlToMarkdown,
  renderKaTeXSafe,
  looksLikeMarkdown,
  escapeAttr,
  escapeHtml,
} from '../utils/markdownCodec';

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

const TEXT_COLORS = [
  { name: 'Mặc định', value: '' },
  { name: 'Trắng sáng', value: '#ffffff' },
  { name: 'Đỏ san hô', value: '#fb7185' },
  { name: 'Cam hổ phách', value: '#fbbf24' },
  { name: 'Xanh lục', value: '#34d399' },
  { name: 'Xanh ngọc', value: '#22d3ee' },
  { name: 'Xanh dương', value: '#60a5fa' },
  { name: 'Tím Lavender', value: '#c084fc' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Bỏ tô sáng', value: '' },
  { name: 'Vàng dạ quang', value: 'rgba(250, 204, 21, 0.32)', text: '#fef08a' },
  { name: 'Xanh lá dạ quang', value: 'rgba(16, 185, 129, 0.3)', text: '#a7f3d0' },
  { name: 'Xanh ngọc dạ quang', value: 'rgba(6, 182, 212, 0.3)', text: '#a5f3fc' },
  { name: 'Hồng dạ quang', value: 'rgba(244, 63, 94, 0.32)', text: '#fecdd3' },
  { name: 'Tím dạ quang', value: 'rgba(168, 85, 247, 0.34)', text: '#e9d5ff' },
];

const QUICK_MATH_SYMBOLS = [
  { label: '→', latex: '\\rightarrow', tip: 'Mũi tên suy ra' },
  { label: '⇒', latex: '\\Rightarrow', tip: 'Suy ra kép' },
  { label: '⇌', latex: '\\rightleftharpoons', tip: 'Cân bằng thuận nghịch' },
  { label: '↑', latex: '\\uparrow', tip: 'Tăng lên' },
  { label: '↓', latex: '\\downarrow', tip: 'Giảm xuống' },
  { label: '≈', latex: '\\approx', tip: 'Xấp xỉ bằng' },
  { label: '±', latex: '\\pm', tip: 'Cộng trừ' },
  { label: '≤', latex: '\\le', tip: 'Nhỏ hơn hoặc bằng' },
  { label: '≥', latex: '\\ge', tip: 'Lớn hơn hoặc bằng' },
  { label: '≠', latex: '\\ne', tip: 'Khác' },
  { label: '×', latex: '\\times', tip: 'Nhân' },
  { label: '∞', latex: '\\infty', tip: 'Vô cực' },
  { label: 'μ', latex: '\\mu', tip: 'Micro (μ)' },
  { label: 'α', latex: '\\alpha', tip: 'Alpha' },
  { label: 'β', latex: '\\beta', tip: 'Beta' },
  { label: 'Δ', latex: '\\Delta', tip: 'Delta (Biến thiên)' },
  { label: 'a/b', latex: '\\frac{a}{b}', tip: 'Phân số' },
  { label: 'x²', latex: 'x^{2}', tip: 'Số mũ' },
  { label: 'x₁', latex: 'x_{1}', tip: 'Chỉ số dưới' },
  { label: '√x', latex: '\\sqrt{x}', tip: 'Căn bậc hai' },
  { label: '∑', latex: '\\sum_{i=1}^{n}', tip: 'Tổng sigma' },
  { label: '∫', latex: '\\int_{a}^{b}', tip: 'Tích phân' },
  { label: 'mg/dL', latex: '\\text{ mg/dL}', tip: 'Đơn vị mg/dL' },
  { label: 'μM', latex: '\\ \\mu\\text{M}', tip: 'Đơn vị μM' },
];

export const UnifiedNoteEditor: React.FC<UnifiedNoteEditorProps> = ({
  content,
  onChange,
  attachments = {},
  onSaveAttachment,
  onOpenLinkModal,
  onToggleAiWriter,
  showAiWriter = false,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const lastEmittedContentRef = useRef<string>(content);
  const lastAttachmentsCountRef = useRef<number>(Object.keys(attachments).length);
  const isComposingRef = useRef<boolean>(false);

  // Menus & Modals
  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [boxMenuOpen, setBoxMenuOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);

  // Math Editor Popover State
  const [mathModalOpen, setMathModalOpen] = useState(false);
  const [mathLatex, setMathLatex] = useState('');
  const [mathIsBlock, setMathIsBlock] = useState(false);
  const [editingMathEl, setEditingMathEl] = useState<HTMLElement | null>(null);

  // Active Contextual Elements (Callout Box or Table currently focused)
  const [activeCalloutEl, setActiveCalloutEl] = useState<HTMLElement | null>(null);
  const [activeTableEl, setActiveTableEl] = useState<HTMLTableElement | null>(null);
  const [activeCellEl, setActiveCellEl] = useState<HTMLTableCellElement | null>(null);

  // Custom CSS Code Editor for Callout Box
  const [cssEditorOpen, setCssEditorOpen] = useState(false);
  const [customBoxCss, setCustomBoxCss] = useState('');
  const [customBoxTitle, setCustomBoxTitle] = useState('');

  // Emit DOM changes to Markdown
  const emitChanges = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const md = htmlToMarkdown(el);
    lastEmittedContentRef.current = md;
    const isEmpty = !md || md.trim().length === 0;
    el.setAttribute('data-empty', isEmpty ? 'true' : 'false');
    onChange(md);
  }, [onChange]);

  // Initial mount & external content sync (e.g. node switch, AI Writer update, attachments loaded)
  useEffect(() => {
    if (sourceMode) return;
    const el = editorRef.current;
    if (!el) return;

    const attachmentsCount = Object.keys(attachments).length;
    const contentChangedExternally = content !== lastEmittedContentRef.current;
    const attachmentsChanged = attachmentsCount !== lastAttachmentsCountRef.current;

    if (contentChangedExternally || attachmentsChanged || !el.innerHTML) {
      el.innerHTML = markdownToHtml(content, attachments);
      const isEmpty = !content || content.trim().length === 0;
      el.setAttribute('data-empty', isEmpty ? 'true' : 'false');
      lastEmittedContentRef.current = content;
      lastAttachmentsCountRef.current = attachmentsCount;
    }
  }, [content, attachments, sourceMode]);

  // Save current selection range inside editor
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();

      // Detect if cursor is inside a Callout Box or Table
      const targetNode =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as HTMLElement)
          : range.commonAncestorContainer.parentElement;

      const callout = targetNode?.closest('.mn-callout-box') as HTMLElement | null;
      setActiveCalloutEl(callout);

      const table = targetNode?.closest('table') as HTMLTableElement | null;
      const cell = targetNode?.closest('td, th') as HTMLTableCellElement | null;
      setActiveTableEl(table);
      setActiveCellEl(cell);
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    if (savedRangeRef.current) {
      try {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        }
      } catch {
        // Ignore stale range
      }
    }
  }, []);

  // Insert HTML snippet at current cursor
  const insertHtmlAtCursor = useCallback(
    (htmlString: string) => {
      restoreSelection();
      document.execCommand('insertHTML', false, htmlString);
      emitChanges();
      saveSelection();
    },
    [restoreSelection, emitChanges, saveSelection]
  );

  // Standard Rich Text Commands (Bold, Italic, Underline, Strikethrough)
  const execFormat = useCallback(
    (command: string, value?: string) => {
      restoreSelection();
      document.execCommand(command, false, value);
      emitChanges();
      saveSelection();
    },
    [restoreSelection, emitChanges, saveSelection]
  );

  // Heading / Block Format
  const handleApplyBlock = useCallback(
    (tag: 'P' | 'H1' | 'H2' | 'H3' | 'H4' | 'BLOCKQUOTE') => {
      setHeadingMenuOpen(false);
      restoreSelection();
      document.execCommand('formatBlock', false, `<${tag}>`);
      emitChanges();
      saveSelection();
    },
    [restoreSelection, emitChanges, saveSelection]
  );

  // Apply Text Color
  const handleTextColor = useCallback(
    (color: string) => {
      setColorMenuOpen(false);
      restoreSelection();
      if (!color) {
        document.execCommand('removeFormat', false);
      } else {
        document.execCommand('foreColor', false, color);
      }
      emitChanges();
    },
    [restoreSelection, emitChanges]
  );

  // Apply Highlight (Bút dạ quang)
  const handleHighlight = useCallback(
    (bgColor: string, textColor?: string) => {
      setColorMenuOpen(false);
      restoreSelection();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const selectedText = sel.toString();
      if (!selectedText) return;

      if (!bgColor) {
        document.execCommand('insertText', false, selectedText);
      } else {
        const styleStr = `background: ${bgColor};${textColor ? ` color: ${textColor};` : ''} padding: 1px 5px; border-radius: 4px;`;
        document.execCommand(
          'insertHTML',
          false,
          `<mark style="${escapeAttr(styleStr)}">${escapeHtml(selectedText)}</mark>`
        );
      }
      emitChanges();
    },
    [restoreSelection, emitChanges]
  );

  // Insert Task Checkbox Item
  const handleInsertTaskList = useCallback(() => {
    insertHtmlAtCursor(
      `<ul class="mn-list mn-list-ul"><li class="mn-task-item" data-task="false"><input type="checkbox" class="mn-task-checkbox" contenteditable="false" /><span class="mn-li-content">Mục cần làm...</span></li></ul>`
    );
  }, [insertHtmlAtCursor]);

  // Insert Callout / Colored Box directly in document flow
  const handleInsertCalloutBox = useCallback(
    (preset = CODE_BOX_PRESETS[0]) => {
      setBoxMenuOpen(false);
      const html =
        `<div class="mn-callout-box" data-box-kind="box" data-box-style="${escapeAttr(preset.css)}" style="${escapeAttr(preset.css)}">` +
        `<div class="mn-callout-header">` +
        `<div class="mn-callout-title" contenteditable="true">${escapeHtml(preset.title)}</div>` +
        `</div>` +
        `<div class="mn-callout-body" contenteditable="true"><p>Nhập nội dung ghi chú tại đây...</p></div>` +
        `</div><p><br></p>`;
      insertHtmlAtCursor(html);
    },
    [insertHtmlAtCursor]
  );

  // Insert Table directly in document flow
  const handleInsertTable = useCallback(() => {
    const html =
      `<div class="mn-table-wrapper"><table class="mn-table">` +
      `<thead><tr><th>Tiêu đề 1</th><th>Tiêu đề 2</th><th>Tiêu đề 3</th></tr></thead>` +
      `<tbody>` +
      `<tr><td>Nội dung 1</td><td>Nội dung 2</td><td>Nội dung 3</td></tr>` +
      `<tr><td><br></td><td><br></td><td><br></td></tr>` +
      `</tbody></table></div><p><br></p>`;
    insertHtmlAtCursor(html);
  }, [insertHtmlAtCursor]);

  // Open Math Modal (for new formula or editing existing formula)
  const handleOpenNewMath = useCallback(() => {
    saveSelection();
    const sel = window.getSelection();
    const selectedText = sel?.toString().trim() || '';
    setEditingMathEl(null);
    setMathLatex(selectedText || '\\approx 5,8\\text{ mg/dL}');
    setMathIsBlock(false);
    setMathModalOpen(true);
  }, [saveSelection]);

  const handleSaveMath = useCallback(() => {
    const clean = mathLatex.trim();
    if (!clean) {
      if (editingMathEl) {
        editingMathEl.remove();
        emitChanges();
      }
      setMathModalOpen(false);
      return;
    }

    const katexHtml = renderKaTeXSafe(clean, mathIsBlock);

    if (editingMathEl && editorRef.current?.contains(editingMathEl)) {
      // Replace existing math node in place
      const wrapper = document.createElement('div');
      if (mathIsBlock) {
        wrapper.innerHTML = `<div class="mn-math-block" contenteditable="false" data-latex="${escapeAttr(clean)}" title="Nhấp để sửa công thức toán học">${katexHtml}</div>`;
      } else {
        wrapper.innerHTML = `<span class="mn-math-inline" contenteditable="false" data-latex="${escapeAttr(clean)}" title="Nhấp để sửa công thức: ${escapeAttr(clean)}">${katexHtml}</span>`;
      }
      const newNode = wrapper.firstElementChild;
      if (newNode) {
        editingMathEl.replaceWith(newNode);
      }
      emitChanges();
    } else {
      // Insert new math node at cursor
      if (mathIsBlock) {
        insertHtmlAtCursor(
          `<div class="mn-math-block" contenteditable="false" data-latex="${escapeAttr(clean)}" title="Nhấp để sửa công thức toán học">${katexHtml}</div><p><br></p>`
        );
      } else {
        insertHtmlAtCursor(
          `<span class="mn-math-inline" contenteditable="false" data-latex="${escapeAttr(clean)}" title="Nhấp để sửa công thức: ${escapeAttr(clean)}">${katexHtml}</span>&nbsp;`
        );
      }
    }

    setMathModalOpen(false);
    setEditingMathEl(null);
  }, [mathLatex, mathIsBlock, editingMathEl, emitChanges, insertHtmlAtCursor]);

  // Callout Box contextual actions
  const handleChangeActiveBoxPreset = useCallback(
    (preset: (typeof CODE_BOX_PRESETS)[0]) => {
      if (!activeCalloutEl) return;
      activeCalloutEl.setAttribute('data-box-style', preset.css);
      activeCalloutEl.setAttribute('style', preset.css);
      emitChanges();
    },
    [activeCalloutEl, emitChanges]
  );

  const handleOpenCssEditorForActiveBox = useCallback(() => {
    if (!activeCalloutEl) return;
    const style = activeCalloutEl.getAttribute('data-box-style') || activeCalloutEl.getAttribute('style') || CODE_BOX_PRESETS[0].css;
    const titleEl = activeCalloutEl.querySelector('.mn-callout-title');
    setCustomBoxCss(style);
    setCustomBoxTitle(titleEl?.textContent || '📌 Ghi chú');
    setCssEditorOpen(true);
  }, [activeCalloutEl]);

  const handleRunCustomBoxCss = useCallback(() => {
    if (!activeCalloutEl) return;
    activeCalloutEl.setAttribute('data-box-style', customBoxCss.trim());
    activeCalloutEl.setAttribute('style', customBoxCss.trim());
    const titleEl = activeCalloutEl.querySelector('.mn-callout-title');
    if (titleEl && customBoxTitle.trim()) {
      titleEl.textContent = customBoxTitle.trim();
    }
    setCssEditorOpen(false);
    emitChanges();
  }, [activeCalloutEl, customBoxCss, customBoxTitle, emitChanges]);

  const handleAddParagraphAfterBox = useCallback(() => {
    if (!activeCalloutEl) return;
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    activeCalloutEl.insertAdjacentElement('afterend', p);
    const range = document.createRange();
    range.setStart(p, 0);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    setActiveCalloutEl(null);
    emitChanges();
  }, [activeCalloutEl, emitChanges]);

  const handleDeleteActiveBox = useCallback(() => {
    if (!activeCalloutEl) return;
    activeCalloutEl.remove();
    setActiveCalloutEl(null);
    emitChanges();
  }, [activeCalloutEl, emitChanges]);

  // Table contextual actions
  const handleTableAddRow = useCallback(() => {
    if (!activeTableEl) return;
    const tbody = activeTableEl.querySelector('tbody') || activeTableEl;
    const currentRow = activeCellEl?.closest('tr');
    const colCount = activeTableEl.querySelector('tr')?.children.length || 3;
    const newRow = document.createElement('tr');
    for (let c = 0; c < colCount; c++) {
      const td = document.createElement('td');
      td.innerHTML = '<br>';
      newRow.appendChild(td);
    }
    if (currentRow && currentRow.parentElement === tbody) {
      currentRow.insertAdjacentElement('afterend', newRow);
    } else {
      tbody.appendChild(newRow);
    }
    emitChanges();
  }, [activeTableEl, activeCellEl, emitChanges]);

  const handleTableAddCol = useCallback(() => {
    if (!activeTableEl) return;
    const rows = Array.from(activeTableEl.querySelectorAll('tr'));
    rows.forEach((tr, idx) => {
      const cell = document.createElement(idx === 0 && tr.parentElement?.tagName === 'THEAD' ? 'th' : 'td');
      cell.innerHTML = idx === 0 ? 'Cột mới' : '<br>';
      tr.appendChild(cell);
    });
    emitChanges();
  }, [activeTableEl, emitChanges]);

  const handleTableDeleteRow = useCallback(() => {
    if (!activeTableEl || !activeCellEl) return;
    const tr = activeCellEl.closest('tr');
    if (!tr) return;
    const allRows = activeTableEl.querySelectorAll('tr');
    if (allRows.length <= 1) {
      activeTableEl.closest('.mn-table-wrapper')?.remove();
      setActiveTableEl(null);
    } else {
      tr.remove();
    }
    emitChanges();
  }, [activeTableEl, activeCellEl, emitChanges]);

  const handleTableDeleteCol = useCallback(() => {
    if (!activeTableEl || !activeCellEl) return;
    const tr = activeCellEl.closest('tr');
    if (!tr) return;
    const colIdx = Array.from(tr.children).indexOf(activeCellEl);
    if (colIdx < 0) return;
    const rows = Array.from(activeTableEl.querySelectorAll('tr'));
    if ((rows[0]?.children.length || 0) <= 1) {
      activeTableEl.closest('.mn-table-wrapper')?.remove();
      setActiveTableEl(null);
    } else {
      rows.forEach((r) => r.children[colIdx]?.remove());
    }
    emitChanges();
  }, [activeTableEl, activeCellEl, emitChanges]);

  const handleTableDelete = useCallback(() => {
    if (!activeTableEl) return;
    const wrapper = activeTableEl.closest('.mn-table-wrapper') || activeTableEl;
    wrapper.remove();
    setActiveTableEl(null);
    setActiveCellEl(null);
    emitChanges();
  }, [activeTableEl, emitChanges]);

  // Handle clicks inside the WYSIWYG surface (Math widgets, Checkboxes, Internal Links)
  const handleEditorClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      // 1. Clicked on Task Checkbox
      if (target.classList.contains('mn-task-checkbox')) {
        const checkbox = target as HTMLInputElement;
        const li = checkbox.closest('li.mn-task-item');
        if (li) {
          li.setAttribute('data-task', checkbox.checked ? 'true' : 'false');
          emitChanges();
        }
        return;
      }

      // 2. Clicked on Inline or Block Math -> Open Math Popover Editor
      const mathEl = target.closest('.mn-math-inline, .mn-math-block') as HTMLElement | null;
      if (mathEl) {
        e.preventDefault();
        e.stopPropagation();
        const latex = mathEl.getAttribute('data-latex') || '';
        const isBlock = mathEl.classList.contains('mn-math-block');
        setEditingMathEl(mathEl);
        setMathLatex(latex);
        setMathIsBlock(isBlock);
        setMathModalOpen(true);
        return;
      }

      // 3. Clicked on Internal Wiki-Link -> Navigate to node on Mindmap
      const wikiLink = target.closest('a.mn-wiki-link') as HTMLAnchorElement | null;
      if (wikiLink) {
        e.preventDefault();
        e.stopPropagation();
        const targetId =
          wikiLink.getAttribute('data-target') ||
          wikiLink.getAttribute('data-href')?.replace(/^node:/, '').replace(/^#/, '') ||
          '';
        if (targetId) {
          window.dispatchEvent(
            new CustomEvent('canvas-navigate', {
              detail: { noteId: decodeURIComponent(targetId) },
            })
          );
        }
        return;
      }

      // 4. Clicked on External Link with Ctrl/Cmd
      const extLink = target.closest('a.mn-ext-link') as HTMLAnchorElement | null;
      if (extLink && (e.ctrlKey || e.metaKey)) {
        window.open(extLink.href, '_blank', 'noopener,noreferrer');
        return;
      }

      saveSelection();
    },
    [emitChanges, saveSelection]
  );

  // Smart Keyboard Shortcuts & Auto-Markdown / Smart Symbols
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isComposingRef.current) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Formatting shortcuts
      if (isCtrlOrCmd && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        execFormat('bold');
        return;
      }
      if (isCtrlOrCmd && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        execFormat('italic');
        return;
      }
      if (isCtrlOrCmd && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        execFormat('underline');
        return;
      }
      if (isCtrlOrCmd && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        handleOpenNewMath();
        return;
      }

      // Tab / Shift+Tab for Lists, Tables, and Indentation
      if (e.key === 'Tab') {
        e.preventDefault();
        const sel = window.getSelection();
        const anchorEl =
          sel?.anchorNode?.nodeType === Node.ELEMENT_NODE
            ? (sel.anchorNode as HTMLElement)
            : sel?.anchorNode?.parentElement;

        // Inside Table: jump to next/prev cell
        const cell = anchorEl?.closest('td, th') as HTMLTableCellElement | null;
        if (cell) {
          const table = cell.closest('table');
          if (table) {
            const cells = Array.from(table.querySelectorAll('th, td'));
            const idx = cells.indexOf(cell);
            const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
            if (nextIdx >= 0 && nextIdx < cells.length) {
              const targetCell = cells[nextIdx] as HTMLElement;
              targetCell.focus();
              const range = document.createRange();
              range.selectNodeContents(targetCell);
              range.collapse(false);
              sel?.removeAllRanges();
              sel?.addRange(range);
              return;
            }
          }
        }

        // Inside List or General Text: Indent / Outdent
        if (e.shiftKey) {
          document.execCommand('outdent', false);
        } else {
          const inList = Boolean(anchorEl?.closest('li'));
          if (inList) {
            document.execCommand('indent', false);
          } else {
            document.execCommand('insertText', false, '    ');
          }
        }
        emitChanges();
        return;
      }

      // Auto-Markdown & Smart Symbol replacements on Space
      if (e.key === ' ') {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed && sel.anchorNode?.nodeType === Node.TEXT_NODE) {
          const textNode = sel.anchorNode as Text;
          const offset = sel.anchorOffset;
          const textBefore = textNode.textContent?.slice(0, offset) || '';

          // 1. Block-level Markdown triggers at start of line
          const blockEl = textNode.parentElement?.closest('p, div');
          const isAtBlockStart = blockEl && blockEl.textContent?.slice(0, offset) === textBefore;

          const replacePrefixAndExec = (prefixLen: number, cmd: () => void) => {
            e.preventDefault();
            const range = document.createRange();
            range.setStart(textNode, 0);
            range.setEnd(textNode, prefixLen);
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand('delete', false);
            cmd();
            emitChanges();
          };

          if (isAtBlockStart) {
            if (textBefore === '#') {
              replacePrefixAndExec(1, () => document.execCommand('formatBlock', false, '<H1>'));
              return;
            }
            if (textBefore === '##') {
              replacePrefixAndExec(2, () => document.execCommand('formatBlock', false, '<H2>'));
              return;
            }
            if (textBefore === '###') {
              replacePrefixAndExec(3, () => document.execCommand('formatBlock', false, '<H3>'));
              return;
            }
            if (textBefore === '####') {
              replacePrefixAndExec(4, () => document.execCommand('formatBlock', false, '<H4>'));
              return;
            }
            if (textBefore === '-' || textBefore === '*') {
              replacePrefixAndExec(1, () => document.execCommand('insertUnorderedList', false));
              return;
            }
            if (textBefore === '1.') {
              replacePrefixAndExec(2, () => document.execCommand('insertOrderedList', false));
              return;
            }
            if (textBefore === '>') {
              replacePrefixAndExec(1, () => document.execCommand('formatBlock', false, '<BLOCKQUOTE>'));
              return;
            }
          }

          // 2. Smart inline symbol replacements (e.g. -> to →, => to ⇒, <-> to ↔)
          const symbolRules: Array<{ suffix: string; replacement: string }> = [
            { suffix: '<->', replacement: '↔ ' },
            { suffix: '->', replacement: '→ ' },
            { suffix: '=>', replacement: '⇒ ' },
            { suffix: '>=', replacement: '≥ ' },
            { suffix: '<=', replacement: '≤ ' },
            { suffix: '+-', replacement: '± ' },
            { suffix: '~=', replacement: '≈ ' },
          ];

          for (const rule of symbolRules) {
            if (textBefore.endsWith(rule.suffix)) {
              e.preventDefault();
              const range = document.createRange();
              range.setStart(textNode, offset - rule.suffix.length);
              range.setEnd(textNode, offset);
              sel.removeAllRanges();
              sel.addRange(range);
              document.execCommand('insertText', false, rule.replacement);
              emitChanges();
              return;
            }
          }

          // 3. Live inline math $...$ conversion when pressing space after closing $
          const inlineMathMatch = textBefore.match(/\$([^$\n]+)\$$/);
          if (inlineMathMatch) {
            e.preventDefault();
            const fullMatch = inlineMathMatch[0];
            const formula = inlineMathMatch[1].trim();
            const range = document.createRange();
            range.setStart(textNode, offset - fullMatch.length);
            range.setEnd(textNode, offset);
            sel.removeAllRanges();
            sel.addRange(range);
            const katexHtml = renderKaTeXSafe(formula, false);
            document.execCommand(
              'insertHTML',
              false,
              `<span class="mn-math-inline" contenteditable="false" data-latex="${escapeAttr(formula)}" title="Nhấp để sửa công thức: ${escapeAttr(formula)}">${katexHtml}</span>&nbsp;`
            );
            emitChanges();
            return;
          }
        }
      }
    },
    [execFormat, handleOpenNewMath, emitChanges]
  );

  // Smart Paste: Handles pasted images AND auto-formats pasted Markdown/LaTeX from AI/Notes
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = e.clipboardData?.items;
      if (items && onSaveAttachment) {
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
                insertHtmlAtCursor(
                  `<span class="mn-image-widget" contenteditable="false" data-raw-src="attachment:${attachId}" data-alt="Ảnh dán"><img src="${escapeAttr(base64)}" alt="Ảnh dán" class="mn-editor-img" /></span><p><br></p>`
                );
              };
              reader.readAsDataURL(file);
            }
            return;
          }
        }
      }

      const plainText = e.clipboardData?.getData('text/plain') || '';
      if (plainText && looksLikeMarkdown(plainText)) {
        e.preventDefault();
        const convertedHtml = markdownToHtml(plainText, attachments);
        document.execCommand('insertHTML', false, convertedHtml);
        emitChanges();
      }
    },
    [onSaveAttachment, attachments, insertHtmlAtCursor, emitChanges]
  );

  // Upload Image from disk
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onSaveAttachment) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const attachId = `img-${Date.now()}`;
        onSaveAttachment(attachId, base64);
        insertHtmlAtCursor(
          `<span class="mn-image-widget" contenteditable="false" data-raw-src="attachment:${attachId}" data-alt="${escapeAttr(file.name)}"><img src="${escapeAttr(base64)}" alt="${escapeAttr(file.name)}" class="mn-editor-img" /><span class="mn-img-caption">${escapeHtml(file.name)}</span></span><p><br></p>`
        );
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-[#121217] text-zinc-200 select-text relative">
      {/* Hidden file input for image upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* ==================================================== */}
      {/* THANH CÔNG CỤ CHUẨN BIG-TECH (WORD / NOTION / DOCS)  */}
      {/* ==================================================== */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#252534] bg-[#16161f]/95 backdrop-blur-md gap-1.5 overflow-x-auto max-w-full select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0 z-20">
        <div className="flex items-center gap-1 shrink-0">
          {/* 1. KIỂU VĂN BẢN / TIÊU ĐỀ DROPDOWN */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setHeadingMenuOpen(!headingMenuOpen);
                setColorMenuOpen(false);
                setBoxMenuOpen(false);
              }}
              title="Kiểu chữ & Tiêu đề"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#20202d] hover:bg-[#2a2a3c] text-xs font-semibold text-zinc-200 border border-zinc-700/60 transition-colors cursor-pointer"
            >
              <Type className="w-3.5 h-3.5 text-purple-400" />
              <span>Kiểu chữ</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {headingMenuOpen && (
              <div className="absolute left-0 top-9 w-48 bg-[#1a1a26] border border-[#323248] rounded-xl shadow-2xl p-1.5 z-50 text-xs space-y-0.5 animate-in fade-in duration-100">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleApplyBlock('P')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-200 flex items-center justify-between cursor-pointer"
                >
                  <span>Văn bản thường</span>
                  <span className="text-[10px] text-zinc-500">Chuẩn</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleApplyBlock('H1')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-600/25 text-white font-extrabold text-sm flex items-center justify-between cursor-pointer"
                >
                  <span>Tiêu đề lớn 1</span>
                  <span className="text-[10px] text-zinc-500 font-mono">H1</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleApplyBlock('H2')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-600/25 text-zinc-100 font-bold text-xs flex items-center justify-between cursor-pointer"
                >
                  <span>Tiêu đề vừa 2</span>
                  <span className="text-[10px] text-zinc-500 font-mono">H2</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleApplyBlock('H3')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-600/25 text-purple-300 font-semibold text-xs flex items-center justify-between cursor-pointer"
                >
                  <span>Tiêu đề mục 3</span>
                  <span className="text-[10px] text-zinc-500 font-mono">H3</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleApplyBlock('BLOCKQUOTE')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-600/25 text-zinc-300 border-t border-zinc-800 mt-1 pt-1.5 flex items-center gap-2 cursor-pointer"
                >
                  <Quote className="w-3.5 h-3.5 text-purple-400" />
                  <span>Khung trích dẫn</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-zinc-800 mx-0.5" />

          {/* 2. ĐỊNH DẠNG CHỮ TRỰC TIẾP: B, I, U, S */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('bold')}
            title="In đậm (Ctrl+B)"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <Bold className="w-4 h-4" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('italic')}
            title="In nghiêng (Ctrl+I)"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <Italic className="w-4 h-4" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('underline')}
            title="Gạch chân (Ctrl+U)"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <Underline className="w-4 h-4" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('strikeThrough')}
            title="Gạch ngang chữ"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          {/* 3. MÀU CHỮ & BÚT DẠ QUANG (HIGHLIGHT) */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setColorMenuOpen(!colorMenuOpen);
                setHeadingMenuOpen(false);
                setBoxMenuOpen(false);
              }}
              title="Màu chữ & Bút dạ quang (Highlight)"
              className="p-1.5 rounded-lg hover:bg-[#252535] text-amber-300 hover:text-amber-200 transition-colors cursor-pointer flex items-center gap-0.5"
            >
              <Highlighter className="w-4 h-4" />
              <ChevronDown className="w-2.5 h-2.5 text-zinc-400" />
            </button>

            {colorMenuOpen && (
              <div className="absolute left-0 top-9 w-56 bg-[#1a1a26] border border-[#323248] rounded-xl shadow-2xl p-3 z-50 space-y-3 animate-in fade-in duration-100">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Màu chữ
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleTextColor(c.value)}
                        title={c.name}
                        className="flex items-center justify-center h-7 rounded-lg bg-[#12121a] hover:bg-[#252536] border border-zinc-700/60 text-xs font-bold cursor-pointer"
                        style={{ color: c.value || '#e4e4e7' }}
                      >
                        A
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Bút dạ quang (Tô sáng)
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {HIGHLIGHT_COLORS.map((h) => (
                      <button
                        key={h.name}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleHighlight(h.value, h.text)}
                        title={h.name}
                        className="px-2 py-1 rounded-lg border border-zinc-700/60 text-[11px] font-semibold cursor-pointer truncate"
                        style={{
                          background: h.value || '#12121a',
                          color: h.text || '#a1a1aa',
                        }}
                      >
                        {h.value ? 'Tô sáng' : 'Bỏ tô'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-zinc-800 mx-0.5" />

          {/* 4. DANH SÁCH & THỤT ĐẦU DÒNG */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('insertUnorderedList')}
            title="Danh sách chấm đầu dòng"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('insertOrderedList')}
            title="Danh sách đánh số (1, 2, 3)"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleInsertTaskList}
            title="Danh sách việc cần làm (Checkbox)"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <CheckSquare className="w-4 h-4" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('indent')}
            title="Thụt lề vào trong (Tab)"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <Indent className="w-4 h-4" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('outdent')}
            title="Lùi lề ra ngoài (Shift+Tab)"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <Outdent className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-0.5" />

          {/* 5. CÔNG THỨC TOÁN & KÝ HIỆU Y SINH */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleOpenNewMath}
            title="Chèn Công thức Toán / Ký hiệu Y Sinh (Ctrl+M)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 border border-purple-500/35 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Sigma className="w-3.5 h-3.5" />
            <span>Công thức</span>
          </button>

          {/* 6. CHÈN Ô MÀU GHI CHÚ (CALLOUT / HỘP MÃ) */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setBoxMenuOpen(!boxMenuOpen);
                setHeadingMenuOpen(false);
                setColorMenuOpen(false);
              }}
              title="Chèn Ô màu ghi chú (Callout Box) ngay tại dòng hiện tại"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/35 text-xs font-semibold transition-colors cursor-pointer"
            >
              <SquarePlus className="w-3.5 h-3.5" />
              <span>Ô màu</span>
              <ChevronDown className="w-3 h-3 text-amber-400/70" />
            </button>

            {boxMenuOpen && (
              <div className="absolute left-0 top-9 w-52 bg-[#1a1a26] border border-[#323248] rounded-xl shadow-2xl p-1.5 z-50 text-xs space-y-1 animate-in fade-in duration-100">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Chọn mẫu ô màu ghi chú
                </div>
                {CODE_BOX_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleInsertCalloutBox(preset)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/80 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: preset.color }}
                    />
                    <span className="truncate text-zinc-200 font-medium">{preset.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 7. CHÈN BẢNG BIỂU, ẢNH, LIÊN KẾT */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleInsertTable}
            title="Chèn bảng biểu trực quan"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            <TableIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              saveSelection();
              fileInputRef.current?.click();
            }}
            title="Chèn ảnh (hoặc dán trực tiếp Ctrl+V)"
            className="p-1.5 rounded-lg hover:bg-[#252535] text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          {onOpenLinkModal && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                saveSelection();
                onOpenLinkModal();
              }}
              title="Chèn liên kết nội bộ / liên kết web"
              className="p-1.5 rounded-lg hover:bg-[#252535] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* PHÍA PHẢI: AI VIẾT, MÃ NGUỒN & TOÀN MÀN HÌNH */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleAiWriter && (
            <button
              type="button"
              onClick={onToggleAiWriter}
              title="Trợ lý AI viết & trau chuốt nội dung"
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

          {/* Chuyển đổi Trực quan <-> Mã gốc Markdown */}
          <button
            type="button"
            onClick={() => setSourceMode(!sourceMode)}
            title={
              sourceMode
                ? 'Quay lại chế độ Soạn thảo Trực quan (WYSIWYG)'
                : 'Xem / Chỉnh sửa mã nguồn Markdown thô'
            }
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              sourceMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-[#20202c] hover:bg-[#282838] text-zinc-400 hover:text-zinc-200 border-zinc-700/60'
            }`}
          >
            {sourceMode ? (
              <>
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Trực quan</span>
              </>
            ) : (
              <FileCode2 className="w-3.5 h-3.5" />
            )}
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Thu nhỏ lại thanh bên' : 'Mở rộng toàn màn hình để viết tập trung'}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#20202c] hover:bg-[#282838] text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-medium transition-colors cursor-pointer"
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
      {/* THANH CÔNG CỤ NGỮ CẢNH KHI ĐANG ĐẶT CON TRỎ TRONG Ô MÀU */}
      {/* ==================================================== */}
      {activeCalloutEl && !sourceMode && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#1b1b28] border-b border-purple-500/30 text-xs animate-in fade-in duration-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-semibold text-amber-300">
              <Palette className="w-3.5 h-3.5" />
              <span>Đang trong Ô màu:</span>
            </span>
            <div className="flex items-center gap-1.5">
              {CODE_BOX_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleChangeActiveBoxPreset(preset)}
                  title={`Đổi sang màu ${preset.name}`}
                  className="w-4 h-4 rounded-full border border-white/25 hover:scale-125 transition-transform cursor-pointer"
                  style={{ backgroundColor: preset.color }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAddParagraphAfterBox}
              title="Thêm dòng văn bản bình thường bên dưới ô màu này"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] cursor-pointer"
            >
              <CornerDownLeft className="w-3 h-3 text-purple-400" />
              <span>Viết tiếp dưới ô</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleOpenCssEditorForActiveBox}
              title="Mở Hộp mã CSS để tùy chỉnh nâng cao và Chạy mã"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-medium cursor-pointer"
            >
              <Code2 className="w-3 h-3" />
              <span>Hộp mã CSS</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDeleteActiveBox}
              title="Xóa ô màu này"
              className="p-1 rounded hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* THANH CÔNG CỤ NGỮ CẢNH KHI ĐANG ĐẶT CON TRỎ TRONG BẢNG */}
      {/* ==================================================== */}
      {activeTableEl && !sourceMode && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#161e29] border-b border-cyan-500/30 text-xs animate-in fade-in duration-100 shrink-0">
          <span className="flex items-center gap-1.5 font-semibold text-cyan-300">
            <TableIcon className="w-3.5 h-3.5" />
            <span>Công cụ Bảng biểu</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleTableAddRow}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-500/30 text-[11px] cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Thêm hàng</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleTableAddCol}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-500/30 text-[11px] cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Thêm cột</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleTableDeleteRow}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-300 text-[11px] cursor-pointer"
            >
              <Minus className="w-3 h-3" />
              <span>Xóa hàng</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleTableDeleteCol}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-300 text-[11px] cursor-pointer"
            >
              <Minus className="w-3 h-3" />
              <span>Xóa cột</span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleTableDelete}
              title="Xóa toàn bộ bảng"
              className="p-1 rounded hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TRANG GIẤY SOẠN THẢO TRỰC QUAN LIỀN MẠCH (DOCUMENT)   */}
      {/* ==================================================== */}
      {sourceMode ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className={`mx-auto h-full flex flex-col ${isFullscreen ? 'max-w-4xl' : 'w-full'}`}>
            <div className="mb-2 flex items-center justify-between text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5">
              <span>Đang ở chế độ Mã nguồn Markdown. Bấm nút "Trực quan" trên thanh công cụ để quay lại trang văn bản chuẩn.</span>
              <button
                type="button"
                onClick={() => setSourceMode(false)}
                className="font-bold underline cursor-pointer ml-2 shrink-0"
              >
                Quay lại Trực quan
              </button>
            </div>
            <textarea
              value={content}
              onChange={(e) => {
                lastEmittedContentRef.current = e.target.value;
                onChange(e.target.value);
              }}
              className="flex-1 w-full bg-[#15151e] border border-[#2a2a3c] focus:border-purple-500 rounded-xl p-4 text-zinc-200 font-mono text-xs leading-relaxed outline-none resize-none"
              placeholder="Mã nguồn Markdown..."
            />
          </div>
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto cursor-text"
          onClick={(e) => {
            if (e.target === e.currentTarget && editorRef.current) {
              editorRef.current.focus();
            }
          }}
        >
          <div
            className={`mx-auto min-h-full ${
              isFullscreen
                ? 'max-w-3xl px-8 sm:px-14 py-8 sm:py-12'
                : 'w-full px-5 sm:px-6 py-5'
            }`}
          >
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => {
                if (!isComposingRef.current) {
                  emitChanges();
                }
              }}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={() => {
                isComposingRef.current = false;
                emitChanges();
              }}
              onKeyUp={saveSelection}
              onMouseUp={saveSelection}
              onClick={handleEditorClick}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              data-placeholder="Bắt đầu viết ghi chú tại đây... (Gõ # để tạo tiêu đề, - để tạo danh sách, -> để tạo mũi tên →, hoặc bấm nút Công thức / Ô màu ở trên)"
              className={`mn-doc-surface min-h-[65vh] pb-24 ${
                isFullscreen ? 'mn-doc-fullscreen' : ''
              }`}
            />
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* POPOVER CHÈN / SỬA CÔNG THỨC TOÁN & KÝ HIỆU (KATEX)   */}
      {/* ==================================================== */}
      {mathModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#181824] border border-purple-500/40 rounded-2xl w-full max-w-md shadow-2xl p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Sigma className="w-4 h-4 text-purple-400" />
                <span>{editingMathEl ? 'Chỉnh sửa Công thức / Ký hiệu' : 'Chèn Công thức / Ký hiệu'}</span>
              </div>
              <button
                type="button"
                onClick={() => setMathModalOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bảng chèn nhanh ký hiệu Toán & Y Sinh */}
            <div>
              <div className="text-[11px] font-semibold text-zinc-400 mb-1.5">
                Bấm chọn nhanh ký hiệu hoặc mẫu công thức:
              </div>
              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1.5 rounded-xl bg-[#12121a] border border-zinc-800">
                {QUICK_MATH_SYMBOLS.map((sym) => (
                  <button
                    key={sym.label}
                    type="button"
                    onClick={() => setMathLatex((prev) => `${prev}${sym.latex}`)}
                    title={`${sym.tip} (${sym.latex})`}
                    className="px-2 py-1 rounded-lg bg-[#1e1e2d] hover:bg-purple-600/30 text-zinc-200 hover:text-white border border-zinc-700/60 hover:border-purple-500/50 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {sym.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ô nhập mã LaTeX */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-400 font-medium">Biểu thức LaTeX / KaTeX:</span>
                <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={mathIsBlock}
                    onChange={(e) => setMathIsBlock(e.target.checked)}
                    className="accent-purple-600 rounded cursor-pointer"
                  />
                  <span>Hiển thị thành khối lớn riêng dòng</span>
                </label>
              </div>
              <input
                type="text"
                autoFocus
                value={mathLatex}
                onChange={(e) => setMathLatex(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveMath();
                  } else if (e.key === 'Escape') {
                    setMathModalOpen(false);
                  }
                }}
                placeholder="Ví dụ: \approx 5,8\text{ mg/dL} hoặc \frac{a}{b}"
                className="w-full bg-[#101018] border border-zinc-700 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-mono text-zinc-100 outline-none"
              />
            </div>

            {/* Xem trước trực tiếp */}
            <div className="p-3 rounded-xl bg-[#12121c] border border-zinc-800/90 flex items-center justify-center min-h-[56px] overflow-x-auto">
              <div
                dangerouslySetInnerHTML={{
                  __html: renderKaTeXSafe(mathLatex, mathIsBlock),
                }}
                className="text-zinc-100 text-base"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              {editingMathEl ? (
                <button
                  type="button"
                  onClick={() => {
                    editingMathEl.remove();
                    emitChanges();
                    setMathModalOpen(false);
                    setEditingMathEl(null);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa công thức</span>
                </button>
              ) : (
                <span className="text-[11px] text-zinc-500">
                  Mẹo: Gõ trực tiếp <code className="text-purple-300">$công_thức$</code> + Phím cách trong bài cũng tự biến thành công thức!
                </span>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setMathModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveMath}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 cursor-pointer"
                >
                  {editingMathEl ? 'Cập nhật ngay' : 'Chèn vào dòng chữ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL TÙY CHỈNH HỘP MÃ CSS CHO Ô MÀU                 */}
      {/* ==================================================== */}
      {cssEditorOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#181824] border border-amber-500/40 rounded-2xl w-full max-w-md shadow-2xl p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                <Code2 className="w-4 h-4" />
                <span>Tùy chỉnh Hộp mã CSS của Ô màu</span>
              </div>
              <button
                type="button"
                onClick={() => setCssEditorOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-zinc-400 font-medium">Tiêu đề ô màu:</label>
              <input
                type="text"
                value={customBoxTitle}
                onChange={(e) => setCustomBoxTitle(e.target.value)}
                className="w-full bg-[#101018] border border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-400 font-medium">Mã định dạng CSS:</label>
                <div className="flex items-center gap-1">
                  {CODE_BOX_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setCustomBoxCss(preset.css);
                        setCustomBoxTitle(preset.title);
                      }}
                      title={preset.name}
                      className="w-3.5 h-3.5 rounded-full border border-white/25 cursor-pointer"
                      style={{ backgroundColor: preset.color }}
                    />
                  ))}
                </div>
              </div>
              <textarea
                rows={4}
                value={customBoxCss}
                onChange={(e) => setCustomBoxCss(e.target.value)}
                className="w-full bg-[#101018] border border-zinc-700 focus:border-amber-500 rounded-lg p-2.5 text-xs font-mono text-zinc-200 outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCssEditorOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleRunCustomBoxCss}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs shadow-lg shadow-amber-500/25 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>▶ Chạy mã</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
