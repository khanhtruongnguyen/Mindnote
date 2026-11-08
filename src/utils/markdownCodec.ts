import katex from 'katex';

export interface CodeBoxPreset {
  name: string;
  color: string;
  css: string;
  title: string;
}

export const CODE_BOX_PRESETS: CodeBoxPreset[] = [
  {
    name: 'Tím Neon',
    color: '#a855f7',
    css: 'background: rgba(147, 51, 234, 0.14); border: 1px solid rgba(168, 85, 247, 0.55); border-left: 4px solid #a855f7; border-radius: 12px; padding: 14px 16px; color: #f3e8ff;',
    title: '📌 Ghi chú quan trọng',
  },
  {
    name: 'Xanh Ngọc',
    color: '#06b6d4',
    css: 'background: rgba(6, 182, 212, 0.14); border: 1px solid rgba(6, 182, 212, 0.55); border-left: 4px solid #06b6d4; border-radius: 12px; padding: 14px 16px; color: #cffafe;',
    title: '💡 Điểm cốt lõi',
  },
  {
    name: 'Hổ Phách',
    color: '#f59e0b',
    css: 'background: rgba(245, 158, 11, 0.14); border: 1px solid rgba(245, 158, 11, 0.55); border-left: 4px solid #f59e0b; border-radius: 12px; padding: 14px 16px; color: #fef3c7;',
    title: '⚠️ Lưu ý đặc biệt',
  },
  {
    name: 'Xanh Biển',
    color: '#3b82f6',
    css: 'background: rgba(59, 130, 246, 0.14); border: 1px solid rgba(59, 130, 246, 0.55); border-left: 4px solid #3b82f6; border-radius: 12px; padding: 14px 16px; color: #dbeafe;',
    title: '📘 Kiến thức mở rộng',
  },
  {
    name: 'Đỏ Hồng',
    color: '#f43f5e',
    css: 'background: rgba(244, 63, 94, 0.14); border: 1px solid rgba(244, 63, 94, 0.55); border-left: 4px solid #f43f5e; border-radius: 12px; padding: 14px 16px; color: #ffe4e6;',
    title: '⛔ Chống chỉ định / Cảnh báo',
  },
  {
    name: 'Xanh Lá',
    color: '#10b981',
    css: 'background: rgba(16, 185, 129, 0.14); border: 1px solid rgba(16, 185, 129, 0.55); border-left: 4px solid #10b981; border-radius: 12px; padding: 14px 16px; color: #d1fae5;',
    title: '✅ Kết luận / Phác đồ',
  },
];

