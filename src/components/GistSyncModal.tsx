import React, { useState } from 'react';
import { X, Cloud, Key, CheckCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { StorageService } from '../services/storage';
import type { MapData } from '../types';

interface GistSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  maps: MapData[];
  onMapsLoaded: (maps: MapData[]) => void;
  githubToken: string;
  gistId: string;
  onSaveCredentials: (token: string, gistId: string) => void;
}

export const GistSyncModal: React.FC<GistSyncModalProps> = ({
  isOpen,
  onClose,
  maps,
  onMapsLoaded,
  githubToken,
  gistId,
  onSaveCredentials,
}) => {
  const [token, setToken] = useState(githubToken || '');
  const [currentGistId, setCurrentGistId] = useState(gistId || '');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSaveAndPush = async () => {
    if (!token.trim()) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập GitHub Personal Access Token.' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await StorageService.syncToGist(token.trim(), currentGistId.trim() || null, maps);
      setCurrentGistId(res.gistId);
      onSaveCredentials(token.trim(), res.gistId);
      setStatusMessage({
        type: 'success',
        text: `Đồng bộ thành công lên GitHub Gist! ID: ${res.gistId}`,
      });
    } catch (e: unknown) {
      const error = e as Error;
      setStatusMessage({
        type: 'error',
        text: error.message || 'Lỗi khi đồng bộ lên GitHub Gist.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePullFromGist = async () => {
    if (!token.trim() || !currentGistId.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Cần có cả Token và Gist ID để tải dữ liệu về.',
      });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const remoteMaps = await StorageService.loadFromGist(token.trim(), currentGistId.trim());
      onMapsLoaded(remoteMaps);
      onSaveCredentials(token.trim(), currentGistId.trim());
      setStatusMessage({
        type: 'success',
        text: `Đã tải về thành công ${remoteMaps.length} bản đồ từ GitHub Gist!`,
      });
    } catch (e: unknown) {
      const error = e as Error;
      setStatusMessage({
        type: 'error',
        text: error.message || 'Không thể tải dữ liệu từ GitHub Gist.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181822] border border-[#2e2e3d] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a38] bg-[#1d1d28]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Đồng bộ GitHub Gist</h2>
              <p className="text-xs text-zinc-400">Sao lưu dữ liệu cá nhân an toàn vào tài khoản GitHub của bạn</p>
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
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-purple-400" />
              <span>GitHub Personal Access Token (Classic hoặc Fine-grained)</span>
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full bg-[#121218] border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-purple-500 font-mono transition-colors"
            />
            <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500">
              <span>Chỉ cần quyền tick chọn scope: <code className="text-purple-400 font-mono">gist</code>.</span>
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noreferrer"
                className="text-purple-400 hover:underline flex items-center gap-0.5 ml-1"
              >
                <span>Tạo token tại đây</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              Gist ID (Để trống nếu muốn tạo Gist mới)
            </label>
            <input
              type="text"
              value={currentGistId}
              onChange={(e) => setCurrentGistId(e.target.value)}
              placeholder="Ví dụ: 8d2b904d95..."
              className="w-full bg-[#121218] border border-zinc-700/80 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-purple-500 font-mono transition-colors"
            />
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs leading-relaxed ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
              }`}
            >
              {statusMessage.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#14141c] border-t border-[#2a2a38]">
          <button
            onClick={handlePullFromGist}
            disabled={loading || !currentGistId.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Kéo về máy (Pull)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white text-xs font-medium transition-colors"
            >
              Đóng
            </button>
            <button
              onClick={handleSaveAndPush}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-colors"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              <span>{currentGistId ? 'Cập nhật lên Gist' : 'Tạo mới & Đẩy lên Gist'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
