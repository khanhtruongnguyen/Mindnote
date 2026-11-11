import React, { useState } from 'react';
import {
  X,
  ArrowRightLeft,
  Copy,
  Scissors,
  Check,
  AlertTriangle,
  FolderSymlink,
} from 'lucide-react';
import type { CustomNode, MapData } from '../types';
import type { Edge } from '@xyflow/react';

interface MoveNodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNodes: CustomNode[];
  selectedEdges: Edge[];
  allMaps: MapData[];
  currentMapId: string;
  onConfirm: (targetMapId: string, action: 'move' | 'copy') => void;
}

export const MoveNodesModal: React.FC<MoveNodesModalProps> = ({
  isOpen,
  onClose,
  selectedNodes,
  selectedEdges,
  allMaps,
  currentMapId,
  onConfirm,
}) => {
  const otherMaps = allMaps.filter((m) => m.id !== currentMapId);
  const [targetMapId, setTargetMapId] = useState<string>(otherMaps[0]?.id || '');
  const [action, setAction] = useState<'move' | 'copy'>('move');

  if (!isOpen) return null;

  const handleExecute = () => {
    if (!targetMapId) {
      alert('Vui lòng chọn bản đồ đích!');
      return;
    }
    onConfirm(targetMapId, action);
  };

  const selectedMap = otherMaps.find((m) => m.id === targetMapId);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-[#161622] border border-[#2d2d42] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252538] bg-[#1a1a29]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Chuyển ô sang Bản đồ khác</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                  {selectedNodes.length} ô
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Di chuyển hoặc nhân bản cụm ô vừa khoanh vùng sang bản đồ bạn chọn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Thông tin vùng chọn */}
          <div className="p-3 rounded-xl bg-[#12121b] border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-zinc-300">
              <span className="font-semibold text-zinc-200">Các ô trong vùng khoanh:</span>
              <span className="font-mono text-purple-300">
                {selectedNodes.length} ô • {selectedEdges.length} liên kết nội bộ
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {selectedNodes.map((node) => (
                <span
                  key={node.id}
                  className="px-2 py-0.5 rounded-md bg-zinc-800/90 border border-zinc-700/60 text-zinc-200 text-[11px] truncate max-w-[200px]"
                >
                  {node.data?.label || 'Chưa đặt tên'}
                </span>
              ))}
            </div>
          </div>

          {/* Quy ước liên kết (Cắt bỏ các mũi tên nối ra ngoài) */}
          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200 flex items-start gap-2.5 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px]">
              <strong>Quy tắc liên kết:</strong> Chỉ giữ lại <strong>{selectedEdges.length}</strong> mũi tên kết nối giữa các ô cùng nằm trong vùng chọn. Các mũi tên nối ra ngoài (với các ô ở lại map cũ) sẽ tự động được cắt bỏ để tránh đứt gãy sơ đồ.
            </div>
          </div>

          {/* Chọn Bản đồ đích */}
          <div className="space-y-2">
            <label className="block font-semibold text-zinc-200">
              1. Chọn Bản đồ đích muốn chuyển vào:
            </label>

            {otherMaps.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs">
                Kho của bạn hiện chỉ có 1 bản đồ. Vui lòng tạo thêm một bản đồ mới trước khi thực hiện chuyển ô!
              </div>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {otherMaps.map((map) => {
                  const isSelected = map.id === targetMapId;
                  return (
                    <div
                      key={map.id}
                      onClick={() => setTargetMapId(map.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-purple-600/20 border-purple-500/80 text-white shadow-md shadow-purple-500/10'
                          : 'bg-[#12121b] border-zinc-800 hover:border-zinc-700 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FolderSymlink
                          className={`w-4 h-4 shrink-0 ${
                            isSelected ? 'text-purple-400' : 'text-zinc-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold truncate text-xs">{map.name}</div>
                          <div className="text-[10px] text-zinc-500">
                            Hiện có {map.nodes?.length || 0} ô ghi chú • Cập nhật{' '}
                            {new Date(map.updatedAt).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-purple-500 text-black flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chọn Hành vi: Di chuyển (Cắt) vs Nhân bản (Sao chép) */}
          <div className="space-y-2 pt-1">
            <label className="block font-semibold text-zinc-200">
              2. Chọn phương thức thực hiện:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAction('move')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  action === 'move'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-200 ring-1 ring-amber-500/50'
                    : 'bg-[#12121b] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <Scissors className="w-3.5 h-3.5 text-amber-400" />
                  <span>Di chuyển (Cắt)</span>
                </div>
                <div className="text-[11px] text-zinc-400 leading-tight">
                  Xóa các ô này ở Map hiện tại và chuyển sang Map đích.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAction('copy')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  action === 'copy'
                    ? 'bg-purple-600/25 border-purple-500 text-purple-200 ring-1 ring-purple-500/50'
                    : 'bg-[#12121b] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <Copy className="w-3.5 h-3.5 text-purple-400" />
                  <span>Nhân bản (Sao chép)</span>
                </div>
                <div className="text-[11px] text-zinc-400 leading-tight">
                  Giữ nguyên ở Map hiện tại và tạo bản sao sang Map đích.
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#252538] bg-[#1a1a29]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={handleExecute}
            disabled={!targetMapId || otherMaps.length === 0}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              action === 'move'
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
            }`}
          >
            {action === 'move' ? (
              <>
                <Scissors className="w-3.5 h-3.5" />
                <span>Xác nhận Di chuyển sang "{selectedMap?.name || 'Map đích'}"</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Xác nhận Sao chép sang "{selectedMap?.name || 'Map đích'}"</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