export function renderKaTeXSafe(formula: string, displayMode = false): string {
  const clean = (formula || '').trim();
  if (!clean) return '<span class="text-zinc-500 italic">Nhập công thức...</span>';
  try {
    return katex.renderToString(clean, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return `<code class="text-rose-400 text-xs">${escapeHtml(clean)}</code>`;
  }
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function unescapeAttr(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Parse inline Markdown (bold, italic, underline, strikethrough, code, math, images, wiki-links, web links, colors/highlights)
 * into rich WYSIWYG HTML with data-* attributes for lossless round-trip serialization.
 */
export function renderInlineMarkdownToHtml(
  rawText: string,
  attachments: Record<string, string> = {}
): string {
  if (!rawText) return '';

  const tokens: string[] = [];
  const pushToken = (html: string): string => {
    const idx = tokens.length;
    tokens.push(html);
    return `@@MN_INLINE_${idx}@@`;
  };

  let text = rawText;

  // 1. Inline code `...`
  text = text.replace(/`([^`\n]+)`/g, (_m, codeContent: string) => {
    return pushToken(`<code class="mn-inline-code">${escapeHtml(codeContent)}</code>`);
  });

  // 2. Inline block math $$...$$ on a single line
  text = text.replace(/\$\$([^\n$]+?)\$\$/g, (_m, formula: string) => {
    const clean = formula.trim();
    const katexHtml = renderKaTeXSafe(clean, true);
    return pushToken(
      `<span class="mn-math-inline mn-math-display-inline" contenteditable="false" data-latex="${escapeAttr(clean)}" data-display="true" title="Nhấp để sửa công thức: ${escapeAttr(clean)}">${katexHtml}</span>`
    );
  });

  // 3. Inline math $...$
  text = text.replace(/\$([^$\n]+?)\$/g, (_m, formula: string) => {
    const clean = formula.trim();
    if (!clean) return _m;
    const katexHtml = renderKaTeXSafe(clean, false);
    return pushToken(
      `<span class="mn-math-inline" contenteditable="false" data-latex="${escapeAttr(clean)}" title="Nhấp để sửa công thức: ${escapeAttr(clean)}">${katexHtml}</span>`
    );
  });

  // 4. Images ![alt](src)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, rawSrc: string) => {
    const cleanSrc = rawSrc.trim();
    const cleanAlt = alt.trim();
    let displaySrc = cleanSrc;
    if (cleanSrc.startsWith('attachment:')) {
      const attachId = cleanSrc.replace('attachment:', '');
      displaySrc = attachments[attachId] || '';
    }
    const imgTag = displaySrc
      ? `<img src="${escapeAttr(displaySrc)}" alt="${escapeAttr(cleanAlt || 'Hình ảnh')}" class="mn-editor-img" />`
      : `<span class="mn-missing-img">[Không tìm thấy ảnh: ${escapeHtml(cleanAlt || cleanSrc)}]</span>`;

    const captionHtml = cleanAlt
      ? `<span class="mn-img-caption">${escapeHtml(cleanAlt)}</span>`
      : '';

    return pushToken(
      `<span class="mn-image-widget" contenteditable="false" data-raw-src="${escapeAttr(cleanSrc)}" data-alt="${escapeAttr(cleanAlt)}">${imgTag}${captionHtml}</span>`
    );
  });

  // 5. Wiki-links [[target|alias]] or [[target]]
  text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, alias?: string) => {
    const cleanTarget = target.trim();
    const cleanAlias = (alias || cleanTarget).trim();
    return pushToken(
      `<a href="node:${escapeAttr(cleanTarget)}" class="mn-wiki-link" contenteditable="false" data-link-type="wiki" data-target="${escapeAttr(cleanTarget)}" data-alias="${escapeAttr(cleanAlias)}" title="Nhấp để mở ô ghi chú: ${escapeAttr(cleanTarget)}"><span class="mn-wiki-icon">🧭</span><span>${escapeHtml(cleanAlias)}</span></a>`
    );
  });

  // 6. Standard Markdown links [label](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => {
    const cleanHref = href.trim();
    const cleanLabel = label.trim();
    const isInternal =
      cleanHref.startsWith('node:') ||
      cleanHref.startsWith('#') ||
      cleanHref.includes('?map=') ||
      cleanHref.includes('?note=');

    if (isInternal) {
      return pushToken(
        `<a href="${escapeAttr(cleanHref)}" class="mn-wiki-link" contenteditable="false" data-link-type="md-internal" data-href="${escapeAttr(cleanHref)}" data-alias="${escapeAttr(cleanLabel)}" title="Nhấp để đi tới ô ghi chú"><span class="mn-wiki-icon">🧭</span><span>${escapeHtml(cleanLabel)}</span></a>`
      );
    }

    return pushToken(
      `<a href="${escapeAttr(cleanHref)}" target="_blank" rel="noopener noreferrer" class="mn-ext-link" data-href="${escapeAttr(cleanHref)}" title="Mở liên kết: ${escapeAttr(cleanHref)}">${escapeHtml(cleanLabel)}</a>`
    );
  });

  // 7. Preserve safe inline HTML tags (<u>, <mark>, <span style="...">, <sup>, <sub>, <br>)
  const safeHtmlTags: string[] = [];
  text = text.replace(
    /<(\/?(?:u|mark|span|sup|sub|b|i|strong|em|del|s|br)\b[^>]*)>/gi,
    (fullMatch) => {
      const idx = safeHtmlTags.length;
      safeHtmlTags.push(fullMatch);
      return `@@MN_SAFETAG_${idx}@@`;
    }
  );

  // 8. Escape any remaining raw <, >, &
  text = escapeHtml(text);

  // 9. Restore safe inline HTML tags
  text = text.replace(/@@MN_SAFETAG_(\d+)@@/g, (_m, idxStr: string) => {
    return safeHtmlTags[Number(idxStr)] || '';
  });

  // 10. Markdown Bold + Italic ***...***
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold **...**
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic *...*
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  // Strikethrough ~~...~~
  text = text.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  // Highlight ==...== (Obsidian style)
  text = text.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');

  // 11. Restore tokens
  text = text.replace(/@@MN_INLINE_(\d+)@@/g, (_m, idxStr: string) => {
    return tokens[Number(idxStr)] || '';
  });

  return text;
}

export function parseBoxBlock(inner: string): { style: string; title: string; content: string } {
  const lines = inner.trim().split('\n');
  let style = CODE_BOX_PRESETS[0].css;
  let title = '';
  const contentLines: string[] = [];
  let inContent = false;

  for (const line of lines) {
    if (!inContent && line.startsWith('style:')) {
      style = line.replace(/^style:\s*/, '').trim() || style;
    } else if (!inContent && line.startsWith('title:')) {
      title = line.replace(/^title:\s*/, '').trim();
    } else if (!inContent && line.startsWith('content:')) {
      inContent = true;
      const firstLine = line.replace(/^content:\s*/, '');
      if (firstLine) contentLines.push(firstLine);
    } else {
      inContent = true;
      contentLines.push(line);
    }
  }

  return {
    style,
    title: title || '📌 Ghi chú',
    content: contentLines.join('\n').trim(),
  };
}

interface ListItemNode {
  type: 'ul' | 'ol';
  indent: number;
  checked?: boolean;
  htmlContent: string;
  children: ListItemNode[];
}

function renderListTreeToHtml(items: ListItemNode[]): string {
  if (items.length === 0) return '';
  let html = '';
  let i = 0;

  while (i < items.length) {
    const listType = items[i].type;
    const tag = listType === 'ol' ? 'ol' : 'ul';
    html += `<${tag} class="mn-list mn-list-${tag}">`;

    while (i < items.length && items[i].type === listType) {
      const item = items[i];
      const isTask = typeof item.checked === 'boolean';
      const taskAttr = isTask
        ? ` class="mn-task-item" data-task="${item.checked ? 'true' : 'false'}"`
        : '';
      const checkboxHtml = isTask
        ? `<input type="checkbox" class="mn-task-checkbox" ${item.checked ? 'checked' : ''} contenteditable="false" />`
        : '';
      const childrenHtml =
        item.children.length > 0 ? renderListTreeToHtml(item.children) : '';

      html += `<li${taskAttr}>${checkboxHtml}<span class="mn-li-content">${item.htmlContent || '<br>'}</span>${childrenHtml}</li>`;
      i++;
    }

    html += `</${tag}>`;
  }

  return html;
}

function buildAndRenderListBlock(
  rawLines: string[],
  attachments: Record<string, string>
): string {
  const root: ListItemNode[] = [];
  const stack: ListItemNode[] = [];

  for (const line of rawLines) {
    const match = line.match(/^(\s*)(?:([-*+])|(\d+)\.)\s+(.*)$/);
    if (!match) continue;

    const indentSpaces = (match[1] || '').replace(/\t/g, '  ').length;
    const isOrdered = Boolean(match[3]);
    let itemText = match[4] || '';
    let checked: boolean | undefined = undefined;

    const taskMatch = itemText.match(/^\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      checked = taskMatch[1].toLowerCase() === 'x';
      itemText = taskMatch[2];
    }

    const node: ListItemNode = {
      type: isOrdered ? 'ol' : 'ul',
      indent: indentSpaces,
      checked,
      htmlContent: renderInlineMarkdownToHtml(itemText, attachments),
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].indent >= indentSpaces) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return renderListTreeToHtml(root);
}

/**
 * Convert full Markdown document into WYSIWYG HTML for the rich editor.
 */
export function markdownToHtml(
  markdown: string,
  attachments: Record<string, string> = {}
): string {
  if (!markdown || !markdown.trim()) {
    return '<p><br></p>';
  }

  const blockTokens: string[] = [];
  const pushBlockToken = (html: string): string => {
    const idx = blockTokens.length;
    blockTokens.push(html);
    return `@@MN_BLOCK_${idx}@@`;
  };

  let text = markdown.replace(/\r\n/g, '\n');

  // 1. Extract ```box ... ``` blocks
  text = text.replace(/```box\s*\n([\s\S]*?)```/g, (_m, inner: string) => {
    const parsed = parseBoxBlock(inner);
    const bodyHtml = markdownToHtml(parsed.content, attachments);
    return pushBlockToken(
      `<div class="mn-callout-box" data-box-kind="box" data-box-style="${escapeAttr(parsed.style)}" style="${escapeAttr(parsed.style)}">` +
        `<div class="mn-callout-header">` +
        `<div class="mn-callout-title" contenteditable="true" data-placeholder="Tiêu đề hộp ghi chú...">${renderInlineMarkdownToHtml(parsed.title, attachments)}</div>` +
        `</div>` +
        `<div class="mn-callout-body" contenteditable="true" data-placeholder="Nhập nội dung hộp ghi chú...">${bodyHtml}</div>` +
        `</div>`
    );
  });

  // 2. Extract other fenced code blocks ```lang ... ```
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    return pushBlockToken(
      `<pre class="mn-code-block" data-lang="${escapeAttr(lang || '')}"><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`
    );
  });

  // 3. Extract multi-line or standalone block math $$...$$
  text = text.replace(/(?:^|\n)\$\$\s*\n?([\s\S]+?)\n?\$\$(?=\n|$)/g, (_m, formula: string) => {
    const clean = formula.trim();
    const katexHtml = renderKaTeXSafe(clean, true);
    return (
      '\n' +
      pushBlockToken(
        `<div class="mn-math-block" contenteditable="false" data-latex="${escapeAttr(clean)}" title="Nhấp để sửa công thức toán học">${katexHtml}</div>`
      ) +
      '\n'
    );
  });

  // 4. Extract custom <div style="...">...</div> blocks
  text = text.replace(/<div\s+style="([^"]+)">([\s\S]*?)<\/div>/gi, (_m, styleStr: string, inner: string) => {
    const bodyHtml = markdownToHtml(inner.trim(), attachments);
    return pushBlockToken(
      `<div class="mn-callout-box" data-box-kind="div" data-box-style="${escapeAttr(styleStr)}" style="${escapeAttr(styleStr)}">` +
        `<div class="mn-callout-body" contenteditable="true" data-placeholder="Nhập nội dung ô màu...">${bodyHtml}</div>` +
        `</div>`
    );
  });

  const lines = text.split('\n');
  const htmlBlocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      i++;
      continue;
    }

    // Standalone Block Token
    const tokenMatch = trimmed.match(/^@@MN_BLOCK_(\d+)@@$/);
    if (tokenMatch) {
      htmlBlocks.push(blockTokens[Number(tokenMatch[1])] || '');
      i++;
      continue;
    }

    // Horizontal Rule
    if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
      htmlBlocks.push('<hr class="mn-hr" />');
      i++;
      continue;
    }

    // Headings # to ####
    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = renderInlineMarkdownToHtml(headingMatch[2].trim(), attachments);
      htmlBlocks.push(`<h${level} class="mn-h${level}">${content || '<br>'}</h${level}>`);
      i++;
      continue;
    }

    // GFM Table
    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      /^\s*\|[\s\-:|]+\|\s*$/.test(lines[i + 1])
    ) {
      const parseCells = (rowStr: string) =>
        rowStr
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseCells(lines[i]);
      i += 2; // Skip header and separator rows
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseCells(lines[i]));
        i++;
      }

      const theadHtml =
        '<thead><tr>' +
        headers
          .map((h) => `<th>${renderInlineMarkdownToHtml(h, attachments) || '<br>'}</th>`)
          .join('') +
        '</tr></thead>';

      const tbodyHtml =
        '<tbody>' +
        (rows.length > 0
          ? rows
              .map(
                (r) =>
                  '<tr>' +
                  headers
                    .map((_, colIdx) => `<td>${renderInlineMarkdownToHtml(r[colIdx] || '', attachments) || '<br>'}</td>`)
                    .join('') +
                  '</tr>'
              )
              .join('')
          : '<tr>' + headers.map(() => '<td><br></td>').join('') + '</tr>') +
        '</tbody>';

      htmlBlocks.push(
        `<div class="mn-table-wrapper"><table class="mn-table">${theadHtml}${tbodyHtml}</table></div>`
      );
      continue;
    }

    // Blockquote (> ...)
    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      const innerHtml = quoteLines
        .map((ql) => `<p>${renderInlineMarkdownToHtml(ql, attachments) || '<br>'}</p>`)
        .join('');
      htmlBlocks.push(`<blockquote class="mn-blockquote">${innerHtml}</blockquote>`);
      continue;
    }

    // Lists (- , * , + , 1. )
    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length && /^\s*(?:[-*+]|\d+\.)\s+/.test(lines[i])) {
        listLines.push(lines[i]);
        i++;
      }
      htmlBlocks.push(buildAndRenderListBlock(listLines, attachments));
      continue;
    }

    // Standalone image line ![alt](src)
    const standaloneImgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (standaloneImgMatch) {
      htmlBlocks.push(`<p class="mn-p-img">${renderInlineMarkdownToHtml(trimmed, attachments)}</p>`);
      i++;
      continue;
    }

    // Normal paragraph
    const contentHtml = renderInlineMarkdownToHtml(line, attachments);
    // Replace any embedded block tokens if they appeared inline
    const resolvedHtml = contentHtml.replace(/@@MN_BLOCK_(\d+)@@/g, (_m, idxStr: string) => {
      return blockTokens[Number(idxStr)] || '';
    });
    htmlBlocks.push(`<p>${resolvedHtml || '<br>'}</p>`);
    i++;
  }

  return htmlBlocks.join('') || '<p><br></p>';
}

/**
 * Serialize inline DOM nodes back to Markdown string.
 */
function serializeInlineNodes(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').replace(/\u200B/g, '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  // Skip UI-only controls
  if (el.getAttribute('data-mn-ui') === 'true' || el.classList.contains('mn-task-checkbox')) {
    return '';
  }

  // Math Inline / Display Inline
  if (el.classList.contains('mn-math-inline')) {
    const latex = el.getAttribute('data-latex') || '';
    const isDisplay = el.getAttribute('data-display') === 'true';
    return isDisplay ? `$$${latex}$$` : `$${latex}$`;
  }

  // Math Block accidentally inside inline context
  if (el.classList.contains('mn-math-block')) {
    const latex = el.getAttribute('data-latex') || '';
    return `\n$$\n${latex}\n$$\n`;
  }

  // Image Widget
  if (el.classList.contains('mn-image-widget')) {
    const rawSrc = el.getAttribute('data-raw-src') || el.querySelector('img')?.getAttribute('src') || '';
    const alt = el.getAttribute('data-alt') || el.querySelector('img')?.getAttribute('alt') || '';
    return `![${alt}](${rawSrc})`;
  }

  if (tag === 'img') {
    const rawSrc = el.getAttribute('data-raw-src') || el.getAttribute('src') || '';
    const alt = el.getAttribute('alt') || '';
    return `![${alt}](${rawSrc})`;
  }

  // Wiki / Internal links
  if (el.classList.contains('mn-wiki-link')) {
    const linkType = el.getAttribute('data-link-type');
    const target = el.getAttribute('data-target') || '';
    const href = el.getAttribute('data-href') || el.getAttribute('href') || '';
    const alias = el.getAttribute('data-alias') || el.textContent?.replace(/^🧭\s*/, '').trim() || '';

    if (linkType === 'wiki' && target) {
      return alias && alias !== target ? `[[${target}|${alias}]]` : `[[${target}]]`;
    }
    return `[${alias || href}](${href})`;
  }

  // External links
  if (tag === 'a') {
    const href = el.getAttribute('data-href') || el.getAttribute('href') || '';
    const childrenMd = Array.from(el.childNodes).map(serializeInlineNodes).join('').trim();
    return href ? `[${childrenMd || href}](${href})` : childrenMd;
  }

  if (tag === 'br') {
    return '\n';
  }

  const inner = Array.from(el.childNodes).map(serializeInlineNodes).join('');
  if (!inner && tag !== 'hr') return '';

  // Formatting tags
  if (tag === 'strong' || tag === 'b') {
    const trimmed = inner.trim();
    if (!trimmed) return inner;
    const lead = inner.match(/^\s*/)?.[0] || '';
    const trail = inner.match(/\s*$/)?.[0] || '';
    return `${lead}**${trimmed}**${trail}`;
  }

  if (tag === 'em' || tag === 'i') {
    const trimmed = inner.trim();
    if (!trimmed) return inner;
    const lead = inner.match(/^\s*/)?.[0] || '';
    const trail = inner.match(/\s*$/)?.[0] || '';
    return `${lead}*${trimmed}*${trail}`;
  }

  if (tag === 'u') {
    return `<u>${inner}</u>`;
  }

  if (tag === 'del' || tag === 's' || tag === 'strike') {
    const trimmed = inner.trim();
    if (!trimmed) return inner;
    return `~~${trimmed}~~`;
  }

  if (tag === 'mark') {
    const style = el.getAttribute('style');
    if (style) {
      return `<mark style="${style}">${inner}</mark>`;
    }
    return `<mark>${inner}</mark>`;
  }

  if (tag === 'code' && !el.parentElement?.classList.contains('mn-code-block')) {
    return `\`${inner}\``;
  }

  if (tag === 'sup') return `<sup>${inner}</sup>`;
  if (tag === 'sub') return `<sub>${inner}</sub>`;

  if (tag === 'span' || tag === 'font') {
    const style = el.getAttribute('style') || '';
    const colorAttr = el.getAttribute('color');
    if (colorAttr) {
      return `<span style="color: ${colorAttr}">${inner}</span>`;
    }
    if (
      style &&
      (style.includes('color') || style.includes('background')) &&
      !el.classList.contains('mn-li-content')
    ) {
      return `<span style="${style}">${inner}</span>`;
    }
    return inner;
  }

  return inner;
}

function serializeListElement(listEl: HTMLElement, depth = 0): string {
  const isOrdered = listEl.tagName.toLowerCase() === 'ol';
  const lines: string[] = [];
  let orderCounter = 1;

  for (const child of Array.from(listEl.children)) {
    if (child.tagName.toLowerCase() !== 'li') continue;
    const li = child as HTMLElement;
    const indent = '  '.repeat(depth);

    const checkbox = li.querySelector(':scope > input.mn-task-checkbox') as HTMLInputElement | null;
    const isTask = li.classList.contains('mn-task-item') || Boolean(checkbox);
    const isChecked = checkbox ? checkbox.checked : li.getAttribute('data-task') === 'true';

    let prefix = isOrdered ? `${orderCounter++}. ` : '- ';
    if (isTask) {
      prefix = isChecked ? '- [x] ' : '- [ ] ';
    }

    // Collect inline content (excluding nested ul/ol)
    const inlineParts: string[] = [];
    const nestedLists: HTMLElement[] = [];

    for (const node of Array.from(li.childNodes)) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const nodeEl = node as HTMLElement;
        const nodeTag = nodeEl.tagName.toLowerCase();
        if (nodeTag === 'ul' || nodeTag === 'ol') {
          nestedLists.push(nodeEl);
          continue;
        }
      }
      inlineParts.push(serializeInlineNodes(node));
    }

    const lineText = inlineParts.join('').replace(/\n+/g, ' ').trim();
    lines.push(`${indent}${prefix}${lineText}`);

    for (const nested of nestedLists) {
      const nestedMd = serializeListElement(nested, depth + 1);
      if (nestedMd) lines.push(nestedMd);
    }
  }

  return lines.join('\n');
}

