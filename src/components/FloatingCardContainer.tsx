import React, { useRef, useCallback, useEffect } from 'react';
import type { CustomNode, FloatingCardState } from '../types';
import { COLOR_SCHEMES } from '../constants/theme';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  Pencil,
  Eye,
  X,
  Minus,
  Maximize2,
  Grid,
  Layers,
  FileText,
  GripHorizontal,
  Bold,
  Italic,
  List,
  CheckSquare,
  Sigma,
} from 'lucide-react';

interface FloatingCardContainerProps {
  cards: FloatingCardState[];
  nodes: CustomNode[];
  attachments?: Record<string, string>;
  attachmentCaptions?: Record<string, string>;
  onUpdateNode: (id: string, updates: Partial<CustomNode['data']>) => void;
  onCloseCard: (id: string) => void;
  onUpdateCard: (id: string, updates: Partial<FloatingCardState>) => void;
  onBringToFront: (id: string) => void;
  onCloseAllCards: () => void;
  onTileCards: () => void;
  onCascadeCards: () => void;
  onNavigate?: (mapId?: string, noteId?: string) => void;
  onSelectNodeById?: (nodeId: string) => void;
}

export const FloatingCardContainer: React.FC<FloatingCardContainerProps> = ({
  cards,
  nodes,
  attachments = {},
  attachmentCaptions = {},
  onUpdateNode,
  onCloseCard,
  onUpdateCard,
  onBringToFront,
  onCloseAllCards,
  onTileCards,
  onCascadeCards,
  onNavigate,
  onSelectNodeById,
}) => {
  // Dragging card state
  const dragRef = useRef<{
    activeCardId: string | null;
    startX: number;
    startY: number;
    cardStartX: number;
    cardStartY: number;
  }>({
    activeCardId: null,
    startX: 0,
    startY: 0,
    cardStartX: 0,
    cardStartY: 0,
  });

  // Resizing card state
  const resizeRef = useRef<{
    activeCardId: string | null;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  }>({
    activeCardId: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });

  // Listen to mouse / pointer moves for drag and resize
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      // 1. Handling Dragging
      if (dragRef.current.activeCardId) {
        const { activeCardId, startX, startY, cardStartX, cardStartY } = dragRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        const newX = Math.max(10, Math.min(window.innerWidth - 100, cardStartX + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - 80, cardStartY + dy));

        onUpdateCard(activeCardId, { x: newX, y: newY });
      }

      // 2. Handling Resizing
      if (resizeRef.current.activeCardId) {
        const { activeCardId, startX, startY, startWidth, startHeight } = resizeRef.current;
        const dw = e.clientX - startX;
        const dh = e.clientY - startY;

        const newWidth = Math.max(280, Math.min(window.innerWidth * 0.9, startWidth + dw));
        const newHeight = Math.max(180, Math.min(window.innerHeight * 0.85, startHeight + dh));

        onUpdateCard(activeCardId, { width: newWidth, height: newHeight });
      }
    };

    const handlePointerUp = () => {
      dragRef.current.activeCardId = null;
      resizeRef.current.activeCardId = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onUpdateCard]);

  // Start dragging a card from its header
  const handleStartDrag = useCallback(
    (cardId: string, e: React.PointerEvent) => {
      // Don't drag if clicked on button or input
      if ((e.target as HTMLElement).closest('button, input, textarea, a')) return;

      onBringToFront(cardId);
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;

      dragRef.current = {
        activeCardId: cardId,
        startX: e.clientX,
        startY: e.clientY,
        cardStartX: card.x,
        cardStartY: card.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [cards, onBringToFront]
  );

  // Start resizing a card from bottom-right corner
  const handleStartResize = useCallback(
    (cardId: string, e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      onBringToFront(cardId);
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;

      resizeRef.current = {
        activeCardId: cardId,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: card.width,
        startHeight: card.height,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [cards, onBringToFront]
  );

  if (cards.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[120] overflow-hidden select-none">
      {/* ========================================================= */}
      {/* DANH SÁCH CÁC THẺ GHI CHÚ NỔI TRÊN MÀN HÌNH (DESKTOP)     */}
      {/* ========================================================= */}
      {cards.map((card) => {
        const node = nodes.find((n) => n.id === card.id);
        if (!node) return null;

        const data = node.data;
        const colorScheme = COLOR_SCHEMES[data.color] || COLOR_SCHEMES.purple;
        const isEditing = Boolean(card.isEditing);
        const isMinimized = Boolean(card.isMinimized);

        return (
          <div
            key={card.id}
            onPointerDown={() => onBringToFront(card.id)}
            style={{
              transform: `translate3d(${card.x}px, ${card.y}px, 0)`,
              width: isMinimized ? '280px' : `${card.width}px`,
              height: isMinimized ? 'auto' : `${card.height}px`,
              zIndex: card.zIndex,
            }}
            className={`absolute flex flex-col rounded-2xl bg-[#14141d]/95 backdrop-blur-xl border border-zinc-700/80 shadow-2xl shadow-black/80 pointer-events-auto transition-shadow duration-150 overflow-hidden ${
              colorScheme.glow
            }`}
          >
            {/* ===================================================== */}
            {/* HEADER THẺ: NƠI KÉO THẢ DI CHUYỂN KHẮP MÀN HÌNH       */}
            {/* ===================================================== */}
            <div
              onPointerDown={(e) => handleStartDrag(card.id, e)}
              className="flex items-center justify-between px-3.5 py-2.5 bg-[#181824] border-b border-zinc-800/80 cursor-grab active:cursor-grabbing shrink-0 select-none hover:bg-[#1c1c2b] transition-colors"
            >
              {/* Tên & Màu sắc thẻ */}
              <div className="flex items-center gap-2 min-w-0 mr-2">
                <GripHorizontal className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className={`w-2.5 h-2.5 rounded-full ${colorScheme.dot} shrink-0 shadow-sm`} />
                <span className="text-xs font-bold text-zinc-100 truncate tracking-wide">
                  {data.label || 'Ghi chú'}
                </span>
              </div>

              {/* Các nút điều khiển thẻ (Sửa / Đọc / Thu nhỏ / Đóng) */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Nút Cây Bút ✏️: Chỉ khi ấn vào cây bút thì mới bắt đầu sửa */}
                {!isMinimized && (
                  <button
                    type="button"
                    onClick={() => onUpdateCard(card.id, { isEditing: !isEditing })}
                    title={isEditing ? 'Chuyển sang chế độ xem nội dung' : 'Bắt đầu chỉnh sửa (Cây bút ✏️)'}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all shadow-xs cursor-pointer ${
                      isEditing
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-purple-600/25 text-purple-200 border border-purple-500/40 hover:bg-purple-600/40 hover:text-white'
                    }`}
                  >
                    {isEditing ? (
                      <>
                        <Eye className="w-3 h-3 text-emerald-400" />
                        <span>Xem</span>
                      </>
                    ) : (
                      <>
                        <Pencil className="w-3 h-3 text-purple-400" />
                        <span>Sửa</span>
                      </>
                    )}
                  </button>
                )}

                {/* Nút Thu nhỏ / Mở rộng */}
                <button
                  type="button"
                  onClick={() => onUpdateCard(card.id, { isMinimized: !isMinimized })}
                  title={isMinimized ? 'Mở rộng thẻ' : 'Thu nhỏ thẻ thành thanh gọn'}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                </button>

                {/* Nút Đóng thẻ */}
                <button
                  type="button"
                  onClick={() => onCloseCard(card.id)}
                  title="Đóng thẻ này"
                  className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ===================================================== */}
            {/* BODY THẺ: MẶC ĐỊNH CHỈ CÓ NỘI DUNG, ẤN BÚT MỚI SỬA     */}
            {/* ===================================================== */}
            {!isMinimized && (
              <div className="flex-1 flex flex-col min-h-0 bg-[#121217] relative select-text">
                {isEditing ? (
                  /* CHẾ ĐỘ SỬA: Bộ soạn thảo nhanh gọn, tự động lưu */
                  <div className="flex-1 flex flex-col min-h-0 p-3 space-y-2">
                    {/* Thanh công cụ định dạng nhanh */}
                    <div className="flex items-center gap-1 pb-1.5 border-b border-zinc-800/80 overflow-x-auto text-zinc-400">
                      <button
                        type="button"
                        onClick={() => {
                          const current = data.content || '';
                          onUpdateNode(card.id, { content: `${current} **in đậm**` });
                        }}
                        title="In đậm"
                        className="p-1 hover:bg-zinc-800 rounded hover:text-white cursor-pointer"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const current = data.content || '';
                          onUpdateNode(card.id, { content: `${current} *in nghiêng*` });
                        }}
                        title="In nghiêng"
                        className="p-1 hover:bg-zinc-800 rounded hover:text-white cursor-pointer"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const current = data.content || '';
                          onUpdateNode(card.id, { content: `${current}\n- Mục danh sách` });
                        }}
                        title="Chấm đầu dòng"
                        className="p-1 hover:bg-zinc-800 rounded hover:text-white cursor-pointer"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const current = data.content || '';
                          onUpdateNode(card.id, { content: `${current}\n- [ ] Nhiệm vụ` });
                        }}
                        title="Ô kiểm task"
                        className="p-1 hover:bg-zinc-800 rounded hover:text-white cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const current = data.content || '';
                          onUpdateNode(card.id, { content: `${current} $x^2 + y^2 = r^2$` });
                        }}
                        title="Công thức KaTeX"
                        className="p-1 hover:bg-zinc-800 rounded hover:text-cyan-400 cursor-pointer"
                      >
                        <Sigma className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Vùng gõ nội dung */}
                    <textarea
                      value={data.content || ''}
                      onChange={(e) => onUpdateNode(card.id, { content: e.target.value })}
                      placeholder="Viết nội dung ghi chú tại đây... (Hỗ trợ Markdown, KaTeX công thức toán, ảnh dán)"
                      className="flex-1 w-full bg-transparent resize-none border-none outline-none text-xs text-zinc-100 placeholder-zinc-500 font-mono leading-relaxed"
                      autoFocus
                    />
                  </div>
                ) : (
                  /* CHẾ ĐỘ ĐỌC: Chỉ hiển thị nội dung thuần túy, đẹp mắt */
                  <div
                    className="flex-1 overflow-y-auto p-4 text-xs select-text cursor-default space-y-2"
                    onDoubleClick={() => onUpdateCard(card.id, { isEditing: true })}
                    title="Nhấp đúp chuột để bắt đầu chỉnh sửa"
                  >
                    {data.content && data.content.trim() ? (
                      <MarkdownRenderer
                        content={data.content}
                        attachments={attachments}
                        attachmentCaptions={attachmentCaptions}
                        onNavigate={onNavigate}
                        onNodeClick={onSelectNodeById}
                      />
                    ) : (
                      <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center p-4 space-y-2 text-zinc-500">
                        <FileText className="w-8 h-8 text-zinc-600" />
                        <p className="text-[11px] text-zinc-400">Ghi chú chưa có nội dung</p>
                        <button
                          type="button"
                          onClick={() => onUpdateCard(card.id, { isEditing: true })}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3 h-3 text-purple-300" />
                          <span>Viết ghi chú</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* =================================================== */}
                {/* TAY CẦM CHỈNH ĐỘ TO NHỎ (RESIZE HANDLE GÓC DƯỚI PHẢI)*/}
                {/* =================================================== */}
                <div
                  onPointerDown={(e) => handleStartResize(card.id, e)}
                  title="Kéo góc này để chỉnh độ to nhỏ của thẻ"
                  className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-1 text-zinc-500 hover:text-purple-400 transition-colors pointer-events-auto select-none"
                >
                  <svg className="w-3 h-3" viewBox="0 0 10 10" fill="currentColor">
                    <circle cx="8" cy="8" r="1.2" />
                    <circle cx="8" cy="4" r="1.2" />
                    <circle cx="4" cy="8" r="1.2" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ========================================================= */}
      {/* THANH DOCK ĐIỀU KHIỂN CÁC THẺ NỔI ĐA NHIỆM (ĐÁY MÀN HÌNH) */}
      {/* ========================================================= */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-[#14141d]/95 backdrop-blur-xl border border-zinc-700/80 shadow-2xl text-xs text-zinc-300 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="font-semibold text-purple-300 flex items-center gap-1 pl-1">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            Đang mở {cards.length} thẻ
          </span>

          <div className="w-px h-3.5 bg-zinc-700 mx-1" />

          {/* Xếp cạnh nhau */}
          <button
            type="button"
            onClick={onTileCards}
            title="Tự động xếp các thẻ nằm cạnh nhau trên màn hình"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <Grid className="w-3.5 h-3.5 text-cyan-400" />
            <span>Xếp cạnh nhau</span>
          </button>

          {/* Xếp bậc thang */}
          <button
            type="button"
            onClick={onCascadeCards}
            title="Tự động xếp các thẻ so le bậc thang"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Xếp so le</span>
          </button>

          <div className="w-px h-3.5 bg-zinc-700 mx-1" />

          {/* Đóng tất cả */}
          <button
            type="button"
            onClick={onCloseAllCards}
            title="Đóng toàn bộ các thẻ nổi"
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-500/15 text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-rose-400" />
            <span>Đóng hết</span>
          </button>
        </div>
      </div>
    </div>
  );
};
