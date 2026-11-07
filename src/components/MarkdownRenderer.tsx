import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { ExternalLink, Lightbulb, MapPin } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  attachments?: Record<string, string>;
  onNodeClick?: (nodeId: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  attachments = {},
  onNodeClick,
}) => {
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
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        urlTransform={(url) => url} // Cho phép render cả data: URI và attachment: URI
        components={{
          h1: ({ ...props }) => (
            <h1 className="text-xl font-bold text-white border-b border-zinc-700/60 pb-2 mb-3 mt-1" {...props} />
          ),
          h2: ({ ...props }) => (
            <h2 className="text-lg font-semibold text-zinc-100 border-b border-zinc-800 pb-1.5 mb-2 mt-4" {...props} />
          ),
          h3: ({ ...props }) => (
            <h3 className="text-base font-semibold text-purple-300 mb-2 mt-3" {...props} />
          ),
          h4: ({ ...props }) => (
            <h4 className="text-sm font-semibold text-zinc-300 mb-1 mt-2" {...props} />
          ),
          p: ({ ...props }) => (
            <p className="leading-relaxed mb-2.5 text-zinc-300" {...props} />
          ),
          ul: ({ ...props }) => (
            <ul className="list-disc pl-5 space-y-1 mb-2.5 text-zinc-300" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="list-decimal pl-5 space-y-1 mb-2.5 text-zinc-300" {...props} />
          ),
          li: ({ ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          /* Khung đóng ô / Callout Box */
          blockquote: ({ children }) => {
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
          /* Liên kết Web hoặc Node trong Mind Map */
          a: ({ href, children }) => {
            if (href?.startsWith('node:')) {
              const targetNodeId = href.replace(/^node:/, '');
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onNodeClick?.(targetNodeId);
                  }}
                  className="inline-flex items-center gap-1 text-purple-300 hover:text-white font-medium bg-purple-500/20 hover:bg-purple-500/35 px-2 py-0.5 rounded-full border border-purple-500/40 transition-all cursor-pointer my-0.5 text-xs shadow-sm"
                  title="Nhấp để chuyển đến vị trí ô này trên sơ đồ"
                >
                  <MapPin className="w-3 h-3 text-purple-400 shrink-0" />
                  <span>{children}</span>
                </button>
              );
            }
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
          /* Khối mã nguồn */
          code: ({ className, children, ...props }) => {
            const isInline = !className;
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
          table: ({ ...props }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-800 text-xs text-left" {...props} />
            </div>
          ),
          thead: ({ ...props }) => <thead className="bg-[#1a1a24] text-zinc-200 font-semibold" {...props} />,
          th: ({ ...props }) => <th className="px-3 py-2 border-r border-zinc-800 last:border-r-0" {...props} />,
          td: ({ ...props }) => <td className="px-3 py-2 border-r border-t border-zinc-800/60 last:border-r-0 text-zinc-300" {...props} />,
          /* Render hình ảnh (cả URL web, data: URI, lẫn attachment:) */
          img: ({ src, alt }) => {
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
              <span className="block my-3">
                <img
                  src={actualSrc}
                  alt={alt || 'Note image'}
                  className="max-w-full h-auto rounded-xl border border-zinc-700/70 shadow-lg object-contain max-h-80 mx-auto transition-transform hover:scale-[1.01]"
                  loading="lazy"
                />
                {alt && <span className="block text-center text-[11px] text-zinc-400 mt-1.5">{alt}</span>}
              </span>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