function serializeTableElement(tableEl: HTMLElement): string {
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  if (rows.length === 0) return '';

  const matrix: string[][] = rows.map((tr) =>
    Array.from(tr.querySelectorAll('th, td')).map((cell) =>
      Array.from(cell.childNodes)
        .map(serializeInlineNodes)
        .join('')
        .replace(/\n+/g, ' ')
        .replace(/\|/g, '\\|')
        .trim()
    )
  );

  const colCount = Math.max(...matrix.map((r) => r.length), 1);
  const normalizeRow = (r: string[]) => {
    const padded = [...r];
    while (padded.length < colCount) padded.push('');
    return `| ${padded.join(' | ')} |`;
  };

  const headerLine = normalizeRow(matrix[0]);
  const separatorLine = `| ${Array(colCount).fill('---').join(' | ')} |`;
  const bodyLines = matrix.slice(1).map(normalizeRow);

  return [headerLine, separatorLine, ...bodyLines].join('\n');
}

function serializeBlockNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const txt = (node.textContent || '').replace(/\u200B/g, '').trim();
    return txt;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (el.getAttribute('data-mn-ui') === 'true') return '';

  // 1. Callout / Code Box
  if (el.classList.contains('mn-callout-box')) {
    const kind = el.getAttribute('data-box-kind') || 'box';
    const style = el.getAttribute('data-box-style') || el.getAttribute('style') || CODE_BOX_PRESETS[0].css;
    const titleEl = el.querySelector(':scope > .mn-callout-header .mn-callout-title');
    const bodyEl = el.querySelector(':scope > .mn-callout-body');

    const titleMd = titleEl
      ? Array.from(titleEl.childNodes).map(serializeInlineNodes).join('').trim()
      : '📌 Ghi chú';
    const bodyMd = bodyEl ? htmlToMarkdown(bodyEl as HTMLElement) : '';

    if (kind === 'div' && !titleEl) {
      return `<div style="${style}">\n${bodyMd}\n</div>`;
    }

    return `\`\`\`box\nstyle: ${style}\ntitle: ${titleMd || '📌 Ghi chú'}\ncontent: ${bodyMd}\n\`\`\``;
  }

  // 2. Block Math
  if (el.classList.contains('mn-math-block')) {
    const latex = el.getAttribute('data-latex') || '';
    return `$$\n${latex}\n$$`;
  }

  // 3. Fenced Code Block
  if (tag === 'pre' || el.classList.contains('mn-code-block')) {
    const lang = el.getAttribute('data-lang') || '';
    const codeText = el.textContent || '';
    return `\`\`\`${lang}\n${codeText}\n\`\`\``;
  }

  // 4. Table
  if (el.classList.contains('mn-table-wrapper')) {
    const table = el.querySelector('table');
    return table ? serializeTableElement(table as HTMLElement) : '';
  }
  if (tag === 'table') {
    return serializeTableElement(el);
  }

  // 5. Headings
  if (/^h[1-6]$/.test(tag)) {
    const level = Math.min(Number(tag[1]), 4);
    const hashes = '#'.repeat(level);
    const text = Array.from(el.childNodes).map(serializeInlineNodes).join('').replace(/\n+/g, ' ').trim();
    return text ? `${hashes} ${text}` : '';
  }

  // 6. Lists
  if (tag === 'ul' || tag === 'ol') {
    return serializeListElement(el, 0);
  }

  // 7. Blockquote
  if (tag === 'blockquote') {
    const innerMd = htmlToMarkdown(el);
    return innerMd
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
  }

  // 8. Horizontal Rule
  if (tag === 'hr') {
    return '---';
  }

  // 9. Paragraph or Div
  if (tag === 'p' || tag === 'div') {
    // Check if div contains block-level children
    const hasBlockChildren = Array.from(el.children).some((c) =>
      /^(P|DIV|H1|H2|H3|H4|UL|OL|TABLE|BLOCKQUOTE|PRE|HR)$/.test(c.tagName)
    );
    if (tag === 'div' && hasBlockChildren) {
      return htmlToMarkdown(el);
    }

    const content = Array.from(el.childNodes).map(serializeInlineNodes).join('').trim();
    return content;
  }

  return Array.from(el.childNodes).map(serializeInlineNodes).join('').trim();
}

/**
 * Convert the WYSIWYG editor DOM back into clean Markdown + LaTeX.
 */
export function htmlToMarkdown(rootEl: HTMLElement): string {
  const blocks: string[] = [];

  for (const child of Array.from(rootEl.childNodes)) {
    const md = serializeBlockNode(child);
    if (md !== '') {
      blocks.push(md);
    }
  }

  return blocks.join('\n\n').trim();
}

/**
 * Detect if pasted plain text contains Markdown / LaTeX syntax that should be auto-rendered.
 */
export function looksLikeMarkdown(text: string): boolean {
  if (!text || text.length < 3) return false;
  return (
    /^#{1,4}\s+/m.test(text) ||
    /\*\*[^*]+\*\*/.test(text) ||
    /\$[^$\n]+\$/.test(text) ||
    /\$\$[\s\S]+?\$\$/.test(text) ||
    /^\s*[-*+]\s+/m.test(text) ||
    /^\s*\d+\.\s+/m.test(text) ||
    /^\s*\|.+\|\s*$/m.test(text) ||
    /```/.test(text) ||
    /\[\[.+?\]\]/.test(text)
  );
}
