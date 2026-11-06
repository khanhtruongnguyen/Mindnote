import React, { useState, useRef, useEffect } from 'react';
import type { MapData } from '../types';
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
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  maps: MapData[];
  activeMap: MapData;
  onSelectMap: (mapId: string) => void;
  onOpenNewMapModal: () => void;
  onRenameMap: (mapId: string, newName: string) => void;
  onDeleteMap: (mapId: string) => void;
  onAddNode: () => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onOpenGistModal: () => void;
  onOpenHelpModal: () => void;
  hasGistConfigured: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  maps,
  activeMap,
  onSelectMap,
  onOpenNewMapModal,
  onRenameMap,
  onDeleteMap,
  onAddNode,
  onExportBackup,
  onImportBackup,
  onOpenGistModal,
  onOpenHelpModal,
  hasGistConfigured,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(activeMap.name);
  const fileImportRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditedName(activeMap.name);
    setIsEditingName(false);
  }, [activeMap]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
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
    <header className="absolute top-0 left-0 right-0 h-14 bg-[#141419]/90 backdrop-blur-md border-b border-[#252533] px-4 flex items-center justify-between z-30 select-none">
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

      {/* Left: Brand & Map Selector */}
      <div className="flex items-center gap-3">
        {/* Brand logo */}
        <div className="flex items-center gap-2 pr-3 border-r border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-600/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white hidden sm:inline">
            Nexus<span className="text-purple-400">Canvas</span>
          </span>
        </div>

        {/* Current Map Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center gap-1.5 bg-[#1c1c25] border border-[#2e2e3d] hover:border-zinc-600 rounded-xl px-3 py-1.5 transition-colors">
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
                  className="bg-transparent text-xs font-semibold text-white border-b border-purple-500 outline-none px-0.5 py-0 w-44"
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
                  className="flex items-center gap-2 text-xs font-semibold text-zinc-100 max-w-[200px] truncate"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">{activeMap.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                </button>
                <button
                  onClick={() => setIsEditingName(true)}
                  title="Đổi tên Map này"
                  className="p-1 rounded text-zinc-500 hover:text-zinc-200"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute top-11 left-0 w-64 bg-[#1a1a24] border border-[#2e2e3e] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Danh sách Map của bạn ({maps.length})
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
                      {maps.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Xác nhận xóa bản đồ "${m.name}"?`)) {
                              onDeleteMap(m.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-rose-400 transition-opacity"
                          title="Xóa Map này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                  <span>Tạo Bản đồ / Môn học mới</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Quick Action Controls */}
      <div className="flex items-center gap-2">
        {/* Add Node Button */}
        <button
          onClick={onAddNode}
          title="Thêm nút mới vào giữa màn hình (hoặc click đúp chuột vào canvas)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm nút</span>
        </button>

        {/* Export / Backup button */}
        <button
          onClick={onExportBackup}
          title="Xuất file JSON sao lưu vào máy"
          className="p-2 rounded-xl bg-[#1c1c25] border border-[#2e2e3d] text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Import button */}
        <button
          onClick={() => fileImportRef.current?.click()}
          title="Nhập file JSON sao lưu từ máy"
          className="p-2 rounded-xl bg-[#1c1c25] border border-[#2e2e3d] text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
        >
          <Upload className="w-4 h-4" />
        </button>

        {/* Gist Sync Button */}
        <button
          onClick={onOpenGistModal}
          title={hasGistConfigured ? 'GitHub Gist đã kết nối' : 'Kết nối GitHub Gist để đồng bộ'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
            hasGistConfigured
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : 'bg-[#1c1c25] border-[#2e2e3d] text-zinc-400 hover:text-white'
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Gist Sync</span>
          {hasGistConfigured && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
        </button>

        {/* Help / Shortcuts Button */}
        <button
          onClick={onOpenHelpModal}
          title="Hướng dẫn & Phím tắt"
          className="p-2 rounded-xl bg-[#1c1c25] border border-[#2e2e3d] text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
