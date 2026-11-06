import React, { useState } from 'react';
import { X, Plus, FolderPlus } from 'lucide-react';

interface NewMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export const NewMapModal: React.FC<NewMapModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    setName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181822] border border-[#2e2e3d] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a38] bg-[#1d1d28]">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-white">Tạo Bản Đồ Ghi Chú Mới</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Tên Bản đồ / Môn học
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Đại Số Tuyến Tính, Kinh Tế Lượng, Sinh Học..."
              className="w-full bg-[#121218] border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-purple-600/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo Map</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
