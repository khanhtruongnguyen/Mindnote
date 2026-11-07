import React, { useState, useEffect } from 'react';
import { X, Brain, Sparkles, Check, BookOpen, Stethoscope, Binary, BarChart3 } from 'lucide-react';

interface MapContextModalProps {
  isOpen: boolean;
  mapName: string;
  initialContext?: string;
  onClose: () => void;
  onSaveContext: (context: string) => void;
}

export const MapContextModal: React.FC<MapContextModalProps> = ({
  isOpen,
  mapName,
  initialContext = '',
  onClose,
  onSaveContext,
}) => {
  const [contextText, setContextText] = useState(initialContext);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  useEffect(() => {
    setContextText(initialContext || '');
  }, [initialContext, isOpen]);

  if (!isOpen) return null;

  const handleApplyTemplate = (template: string) => {
    if (contextText.trim() && !confirm('Thay thế ngữ cảnh hiện tại bằng mẫu gợi ý này?')) {
      return;
    }
    setContextText(template);
  };

  const handleSave = () => {
    onSaveContext(contextText.trim());
    setCopiedSuccess(true);
    setTimeout(() => {
      setCopiedSuccess(false);
      onClose();
    }, 500);
  };

  const templates = [
    {
      label: 'Y Khoa & Huyết Học',
      icon: <Stethoscope className="w-3.5 h-3.5 text-rose-400" />,
      content: `[NGỮ CẢNH: Y KHOA - HUYẾT HỌC]
- Trường: Đại học Y Dược.
- Giáo trình tham khảo: Huyết học Lâm sàng, Phân loại Bệnh lý Huyết học theo WHO.
- Trọng tâm môn học: Các dòng tế bào máu (Hồng cầu, Bạch cầu hạt, Tủy bào, Tiểu cầu), tiêu chuẩn chẩn đoán Bạch cầu cấp (AML, ALL), Tủy đồ và Sinh thiết tủy.
- Quy ước AI: Khi giải thích bệnh học, luôn nêu rõ: Triệu chứng lâm sàng, Xét nghiệm cận lâm sàng (CTM, tủy đồ), và Tiêu chuẩn chẩn đoán xác định.`,
    },
    {
      label: 'Toán & Kỹ Thuật',
      icon: <Binary className="w-3.5 h-3.5 text-cyan-400" />,
      content: `[NGỮ CẢNH: TOÁN HỌC & KỸ THUẬT]
- Môn học: Giải Tích / Đại Số Tuyến Tính / Cấu Trúc Dữ Liệu.
- Trọng tâm: Định lý toán học, điều kiện cần và đủ, chứng minh và các bước giải thuật.
- Quy ước AI: Mọi công thức BẮT BUỘC viết dưới dạng KaTeX ($...$ hoặc $$...$$), ghi rõ điều kiện xác định của biến số và đưa ví dụ bằng số cụ thể.`,
    },
    {
      label: 'Kinh Tế & Quản Trị',
      icon: <BarChart3 className="w-3.5 h-3.5 text-amber-400" />,
      content: `[NGỮ CẢNH: KINH TẾ HỌC]
- Môn học: Kinh Tế Vi Mô / Vĩ Mô / Kinh Tế Lượng.
- Trọng tâm: Các quy luật cung cầu, mô hình tối ưu hóa lợi nhuận, chính sách tài khóa & tiền tệ.
- Quy ước AI: Sử dụng thuật ngữ kinh tế chuẩn mực, vẽ đồ thị hoặc bảng so sánh khi phân tích tác động của chính sách.`,
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#181822] border border-[#2e2e3d] rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#2a2a38] bg-[#1d1d28] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 shadow-md shadow-purple-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Ngữ Cảnh Sổ Tay (AI Context)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-normal border border-purple-500/30">
                  {mapName}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Dán đề cương, giáo trình hoặc quy ước riêng để AI hiểu sâu sắc toàn bộ bản đồ này
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 select-text">
          {/* Quick templates */}
          <div>
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Gợi ý mẫu ngữ cảnh nhanh:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {templates.map((tpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyTemplate(tpl.content)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#20202c] hover:bg-[#282838] text-zinc-300 hover:text-white text-xs font-medium border border-zinc-700/60 transition-colors cursor-pointer"
                >
                  {tpl.icon}
                  <span>{tpl.label}</span>
                </button>
              ))}
              {contextText && (
                <button
                  type="button"
                  onClick={() => setContextText('')}
                  className="px-2.5 py-1.5 rounded-xl text-xs text-zinc-500 hover:text-rose-400 transition-colors"
                >
                  Xóa trắng
                </button>
              )}
            </div>
          </div>

          {/* Textarea */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              Nội dung tài liệu nền tảng & Hướng dẫn cho AI:
            </label>
            <textarea
              value={contextText}
              onChange={(e) => setContextText(e.target.value)}
              placeholder="Ví dụ:&#10;- Môn Huyết học Đại học Y, giáo trình thầy XYZ...&#10;- Các từ viết tắt: CTM = Công thức máu, BC = Bạch cầu, BM = Tủy xương...&#10;- Trọng tâm ôn thi: Phân biệt các giai đoạn biệt hóa tế bào...&#10;- Quy ước: Luôn giải thích ngắn gọn, gạch đầu dòng và viết công thức bằng LaTeX..."
              rows={12}
              className="w-full bg-[#121218] border border-zinc-700/80 rounded-xl p-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-purple-500 font-mono leading-relaxed resize-none transition-colors"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-purple-200/90 leading-relaxed flex items-start gap-2.5">
            <BookOpen className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <strong>Cách thức hoạt động:</strong> Mỗi khi bạn bấm <em>+ Nhánh con AI</em>, <em>AI Viết bài</em>, hoặc nhắn tin trong <em>AI Chat</em>, AI sẽ luôn đọc qua ngữ cảnh này đầu tiên. Nhờ đó mọi giải thích và câu trả lời đều bám sát 100% đề cương của bạn!
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 bg-[#14141c] border-t border-[#2a2a38] flex items-center justify-between shrink-0">
          <span className="text-xs text-zinc-500">
            {contextText.trim() ? `${contextText.trim().length} ký tự` : 'Chưa thiết lập'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
            >
              {copiedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Đã lưu ngữ cảnh!</span>
                </>
              ) : (
                <>
                  <Brain className="w-3.5 h-3.5" />
                  <span>Lưu ngữ cảnh môn học</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
