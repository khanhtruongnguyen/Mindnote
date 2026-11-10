import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { ExternalLink, Lightbulb, Compass, Maximize2 } from 'lucide-react';
import { parseBoxBlock } from '../utils/markdownCodec';
import { openImageViewer } from './ImageViewerModal';

function parseInlineCssToReact(cssString: string): React.CSSProperties {
  const styleObj: Record<string, string> = {};
  if (!cssString) return styleObj;
  for (const decl of cssString.split(';')) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx > 0) {
      const prop = decl.substring(0, colonIdx).trim();
      const val = decl.substring(colonIdx + 1).trim();
      if (prop && val) {
        const camelProp = prop.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        styleObj[camelProp] = val;
      }
    }
  }
  return styleObj as React.CSSProperties;
}

interface MarkdownRendererProps {
  content: string;
  attachments?: Record<string, string>;
  onNavigate?: (mapId?: string, noteId?: string) => void;
  onNodeClick?: (nodeId: string) => void;
}

// Fixed plugin references to avoid re-instantiating AST parsers on re-render
const REMARK_PLUGINS = [remarkMath, remarkGfm];
const REHYPE_PLUGINS = [rehypeKatex];
const URL_TRANSFORM = (url: string) => url;

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = React.memo(({
  content,
  attachments = {},
  onNavigate,
  onNodeClick,
}) => {
  // Tiền xử lý nội dung để hỗ trợ cú pháp Wiki-link chuẩn Obsidian:
  // [[Tên ô ghi chú]] -> [Tên ô ghi chú](node:Tên ô ghi chú)
  // [[Tên ô ghi chú|Tên hiển thị]] -> [Tên hiển thị](node:Tên ô ghi chú)
  const processedContent = useMemo(() => {
    if (!content) return '';
    return content.replace(/\[\[(.*?)(?:\|(.*?))?\]\]/g, (_match, target, alias) => {
      const cleanTarget = (target || '').trim();
      const cleanAlias = (alias || cleanTarget).trim();
      return `[${cleanAlias}](node:${cleanTarget})`;
    });
  }, [content]);

  const components = useMemo(() => ({
    h1: ({ ...props }: React.ComponentPropsWithoutRef<'h1'>) => (
      <h1 className="text-xl font-bold text-white border-b border-zinc-700/60 pb-2 mb-3 mt-1" {...props} />
    ),
    h2: ({ ...props }: React.ComponentPropsWithoutRef<'h2'>) => (
      <h2 className="text-lg font-semibold text-zinc-100 border-b border-zinc-800 pb-1.5 mb-2 mt-4" {...props} />
    ),
    h3: ({ ...props }: React.ComponentPropsWithoutRef<'h3'>) => (
      <h3 className="text-base font-semibold text-purple-300 mb-2 mt-3" {...props} />
    ),
    h4: ({ ...props }: React.ComponentPropsWithoutRef<'h4'>) => (
      <h4 className="text-sm font-semibold text-zinc-300 mb-1 mt-2" {...props} />
    ),
    p: ({ ...props }: React.ComponentPropsWithoutRef<'p'>) => (
      <p className="leading-relaxed mb-2.5 text-zinc-300" {...props} />
    ),
    ul: ({ ...props }: React.ComponentPropsWithoutRef<'ul'>) => (
      <ul className="list-disc pl-5 space-y-1 mb-2.5 text-zinc-300" {...props} />
    ),
    ol: ({ ...props }: React.ComponentPropsWithoutRef<'ol'>) => (
      <ol className="list-decimal pl-5 space-y-1 mb-2.5 text-zinc-300" {...props} />
    ),
    li: ({ ...props }: React.ComponentPropsWithoutRef<'li'>) => (
      <li className="leading-relaxed" {...props} />
    ),
    /* Khung đóng ô / Callout Box */
    blockquote: ({ children }: { children?: React.ReactNode }) => {
      return (
        <blockquote className="relative my-3 p-3.5 rounded-xl bg-[#191925]/90 border-l-4 border-purple-500 border-t border-r border-b border-[#2d2d3f] shadow-lg text-zinc-200">
          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded-md bg-purple-500/20 text-purple-300 shrink-0 mt-0.5">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div className="flex-1 text-sm leading-relaxed not-italic">
              {children}
            </div>
          </div>
        </blockquote>
      );
    },
    /* Liên kết Web & Google Docs & Liên kết nội bộ Map/Node */
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      if (!href) return <span>{children}</span>;

      // Kiểm tra nếu là link web bên ngoài (bắt đầu bằng http://, https://, mailto:)
      let isExternal =
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('mailto:');

      // Nếu link trỏ về URL của app (chứa ?note= hoặc ?map= hoặc cùng hostname) thì coi là link nội bộ (ở lại tab hiện tại)
      if (isExternal && !href.startsWith('mailto:')) {
        try {
          const urlObj = new URL(href, window.location.origin);
          const isSameHost = urlObj.hostname === window.location.hostname;
          const hasNoteParam = urlObj.searchParams.has('note') || urlObj.searchParams.has('map');
          if (isSameHost || hasNoteParam) {
            isExternal = false;
          }
        } catch {
          // ignore
        }
      }

      if (!isExternal) {
        // Link nội bộ đến ô ghi chú hoặc bản đồ (không bao giờ mở tab mới gây trang trắng)
        return (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                let targetId = '';
                let targetMap: string | undefined;

                if (href.startsWith('node:')) {
                  targetId = decodeURIComponent(href.replace(/^node:/, ''));
                } else if (href.startsWith('#')) {
                  targetId = decodeURIComponent(href.replace(/^#/, ''));
                } else if (href.includes('?') && (href.includes('map=') || href.includes('note='))) {
                  const dummy = new URL(href, window.location.origin);
                  targetMap = dummy.searchParams.get('map') || undefined;
                  targetId = dummy.searchParams.get('note') || '';
                } else {
                  targetId = decodeURIComponent(href);
                }

                if (onNodeClick && targetId) {
                  onNodeClick(targetId);
                } else if (onNavigate) {
                  onNavigate(targetMap, targetId || undefined);
                } else {
                  window.dispatchEvent(
                    new CustomEvent('canvas-navigate', {
                      detail: { mapId: targetMap, noteId: targetId },
                    })
                  );
                }
              } catch {
                // Fallback
              }
            }}
            title="Nhấp để xem ô ghi chú này trên bản đồ (ở lại tab hiện tại)"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 my-0.5 rounded-full bg-purple-500/20 hover:bg-purple-500/35 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-medium cursor-pointer transition-colors shadow-sm select-none"
          >
            <Compass className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>{children}</span>
          </button>
        );
      }

      // Link web bên ngoài
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-medium underline underline-offset-4 transition-colors bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 my-0.5"
        >
          <span>{children}</span>
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      );
    },
    /* Khối mã nguồn & Ô màu (box) */
    code: ({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'>) => {
      const isInline = !className;
      if (className === 'language-box') {
        const rawText = String(children || '');
        const parsed = parseBoxBlock(rawText);
        return (
          <div
            style={parseInlineCssToReact(parsed.style)}
            className="my-3 rounded-xl shadow-lg leading-relaxed"
          >
            {parsed.title && (
              <div className="font-bold text-sm mb-1.5">{parsed.title}</div>
            )}
            <div className="text-xs sm:text-sm whitespace-pre-wrap">{parsed.content}</div>
          </div>
        );
      }
      return isInline ? (
        <code className="bg-zinc-800/90 text-purple-300 px-1.5 py-0.5 rounded text-xs font-mono border border-zinc-700/50" {...props}>
          {children}
        </code>
      ) : (
        <pre className="bg-[#101014] p-3 rounded-lg overflow-x-auto text-xs font-mono border border-zinc-800 text-zinc-300 my-2.5">
          <code {...props}>{children}</code>
        </pre>
      );
    },
    /* Bảng biểu */
    table: ({ ...props }: React.ComponentPropsWithoutRef<'table'>) => (
      <div className="overflow-x-auto my-3 rounded-lg border border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-800 text-xs text-left" {...props} />
      </div>
    ),
    thead: ({ ...props }: React.ComponentPropsWithoutRef<'thead'>) => <thead className="bg-[#1a1a24] text-zinc-200 font-semibold" {...props} />,
    th: ({ ...props }: React.ComponentPropsWithoutRef<'th'>) => <th className="px-3 py-2 border-r border-zinc-800 last:border-r-0" {...props} />,
    td: ({ ...props }: React.ComponentPropsWithoutRef<'td'>) => <td className="px-3 py-2 border-r border-t border-zinc-800/60 last:border-r-0 text-zinc-300" {...props} />,
    /* Render hình ảnh (cả URL web, data: URI, lẫn attachment:) */
    img: ({ src, alt }: { src?: string; alt?: string }) => {
      let actualSrc = src || '';
      if (actualSrc.startsWith('attachment:')) {
        const attachmentId = actualSrc.replace('attachment:', '');
        actualSrc = attachments[attachmentId] || '';
      }

      if (!actualSrc) {
        return (
          <div className="p-3 my-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 italic text-center">
            [Không tìm thấy ảnh: {alt || 'Hình ảnh'}]
          </div>
        );
      }

      return (
        <span
          className="relative inline-block max-w-full my-3 group cursor-zoom-in text-center mx-auto"
          onClick={(e) => {
            e.stopPropagation();
            openImageViewer({ src: actualSrc, alt, title: alt });
          }}
          title="Nhấp để mở & phóng to ảnh"
        >
          <img
            src={actualSrc}
            alt={alt || 'Note image'}
            className="max-w-full h-auto rounded-xl border border-zinc-700/70 shadow-lg object-contain max-h-80 mx-auto transition-transform duration-200 group-hover:scale-[1.01] group-hover:border-purple-500/60"
            loading="lazy"
          />
          <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/65 backdrop-blur-md border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md flex items-center gap-1 text-[10px]">
            <Maximize2 className="w-3 h-3 text-purple-300" />
            <span>Phóng to</span>
          </div>
          {alt && <span className="block text-center text-[11px] text-zinc-400 mt-1.5">{alt}</span>}
        </span>
      );
    },
  }), [attachments, onNavigate, onNodeClick]);

  if (!content || !content.trim()) {
    return (
      <div className="text-zinc-500 italic text-sm py-4">
        Chưa có nội dung. Hãy nhập văn bản hoặc công thức toán học bên tab Soạn thảo.
      </div>
    );
  }

  return (
    <div className="prose prose-invert max-w-none text-zinc-200 text-sm leading-relaxed space-y-3 break-words">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        urlTransform={URL_TRANSFORM}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';
