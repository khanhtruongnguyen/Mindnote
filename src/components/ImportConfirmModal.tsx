import React from 'react';
import type { MapData, ImportDataResult } from '../types';
import {
  Layers,
  FileText,
  AlertTriangle,
  CheckCircle2,
  CopyPlus,
  RefreshCw,
  X,
  Image,
  GitBranch,
} from 'lucide-react';

interface ImportConfirmModalProps {
  isOpen: boolean;
  importResult: ImportDataResult | null;
  existingMaps: MapData[];
  onClose: () => void;
  // Cho Single Map
  onUpdateExisting: (importedMap: MapData, existingMapId: string) => void;
  onAddNewMap: (importedMap: MapData) => void;
  // Cho Multi Maps
  onMergeVault: (importedMaps: MapData[]) => void;
  onReplaceVault: (importedMaps: MapData[]) => void;
}

export const ImportConfirmModal: React.FC<ImportConfirmModalProps> = ({
  isOpen,
  importResult,
  existingMaps,
  onClose,
  onUpdateExisting,
  onAddNewMap,
  onMergeVault,
  onReplaceVault,
}) => {
  if (!isOpen || !importResult) return null;

  const isSingle = importResult.type === 'single_map';
  const singleMap = isSingle ? importResult.map : null;

  // Kiểm tra trùng lặp cho single map (theo ID hoặc theo Tên)
  const existingMatch = isSingle && singleMap
    ? existingMaps.find((m) => m.id === singleMap.id || m.name.trim().toLowerCase() === singleMap.name.trim().toLowerCase())
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#181822] border border-[#2e2e42] rounded-2xl shadow-2xl p-5 sm:p-6 text-zinc-100 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Nút đóng */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Tiêu đề */}
        <div className="flex items-center gap-3 pb-3 border-b border-[#2e2e42]">
          <div className="p-2.5 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
            {isSingle ? <FileText className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              {isSingle ? 'Nhập Bản Đồ Đơn Lẻ' : 'Khôi Phục Sao Lưu Kho'}
            </h3>
            <p className="text-xs text-zinc-400">
              {isSingle ? 'Xử lý nạp một bản đồ từ file JSON' : 'Xử lý file sao lưu chứa nhiều bản đồ'}
            </p>
          </div>
        </div>

        {/* Thân Modal */}
        <div className="py-4 space-y-4 overflow-y-auto pr-1">
          {isSingle && singleMap && (
            <>
              {/* Thẻ thông tin Map */}
              <div className="p-3.5 rounded-xl bg-[#121218] border border-[#2a2a3d] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-purple-300 truncate max-w-[280px]">
                    {singleMap.name}
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-500/40 text-purple-300">
                    Bản đồ đơn lẻ
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-zinc-400 pt-1">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    <strong className="text-zinc-200">{(singleMap.nodes || []).length}</strong> ô ghi chú
                  </span>
                  <span className="flex items-center gap-1">
                    <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
                    <strong className="text-zinc-200">{(singleMap.edges || []).length}</strong> liên kết
                  </span>
                  <span className="flex items-center gap-1">
                    <Image className="w-3.5 h-3.5 text-zinc-500" />
                    <strong className="text-zinc-200">{Object.keys(singleMap.attachments || {}).length}</strong> hình ảnh
                  </span>
                </div>
              </div>

              {/* Tình trạng trùng lặp */}
              {existingMatch ? (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200/90 flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-300">
                      Đã tìm thấy bản đồ "{existingMatch.name}" trong kho của bạn.
                    </span>
                    <p className="mt-1 text-amber-200/70 text-[11px] leading-relaxed">
                      Khi chọn <b>"Cập nhật"</b>, hệ thống sẽ tự động tạo một bản sao lưu dự phòng cho bản đồ cũ để bảo vệ 100% dữ liệu của bạn, không lo mất mát!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Bản đồ này chưa có trong kho. Bạn có thể thêm an toàn vào bộ sưu tập.</span>
                </div>
              )}

              {/* Các nút hành động */}
              <div className="space-y-2 pt-2">
                {existingMatch && (
                  <button
                    onClick={() => {
                      onUpdateExisting(singleMap, existingMatch.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-lg shadow-purple-600/25 transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <RefreshCw className="w-4 h-4 text-purple-200 group-hover:rotate-180 transition-transform duration-500" />
                      <div>
                        <div className="font-semibold">Cập nhật bản đồ này (Khuyên dùng)</div>
                        <div className="text-[11px] text-purple-200/80 font-normal">
                          Cập nhật bản mới + Tự động lưu bản cũ vào kho dự phòng
                        </div>
                      </div>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => {
                    onAddNewMap(singleMap);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border font-medium text-xs transition-all text-left cursor-pointer group ${
                    existingMatch
                      ? 'bg-[#1e1e2c] border-[#36364a] text-zinc-200 hover:bg-[#28283a] hover:border-zinc-500'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <CopyPlus className="w-4 h-4 text-zinc-400 group-hover:text-white" />
                    <div>
                      <div className="font-semibold">
                        {existingMatch ? 'Thêm thành bản đồ mới độc lập' : 'Thêm bản đồ vào kho'}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-normal">
                        {existingMatch
                          ? `Tạo bản đồ mới mang tên "${singleMap.name} (Bản mới)"`
                          : 'Lưu bản đồ này vào danh sách bản đồ của bạn'}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </>
          )}

          {!isSingle && importResult.type === 'multi_maps' && (
            <>
              <div className="p-3.5 rounded-xl bg-[#121218] border border-[#2a2a3d] space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-purple-300">File Sao Lưu Toàn Bộ Kho</div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-950/60 border border-blue-500/40 text-blue-300">
                    Kho đa bản đồ
                  </span>
                </div>
                <div className="text-xs text-zinc-400">
                  File chứa tổng cộng <strong className="text-zinc-200">{importResult.maps.length}</strong> bản đồ ghi chú.
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    onMergeVault(importResult.maps);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-lg shadow-purple-600/25 transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <GitBranch className="w-4 h-4 text-purple-200" />
                    <div>
                      <div className="font-semibold">Gộp vào kho hiện tại (Khuyên dùng)</div>
                      <div className="text-[11px] text-purple-200/80 font-normal">
                        Giữ nguyên các bản đồ hiện tại, chỉ thêm hoặc cập nhật các bản đồ từ file
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (confirm('CẢNH BÁO: Thao tác này sẽ thay thế TOÀN BỘ kho hiện tại bằng các bản đồ trong file. Bạn chắc chắn chứ?')) {
                      onReplaceVault(importResult.maps);
                      onClose();
                    }
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-500/40 text-rose-300 font-medium text-xs transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <div>
                      <div className="font-semibold">Thay thế toàn bộ kho</div>
                      <div className="text-[11px] text-rose-300/70 font-normal">
                        Xóa sạch kho hiện tại và nạp lại toàn bộ từ file sao lưu này
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Nút hủy phía dưới */}
        <div className="pt-3 border-t border-[#2e2e42] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#20202c] hover:bg-[#28283a] text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Đóng / Hủy bỏ
          </button>
        </div>
      </div>
    </div>
  );
};
