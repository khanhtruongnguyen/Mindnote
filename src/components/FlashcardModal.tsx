import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Sparkles,
  Brain,
  CheckSquare,
  Square,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Plus,
  Edit3,
  Check,
  Compass,
  Loader2,
  Layers,
  Image as ImageIcon,
  Sigma,
  Search,
  Award,
  BookOpen,
} from 'lucide-react';
import type { MapData, AppSettings, FlashcardItem } from '../types';
import { AiService } from '../services/aiService';
import { COLOR_SCHEMES } from '../constants/theme';
import { MarkdownRenderer } from './MarkdownRenderer';
import confetti from 'canvas-confetti';

interface FlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMap: MapData;
  selectedNodeId?: string | null;
  settings: AppSettings;
  onUpdateFlashcards: (flashcards: FlashcardItem[]) => void;
  onFocusNode: (nodeId: string) => void;
}

export const FlashcardModal: React.FC<FlashcardModalProps> = ({
  isOpen,
  onClose,
  activeMap,
  selectedNodeId,
  settings,
  onUpdateFlashcards,
  onFocusNode,
}) => {
  const flashcards = useMemo(() => activeMap.flashcards || [], [activeMap.flashcards]);

  // Tab: 'study' (Ôn tập bộ thẻ đã lưu) vs 'generate' (Chọn nhiều ô để AI sinh thẻ mới)
  const [activeTab, setActiveTab] = useState<'study' | 'generate'>(() =>
    flashcards.length > 0 ? 'study' : 'generate'
  );

  // Multi-node selection state
  const [checkedNodeIds, setCheckedNodeIds] = useState<string[]>([]);
  const [nodeSearch, setNodeSearch] = useState('');
  const [cardCount, setCardCount] = useState<number>(6);
  const [cardStyle, setCardStyle] = useState<'mixed' | 'qa' | 'formula_cloze' | 'clinical_case'>('mixed');
  const [appendMode, setAppendMode] = useState<'append' | 'replace'>('append');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Study mode state
  const [statusFilter, setStatusFilter] = useState<'all' | 'unmastered' | 'mastered'>('all');
  const [sourceNodeFilter, setSourceNodeFilter] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Manual Add / Edit Card state
  const [editingCard, setEditingCard] = useState<FlashcardItem | null>(null);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [draftQuestion, setDraftQuestion] = useState('');
  const [draftAnswer, setDraftAnswer] = useState('');

  // Khi mở modal: mặc định tick chọn ô đang mở (nếu có) hoặc chọn tất cả nếu chưa chọn gì
  useEffect(() => {
    if (!isOpen) return;
    if (flashcards.length === 0) {
      setActiveTab('generate');
    }
    if (checkedNodeIds.length === 0 && activeMap.nodes.length > 0) {
      if (selectedNodeId && activeMap.nodes.some((n) => n.id === selectedNodeId)) {
        // Chọn ô hiện tại và các ô nhánh con nối trực tiếp từ nó
        const connectedChildIds = activeMap.edges
          .filter((e) => e.source === selectedNodeId)
          .map((e) => e.target);
        setCheckedNodeIds(Array.from(new Set([selectedNodeId, ...connectedChildIds])));
      } else {
        setCheckedNodeIds(activeMap.nodes.map((n) => n.id));
      }
    }
  }, [isOpen, activeMap.id]);

  // Danh sách thẻ sau khi lọc
  const filteredCards = useMemo(() => {
    return flashcards.filter((c) => {
      if (statusFilter === 'unmastered' && c.status === 'mastered') return false;
      if (statusFilter === 'mastered' && c.status !== 'mastered') return false;
      if (sourceNodeFilter !== 'all' && c.sourceNodeId !== sourceNodeFilter) return false;
      return true;
    });
  }, [flashcards, statusFilter, sourceNodeFilter]);

  useEffect(() => {
    if (currentIndex >= filteredCards.length) {
      setCurrentIndex(0);
    }
    setIsFlipped(false);
  }, [filteredCards.length, statusFilter, sourceNodeFilter]);

  if (!isOpen) return null;

  const currentCard = filteredCards[currentIndex] || null;

  const toggleNodeCheck = (nodeId: string) => {
    setCheckedNodeIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    );
  };

  const handleSelectAllNodes = () => {
    setCheckedNodeIds(activeMap.nodes.map((n) => n.id));
  };

  const handleClearAllNodes = () => {
    setCheckedNodeIds([]);
  };

  const handleSelectBranch = (rootId: string) => {
    const visited = new Set<string>([rootId]);
    const queue = [rootId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const e of activeMap.edges) {
        if (e.source === curr && !visited.has(e.target)) {
          visited.add(e.target);
          queue.push(e.target);
        }
      }
    }
    setCheckedNodeIds(Array.from(visited));
  };

  const handleGenerateFlashcards = async () => {
    const selectedNodes = activeMap.nodes.filter((n) => checkedNodeIds.includes(n.id));
    if (selectedNodes.length === 0) {
      setGenError('Vui lòng tick chọn ít nhất 1 ô ghi chú để tạo Flashcard.');
      return;
    }

    setIsGenerating(true);
    setGenError(null);

    try {
      const baseUrl = settings.aiBaseUrl || 'https://api.xah.io/v1';
      const apiKey =
        settings.aiApiKey || 'sk-6e5bd68e2310d13bcf3747838f1cf8138d68e14e318e4e7e68cfb62a30aff59b';
      const model = settings.aiModel || 'dungcsnd113/gemini-flash-3.8';

      const newCards = await AiService.generateFlashcardsFromNodes({
        baseUrl,
        apiKey,
        model,
        selectedNodes,
        mapName: activeMap.name,
        mapContext: activeMap.context,
        attachments: activeMap.attachments,
        attachmentCaptions: activeMap.attachmentCaptions,
        count: cardCount,
        cardStyle,
      });

      const nextList = appendMode === 'replace' ? newCards : [...newCards, ...flashcards];
      onUpdateFlashcards(nextList);
      setActiveTab('study');
      setStatusFilter('all');
      setSourceNodeFilter('all');
      setCurrentIndex(0);
      setIsFlipped(false);

      try {
        confetti({ particleCount: 55, spread: 65, origin: { y: 0.6 } });
      } catch {
        // ignore
      }
    } catch (err: unknown) {
      const e = err as Error;
      setGenError(e.message || 'Lỗi khi tạo Flashcard từ AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMarkStatus = (cardId: string, status: FlashcardItem['status']) => {
    const updated = flashcards.map((c) =>
      c.id === cardId ? { ...c, status, lastReviewedAt: Date.now() } : c
    );
    onUpdateFlashcards(updated);
    setIsFlipped(false);
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleDeleteCard = (cardId: string) => {
    const updated = flashcards.filter((c) => c.id !== cardId);
    onUpdateFlashcards(updated);
  };

  const handleClearAllCards = () => {
    if (confirm('Bạn có chắc muốn xóa toàn bộ Flashcard của bản đồ này?')) {
      onUpdateFlashcards([]);
    }
  };

  const handleSaveManualOrEditedCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftQuestion.trim() || !draftAnswer.trim()) return;

    if (editingCard) {
      const updated = flashcards.map((c) =>
        c.id === editingCard.id
          ? { ...c, question: draftQuestion.trim(), answer: draftAnswer.trim() }
          : c
      );
      onUpdateFlashcards(updated);
      setEditingCard(null);
    } else {
      const newCard: FlashcardItem = {
        id: `fc-manual-${Date.now()}`,
        question: draftQuestion.trim(),
        answer: draftAnswer.trim(),
        sourceNodeId: selectedNodeId || activeMap.nodes[0]?.id,
        sourceNodeLabel:
          activeMap.nodes.find((n) => n.id === selectedNodeId)?.data.label ||
          activeMap.nodes[0]?.data.label ||
          'Tự soạn',
        status: 'new',
        createdAt: Date.now(),
      };
      onUpdateFlashcards([newCard, ...flashcards]);
      setIsAddingManual(false);
    }
    setDraftQuestion('');
    setDraftAnswer('');
  };

  const filteredMapNodes = activeMap.nodes.filter((n) =>
    (n.data.label || '').toLowerCase().includes(nodeSearch.toLowerCase().trim()) ||
    (n.data.content || '').toLowerCase().includes(nodeSearch.toLowerCase().trim())
  );

  const masteredCount = flashcards.filter((c) => c.status === 'mastered').length;
  const learningCount = flashcards.filter((c) => c.status === 'learning').length;
  const newCount = flashcards.filter((c) => c.status === 'new').length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-[#161621] border border-[#2e2e40] rounded-2xl w-full max-w-3xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#29293a] bg-[#12121b] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-600/30 shrink-0">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">
                  Flashcard Ôn Tập AI
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold shrink-0">
                  {flashcards.length} thẻ đã lưu
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                Chọn nhiều ô trên bản đồ "{activeMap.name}" để AI tạo thẻ hỏi đáp & lưu lại lâu dài
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
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 bg-[#14141d] border-b border-[#252536] shrink-0">
          <div className="flex items-center gap-1.5 bg-[#1b1b28] p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab('study')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'study'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Ôn Tập Thẻ ({flashcards.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('generate')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'generate'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-200" />
              <span>Chọn Nhiều Ô & Tạo Thẻ AI</span>
            </button>
          </div>

          {flashcards.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-md bg-rose-950/50 border border-rose-500/30 text-rose-300">
                Chưa thuộc: {newCount}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-950/50 border border-amber-500/30 text-amber-300">
                Tạm nhớ: {learningCount}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-950/50 border border-emerald-500/30 text-emerald-300">
                Đã thuộc: {masteredCount}
              </span>
            </div>
          )}
        </div>

        {/* BODY CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {activeTab === 'generate' ? (
            /* ============================================================ */
            /* TAB 2: CHỌN NHIỀU Ô TRÊN BẢN ĐỒ ĐỂ AI TẠO FLASHCARD          */
            /* ============================================================ */
            <div className="space-y-4">
              {/* Thanh công cụ chọn nhanh các ô */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#1b1b28] p-3 rounded-xl border border-[#2d2d42]">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">
                    Đã chọn {checkedNodeIds.length} / {activeMap.nodes.length} ô ghi chú
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSelectAllNodes}
                    className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-500/30 text-[11px] font-medium cursor-pointer transition-colors"
                  >
                    Chọn tất cả ({activeMap.nodes.length})
                  </button>
                  {selectedNodeId && (
                    <button
                      type="button"
                      onClick={() => handleSelectBranch(selectedNodeId)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-200 border border-cyan-500/30 text-[11px] font-medium cursor-pointer transition-colors"
                    >
                      Chọn ô đang mở & các nhánh con
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClearAllNodes}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] cursor-pointer transition-colors"
                  >
                    Bỏ chọn hết
                  </button>
                </div>
              </div>

              {/* Tìm kiếm ô */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={nodeSearch}
                  onChange={(e) => setNodeSearch(e.target.value)}
                  placeholder="Tìm kiếm ô ghi chú theo tiêu đề hoặc nội dung..."
                  className="w-full bg-[#12121a] border border-[#2b2b3d] focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 outline-none"
                />
              </div>

              {/* Danh sách các ô để tick chọn */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
                {filteredMapNodes.map((node) => {
                  const isChecked = checkedNodeIds.includes(node.id);
                  const scheme = COLOR_SCHEMES[node.data.color || 'purple'] || COLOR_SCHEMES.purple;
                  const imgMatches = [...(node.data.content || '').matchAll(/attachment:([^\s)]+)/g)];
                  const imgCount = imgMatches.length;
                  const captionedCount = imgMatches.filter(
                    (m) => Boolean(activeMap.attachmentCaptions?.[m[1]]?.trim())
                  ).length;
                  const hasMath = Boolean(node.data.content?.includes('$'));

                  return (
                    <div
                      key={node.id}
                      onClick={() => toggleNodeCheck(node.id)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                        isChecked
                          ? 'bg-purple-600/15 border-purple-500/50 text-white shadow-sm'
                          : 'bg-[#14141f] border-[#262638] text-zinc-400 hover:bg-[#1a1a28] hover:text-zinc-200'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${scheme.dot} shrink-0`} />
                          <span className="text-xs font-semibold truncate">
                            {node.data.label || 'Chưa đặt tên'}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {(node.data.content || '(Trống)').replace(/#|\*|`|\$|!\[.*?\]\(.*?\)/g, '')}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px]">
                          {hasMath && (
                            <span className="inline-flex items-center gap-0.5 text-cyan-400">
                              <Sigma className="w-2.5 h-2.5" /> KaTeX
                            </span>
                          )}
                          {imgCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-400">
                              <ImageIcon className="w-2.5 h-2.5" /> {imgCount} ảnh (
                              {captionedCount}/{imgCount} đã tóm tắt)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tuỳ chọn sinh Flashcard */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#13131c] p-3.5 rounded-xl border border-[#272738]">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                    Số lượng thẻ muốn tạo:
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[4, 6, 10, 15].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCardCount(num)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          cardCount === num
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-[#1b1b28] text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        {num} thẻ
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                    Trọng tâm câu hỏi:
                  </label>
                  <select
                    value={cardStyle}
                    onChange={(e) => setCardStyle(e.target.value as any)}
                    className="w-full bg-[#1b1b28] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-purple-500"
                  >
                    <option value="mixed">🎯 Đa dạng (Khái niệm + Công thức + Vận dụng)</option>
                    <option value="qa">📖 Hỏi - Đáp Lý thuyết & Cơ chế</option>
                    <option value="formula_cloze">📐 Công thức KaTeX & Ngưỡng số liệu</option>
                    <option value="clinical_case">🩺 Tình huống Lâm sàng / Bài tập thực tế</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                    Chế độ lưu vào Bản đồ:
                  </label>
                  <select
                    value={appendMode}
                    onChange={(e) => setAppendMode(e.target.value as any)}
                    className="w-full bg-[#1b1b28] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-purple-500"
                  >
                    <option value="append">➕ Cộng dồn vào {flashcards.length} thẻ hiện có</option>
                    <option value="replace">🔄 Thay thế toàn bộ bộ thẻ cũ</option>
                  </select>
                </div>
              </div>

              {genError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                  ⚠️ {genError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={isGenerating || checkedNodeIds.length === 0}
                  onClick={handleGenerateFlashcards}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.01] cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>AI đang đọc {checkedNodeIds.length} ô & tạo Flashcard...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>
                        🚀 Tạo {cardCount} Flashcard từ {checkedNodeIds.length} ô đã chọn
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* TAB 1: ÔN TẬP & QUẢN LÝ BỘ FLASHCARD ĐÃ LƯU                  */
            /* ============================================================ */
            <div className="space-y-4">
              {flashcards.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center mx-auto">
                    <Brain className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-white">
                    Bản đồ này chưa có bộ Flashcard nào
                  </div>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Hãy chuyển sang tab <strong>"Chọn Nhiều Ô & Tạo Thẻ AI"</strong> để tick chọn các ô ghi chú bạn muốn ôn tập, AI sẽ tự động biên soạn và lưu bộ thẻ cho bạn!
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('generate')}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 cursor-pointer"
                  >
                    + Chọn ô & Tạo Flashcard ngay
                  </button>
                </div>
              ) : (
                <>
                  {/* Thanh lọc thẻ khi ôn tập */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#13131d] p-2.5 rounded-xl border border-[#262638] text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setStatusFilter('all')}
                        className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                          statusFilter === 'all'
                            ? 'bg-purple-600 text-white'
                            : 'bg-[#1c1c2a] text-zinc-400 hover:text-white'
                        }`}
                      >
                        Tất cả ({flashcards.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('unmastered')}
                        className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                          statusFilter === 'unmastered'
                            ? 'bg-amber-600 text-white'
                            : 'bg-[#1c1c2a] text-zinc-400 hover:text-white'
                        }`}
                      >
                        Cần ôn ({newCount + learningCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('mastered')}
                        className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                          statusFilter === 'mastered'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#1c1c2a] text-zinc-400 hover:text-white'
                        }`}
                      >
                        Đã thuộc ({masteredCount})
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCard(null);
                          setDraftQuestion('');
                          setDraftAnswer('');
                          setIsAddingManual(true);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#202030] hover:bg-[#2a2a3e] text-purple-300 border border-purple-500/30 text-[11px] font-semibold cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Tự thêm thẻ</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleClearAllCards}
                        title="Xóa toàn bộ thẻ"
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Form thêm/sửa thẻ thủ công */}
                  {(isAddingManual || editingCard) && (
                    <form
                      onSubmit={handleSaveManualOrEditedCard}
                      className="p-3.5 rounded-xl bg-[#1a1a28] border border-purple-500/40 space-y-3 animate-in fade-in duration-100"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                        <span>{editingCard ? 'Chỉnh sửa thẻ Flashcard' : 'Tự thêm thẻ Flashcard mới'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingManual(false);
                            setEditingCard(null);
                          }}
                          className="text-zinc-400 hover:text-white cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          required
                          value={draftQuestion}
                          onChange={(e) => setDraftQuestion(e.target.value)}
                          placeholder="Mặt trước (Câu hỏi - hỗ trợ KaTeX $...$)"
                          className="w-full bg-[#11111a] border border-zinc-700 focus:border-purple-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
                        />
                        <textarea
                          rows={3}
                          required
                          value={draftAnswer}
                          onChange={(e) => setDraftAnswer(e.target.value)}
                          placeholder="Mặt sau (Đáp án chi tiết - hỗ trợ Markdown & KaTeX $...$)"
                          className="w-full bg-[#11111a] border border-zinc-700 focus:border-purple-500 rounded-lg p-3 text-xs text-white outline-none resize-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingManual(false);
                            setEditingCard(null);
                          }}
                          className="px-3 py-1 rounded-lg text-xs text-zinc-400 hover:text-white cursor-pointer"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Lưu thẻ</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* KHUNG LẬT THẺ FLASHCARD CHÍNH */}
                  {currentCard ? (
                    <div className="space-y-3">
                      <div
                        onClick={() => setIsFlipped(!isFlipped)}
                        className={`relative min-h-[240px] sm:min-h-[270px] rounded-2xl p-5 sm:p-7 border transition-all duration-200 cursor-pointer select-none flex flex-col justify-between shadow-xl ${
                          isFlipped
                            ? 'bg-gradient-to-br from-[#1b2432] to-[#171726] border-emerald-500/50 shadow-emerald-950/20'
                            : 'bg-gradient-to-br from-[#1d1b30] to-[#151522] border-purple-500/50 shadow-purple-950/20 hover:border-purple-400'
                        }`}
                      >
                        {/* Top Bar inside Card */}
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                                isFlipped
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              }`}
                            >
                              {isFlipped ? '💡 Đáp án (Mặt sau)' : '❓ Câu hỏi (Mặt trước)'}
                            </span>

                            <span className="text-zinc-400 font-mono">
                              Thẻ {currentIndex + 1} / {filteredCards.length}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {currentCard.sourceNodeId && (
                              <button
                                type="button"
                                onClick={() => {
                                  onFocusNode(currentCard.sourceNodeId!);
                                  onClose();
                                }}
                                title="Nhảy tới ô ghi chú gốc trên Sơ đồ"
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#232336] hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] transition-colors cursor-pointer"
                              >
                                <Compass className="w-3 h-3" />
                                <span className="truncate max-w-[140px]">
                                  {currentCard.sourceNodeLabel || 'Xem ô gốc'}
                                </span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setEditingCard(currentCard);
                                setDraftQuestion(currentCard.question);
                                setDraftAnswer(currentCard.answer);
                              }}
                              title="Sửa thẻ này"
                              className="p-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCard(currentCard.id)}
                              title="Xóa thẻ này"
                              className="p-1 rounded-lg bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Center Content of Card */}
                        <div className="my-auto py-5 text-sm sm:text-base text-zinc-100 leading-relaxed select-text">
                          <MarkdownRenderer
                            content={isFlipped ? currentCard.answer : currentCard.question}
                            attachments={activeMap.attachments}
                            onNodeClick={(nodeId) => {
                              onFocusNode(nodeId);
                              onClose();
                            }}
                          />
                        </div>

                        {/* Bottom hint */}
                        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-white/10">
                          <span className="flex items-center gap-1.5 text-purple-300 font-medium">
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Nhấp vào thẻ để lật {isFlipped ? 'về câu hỏi' : 'xem đáp án'}</span>
                          </span>
                          <span>
                            Trạng thái:{' '}
                            <strong
                              className={
                                currentCard.status === 'mastered'
                                  ? 'text-emerald-400'
                                  : currentCard.status === 'learning'
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }
                            >
                              {currentCard.status === 'mastered'
                                ? 'Đã thuộc lòng'
                                : currentCard.status === 'learning'
                                ? 'Tạm nhớ'
                                : 'Chưa thuộc'}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Điều hướng Trước / Sau & Đánh giá Mức độ Thuộc bài */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={currentIndex === 0}
                            onClick={() => {
                              setCurrentIndex((prev) => Math.max(0, prev - 1));
                              setIsFlipped(false);
                            }}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1e1e2d] hover:bg-[#28283c] disabled:opacity-40 text-zinc-200 text-xs font-semibold border border-zinc-700/60 cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            <span>Trước</span>
                          </button>

                          <button
                            type="button"
                            disabled={currentIndex >= filteredCards.length - 1}
                            onClick={() => {
                              setCurrentIndex((prev) => Math.min(filteredCards.length - 1, prev + 1));
                              setIsFlipped(false);
                            }}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1e1e2d] hover:bg-[#28283c] disabled:opacity-40 text-zinc-200 text-xs font-semibold border border-zinc-700/60 cursor-pointer"
                          >
                            <span>Tiếp theo</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        {/* 3 Nút Đánh Giá Ghi Nhớ */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleMarkStatus(currentCard.id, 'new')}
                            className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-500/40 text-xs font-semibold cursor-pointer transition-colors"
                          >
                            🔴 Chưa thuộc
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkStatus(currentCard.id, 'learning')}
                            className="px-3 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 border border-amber-500/40 text-xs font-semibold cursor-pointer transition-colors"
                          >
                            🟡 Tạm nhớ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkStatus(currentCard.id, 'mastered')}
                            className="px-3 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-200 border border-emerald-500/40 text-xs font-semibold cursor-pointer transition-colors"
                          >
                            🟢 Đã thuộc lòng
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-xs text-zinc-400">
                      Không có thẻ nào khớp với bộ lọc hiện tại.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
