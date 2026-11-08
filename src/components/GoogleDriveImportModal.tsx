import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  Link as LinkIcon,
  Smartphone,
  Download,
  UploadCloud,
  DownloadCloud,
  X,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Key,
  Copy,
  Check,
  FolderOpen,
  FileJson,
  Layers,
  ExternalLink,
  HardDrive,
  Zap,
} from 'lucide-react';
import type { ImportDataResult, MapData, AppSettings, DriveFileItem } from '../types';
import { StorageService } from '../services/storage';
import {
  GOOGLE_APPS_SCRIPT_CODE,
  testDriveScriptConnection,
  listGoogleDriveFiles,
  pushToGoogleDriveOneClick,
  pullDriveFileOneClick,
} from '../services/googleDrive';
import confetti from 'canvas-confetti';

interface GoogleDriveImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFromDevice: () => void;
  onDataLoaded: (result: ImportDataResult) => void;
  maps?: MapData[];
  activeMap?: MapData;
  settings?: AppSettings;
  onSaveSettings?: (updates: Partial<AppSettings>) => void;
}

export const GoogleDriveImportModal: React.FC<GoogleDriveImportModalProps> = ({
  isOpen,
  onClose,
  onSelectFromDevice,
  onDataLoaded,
  maps = [],
  activeMap,
  settings,
  onSaveSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'sync' | 'config' | 'manual'>('sync');

  // Config state
  const [scriptUrl, setScriptUrl] = useState(settings?.googleDriveScriptUrl || '');
  const [testingConfig, setTestingConfig] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Sync & File List state
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [desktopAvailable, setDesktopAvailable] = useState(false);
  const [desktopFolder, setDesktopFolder] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [pushingTarget, setPushingTarget] = useState<'single' | 'vault' | null>(null);
  const [pullingFileId, setPullingFileId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Manual link state
  const [driveUrl, setDriveUrl] = useState('');
  const [isLoadingManual, setIsLoadingManual] = useState(false);
  const [manualErrorMsg, setManualErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (settings?.googleDriveScriptUrl !== undefined) {
      setScriptUrl(settings.googleDriveScriptUrl);
    }
  }, [settings?.googleDriveScriptUrl]);

  const loadFilesList = useCallback(async (customUrl?: string) => {
    setLoadingFiles(true);
    try {
      const res = await listGoogleDriveFiles(customUrl);
      setDriveFiles(res.files);
      setDesktopAvailable(res.desktopAvailable);
      setDesktopFolder(res.desktopFolder || null);
    } catch (e) {
      console.warn('Error loading Google Drive files:', e);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStatusMessage(null);
      loadFilesList(settings?.googleDriveScriptUrl);
    }
  }, [isOpen, loadFilesList, settings?.googleDriveScriptUrl]);

  if (!isOpen) return null;

  const isScriptReady = Boolean(
    (settings?.googleDriveScriptUrl || '').trim().startsWith('https://script.google.com/')
  );
  const isConnected = desktopAvailable || isScriptReady;

  // 1-Click Push (Single Map or Full Vault)
  const handlePushOneClick = async (isFullVault: boolean) => {
    setPushingTarget(isFullVault ? 'vault' : 'single');
    setStatusMessage(null);

    try {
      const res = await pushToGoogleDriveOneClick({
        map: activeMap,
        maps,
        isFullVault,
        scriptUrl: settings?.googleDriveScriptUrl || scriptUrl,
      });

      if (res.success) {
        const now = Date.now();
        onSaveSettings?.({ lastDriveSyncedAt: now });
        setStatusMessage({ type: 'success', text: res.message });
        confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
        await loadFilesList(settings?.googleDriveScriptUrl || scriptUrl);
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Lỗi khi đẩy dữ liệu lên Google Drive.',
      });
    } finally {
      setPushingTarget(null);
    }
  };

  // 1-Click Pull from File List
  const handlePullFileOneClick = async (item: DriveFileItem) => {
    setPullingFileId(item.id);
    setStatusMessage(null);

    try {
      const rawData = await pullDriveFileOneClick(item, settings?.googleDriveScriptUrl || scriptUrl);
      const parsed = StorageService.parseImportData(rawData);
      const now = Date.now();
      onSaveSettings?.({ lastDriveSyncedAt: now });
      onDataLoaded(parsed);
      onClose();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || `Không thể nạp tệp "${item.name}".`,
      });
    } finally {
      setPullingFileId(null);
    }
  };

  // Save & Test Google Apps Script URL
  const handleTestAndSaveScript = async () => {
    const trimmed = scriptUrl.trim();
    if (!trimmed) {
      onSaveSettings?.({ googleDriveScriptUrl: '' });
      setTestResult({ success: false, message: 'Đã xóa URL Google Apps Script.' });
      return;
    }

    setTestingConfig(true);
    setTestResult(null);

    const res = await testDriveScriptConnection(trimmed);
    setTestingConfig(false);
    setTestResult(res);

    if (res.success) {
      onSaveSettings?.({ googleDriveScriptUrl: trimmed });
      if (res.files) {
        setDriveFiles(res.files);
      }
    }
  };

  const handleCopyScriptCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Manual URL Fetch
  const handleFetchDriveUrl = async () => {
    if (!driveUrl.trim()) {
      setManualErrorMsg('Vui lòng dán đường link chia sẻ từ Google Drive.');
      return;
    }

    setIsLoadingManual(true);
    setManualErrorMsg(null);

    try {
      const apiUrl = `/api/gdrive?url=${encodeURIComponent(driveUrl.trim())}`;
      const res = await fetch(apiUrl);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            `Lỗi tải file (HTTP ${res.status}). Đảm bảo file được bật quyền "Bất kỳ ai có đường link".`
        );
      }

      const json = await res.json();
      const parsed = StorageService.parseImportData(json);
      onDataLoaded(parsed);
      onClose();
    } catch (err: any) {
      console.error('Fetch Google Drive error:', err);
      setManualErrorMsg(
        err.message ||
          'Không thể nạp file từ link Google Drive này. Bạn có thể dùng tab Đồng bộ 1-Click hoặc chọn tệp từ máy.'
      );
    } finally {
      setIsLoadingManual(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-xl bg-[#161620] border border-[#2c2c3e] rounded-2xl shadow-2xl text-zinc-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#262636] bg-[#1a1a27]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Đồng bộ Google Drive (1-Click)</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-blue-400" />
                  <span>Chủ động theo ý bạn</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Chỉ đồng bộ khi bạn bấm nút — Không tự động chạy ngầm, gọn nhẹ & kiểm soát 100%
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#262636] bg-[#14141e] px-6 gap-5 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('sync')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'sync'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Đồng bộ 1-Click</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'config'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Cấu hình 1-Click (Web & Mobile)</span>
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'manual'
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Nạp từ Tệp / Link lẻ</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* TAB 1: 1-CLICK SYNC */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              {/* Connection Status Banner */}
              <div className="p-3.5 rounded-xl border bg-[#12121a] border-zinc-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-3 h-3 rounded-full shrink-0 ${
                      isConnected
                        ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50'
                        : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-200 truncate">
                      {desktopAvailable && isScriptReady
                        ? 'Đã kết nối ổ Google Drive PC & Cloud Script'
                        : desktopAvailable
                        ? `Đã kết nối ổ đĩa Google Drive (${desktopFolder})`
                        : isScriptReady
                        ? 'Đã kết nối Google Drive 1-Click (Apps Script)'
                        : 'Chưa liên kết Google Drive 1-Click'}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">
                      {isConnected
                        ? 'Bấm 1 nút bên dưới bất cứ khi nào bạn muốn đẩy lên hoặc kéo về'
                        : 'Bấm sang tab "Cấu hình 1-Click" để kết nối trong 1 phút'}
                    </div>
                  </div>
                </div>

                {desktopAvailable && window.mindnoteDesktop?.openGoogleDriveFolder ? (
                  <button
                    onClick={() => window.mindnoteDesktop?.openGoogleDriveFolder()}
                    className="flex items-center gap-1.5 text-[11px] text-blue-300 hover:text-white bg-blue-950/40 hover:bg-blue-900/50 px-2.5 py-1.5 rounded-lg border border-blue-500/30 shrink-0 transition-colors cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Mở thư mục</span>
                  </button>
                ) : !isConnected ? (
                  <button
                    onClick={() => setActiveTab('config')}
                    className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-white bg-amber-950/40 px-2.5 py-1.5 rounded-lg border border-amber-500/30 shrink-0 transition-colors cursor-pointer"
                  >
                    <Key className="w-3 h-3" />
                    <span>Thiết lập ngay</span>
                  </button>
                ) : null}
              </div>

              {/* 1-Click Push Buttons */}
              <div>
                <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  1. Đẩy lên Google Drive (1-Click Push)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeMap && (
                    <button
                      onClick={() => handlePushOneClick(false)}
                      disabled={pushingTarget !== null || !isConnected}
                      className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-950/20 hover:bg-blue-950/40 text-blue-200 disabled:opacity-40 transition-all flex flex-col items-center gap-1.5 group cursor-pointer"
                    >
                      {pushingTarget === 'single' ? (
                        <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                      ) : (
                        <UploadCloud className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                      )}
                      <div className="text-center">
                        <div className="text-xs font-bold text-white truncate max-w-[200px]">
                          Đẩy Map hiện tại lên Drive
                        </div>
                        <div className="text-[10px] text-blue-300/80 mt-0.5 truncate max-w-[210px]">
                          Lưu "{activeMap.name}"
                        </div>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => handlePushOneClick(true)}
                    disabled={pushingTarget !== null || !isConnected}
                    className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-200 disabled:opacity-40 transition-all flex flex-col items-center gap-1.5 group cursor-pointer"
                  >
                    {pushingTarget === 'vault' ? (
                      <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                    ) : (
                      <Layers className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    )}
                    <div className="text-center">
                      <div className="text-xs font-bold text-white">
                        Đẩy cả kho lên Drive ({maps.length} Map)
                      </div>
                      <div className="text-[10px] text-emerald-300/80 mt-0.5">
                        Cập nhật file mindnote_vault_backup.json
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 1-Click Pull / File List in Google Drive */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    2. Kéo từ Google Drive về máy (1-Click Pull)
                  </div>
                  <button
                    onClick={() => loadFilesList(settings?.googleDriveScriptUrl || scriptUrl)}
                    disabled={loadingFiles}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingFiles ? 'animate-spin' : ''}`} />
                    <span>Làm mới danh sách</span>
                  </button>
                </div>

                <div className="rounded-xl border border-zinc-800/90 bg-[#111118] overflow-hidden">
                  {loadingFiles ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-zinc-400 text-xs">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                      <span>Đang quét thư mục Mindnote trên Google Drive...</span>
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="py-7 px-4 text-center space-y-1.5">
                      <div className="text-xs font-medium text-zinc-300">
                        {isConnected
                          ? 'Chưa có tệp nào trong thư mục Mindnote trên Google Drive'
                          : 'Chưa kết nối Google Drive 1-Click'}
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        {isConnected
                          ? 'Hãy bấm "Đẩy Map hiện tại" hoặc "Đẩy cả kho" ở trên để tạo bản lưu đầu tiên!'
                          : 'Bấm sang tab "Cấu hình 1-Click" để dán link Web App Script hoặc mở từ tab "Nạp từ Tệp / Link lẻ".'}
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto divide-y divide-zinc-800/60">
                      {driveFiles.map((file) => {
                        const isVault =
                          file.name.toLowerCase().includes('vault') ||
                          file.name.toLowerCase().includes('backup');
                        const isPulling = pullingFileId === file.id;

                        return (
                          <div
                            key={`${file.source}-${file.id}`}
                            className="flex items-center justify-between px-3.5 py-2.5 hover:bg-[#191925] transition-colors gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`p-1.5 rounded-lg shrink-0 ${
                                  isVault
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-purple-500/15 text-purple-400'
                                }`}
                              >
                                {isVault ? (
                                  <Layers className="w-4 h-4" />
                                ) : (
                                  <FileJson className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-zinc-100 truncate">
                                    {file.name}
                                  </span>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded border shrink-0 ${
                                      file.source === 'desktop'
                                        ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
                                        : 'bg-blue-950/60 border-blue-500/30 text-blue-300'
                                    }`}
                                  >
                                    {file.source === 'desktop' ? 'Ổ G:\\' : 'Drive Cloud'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-zinc-400 flex items-center gap-2 mt-0.5">
                                  <span>
                                    Cập nhật: {new Date(file.updatedAt).toLocaleString('vi-VN')}
                                  </span>
                                  {file.size ? <span>• {formatFileSize(file.size)}</span> : null}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handlePullFileOneClick(file)}
                              disabled={pullingFileId !== null}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shrink-0 transition-all cursor-pointer shadow-sm"
                            >
                              {isPulling ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <DownloadCloud className="w-3.5 h-3.5" />
                              )}
                              <span>{isPulling ? 'Đang nạp...' : 'Nạp ngay'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE APPS SCRIPT 1-CLICK SETUP */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-950/25 border border-blue-500/30 text-xs text-blue-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-blue-300">
                  <HardDrive className="w-4 h-4" />
                  <span>Tại sao nên dùng Google Apps Script Webhook?</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Chạy trực tiếp trên tài khoản Google Drive của riêng bạn, <strong>không bao giờ hết hạn đăng nhập</strong>, hoạt động mượt mà trên cả <strong>Web, iPhone/iPad và PC</strong> chỉ với 1 Click mỗi khi bạn muốn đẩy lên hoặc kéo về!
                </p>
              </div>

              {/* Step 1: Copy Script */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-zinc-200">
                      Bước 1: Copy mã Script & dán vào Google Apps Script (Làm 1 lần)
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Mở{' '}
                      <a
                        href="https://script.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline inline-flex items-center gap-0.5"
                      >
                        script.google.com <ExternalLink className="w-2.5 h-2.5" />
                      </a>{' '}
                      → <strong>Dự án mới</strong> → Dán mã → <strong>Triển khai (Deploy)</strong> → <strong>Ứng dụng web (Quyền: Bất kỳ ai / Anyone)</strong>
                    </div>
                  </div>
                  <button
                    onClick={handleCopyScriptCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shrink-0 cursor-pointer transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Đã chép mã!' : 'Copy Mã Script'}</span>
                  </button>
                </div>

                <pre className="p-3 rounded-xl bg-[#0e0e14] border border-zinc-800 text-[10px] text-zinc-300 font-mono overflow-x-auto max-h-36 leading-relaxed select-text">
                  {GOOGLE_APPS_SCRIPT_CODE}
                </pre>
              </div>

              {/* Step 2: Paste Web App URL */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-bold text-zinc-200">
                  Bước 2: Dán đường link Web App URL vào đây
                </label>
                <input
                  type="text"
                  value={scriptUrl}
                  onChange={(e) => setScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full bg-[#121218] border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500 font-mono transition-colors"
                />

                <button
                  onClick={handleTestAndSaveScript}
                  disabled={testingConfig}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  {testingConfig ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  <span>{testingConfig ? 'Đang kiểm tra kết nối...' : 'Lưu & Kiểm tra kết nối'}</span>
                </button>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl text-xs leading-relaxed ${
                      testResult.success
                        ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MANUAL FILE PICKER & SHARE LINK */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              {/* Cách 1: Chọn từ trình duyệt tệp của thiết bị */}
              <div className="p-3.5 rounded-xl bg-[#121218] border border-[#2a2a3d] space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
                  <Smartphone className="w-4 h-4 text-purple-400" />
                  <span>Cách 1: Chọn file trực tiếp từ ứng dụng Tệp / Google Drive trên máy</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Mở hộp thoại chọn tệp của thiết bị (iPhone/iPad/PC) và chọn file <b>.json</b> từ thư mục <b>Google Drive &gt; Mindnote</b>.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onSelectFromDevice();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-md transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Mở bộ chọn tệp từ thiết bị</span>
                </button>
              </div>

              {/* Cách 2: Dán link chia sẻ Google Drive */}
              <div className="p-3.5 rounded-xl bg-[#121218] border border-[#2a2a3d] space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
                  <LinkIcon className="w-4 h-4 text-blue-400" />
                  <span>Cách 2: Dán link chia sẻ file Google Drive bất kỳ</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Nếu bạn hoặc bạn bè chia sẻ 1 file JSON qua link (Quyền: Bất kỳ ai có đường liên kết), dán vào ô dưới để nạp:
                </p>

                <input
                  type="text"
                  placeholder="https://drive.google.com/file/d/..."
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1a26] border border-zinc-700/80 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500"
                />

                {manualErrorMsg && (
                  <div className="flex items-start gap-1.5 p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{manualErrorMsg}</span>
                  </div>
                )}

                <button
                  onClick={handleFetchDriveUrl}
                  disabled={isLoadingManual || !driveUrl.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#222232] hover:bg-blue-600/30 border border-[#333348] text-blue-300 hover:text-white font-medium text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLoadingManual ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{isLoadingManual ? 'Đang tải file từ Drive...' : 'Tải về & Nạp vào Mindnote'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Global Status Notification inside Modal */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs leading-relaxed ${
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
        <div className="flex items-center justify-between px-6 py-3.5 bg-[#14141e] border-t border-[#262636]">
          <div className="text-[11px] text-zinc-500">
            {settings?.lastDriveSyncedAt ? (
              <span>Đồng bộ Drive gần nhất: {new Date(settings.lastDriveSyncedAt).toLocaleTimeString('vi-VN')}</span>
            ) : (
              <span>Chế độ thủ công 1-Click (Không tự chạy ngầm)</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#20202c] hover:bg-[#28283a] text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
