import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MindMapNodeData } from '../../types';
import { COLOR_SCHEMES } from '../../constants/theme';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { FileText, Sigma, Image as ImageIcon, GripHorizontal } from 'lucide-react';

export const MindMapNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as MindMapNodeData;
  const colorScheme = COLOR_SCHEMES[nodeData.color] || COLOR_SCHEMES.purple;
  const shape = nodeData.shape || 'pill';

  // Check if content has formulas or images
  const hasFormula = nodeData.content?.includes('$');
  const hasImage = nodeData.content?.includes('![');

  return (
    <div className={`relative group ${selected ? 'z-[9999]' : ''} will-change-transform`}>
      {/* 4 Handles for connecting edges - Hỗ trợ kéo từ bất kỳ cạnh nào và thả vào bất kỳ cạnh nào */}
      {/* TOP */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-3 !h-3 !bg-zinc-500 hover:!bg-purple-400 !border-2 !border-[#121215] transition-colors"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-src"
        className="!w-3 !h-3 !bg-transparent !border-0"
      />

      {/* RIGHT */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-3 !h-3 !bg-zinc-500 hover:!bg-purple-400 !border-2 !border-[#121215] transition-colors"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-tgt"
        className="!w-3 !h-3 !bg-transparent !border-0"
      />

      {/* BOTTOM */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-3 !h-3 !bg-zinc-500 hover:!bg-purple-400 !border-2 !border-[#121215] transition-colors"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-tgt"
        className="!w-3 !h-3 !bg-transparent !border-0"
      />

      {/* LEFT */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-3 !h-3 !bg-zinc-500 hover:!bg-purple-400 !border-2 !border-[#121215] transition-colors"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-src"
        className="!w-3 !h-3 !bg-transparent !border-0"
      />

      {/* Circle / Dot shape */}
      {shape === 'circle' && (
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-full border backdrop-blur-md cursor-grab active:cursor-grabbing touch-none select-none transition-colors duration-150 ${
            colorScheme.bg
          } ${colorScheme.border} ${
            selected
              ? `ring-2 ring-purple-400 ring-offset-2 ring-offset-[#121215] ${colorScheme.glow}`
              : 'shadow-md'
          }`}
        >
          <div className={`w-3 h-3 rounded-full ${colorScheme.dot} shadow-sm animate-pulse`} />
          <div className="absolute top-11 whitespace-nowrap px-2 py-0.5 rounded bg-[#18181f]/90 border border-[#2a2a35] text-[11px] font-medium text-zinc-300 pointer-events-none shadow-lg">
            {nodeData.label || 'Chưa đặt tên'}
          </div>
        </div>
      )}

      {/* Pill Capsule shape (Obsidian favorite) */}
      {shape === 'pill' && (
        <div
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-full border backdrop-blur-md cursor-grab active:cursor-grabbing touch-none transition-colors duration-150 select-none ${
            colorScheme.bg
          } ${colorScheme.border} ${
            selected
              ? `ring-2 ring-purple-400/90 ring-offset-2 ring-offset-[#121215] ${colorScheme.glow}`
              : 'hover:border-zinc-500 shadow-lg shadow-black/40'
          }`}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${colorScheme.dot} shrink-0 shadow-sm`} />
          
          <span className="text-xs font-semibold text-zinc-100 max-w-[200px] truncate tracking-wide">
            {nodeData.label || 'Chưa đặt tên'}
          </span>

          {/* Indicator icons */}
          <div className="flex items-center gap-1 ml-0.5 opacity-60">
            {hasFormula && <Sigma className="w-3 h-3 text-cyan-400" />}
            {hasImage && <ImageIcon className="w-3 h-3 text-emerald-400" />}
            {!hasFormula && !hasImage && <FileText className="w-3 h-3 text-zinc-400" />}
          </div>
        </div>
      )}

      {/* Card shape */}
      {shape === 'card' && (
        <div
          className={`flex flex-col gap-1.5 p-3 rounded-xl border bg-[#161622] cursor-grab active:cursor-grabbing touch-none transition-colors duration-150 min-w-[160px] max-w-[220px] select-none ${
            colorScheme.border
          } ${
            selected
              ? `ring-2 ring-purple-400/90 ring-offset-2 ring-offset-[#121215] ${colorScheme.glow}`
              : 'hover:border-zinc-500 shadow-xl shadow-black/40'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${colorScheme.dot} shrink-0`} />
            <span className="text-xs font-semibold text-zinc-100 truncate flex-1">
              {nodeData.label || 'Chưa đặt tên'}
            </span>
          </div>
          {nodeData.content && (
            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
              {nodeData.content.replace(/#|\*|`|\$/g, '')}
            </p>
          )}
        </div>
      )}

      {/* Full Note directly on Canvas mode (Hiển thị toàn bộ ghi chú trên Map - Tối ưu kéo trên điện thoại & 60FPS) */}
      {shape === 'full' && (
        <div
          className={`flex flex-col rounded-2xl border bg-[#151520] transition-colors duration-150 w-[320px] sm:w-[420px] max-h-[480px] shadow-2xl shadow-black/80 ${
            colorScheme.border
          } ${
            selected
              ? `ring-2 ring-purple-400 ring-offset-2 ring-offset-[#121215] ${colorScheme.glow} shadow-purple-500/20`
              : 'hover:border-zinc-500'
          }`}
        >
          {/* Header of Full Note - Vùng kéo thả chuyên dụng (Drag Handle) */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-800/80 bg-[#12121a] rounded-t-2xl shrink-0 touch-none cursor-grab active:cursor-grabbing select-none hover:bg-[#161622] transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <GripHorizontal className="w-4 h-4 text-zinc-500 hover:text-purple-300 shrink-0" />
              <span className={`w-2.5 h-2.5 rounded-full ${colorScheme.dot} shrink-0 shadow-sm`} />
              <span className="text-xs font-bold text-zinc-100 truncate">
                {nodeData.label || 'Chưa đặt tên'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 opacity-70">
              {hasFormula && <Sigma className="w-3.5 h-3.5 text-cyan-400" />}
              {hasImage && <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />}
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                Toàn bộ
              </span>
            </div>
          </div>

          {/* Body with Markdown & KaTeX */}
          <div
            className="nowheel nopan nodrag p-3.5 overflow-y-auto max-h-[380px] text-xs space-y-2 select-text cursor-auto touch-pan-y"
            onWheel={(e) => e.stopPropagation()}
          >
            {nodeData.content && nodeData.content.trim() ? (
              <MarkdownRenderer
                content={nodeData.content}
                attachments={nodeData.attachments as Record<string, string>}
                onNavigate={nodeData.onNavigate as any}
                onNodeClick={nodeData.onNodeClick as any}
              />
            ) : (
              <div className="text-zinc-500 italic text-xs py-2">
                Chưa có nội dung. Bấm vào ô này để bắt đầu viết chi tiết.
              </div>
            )}
          </div>

          {/* Bottom Drag Handle Bar (Hỗ trợ ngón tay cái kéo trên điện thoại cực mượt) */}
          <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-[#12121a] border-t border-zinc-800/80 rounded-b-2xl text-[10px] text-zinc-500 font-medium touch-none cursor-grab active:cursor-grabbing select-none hover:text-purple-300 hover:bg-[#161622] transition-colors shrink-0">
            <GripHorizontal className="w-3.5 h-3.5" />
            <span>Kéo di chuyển ô</span>
          </div>
        </div>
      )}
    </div>
  );
});

MindMapNode.displayName = 'MindMapNode';
