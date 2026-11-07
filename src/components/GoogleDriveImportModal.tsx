import React, { useState } from 'react';
import { Cloud, Link as LinkIcon, Smartphone, Download, X, AlertCircle } from 'lucide-react';
import type { ImportDataResult } from '../types';
import { StorageService } from '../services/storage';

interface GoogleDriveImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFromDevice: () => void;
  onDataLoaded: (result: ImportDataResult) => void;
}

export const GoogleDriveImportModal: React.FC<GoogleDriveImportModalProps> = ({
  isOpen,
  onClose,
  onSelectFromDevice,
  onDataLoaded,
}) => {
  const [driveUrl, setDriveUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFetchDriveUrl = async () => {
    if (!driveUrl.trim()) {
      setErrorMsg('Vui lòng dán đường link chia sẻ từ Google Drive.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Thử gọi qua endpoint API /api/gdrive của Vercel
      const apiUrl = `/api/gdrive?url=${encodeURIComponent(driveUrl.trim())}`;
      const res = await fetch(apiUrl);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Lỗi tải file (HTTP ${res.status}). Đảm bảo file được bật quyền "Bất kỳ ai có đường link".`);
      }

      const json = await res.json();
      const parsed = StorageService.parseImportData(json);
      onDataLoaded(parsed);
      onClose();
    } catch (err: any) {
      console.error('Fetch Google Drive error:', err);
      setErrorMsg(err.message || 'Không thể nạp file từ link Google Drive này. Bạn có thể dùng cách 1 (chọn tệp từ ứng dụng Drive).');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#181822] border border-[#2e2e42] rounded-2xl shadow-2xl p-5 sm:p-6 text-zinc-100 flex flex-col overflow-hidden">
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
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Nạp từ Google Drive</h3>
            <p className="text-xs text-zinc-400">Chọn file từ Drive hoặc dán link chia sẻ</p>
          </div>
        </div>

        {/* Thân Modal */}
        <div className="py-4 space-y-4">
          {/* Cách 1: Nhanh nhất trên điện thoại */}
          <div className="p-3.5 rounded-xl bg-[#121218] border border-[#2a2a3d] space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
              <Smartphone className="w-4 h-4 text-purple-400" />
              <span>Cách 1: Chọn từ Google Drive (Khuyên dùng trên iPhone/iPad)</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Nhấp nút bên dưới để mở trình duyệt tệp của máy. Trong ứng dụng <b>Tệp (Files)</b>, chọn thư mục <b>Google Drive &gt; Mindnote</b> để nạp tức thì!
            </p>
            <button
              onClick={() => {
                onClose();
                onSelectFromDevice();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-md transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Mở bộ chọn tệp (Chọn từ Drive)</span>
            </button>
          </div>

          {/* Cách 2: Dán link Google Drive */}
          <div className="p-3.5 rounded-xl bg-[#121218] border border-[#2a2a3d] space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
              <LinkIcon className="w-4 h-4 text-blue-400" />
              <span>Cách 2: Dán link chia sẻ Google Drive</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Nếu bạn chia sẻ file qua link, chỉ cần dán link file JSON vào ô dưới:
            </p>

            <input
              type="text"
              placeholder="https://drive.google.com/file/d/..."
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#1a1a26] border border-zinc-700/80 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500"
            />

            {errorMsg && (
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleFetchDriveUrl}
              disabled={isLoading || !driveUrl.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#222232] hover:bg-purple-600/30 border border-[#333348] text-purple-300 hover:text-white font-medium text-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isLoading ? 'Đang tải file từ Drive...' : 'Tải về & Nạp vào Mindnote'}</span>
            </button>
          </div>
        </div>

        {/* Nút đóng */}
        <div className="pt-2 border-t border-[#2e2e42] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#20202c] hover:bg-[#28283a] text-zinc-300 text-xs transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
