import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { Trash2 } from 'lucide-react';

interface CustomEdgeData {
  onDelete?: (id: string) => void;
  [key: string]: unknown;
}

export const CustomEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  data,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as CustomEdgeData | undefined;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {/* Nút xóa liên kết khi chạm/chọn đường nối */}
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan z-30"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (edgeData?.onDelete) {
                  edgeData.onDelete(id);
                }
              }}
              title="Xóa đường nối này"
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold shadow-xl border border-rose-400/50 transition-transform active:scale-95 animate-in zoom-in-75 duration-150"
            >
              <Trash2 className="w-3 h-3" />
              <span>Xóa nối</span>
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
