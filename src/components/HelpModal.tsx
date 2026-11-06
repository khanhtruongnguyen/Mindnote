import React from 'react';
import { X, Command, MousePointer, Move, ZoomIn, Sigma, Image as ImageIcon } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181822] border border-[#2e2e3d] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a38] bg-[#1d1d28]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300">
              <Command className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Hướng dẫn & Phím tắt</h2>
              <p className="text-xs text-zinc-400">Thao tác mượt mà như Obsidian Canvas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-sm text-zinc-300">
          <div className="grid grid-cols-1 gap-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#14141a] border border-[#272733]">
              <div className="flex items-center gap-2">
                <MousePointer className="w-4 h-4 text-purple-400" />
                <span>Tạo nút ghi chú mới</span>
              </div>
              <span className="text-xs font-mono px-2 py-1 rounded bg-[#20202c] text-purple-300 border border-zinc-700">
                Nhấp đúp chuột (Double click)
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#14141a] border border-[#272733]">
              <div className="flex items-center gap-2">
                <Move className="w-4 h-4 text-blue-400" />
                <span>Di chuyển / Kéo bảng (Pan)</span>
              </div>
              <span className="text-xs font-mono px-2 py-1 rounded bg-[#20202c] text-blue-300 border border-zinc-700">
                Kéo chuột hoặc giữ Space + Kéo
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#14141a] border border-[#272733]">
              <div className="flex items-center gap-2">
                <ZoomIn className="w-4 h-4 text-emerald-400" />
                <span>Phóng to / Thu nhỏ (Zoom)</span>
              </div>
              <span className="text-xs font-mono px-2 py-1 rounded bg-[#20202c] text-emerald-300 border border-zinc-700">
                Cuộn con lăn chuột
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#14141a] border border-[#272733]">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span>Tạo mũi tên / đường nối</span>
              </div>
              <span className="text-xs font-mono px-2 py-1 rounded bg-[#20202c] text-zinc-300 border border-zinc-700">
                Kéo từ chấm tròn ở viền nút
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#14141a] border border-[#272733]">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>Dán ảnh chụp màn hình</span>
              </div>
              <span className="text-xs font-mono px-2 py-1 rounded bg-[#20202c] text-amber-300 border border-zinc-700">
                Ctrl + V trực tiếp vào ô soạn thảo
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#14141a] border border-[#272733]">
              <div className="flex items-center gap-2">
                <Sigma className="w-4 h-4 text-cyan-400" />
                <span>Công thức Toán LaTeX</span>
              </div>
              <span className="text-xs font-mono px-2 py-1 rounded bg-[#20202c] text-cyan-300 border border-zinc-700">
                $x^2$ hoặc $$\int...$$
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-purple-200/90 leading-relaxed">
            💡 <strong>Mẹo học tập:</strong> Bạn có thể chia mỗi môn học thành một <em>Bản đồ (Map)</em> riêng ở thanh trên cùng. Thu gọn các khái niệm thành dạng <em>Chấm tròn</em> hoặc <em>Thẻ nhỏ</em> để sơ đồ rộng mở và trực quan nhất!
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#14141c] border-t border-[#2a2a38] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
