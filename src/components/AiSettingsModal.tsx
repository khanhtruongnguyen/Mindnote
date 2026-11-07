import React, { useState } from 'react';
import {
  X,
  Sparkles,
  RefreshCw,
  Search,
  Check,
  AlertCircle,
  Key,
  Globe,
  Cpu,
  Zap,
} from 'lucide-react';
import { AiService } from '../services/aiService';
import type { AppSettings } from '../types';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (updates: Partial<AppSettings>) => void;
}

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [baseUrl, setBaseUrl] = useState(settings.aiBaseUrl || 'https://api.xah.io/v1');
  const [apiKey, setApiKey] = useState(
    settings.aiApiKey || 'sk-6e5bd68e2310d13bcf3747838f1cf8138d68e14e318e4e7e68cfb62a30aff59b'
  );
  const [selectedModel, setSelectedModel] = useState(
    settings.aiModel || 'dungcsnd113/gemini-flash-3.8'
  );
  const [models, setModels] = useState<string[]>(() => settings.cachedModels || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    type: 'success' | 'error' | 'loading' | null;
    message?: string;
  }>({ type: null });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFetchModels = async () => {
    if (!apiKey.trim()) {
      setErrorMsg('Vui lòng nhập API Key trước khi tải danh sách model.');
      return;
    }
    setIsLoadingModels(true);
    setErrorMsg(null);
    try {
      const fetched = await AiService.fetchAvailableModels(baseUrl, apiKey);
      setModels(fetched);
      onSaveSettings({
        aiBaseUrl: baseUrl,
        aiApiKey: apiKey,
        cachedModels: fetched,
      });
      setTestStatus({
        type: 'success',
        message: `Đã tải thành công ${fetched.length} model từ máy chủ!`,
      });
      setTimeout(() => setTestStatus({ type: null }), 3000);
    } catch (e: unknown) {
      const err = e as Error;
      setErrorMsg(err.message || 'Không thể tải danh sách model');
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setErrorMsg('Vui lòng nhập API Key.');
      return;
    }
    setTestStatus({ type: 'loading', message: 'Đang gửi kiểm tra kết nối...' });
    setErrorMsg(null);
    try {
      await AiService.streamChatCompletion({
        baseUrl,
        apiKey,
        model: selectedModel,
        messages: [{ role: 'user', content: 'Trả lời ngắn 1 từ: OK' }],
        onChunk: () => {},
      });
      setTestStatus({
        type: 'success',
        message: `Kết nối thành công tới model ${selectedModel}!`,
      });
      setTimeout(() => setTestStatus({ type: null }), 4000);
    } catch (e: unknown) {
      const err = e as Error;
      setTestStatus({
        type: 'error',
        message: `Lỗi kết nối: ${err.message}`,
      });
    }
  };

  const handleSaveAndClose = () => {
    onSaveSettings({
      aiBaseUrl: baseUrl.trim(),
      aiApiKey: apiKey.trim(),
      aiModel: selectedModel.trim(),
      cachedModels: models,
    });
    onClose();
  };

  const filteredModels = models.filter((m) =>
    m.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#181822] border border-[#2e2e3d] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a2a38] bg-[#14141c]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-600/30">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Cấu hình API & Model AI</h2>
              <p className="text-[11px] text-zinc-400">Tùy chỉnh API key và chọn model phù hợp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <span>Tên miền API (Base URL)</span>
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.xah.io/v1"
              className="w-full bg-[#101016] border border-[#2b2b3a] focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 outline-none transition-colors"
            />
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>API Key</span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-[#101016] border border-[#2b2b3a] focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 outline-none transition-colors"
            />
          </div>

          {/* Selected Model & Controls */}
          <div className="space-y-2 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>Model đang chọn</span>
              </label>

              <button
                type="button"
                onClick={handleFetchModels}
                disabled={isLoadingModels}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                <span>{isLoadingModels ? 'Đang tải...' : 'Tải danh sách Model'}</span>
              </button>
            </div>

            {/* Current Model Input */}
            <input
              type="text"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              placeholder="dungcsnd113/gemini-flash-3.8"
              className="w-full bg-[#101016] border border-[#2b2b3a] focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-cyan-200 outline-none"
            />

            {/* Model Search Box (if models loaded) */}
            {models.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Tìm kiếm trong danh sách ({filteredModels.length}/{models.length}):</span>
                  {selectedModel && (
                    <span className="text-zinc-500 truncate max-w-[200px]">
                      Đã chọn: <strong className="text-purple-300">{selectedModel}</strong>
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Lọc theo tên (vd: gemini, deepseek, flash, dungcsnd113)..."
                    className="w-full bg-[#13131c] border border-[#282836] rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-purple-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-zinc-500 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Model Scrollable List */}
                <div className="max-h-48 overflow-y-auto space-y-1 bg-[#101017] p-1.5 rounded-xl border border-[#222230]">
                  {filteredModels.length === 0 ? (
                    <div className="text-center py-4 text-xs text-zinc-500">
                      Không tìm thấy model khớp với "{searchQuery}"
                    </div>
                  ) : (
                    filteredModels.map((modelId) => {
                      const isSelected = selectedModel === modelId;
                      return (
                        <button
                          key={modelId}
                          type="button"
                          onClick={() => setSelectedModel(modelId)}
                          className={`w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                            isSelected
                              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 font-semibold'
                              : 'text-zinc-300 hover:bg-[#1a1a24] hover:text-white'
                          }`}
                        >
                          <span className="truncate pr-2">{modelId}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Test Status Message */}
          {testStatus.message && (
            <div
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs ${
                testStatus.type === 'success'
                  ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                  : testStatus.type === 'error'
                  ? 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                  : 'bg-purple-950/40 border border-purple-500/30 text-purple-300'
              }`}
            >
              <Zap className="w-4 h-4 shrink-0" />
              <span>{testStatus.message}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#2a2a38] bg-[#14141c] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testStatus.type === 'loading'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#20202c] hover:bg-[#282837] text-zinc-300 hover:text-white border border-[#303042] text-xs font-medium transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Thử kết nối</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/60 text-xs transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02]"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Lưu cấu hình</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
