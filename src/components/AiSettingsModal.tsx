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
  Shuffle,
  Plus,
  Trash2,
  Star,
  ListPlus,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { AiService, getRotationModels } from '../services/aiService';
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
  const [preferredModels, setPreferredModels] = useState<string[]>(() =>
    getRotationModels(settings)
  );
  const [newModelInput, setNewModelInput] = useState('');
  const [autoFallback, setAutoFallback] = useState<boolean>(settings.autoFallbackModel !== false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchText, setBatchText] = useState('');

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

  // Thêm model mới vào danh sách xoay vòng
  const handleAddPreferredModel = (modelNameToAdd?: string) => {
    const raw = (modelNameToAdd !== undefined ? modelNameToAdd : newModelInput).trim();
    if (!raw) return;

    if (preferredModels.some((m) => m.toLowerCase() === raw.toLowerCase())) {
      setErrorMsg(`Model "${raw}" đã có sẵn trong danh sách xoay vòng.`);
      setTimeout(() => setErrorMsg(null), 2500);
      return;
    }

    const updated = [...preferredModels, raw];
    setPreferredModels(updated);
    if (!selectedModel) {
      setSelectedModel(raw);
    }
    setNewModelInput('');
    setErrorMsg(null);
  };

  // Xóa model khỏi danh sách xoay vòng
  const handleRemovePreferredModel = (indexToRemove: number) => {
    const target = preferredModels[indexToRemove];
    const updated = preferredModels.filter((_, idx) => idx !== indexToRemove);
    setPreferredModels(updated);
    // Nếu vừa xóa model đang chọn, chuyển sang model đầu tiên còn lại
    if (selectedModel === target && updated.length > 0) {
      setSelectedModel(updated[0]);
    }
  };

  // Đổi thứ tự ưu tiên xoay vòng
  const handleMoveModel = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= preferredModels.length) return;
    const nextList = [...preferredModels];
    const temp = nextList[index];
    nextList[index] = nextList[newIdx];
    nextList[newIdx] = temp;
    setPreferredModels(nextList);
  };

  // Thêm nhanh bộ gợi ý model phổ biến
  const handleAddPopularPresets = () => {
    const presets = [
      'dungcsnd113/gemini-flash-3.8',
      'google/gemini-2.5-flash',
      'openai/gpt-4o-mini',
      'deepseek/deepseek-chat',
    ];
    const merged = Array.from(new Set([...preferredModels, ...presets]));
    setPreferredModels(merged);
  };

  // Áp dụng nhập danh sách hàng loạt (dán nhiều dòng)
  const handleApplyBatchText = () => {
    const lines = batchText
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      const merged = Array.from(new Set([...preferredModels, ...lines]));
      setPreferredModels(merged);
    }
    setIsBatchMode(false);
    setBatchText('');
  };

  const handleSaveAndClose = () => {
    const cleanPreferred = preferredModels.map((m) => m.trim()).filter(Boolean);
    const finalModel = selectedModel.trim() || cleanPreferred[0] || 'dungcsnd113/gemini-flash-3.8';

    onSaveSettings({
      aiBaseUrl: baseUrl.trim(),
      aiApiKey: apiKey.trim(),
      aiModel: finalModel,
      preferredModels: cleanPreferred,
      autoFallbackModel: autoFallback,
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
              <h2 className="text-sm font-bold text-white tracking-wide">Cấu hình API & Xoay vòng AI</h2>
              <p className="text-[11px] text-zinc-400">Tùy biến danh sách model để chuyển đổi nhanh khi mất ổn định</p>
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

          {/* SECTION: Danh sách model xoay vòng (Preferred & Fallback Models) */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                <Shuffle className="w-3.5 h-3.5 text-purple-400" />
                <span>Danh sách Model xoay vòng ({preferredModels.length})</span>
              </label>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsBatchMode(!isBatchMode)}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 px-2 py-0.5 rounded bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                  title="Nhập hàng loạt bằng cách dán văn bản nhiều dòng"
                >
                  <ListPlus className="w-3 h-3 inline mr-1" />
                  {isBatchMode ? 'Đóng dán' : 'Dán nhiều'}
                </button>
                <button
                  type="button"
                  onClick={handleAddPopularPresets}
                  className="text-[11px] text-purple-400 hover:text-purple-300 px-2 py-0.5 rounded bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 transition-colors"
                >
                  + Gợi ý mẫu
                </button>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Các model bạn hay dùng để xoay vòng 1-click hoặc tự động kích hoạt khi 1 model bị lỗi (429/500/mất mạng):
            </p>

            {/* Dán nhiều dòng (Batch Mode Drawer) */}
            {isBatchMode && (
              <div className="p-2.5 rounded-xl bg-[#111118] border border-purple-500/30 space-y-2">
                <textarea
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder="Dán danh sách model vào đây (mỗi dòng hoặc dấu phẩy một model):&#10;dungcsnd113/gemini-flash-3.8&#10;google/gemini-2.5-flash&#10;openai/gpt-4o-mini"
                  rows={4}
                  className="w-full bg-[#161622] border border-[#2a2a3c] rounded-lg p-2 text-xs font-mono text-zinc-200 outline-none focus:border-purple-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBatchMode(false)}
                    className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyBatchText}
                    className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium"
                  >
                    Nạp vào danh sách
                  </button>
                </div>
              </div>
            )}

            {/* Render Danh sách model xoay vòng */}
            <div className="space-y-1.5 max-h-44 overflow-y-auto bg-[#101016] p-2 rounded-xl border border-[#232332]">
              {preferredModels.length === 0 ? (
                <div className="text-center py-3 text-xs text-zinc-500">
                  Chưa có model nào. Hãy nhập tên model hoặc bấm "+ Gợi ý mẫu".
                </div>
              ) : (
                preferredModels.map((modelId, idx) => {
                  const isCurrent = selectedModel === modelId;
                  return (
                    <div
                      key={`${modelId}-${idx}`}
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                        isCurrent
                          ? 'bg-purple-600/25 border border-purple-500/40 text-purple-200 font-semibold'
                          : 'bg-[#151520] hover:bg-[#1c1c2b] text-zinc-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedModel(modelId)}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer group"
                        title="Nhấp để đặt làm model đang dùng"
                      >
                        <span className="text-[10px] text-zinc-500 w-4 shrink-0 font-sans">
                          {idx + 1}.
                        </span>
                        <span className="truncate group-hover:text-purple-300 transition-colors">
                          {modelId}
                        </span>
                        {isCurrent && (
                          <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-500/30 text-purple-200 font-sans font-medium">
                            <Check className="w-3 h-3 text-emerald-400" /> Đang dùng
                          </span>
                        )}
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Di chuyển lên/xuống */}
                        <button
                          type="button"
                          onClick={() => handleMoveModel(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded text-zinc-500 hover:text-zinc-200 disabled:opacity-20 transition-colors"
                          title="Chuyển lên trên"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveModel(idx, 'down')}
                          disabled={idx === preferredModels.length - 1}
                          className="p-1 rounded text-zinc-500 hover:text-zinc-200 disabled:opacity-20 transition-colors"
                          title="Chuyển xuống dưới"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>

                        {/* Xóa */}
                        <button
                          type="button"
                          onClick={() => handleRemovePreferredModel(idx)}
                          className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors"
                          title="Xóa khỏi danh sách xoay vòng"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Ô thêm model vào danh sách */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newModelInput}
                onChange={(e) => setNewModelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPreferredModel();
                  }
                }}
                placeholder="Thêm tên model (vd: google/gemini-2.5-flash)..."
                className="flex-1 bg-[#101016] border border-[#2b2b3a] focus:border-purple-500 rounded-xl px-3 py-1.5 text-xs font-mono text-zinc-200 outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddPreferredModel()}
                disabled={!newModelInput.trim()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors disabled:opacity-40 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm</span>
              </button>
            </div>

            {/* Tự động xoay vòng khi gặp lỗi (Auto Fallback Toggle) */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#12121c] border border-zinc-800/80 cursor-pointer hover:bg-[#161622] transition-colors">
              <input
                type="checkbox"
                checked={autoFallback}
                onChange={(e) => setAutoFallback(e.target.checked)}
                className="mt-0.5 rounded border-zinc-700 text-purple-600 focus:ring-purple-500 bg-zinc-900"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-zinc-200 block">
                  ⚡ Tự động xoay vòng khi gặp sự cố (Auto Fallback)
                </span>
                <span className="text-[11px] text-zinc-400 block leading-tight">
                  Nếu model đang chọn bị lỗi (429 hết quota, 500 lỗi máy chủ hoặc ngắt kết nối), hệ thống sẽ tự động chuyển sang model tiếp theo trong danh sách.
                </span>
              </div>
            </label>
          </div>

          {/* Model đang chọn hiện tại */}
          <div className="space-y-2 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>Model AI đang hoạt động</span>
              </label>

              <button
                type="button"
                onClick={handleFetchModels}
                disabled={isLoadingModels}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                <span>{isLoadingModels ? 'Đang tải...' : 'Tải danh sách Model từ máy chủ'}</span>
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

            {/* Model Search Box (if models loaded from server) */}
            {models.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Tìm kiếm từ máy chủ ({filteredModels.length}/{models.length}):</span>
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
                    placeholder="Lọc theo tên (vd: gemini, deepseek, flash, gpt)..."
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
                <div className="max-h-40 overflow-y-auto space-y-1 bg-[#101017] p-1.5 rounded-xl border border-[#222230]">
                  {filteredModels.length === 0 ? (
                    <div className="text-center py-4 text-xs text-zinc-500">
                      Không tìm thấy model khớp với "{searchQuery}"
                    </div>
                  ) : (
                    filteredModels.map((modelId) => {
                      const isSelected = selectedModel === modelId;
                      const isInPreferred = preferredModels.some(
                        (m) => m.toLowerCase() === modelId.toLowerCase()
                      );
                      return (
                        <div
                          key={modelId}
                          className={`w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                            isSelected
                              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 font-semibold'
                              : 'text-zinc-300 hover:bg-[#1a1a24] hover:text-white'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedModel(modelId)}
                            className="truncate pr-2 flex-1 text-left cursor-pointer"
                          >
                            {modelId}
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Nút thêm vào danh sách xoay vòng */}
                            {isInPreferred ? (
                              <span className="text-[10px] text-purple-300 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/20">
                                <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                                <span>Đã thêm</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddPreferredModel(modelId)}
                                className="text-[10px] text-zinc-400 hover:text-purple-300 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-purple-900/40 transition-colors"
                                title="Thêm vào danh sách xoay vòng"
                              >
                                <Plus className="w-2.5 h-2.5 text-purple-400" />
                                <span>Xoay vòng</span>
                              </button>
                            )}

                            {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                          </div>
                        </div>
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
