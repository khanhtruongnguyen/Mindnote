import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MindMapNodeData } from '../../types';
import { COLOR_SCHEMES } from '../../constants/theme';
import { FileText, Sigma, Image as ImageIcon } from 'lucide-react';

export const MindMapNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const nodeData = data as MindMapNodeData;
  const colorScheme = COLOR_SCHEMES[nodeData.color] || COLOR_SCHEMES.purple;
  const shape = nodeData.shape || 'pill';

  // Check if content has formulas or images
  const hasFormula = nodeData.content?.includes('$');
  const hasImage = nodeData.content?.includes('![');

  return (
    <div className="relative group transition-transform duration-150">
      {/* 4 Handles for connecting edges */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-2.5 !h-2.5 !bg-zinc-500 hover:!bg-purple-400 !border-2 !border-[#121215]"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-2.5 !h-2.5 !bg-zinc-500 hover:!bg-purple-400 !border-2 !border-[#121215]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-2.5 !h-2.5 !bg-zinc-500 hover:!bg-purple-400 !border-2 !border-[#121215]"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-2.5 !h-2.5 !bg-zinc-500 hover:!bg-purple-400 !border-2 !border-[#121215]"
      />

      {/* Circle / Dot shape */}
      {shape === 'circle' && (
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-full border backdrop-blur-md cursor-pointer transition-all duration-200 ${
            colorScheme.bg
          } ${colorScheme.border} ${
            selected
              ? `ring-2 ring-purple-400 ring-offset-2 ring-offset-[#121215] ${colorScheme.glow} scale-110`
              : 'hover:scale-105 shadow-md'
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
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-full border backdrop-blur-md cursor-pointer transition-all duration-200 select-none ${
            colorScheme.bg
          } ${colorScheme.border} ${
            selected
              ? `ring-2 ring-purple-400/90 ring-offset-2 ring-offset-[#121215] ${colorScheme.glow} scale-[1.02]`
              : 'hover:border-zinc-500 hover:scale-[1.01] shadow-lg shadow-black/40'
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
          className={`flex flex-col gap-1.5 p-3 rounded-xl border backdrop-blur-md cursor-pointer transition-all duration-200 min-w-[160px] max-w-[220px] select-none ${
            colorScheme.bg
          } ${colorScheme.border} ${
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
    </div>
  );
});

MindMapNode.displayName = 'MindMapNode';
