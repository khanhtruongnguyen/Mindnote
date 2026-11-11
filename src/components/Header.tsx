import React, { useState, useRef, useEffect } from 'react';
import type { MapData } from '../types';
import type { DeviceMode } from '../hooks/useDeviceMode';
import {
  ChevronDown,
  Plus,
  Cloud,
  HelpCircle,
  Download,
  Upload,
  Edit2,
  Trash2,
  Check,
  Layers,
  MoreVertical,
  Smartphone,
  Monitor,
  Sparkles,
  GitBranch,
  Share2,
  Brain,
  Database,
  FolderOpen,
  FileText,
  Zap,
  BookOpen,
  RotateCcw,
  UploadCloud,
  BoxSelect,
} from 'lucide-react';

interface HeaderProps {
  maps: MapData[];
  activeMap: MapData;
  isMobile: boolean;
  devicePreference: DeviceMode;
  onChangeDeviceMode: (mode: DeviceMode) => void;
  onSelectMap: (mapId: string) => void;
  onOpenNewMapModal: () => void;
  onRenameMap: (mapId: string, newName: string) => void;
  onDeleteMap: (mapId: string) => void;
  onAddNode: () => void;
  onOpenConnectModal?: () => void;
  onOpenContextModal?: () => void;
  onOpenFlashcardModal?: () => void;
  onAutoLayoutMap?: () => void;
  canUndoMap?: boolean;
  onUndoMap?: () => void;
  hasContext?: boolean;
  onExportBackup: () => void;
  onExportSingleMap: (map: MapData) => void;
  onExportGoogleDrive?: (map: MapData, isFullVault?: boolean) => void;
  onImportBackup: (file: File) => void;
  onDesktopImport?: () => void;
  onPickGoogleDrive?: () => void;
  onOpenGoogleDriveModal?: () => void;
  onOpenSupabaseModal?: () => void;
  onCleanOrphanImages?: () => void;
  onOffloadImagesToSupabase?: () => void;
  onOpenHelpModal: () => void;
  hasSupabaseConfigured?: boolean;
  hasDriveConfigured?: boolean;
  isAiOpen?: boolean;
  onToggleAi?: () => void;
  isMoveMode?: boolean;
  onToggleMoveMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  maps,
  activeMap,
  isMobile,
  devicePreference,
  onChangeDeviceMode,
  onSelectMap,
  onOpenNewMapModal,
  onRenameMap,
  onDeleteMap,
  onAddNode,
  onOpenConnectModal,
  onOpenContextModal,
  onOpenFlashcardModal,
  onAutoLayoutMap,
  canUndoMap = false,
  onUndoMap,
  hasContext = false,
  onExportBackup,
  onExportSingleMap,
  onExportGoogleDrive,
  onImportBackup,
  onDesktopImport,
  onOpenGoogleDriveModal,
  onOpenSupabaseModal,
  onCleanOrphanImages,
  onOffloadImagesToSupabase,
  onOpenHelpModal,
  hasSupabaseConfigured = false,
  hasDriveConfigured = false,
  isAiOpen = false,
  onToggleAi,
  isMoveMode = false,
  onToggleMoveMode,
}) => {
  const isDesktop = typeof window !== 'undefined' && Boolean(window.mindnoteDesktop?.isDesktop);
  const attachmentCount = Object.keys(activeMap.attachments || {}).length;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [syncDropdownOpen, setSyncDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(activeMap.name);
  const [copiedMapLink, setCopiedMapLink] = useState(false);
  const fileImportRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const syncDropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const handleCopyMapLink = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('map', activeMap.id);
      url.searchParams.delete('note');
      navigator.clipboard.writeText(url.toString());
      setCopiedMapLink(true);
      setTimeout(() => setCopiedMapLink(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setEditedName(activeMap.name);
    setIsEditingName(false);
  }, [activeMap]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (syncDropdownRef.current && !syncDropdownRef.current.contains(e.target as Node)) {
        setSyncDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveRename = () => {
    if (editedName.trim() && editedName !== activeMap.name) {
      onRenameMap(activeMap.id, editedName.trim());
    }
    setIsEditingName(false);
  };

  return (
    <header
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        height: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
      }}
      className="absolute top-0 left-0 right-0 bg-[#141419]/95 backdrop-blur-md border-b border-[#252533] px-3 sm:px-4 flex flex-col justify-end z-30 select-none"
    >
      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileImportRef}
        accept=".json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onImportBackup(file);
          }
          if (fileImportRef.current) fileImportRef.current.value = '';
        }}
        className="hidden"
      />

      {/* Main bar strictly below notch / status bar */}
      <div className="h-14 w-full flex items-center justify-between">
        {/* Left: Brand & Map Selector */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Brand logo */}
          <div className="flex items-center gap-1.5 pr-2 sm:pr-3 border-r border-zinc-800 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-600/30 text-base">
              📒
            </div>
            <span className="text-sm font-bold tracking-tight text-white hidden md:inline">
              Nexus<span className="text-purple-400">Notes</span>
            </span>
          </div>

          {/* Current Map Selector Dropdown */}
          <div className="relative min-w-0" ref={dropdownRef}>
            <div className="flex items-center gap-1.5 bg-[#1c1c25] border border-[#2e2e3d] hover:border-zinc-600 rounded-xl px-2.5 sm:px-3 py-1.5 transition-colors">
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    autoFocus
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename();
                      if (e.key === 'Escape') setIsEditingName(false);
                    }}
                    className="bg-transparent text-xs font-semibold text-white border-b border-purple-500 outline-none px-0.5 py-0 w-32 sm:w-44"
                  />
                  <button
                    onClick={handleSaveRename}
                    className="p-1 rounded text-purple-400 hover:text-white"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-zinc-100 max-w-[130px] sm:max-w-[180px] md:max-w-[220px] truncate"
                  >
                    <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate">{activeMap.name}</span>
                    <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
                  </button>
                  {!isMobile && (
                    <button
                      onClick={() => setIsEditingName(true)}
                      title="Đổi tên Map này"
                      className="p-1 rounded text-zinc-500 hover:text-zinc-200"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={handleCopyMapLink}
                    title="Sao chép đường link dẫn thẳng đến Bản đồ này"
                    className="p-1 rounded text-zinc-500 hover:text-purple-300 transition-colors"
                  >
                    {copiedMapLink ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Share2 className="w-3 h-3" />
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute top-11 left-0 w-64 bg-[#1a1a24] border border-[#2e2e3e] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Bản đồ của bạn ({maps.length})
                </div>

                <div className="max-h-60 overflow-y-auto py-1">
                  {maps.map((m) => {
                    const isActive = m.id === activeMap.id;
                    return (
                      <div
                        key={m.id}
                        className={`group flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-purple-600/20 text-purple-300 font-semibold border-l-2 border-purple-500'
                            : 'text-zinc-300 hover:bg-[#232330]'
                        }`}
                        onClick={() => {
                          onSelectMap(m.id);
                          setDropdownOpen(false);
                        }}
                      >
                        <span className="truncate pr-2">{m.name}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onExportSingleMap(m);
                            }}
                            className="p-1 rounded text-zinc-400 hover:text-purple-300 transition-colors"
                            title={`Xuất riêng bản đồ "${m.name}"`}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {maps.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Xác nhận xóa bản đồ "${m.name}"?`)) {
                                  onDeleteMap(m.id);
                                }
                              }}
                              className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors"
                              title="Xóa Map này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-[#2a2a38] pt-1 mt-1 px-1.5">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenNewMapModal();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-purple-300 hover:bg-purple-600/20 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tạo Bản đồ mới</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Nút Hoàn tác (Undo) khi vừa chạy AI Agent / Tách nhánh / Sắp xếp Map */}
          {canUndoMap && onUndoMap && (
            <button
              onClick={onUndoMap}
              title="Hoàn tác (Undo) thao tác thay đổi sơ đồ vừa rồi"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-950/50 hover:bg-amber-900/70 border border-amber-500/40 text-amber-200 text-xs font-semibold shadow-md transition-all hover:scale-[1.02] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden lg:inline">Hoàn tác</span>
            </button>
          )}

          {/* Nút Sắp xếp gọn Map theo hình cây (Desktop) */}
          {!isMobile && onAutoLayoutMap && activeMap.nodes.length > 1 && (
            <button
              onClick={onAutoLayoutMap}
              title="Tự động sắp xếp gọn các ô theo cấu trúc Hình cây phân tầng (Smart Tree Layout)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1c1c25] border border-[#2e2e3d] text-zinc-300 hover:text-white hover:border-cyan-500/40 text-xs font-semibold shadow-md transition-all hover:scale-[1.02] cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden xl:inline">Xếp cây</span>
            </button>
          )}

          {/* Nút Flashcard Ôn tập AI (Desktop) */}
          {!isMobile && onOpenFlashcardModal && (
            <button
              onClick={onOpenFlashcardModal}
              title="Chọn nhiều ô trên bản đồ để AI tạo & lưu bộ Flashcard ôn tập"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1c1c25] border border-[#2e2e3d] text-zinc-200 hover:text-white hover:border-purple-500/50 text-xs font-semibold shadow-md transition-all hover:scale-[1.02] cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
              <span>Flashcard</span>
              {(activeMap.flashcards?.length || 0) > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-purple-600/30 border border-purple-500/40 text-purple-200 text-[10px]">
                  {activeMap.flashcards?.length}
                </span>
              )}
            </button>
          )}

          {/* Ngữ cảnh Sổ tay Map (Desktop) */}
          {!isMobile && (
            <button
              onClick={onOpenContextModal}
              title="Ngữ cảnh sổ tay: Cung cấp giáo trình, đề cương môn học cho AI"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-md transition-all hover:scale-[1.02] cursor-pointer ${
                hasContext
                  ? 'bg-purple-950/40 border-purple-500/50 text-purple-200 shadow-purple-900/30'
                  : 'bg-[#1c1c25] border-[#2e2e3d] text-zinc-300 hover:text-white hover:border-purple-500/40'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span>Ngữ cảnh</span>
              {hasContext && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              )}
            </button>
          )}

          {/* AI Assistant & Agent Button (Desktop) */}
          {!isMobile && (
            <button
              onClick={onToggleAi}
              title="Mở Trợ lý Mind Map AI & AI Agent tự động xây dựng sơ đồ"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-md transition-all hover:scale-[1.02] cursor-pointer ${
                isAiOpen
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400 text-white shadow-purple-600/35 ring-1 ring-purple-400/50'
                  : 'bg-[#1b1928] border-purple-500/40 text-purple-300 hover:text-white hover:border-purple-400 shadow-purple-950/30'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
              <span>Hỏi & Agent AI</span>
            </button>
          )}

          {/* Nút Khoanh vùng & Di chuyển sang Map khác (Desktop) */}
          {!isMobile && onToggleMoveMode && (
            <button
              onClick={onToggleMoveMode}
              title="Kéo chuột khoanh chọn vùng các ô để di chuyển hoặc sao chép sang Map khác"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-md transition-all hover:scale-[1.02] cursor-pointer ${
                isMoveMode
                  ? 'bg-amber-500 text-black border-amber-400 font-bold shadow-amber-500/30 ring-2 ring-amber-400/50'
                  : 'bg-[#1c1c25] border-[#2e2e3d] text-zinc-300 hover:text-white hover:border-amber-500/40'
              }`}
            >
              <BoxSelect className={`w-3.5 h-3.5 ${isMoveMode ? 'text-black' : 'text-amber-400'}`} />
              <span>{isMoveMode ? 'Đang khoanh vùng...' : 'Di chuyển'}</span>
            </button>
          )}

          {/* Desktop Add Node button */}
          {!isMobile && (
            <button
              onClick={onAddNode}
              title="Thêm nút mới vào giữa màn hình"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm nút</span>
            </button>
          )}

          {/* Desktop Unified Sync Menu (Đồng bộ) */}
          {!isMobile && (
            <div className="relative" ref={syncDropdownRef}>
              <button
                onClick={() => setSyncDropdownOpen(!syncDropdownOpen)}
                title="Đồng bộ đám mây, Google Drive, Kho SSD và Xuất/Nhập file"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-md transition-all hover:scale-[1.02] cursor-pointer ${
                  hasSupabaseConfigured
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 shadow-emerald-900/30'
                    : 'bg-[#1c1c25] border-[#2e2e3d] text-zinc-300 hover:text-white hover:border-purple-500/40'
                }`}
              >
                <Cloud className={`w-3.5 h-3.5 ${hasSupabaseConfigured ? 'text-emerald-400' : 'text-purple-400'}`} />
                <span>Đồng bộ</span>
                {hasSupabaseConfigured && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
                <ChevronDown className="w-3 h-3 text-zinc-500 ml-0.5" />
              </button>

              {syncDropdownOpen && (
                <div className="absolute right-0 top-11 w-80 bg-[#181822] border border-[#2d2d3e] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2">
                  {/* Mục 1: Đám mây & Realtime */}
                  <div>
                    <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      Đám mây & Realtime
                    </div>
                    {onOpenSupabaseModal && (
                      <button
                        onClick={() => {
                          setSyncDropdownOpen(false);
                          onOpenSupabaseModal();
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-emerald-600/15 text-zinc-200 transition-colors group cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Database className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                          <div>
                            <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                              <span>Supabase Cloud Sync</span>
                              {hasSupabaseConfigured && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300">
                                  Đang kết nối
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 leading-tight">
                              Đồng bộ tức thì mọi thay đổi 2 chiều giữa điện thoại & máy tính
                            </div>
                          </div>
                        </div>
                        {hasSupabaseConfigured && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0 ml-2" />}
                      </button>
                    )}

                    {/* Google Drive 1-Click Sync Modal (Web, Mobile & Desktop) */}
                    {onOpenGoogleDriveModal && (
                      <button
                        onClick={() => {
                          setSyncDropdownOpen(false);
                          onOpenGoogleDriveModal();
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-blue-600/15 text-zinc-200 transition-colors group cursor-pointer mt-0.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <Cloud className="w-4 h-4 text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
                          <div>
                            <div className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                              <span>Google Drive Sync</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-950 border border-blue-500/40 text-blue-300 font-mono">
                                1-Click
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 leading-tight">
                              Đẩy lên & Kéo về từ thư mục Mindnote chỉ với 1 Click
                            </div>
                          </div>
                        </div>
                        {(hasDriveConfigured || isDesktop) && (
                          <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0 ml-2" />
                        )}
                      </button>
                    )}

                    {/* Quick 1-Click Export to Local G:\ Drive on Desktop */}
                    {isDesktop && onExportGoogleDrive && (
                      <button
                        onClick={() => {
                          setSyncDropdownOpen(false);
                          onExportGoogleDrive(activeMap, false);
                        }}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-emerald-600/15 text-zinc-200 transition-colors group cursor-pointer mt-0.5"
                      >
                        <Zap className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <div>
                          <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                            <span>Lưu tức thì vào ổ G:\ (Map này)</span>
                          </div>
                          <div className="text-[11px] text-zinc-400 leading-tight">
                            Ghi thẳng vào G:\My Drive\Mindnote không cần mở bảng
                          </div>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Mục: Tối ưu & Quản lý Ảnh */}
                  <div className="border-t border-[#292938] pt-1.5">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Quản lý & Tối ưu Ảnh</span>
                      {attachmentCount > 0 && (
                        <span className="text-[10px] text-purple-400 font-mono">
                          {attachmentCount} ảnh
                        </span>
                      )}
                    </div>

                    {onCleanOrphanImages && (
                      <button
                        onClick={() => {
                          setSyncDropdownOpen(false);
                          onCleanOrphanImages();
                        }}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-amber-500/15 text-zinc-200 transition-colors group cursor-pointer"
                        title="Quét và xóa ảnh mồ côi không còn dùng trong các ô ghi chú"
                      >
                        <Trash2 className="w-4 h-4 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <div>
                          <div className="text-xs font-semibold text-amber-300">
                            Xóa ảnh rác trong Map này
                          </div>
                          <div className="text-[11px] text-zinc-400 leading-tight">
                            Quét & xóa ảnh không còn dùng trên map & Supabase
                          </div>
                        </div>
                      </button>
                    )}

                    {hasSupabaseConfigured && onOffloadImagesToSupabase && (
                      <button
                        onClick={() => {
                          setSyncDropdownOpen(false);
                          onOffloadImagesToSupabase();
                        }}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-emerald-600/15 text-zinc-200 transition-colors group cursor-pointer mt-0.5"
                        title="Đẩy toàn bộ ảnh Base64 lên Supabase Storage để map siêu nhẹ"
                      >
                        <UploadCloud className="w-4 h-4 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <div>
                          <div className="text-xs font-semibold text-emerald-300">
                            Đẩy toàn bộ ảnh lên Supabase Storage
                          </div>
                          <div className="text-[11px] text-zinc-400 leading-tight">
                            Lưu ảnh lên Cloud CDN, map chỉ còn link URL siêu nhẹ
                          </div>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Mục 2: Xuất & Nhập Tệp Sao Lưu (JSON) */}
                  <div className="border-t border-[#292938] pt-1.5">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      Xuất & Nhập Tệp JSON
                    </div>
                    {/* Xuất riêng Map */}
                    <button
                      onClick={() => {
                        setSyncDropdownOpen(false);
                        onExportSingleMap(activeMap);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-purple-600/15 text-zinc-200 transition-colors group cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-purple-400 shrink-0 group-hover:scale-110 transition-transform" />
                      <div>
                        <div className="text-xs font-semibold text-purple-300">
                          Xuất riêng Map này ({activeMap.name})
                        </div>
                        <div className="text-[11px] text-zinc-400 leading-tight">
                          Tải file .json siêu nhẹ kèm đầy đủ ảnh để chia sẻ
                        </div>
                      </div>
                    </button>

                    {/* Sao lưu cả kho */}
                    <button
                      onClick={() => {
                        setSyncDropdownOpen(false);
                        onExportBackup();
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-purple-600/15 text-zinc-200 transition-colors group cursor-pointer mt-0.5"
                    >
                      <Layers className="w-4 h-4 text-zinc-400 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-zinc-200">
                          Sao lưu cả kho ({maps.length} bản đồ)
                        </div>
                        <div className="text-[11px] text-zinc-400 leading-tight">
                          Đóng gói toàn bộ các bản đồ vào 1 file backup
                        </div>
                      </div>
                    </button>

                    {/* Nhập file sao lưu */}
                    <button
                      onClick={() => {
                        setSyncDropdownOpen(false);
                        if (isDesktop && onDesktopImport) {
                          onDesktopImport();
                        } else {
                          fileImportRef.current?.click();
                        }
                      }}
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-cyan-600/15 text-zinc-200 transition-colors group cursor-pointer mt-0.5"
                    >
                      <Upload className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-cyan-300">
                          Nhập tệp sao lưu JSON
                        </div>
                        <div className="text-[11px] text-zinc-400 leading-tight">
                          Nạp map lẻ hoặc khôi phục dữ liệu từ máy tính
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Mục 3: Kho lưu trữ SSD (Chỉ Desktop) */}
                  {isDesktop && (
                    <div className="border-t border-[#292938] pt-1.5">
                      <button
                        onClick={() => {
                          setSyncDropdownOpen(false);
                          window.mindnoteDesktop?.openVaultFolder();
                        }}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-purple-600/15 text-zinc-200 transition-colors group cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4 text-purple-400 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-purple-300">
                            Mở kho lưu trữ Vault SSD
                          </div>
                          <div className="text-[11px] text-zinc-400 leading-tight">
                            Mở thư mục Documents\MindnoteVault trên máy
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Device Mode Switcher (Dropdown or Button) */}
          <div className="relative flex items-center gap-1.5" ref={mobileMenuRef}>
            {isMobile && (
              <button
                onClick={onToggleAi}
                className={`p-2 rounded-xl border transition-all ${
                  isAiOpen
                    ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/40'
                    : 'bg-[#1c1a27] border-purple-500/40 text-purple-300 hover:text-white'
                }`}
                title="Mở Trợ lý Mind Map AI"
              >
                <Sparkles className="w-4 h-4 animate-pulse text-purple-300" />
              </button>
            )}

            {isMobile ? (
              /* Mobile 3-dot hamburger menu */
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl bg-[#1c1c25] border border-[#2e2e3d] text-zinc-300 hover:text-white"
                title="Menu mở rộng"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            ) : (
              /* Desktop toggle device mode */
              <button
                onClick={() => {
                  const nextMode = devicePreference === 'mobile' ? 'desktop' : devicePreference === 'desktop' ? 'auto' : 'mobile';
                  onChangeDeviceMode(nextMode);
                }}
                title={`Chế độ hiện tại: ${devicePreference}. Bấm để chuyển đổi.`}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#1c1c25] border border-[#2e2e3d] text-zinc-400 hover:text-white text-xs font-medium"
              >
                {devicePreference === 'mobile' ? (
                  <>
                    <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                    <span>Mobile</span>
                  </>
                ) : devicePreference === 'desktop' ? (
                  <>
                    <Monitor className="w-3.5 h-3.5 text-blue-400" />
                    <span>Desktop</span>
                  </>
                ) : (
                  <>
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Tự động</span>
                  </>
                )}
              </button>
            )}

            {/* Mobile Popover Menu */}
            {mobileMenuOpen && (
              <div className="absolute top-12 right-0 w-56 bg-[#1a1a24] border border-[#2e2e3e] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1 text-xs">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onToggleAi?.();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-purple-200 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                  <span className="font-semibold">Trợ lý Mind Map AI</span>
                </button>

                {onOpenFlashcardModal && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenFlashcardModal();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-200 hover:bg-[#252535] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-purple-400" />
                      <span>Flashcard Ôn Tập AI</span>
                    </span>
                    {(activeMap.flashcards?.length || 0) > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-purple-600/30 text-purple-200 text-[10px]">
                        {activeMap.flashcards?.length}
                      </span>
                    )}
                  </button>
                )}

                {onAutoLayoutMap && activeMap.nodes.length > 1 && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onAutoLayoutMap();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-200 hover:bg-[#252535] transition-colors"
                  >
                    <GitBranch className="w-4 h-4 text-cyan-400" />
                    <span>Sắp xếp gọn Map (Xếp cây)</span>
                  </button>
                )}

                {onToggleMoveMode && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onToggleMoveMode();
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                      isMoveMode
                        ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40'
                        : 'text-zinc-200 hover:bg-[#252535]'
                    }`}
                  >
                    <BoxSelect className="w-4 h-4 text-amber-400" />
                    <span>{isMoveMode ? 'Đang bật Khoanh vùng di chuyển' : 'Khoanh vùng di chuyển sang Map khác'}</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenContextModal?.();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-200 hover:bg-[#252535] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <span>Ngữ cảnh sổ tay (AI)</span>
                  </span>
                  {hasContext && (
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                  )}
                </button>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenConnectModal?.();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-200 hover:bg-[#252535] transition-colors"
                >
                  <GitBranch className="w-4 h-4 text-purple-400" />
                  <span>Nối liên kết các ô</span>
                </button>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleCopyMapLink();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-200 hover:bg-[#252535] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-purple-400" />
                    <span>Sao chép link Bản đồ</span>
                  </span>
                  {copiedMapLink && <span className="text-[10px] text-emerald-400">Đã chép</span>}
                </button>

                {onOpenSupabaseModal && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenSupabaseModal();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-zinc-200 hover:bg-[#252535] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-400" />
                      <span>Đồng bộ Supabase Cloud</span>
                    </span>
                    {hasSupabaseConfigured && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                  </button>
                )}

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onExportSingleMap(activeMap);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-200 hover:bg-[#252535] transition-colors"
                >
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span>Xuất riêng Map này ({activeMap.name})</span>
                </button>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onExportBackup();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-200 hover:bg-[#252535] transition-colors"
                >
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span>Sao lưu toàn bộ kho ({maps.length} Map)</span>
                </button>

                {onOpenGoogleDriveModal && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenGoogleDriveModal();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-blue-300 hover:bg-blue-950/40 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-blue-400" />
                      <span>Đồng bộ Google Drive (1-Click)</span>
                    </span>
                    {(hasDriveConfigured || isDesktop) && (
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                    )}
                  </button>
                )}

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    fileImportRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-200 hover:bg-[#252535] transition-colors"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Nhập file JSON sao lưu</span>
                </button>

                {onCleanOrphanImages && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onCleanOrphanImages();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-amber-300 hover:bg-amber-950/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-amber-400" />
                    <span>Xóa ảnh rác trong Map ({attachmentCount} ảnh)</span>
                  </button>
                )}

                {hasSupabaseConfigured && onOffloadImagesToSupabase && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOffloadImagesToSupabase();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-emerald-300 hover:bg-emerald-950/40 transition-colors"
                  >
                    <UploadCloud className="w-4 h-4 text-emerald-400" />
                    <span>Đẩy toàn bộ ảnh lên Supabase</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenHelpModal();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-200 hover:bg-[#252535] transition-colors"
                >
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                  <span>Hướng dẫn & Xóa liên kết</span>
                </button>

                <div className="border-t border-zinc-800 my-1 pt-1">
                  <div className="px-3 py-1 text-[10px] uppercase font-semibold text-zinc-500">
                    Giao diện hiển thị
                  </div>
                  <div className="grid grid-cols-3 gap-1 px-1">
                    {(['auto', 'mobile', 'desktop'] as DeviceMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                          onChangeDeviceMode(mode);
                          setMobileMenuOpen(false);
                        }}
                        className={`py-1 rounded-lg text-center font-medium capitalize text-[11px] ${
                          devicePreference === mode
                            ? 'bg-purple-600 text-white font-bold'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {mode === 'auto' ? 'Tự động' : mode === 'mobile' ? 'Mobile' : 'PC'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
