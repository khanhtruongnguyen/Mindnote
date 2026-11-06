import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Bold,
  Link,
  SquareCheck,
  Table,
  Sigma,
  BoxSelect,
  Check,
  Copy,
} from 'lucide-react';

interface SyntaxHandbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertSyntax?: (text: string) => void;
}

interface SyntaxItem {
  name: string;
  syntax: string;
  preview: string;
  description: string;
}

export const SyntaxHandbookModal: React.FC<SyntaxHandbookModalProps> = ({
  isOpen,
  onClose,
  onInsertSyntax,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(key);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const sections: { title: string; icon: React.ReactNode; items: SyntaxItem[] }[] = [
    {
      title: '1. Định Dạng Chữ Cơ Bản',
      icon: <Bold className="w-4 h-4 text-purple-400" />,
      items: [
        {
          name: 'In đậm',
          syntax: '**văn bản in đậm**',
          preview: 'văn bản in đậm',
          description: 'Đặt hai dấu sao ở đầu và cuối từ',
        },
        {
          name: 'In nghiêng',
          syntax: '*văn bản in nghiêng*',
          preview: 'văn bản in nghiêng',
          description: 'Đặt một dấu sao ở đầu và cuối từ',
        },
        {
          name: 'Gạch ngang',
          syntax: '~~văn bản gạch ngang~~',
          preview: 'văn bản gạch ngang',
          description: 'Hai dấu ngã để gạch bỏ ý tưởng cũ',
        },
        {
          name: 'Tiêu đề các cấp',
          syntax: '# Tiêu đề 1\n## Tiêu đề 2\n### Tiêu đề 3',
          preview: 'H1, H2, H3 theo thứ tự phân cấp',
          description: 'Số lượng dấu thăng (#) tương ứng với cấp độ',
        },
      ],
    },
    {
      title: '2. Đóng Ô Ghi Chú & Hộp Điểm Nhấn (Callout / Box)',
      icon: <BoxSelect className="w-4 h-4 text-amber-400" />,
      items: [
        {
          name: 'Khung ghi chú nổi bật',
          syntax: '> 📌 **Ghi chú quan trọng:**\n> Đây là nội dung được đóng khung nổi bật để nhấn mạnh kiến thức cốt lõi.',
          preview: 'Tạo một hộp bo góc có viền màu sắc bắt mắt',
          description: 'Bắt đầu mỗi dòng bằng ký tự >',
        },
        {
          name: 'Khung định nghĩa / Công thức',
          syntax: '> 💡 **Định lý:**\n> Nếu $f(x)$ liên tục trên $[a, b]$ thì luôn tồn tại giá trị cực trị.',
          preview: 'Hộp màu cho định lý và tính chất',
          description: 'Kết hợp dấu > với công thức toán',
        },
      ],
    },
    {
      title: '3. Chèn Liên Kết Tài Liệu (Google Docs, Drive, Web)',
      icon: <Link className="w-4 h-4 text-blue-400" />,
      items: [
        {
          name: 'Link tài liệu Google Docs',
          syntax: '[📄 Đọc bài giảng trên Google Docs](https://docs.google.com/document/d/.../edit)',
          preview: '📄 Đọc bài giảng trên Google Docs (Bấm vào sẽ mở tab mới)',
          description: 'Trong ngoặc vuông [] là tên hiển thị, trong ngoặc tròn () là đường link web',
        },
        {
          name: 'Link tài liệu tham khảo',
          syntax: '[🔗 Wikipedia: Giải tích](https://vi.wikipedia.org/wiki/Giai_tich)',
          preview: '🔗 Wikipedia: Giải tích',
          description: 'Có thể chèn bất kỳ đường link nào trên internet',
        },
      ],
    },
    {
      title: '4. Danh Sách & Danh Sách Việc Cần Làm (To-Do Checkbox)',
      icon: <SquareCheck className="w-4 h-4 text-emerald-400" />,
      items: [
        {
          name: 'Ô tích việc cần làm (Checkbox)',
          syntax: '- [ ] Đọc chương 3 giáo trình\n- [ ] Làm bài tập 1, 2, 3\n- [x] Đã nộp bài tập lớn',
          preview: 'Các ô vuông để tích hoàn thành bài học',
          description: '- [ ] là chưa xong, - [x] là đã hoàn thành',
        },
        {
          name: 'Danh sách gạch đầu dòng',
          syntax: '- Khái niệm 1\n- Khái niệm 2\n  - Chi tiết nhỏ hơn',
          preview: 'Danh sách phân cấp theo thụt dòng',
          description: 'Dùng dấu gạch nối (-)',
        },
      ],
    },
    {
      title: '5. Bảng Biểu (Table)',
      icon: <Table className="w-4 h-4 text-cyan-400" />,
      items: [
        {
          name: 'Bảng so sánh kiến thức',
          syntax: '| Khái niệm | Công thức | Ý nghĩa |\n| :--- | :---: | ---: |\n| Vận tốc | $v = \\frac{s}{t}$ | Quãng đường / thời gian |\n| Gia tốc | $a = \\frac{dv}{dt}$ | Đạo hàm vận tốc |',
          preview: 'Bảng kẻ ô cân đối hiển thị cả công thức toán',
          description: 'Dùng dấu gạch đứng (|) ngăn giữa các cột',
        },
      ],
    },
    {
      title: '6. Công Thức Toán & Khoa Học (LaTeX)',
      icon: <Sigma className="w-4 h-4 text-rose-400" />,
      items: [
        {
          name: 'Công thức nằm trong dòng',
          syntax: 'Năng lượng nghỉ $E = mc^2$ của Einstein',
          preview: 'Năng lượng nghỉ E = mc² của Einstein',
          description: 'Kẹp giữa một dấu đô-la: $công_thức$',
        },
        {
          name: 'Phân số & Căn bậc hai',
          syntax: '$$\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$',
          preview: 'Công thức nghiệm phương trình bậc 2',
          description: '\\frac{tử}{mẫu} và \\sqrt{biểu_thức}',
        },
        {
          name: 'Tích phân & Đạo hàm',
          syntax: '$$\\int_{0}^{\\pi} \\sin(x) dx = 2$$',
          preview: 'Tích phân từ 0 đến π',
          description: '\\int_{cận_dưới}^{cận_trên}',
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181822] border border-[#2e2e3d] rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a38] bg-[#1d1d28] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Sổ Tay Cú Pháp Ghi Chú</h2>
              <p className="text-xs text-zinc-400">
                Hướng dẫn in đậm, in nghiêng, đóng ô, chèn link Google Docs và công thức Toán
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

        {/* Content list */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 select-text">
          {sections.map((sec, sIdx) => (
            <div key={sIdx} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-zinc-800 pb-2">
                {sec.icon}
                <span>{sec.title}</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {sec.items.map((item, iIdx) => {
                  const itemKey = `${sIdx}-${iIdx}`;
                  const isCopied = copiedIndex === itemKey;

                  return (
                    <div
                      key={iIdx}
                      className="p-3 rounded-xl bg-[#13131a] border border-[#262634] hover:border-zinc-700 transition-colors flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-purple-300">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {onInsertSyntax && (
                            <button
                              onClick={() => {
                                onInsertSyntax(item.syntax);
                                onClose();
                              }}
                              className="text-[11px] px-2 py-0.5 rounded bg-purple-600/30 text-purple-200 hover:bg-purple-600/50 transition-colors"
                            >
                              Chèn ngay
                            </button>
                          )}
                          <button
                            onClick={() => handleCopy(itemKey, item.syntax)}
                            title="Sao chép cú pháp"
                            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Đã chép</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-zinc-400" />
                                <span>Sao chép</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="bg-[#0e0e13] p-2.5 rounded-lg border border-zinc-800/80 font-mono text-xs text-zinc-300 whitespace-pre-wrap break-all">
                        {item.syntax}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-500">
                        <span>{item.description}</span>
                        <span className="text-zinc-400 italic">👁️ {item.preview}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#14141c] border-t border-[#2a2a38] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
          >
            Đóng sổ tay
          </button>
        </div>
      </div>
    </div>
  );
};
