import React, { useState } from 'react';
import {
  X,
  GitBranch,
  ArrowRight,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Network,
} from 'lucide-react';
import type { CustomNode } from '../types';
import type { Edge } from '@xyflow/react';
import { COLOR_SCHEMES } from '../constants/theme';

interface ConnectNodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: CustomNode[];
  edges: Edge[];
  onAddEdge: (sourceId: string, targetId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
}

export const ConnectNodesModal: React.FC<ConnectNodesModalProps> = ({
  isOpen,
  onClose,
  nodes,
  edges,
  onAddEdge,
  onDeleteEdge,
}) => {
  const [sourceId, setSourceId] = useState<string>(() => nodes[0]?.id || '');
  const [targetId, setTargetId] = useState<string>(() => nodes[1]?.id || nodes[0]?.id || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!sourceId || !targetId) {
      setErrorMsg('Vui lòng chọn cả ô bắt đầu và ô đích.');
      return;
    }

    if (sourceId === targetId) {
      setErrorMsg('Không thể tự nối một ô vào chính nó.');
      return;
    }

    // Check if edge already exists
    const exists = edges.some((e) => e.source === sourceId && e.target === targetId);
    if (exists) {
      setErrorMsg('Liên kết này đã tồn tại rồi.');
      return;
    }

    onAddEdge(sourceId, targetId);
    setSuccessMsg('Đã tạo liên kết mũi tên thành công!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#181824] border border-[#2e2e40] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#29293a] bg-[#13131c]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-md shadow-purple-600/30">
              <GitBranch className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Quản lý liên kết các ô</h2>
              <p className="text-[11px] text-zinc-400">Nối các ô note bằng cách chọn trực tiếp, không cần kéo thả</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs">
          {/* Quick Connect Form */}
          <div className="p-3.5 rounded-xl bg-[#14141d] border border-[#272738] space-y-3.5 shadow-sm">
            <span className="font-semibold text-zinc-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-purple-400" />
              <span>Tạo liên kết mới</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
              {/* Source Node Select */}
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-medium">Ô bắt đầu (Nguồn):</label>
                <select
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  className="w-full bg-[#1b1b26] border border-[#303044] focus:border-purple-500 rounded-xl px-2.5 py-2 text-zinc-200 outline-none text-xs truncate"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.data.label || 'Chưa đặt tên'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Arrow Indicator */}
              <div className="flex justify-center pt-3 sm:pt-4 text-purple-400">
                <ArrowRight className="w-4 h-4" />
              </div>

              {/* Target Node Select */}
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-medium">Ô đích (Trỏ tới):</label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full bg-[#1b1b26] border border-[#303044] focus:border-purple-500 rounded-xl px-2.5 py-2 text-zinc-200 outline-none text-xs truncate"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.data.label || 'Chưa đặt tên'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleConnect}
                disabled={nodes.length < 2}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md shadow-purple-600/30 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Nối 2 ô này ngay</span>
              </button>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          {/* Existing Connections List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="font-semibold text-zinc-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5 text-cyan-400" />
                <span>Các liên kết hiện có ({edges.length})</span>
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 bg-[#12121a] p-2 rounded-xl border border-[#252536]">
              {edges.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-xs">
                  Chưa có mũi tên liên kết nào trên sơ đồ.
                </div>
              ) : (
                edges.map((edge) => {
                  const sourceNode = nodes.find((n) => n.id === edge.source);
                  const targetNode = nodes.find((n) => n.id === edge.target);

                  const sourceColor = sourceNode?.data?.color || 'purple';
                  const targetColor = targetNode?.data?.color || 'purple';

                  return (
                    <div
                      key={edge.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#181824] border border-[#272738] text-xs hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        {/* Source Pill */}
                        <div className="flex items-center gap-1 truncate max-w-[120px] sm:max-w-[160px]">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              COLOR_SCHEMES[sourceColor]?.dot || 'bg-purple-500'
                            } shrink-0`}
                          />
                          <span className="truncate text-zinc-200 font-medium">
                            {sourceNode?.data.label || edge.source}
                          </span>
                        </div>

                        {/* Arrow */}
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />

                        {/* Target Pill */}
                        <div className="flex items-center gap-1 truncate max-w-[120px] sm:max-w-[160px]">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              COLOR_SCHEMES[targetColor]?.dot || 'bg-purple-500'
                            } shrink-0`}
                          />
                          <span className="truncate text-zinc-200 font-medium">
                            {targetNode?.data.label || edge.target}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteEdge(edge.id)}
                        title="Xóa liên kết này"
                        className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#29293a] bg-[#13131c] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
