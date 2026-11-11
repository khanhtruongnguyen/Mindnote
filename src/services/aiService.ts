import type { MapData, AgentAction, CustomNode, SplitNodeResult, FlashcardItem, AppSettings } from '../types';

export interface StreamChatOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: unknown }>;
  onChunk: (contentChunk: string, fullContent: string) => void;
  onReasoning?: (reasoningChunk: string, fullReasoning: string) => void;
  signal?: AbortSignal;
}

export const cleanBaseUrl = (url: string): string => {
  return url.trim().replace(/\/+$/, '');
};

export const DEFAULT_ROTATION_MODELS = [
  'dungcsnd113/gemini-flash-3.8',
  'google/gemini-2.5-flash',
  'openai/gpt-4o-mini',
  'deepseek/deepseek-chat',
];

/**
 * Trích xuất danh sách model xoay vòng hợp lệ từ AppSettings
 */
export function getRotationModels(settings?: Partial<AppSettings>): string[] {
  const custom = settings?.preferredModels?.map((m) => m.trim()).filter(Boolean);
  if (custom && custom.length > 0) {
    return Array.from(new Set(custom));
  }
  const current = settings?.aiModel?.trim();
  const list = current ? [current, ...DEFAULT_ROTATION_MODELS] : DEFAULT_ROTATION_MODELS;
  return Array.from(new Set(list));
}

/**
 * Lấy model tiếp theo trong danh sách xoay vòng theo hình thức tròn (Round-Robin)
 */
export function getNextRotationModel(currentModel?: string, preferredModels?: string[]): string {
  const models =
    preferredModels && preferredModels.length > 0
      ? preferredModels.map((m) => m.trim()).filter(Boolean)
      : DEFAULT_ROTATION_MODELS;

  if (models.length === 0) return currentModel || DEFAULT_ROTATION_MODELS[0];
  if (models.length === 1) return models[0];

  const curr = (currentModel || '').toLowerCase().trim();
  const idx = models.findIndex((m) => m.toLowerCase().trim() === curr);

  if (idx === -1 || idx >= models.length - 1) {
    return models[0];
  }
  return models[idx + 1];
}

/**
 * Loại bỏ các nhãn hệ thống/telemetry tiếng Trung (như [ATLAS-OK], 问题, 改动, 方法, 验证)
 * thường bị các proxy/relay API chèn vào phản hồi.
 */
export function cleanAiOutput(text: string): string {
  if (!text) return '';
  // 1. Loại bỏ khối [ATLAS-OK] và mọi nội dung theo sau
  let cleaned = text.replace(/\[ATLAS-OK\][\s\S]*$/gi, '');
  // 2. Loại bỏ các dòng kiểm tra hệ thống tiếng Trung (Vấn đề, Sửa đổi, Phương pháp, Xác minh)
  cleaned = cleaned.replace(/(?:^|\n+)(?:问题|改动|方法|验证)\s*—[\s\S]*$/g, '');
  return cleaned.trimEnd();
}

/**
 * Chuyển đổi mindnote-asset:// sang Base64 trong bộ nhớ RAM cho API AI nếu chạy bản Desktop
 */
export async function resolveImageForAi(img: string): Promise<string> {
  if (!img) return img;
  if (img.startsWith('mindnote-asset://')) {
    try {
      const r = await fetch(img);
      const blob = await r.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) || img);
        reader.readAsDataURL(blob);
      });
    } catch {
      return img;
    }
  }
  return img;
}

/**
 * Nhúng bản mô tả chi tiết hình ảnh (attachmentCaptions) ngay dưới mỗi thẻ ![...](attachment:id)
 * để AI luôn "nhìn" và hiểu sâu nội dung hình ảnh trong ô mà không tốn băng thông gửi lại file ảnh.
 */
export function injectAttachmentCaptionsIntoContent(
  content: string,
  attachmentCaptions?: Record<string, string>
): string {
  if (!content) return '(trống)';
  return content.replace(/!\[([^\]]*)\]\(attachment:([^\s)]+)\)/g, (fullMatch, alt, attachId) => {
    const caption = attachmentCaptions?.[attachId]?.trim();
    if (caption) {
      return `${fullMatch}\n> 🖼️ **[Bản mô tả chi tiết AI của ảnh ${attachId}${alt ? ` (${alt})` : ''}]:** ${caption}`;
    }
    return `${fullMatch}\n> 🖼️ *[Ảnh đính kèm ${attachId} — chưa tạo bản mô tả chi tiết AI]*`;
  });
}

/**
 * Sửa lỗi JSON.parse khi AI sinh công thức LaTeX (\frac, \alpha, \sum...) bên trong chuỗi JSON mà quên escape \\
 */
function safeParseAiJson<T>(rawJsonStr: string): T | null {
  const trimmed = rawJsonStr.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    try {
      // Bảo vệ các escape hợp lệ của JSON (\", \\, \/, \n, \r, \t) nhưng escape các lệnh LaTeX như \frac, \beta, \times, \sqrt...
      const fixed = trimmed.replace(
        /\\(?!["\\/]|u[0-9a-fA-F]{4}|n(?![a-zA-Z])|r(?![a-zA-Z])|t(?![a-zA-Z])|b(?![a-zA-Z])|f(?![a-zA-Z]))/g,
        '\\\\'
      );
      return JSON.parse(fixed) as T;
    } catch {
      return null;
    }
  }
}

export const AiService = {
  /**
   * Tải danh sách model từ OpenAI-compatible API
   */
  async fetchAvailableModels(baseUrl: string, apiKey: string): Promise<string[]> {
    const cleanUrl = cleanBaseUrl(baseUrl);
    const res = await fetch(`${cleanUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || `Lỗi tải danh sách model (${res.status})`);
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.data)) {
      throw new Error('Dữ liệu trả về từ API không chứa danh sách model hợp lệ.');
    }

    const models = data.data
      .map((item: { id?: string }) => item.id)
      .filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0);

    // Sắp xếp: ưu tiên các model có gemini, deepseek, flash, gpt, sau đó sắp xếp abc
    models.sort((a: string, b: string) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aIsFav = aLower.includes('gemini') || aLower.includes('flash') || aLower.includes('deepseek');
      const bIsFav = bLower.includes('gemini') || bLower.includes('flash') || bLower.includes('deepseek');
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      return a.localeCompare(b);
    });

    return models;
  },

  /**
   * Tạo system prompt cung cấp toàn bộ ngữ cảnh Mind Map (kèm bản tóm tắt ảnh đính kèm) cho AI
   */
  buildMindMapSystemPrompt(mapData: MapData): string {
    const nodesInfo = mapData.nodes
      .map((node, index) => {
        const enrichedContent = injectAttachmentCaptionsIntoContent(
          node.data.content || '(trống)',
          mapData.attachmentCaptions
        );
        return `[Node #${index + 1}]
- ID: "${node.id}"
- Tiêu đề: "${node.data.label || 'Chưa đặt tên'}"
- Dạng hình: ${node.data.shape || 'pill'}, Màu sắc: ${node.data.color || 'purple'}
- Tọa độ: x=${Math.round(node.position.x)}, y=${Math.round(node.position.y)}
- Nội dung chi tiết (kèm mô tả hình ảnh nếu có):
${enrichedContent}
----------------------------------------`;
      })
      .join('\n');

    const edgesInfo =
      mapData.edges.length > 0
        ? mapData.edges
            .map((edge) => {
              const sourceNode = mapData.nodes.find((n) => n.id === edge.source);
              const targetNode = mapData.nodes.find((n) => n.id === edge.target);
              return `- "${sourceNode?.data.label || edge.source}" (id: ${edge.source}) ➔ "${targetNode?.data.label || edge.target}" (id: ${edge.target})`;
            })
            .join('\n')
        : '(Hiện tại các nút chưa có liên kết mũi tên nào)';

    const contextSection =
      mapData.context && mapData.context.trim()
        ? `\n=== NGỮ CẢNH SỔ TAY / KIẾN THỨC NỀN CỦA BẢN ĐỒ ===\n${mapData.context.trim()}\n(LƯU Ý: Đây là giáo trình, tài liệu chuyên môn và hướng dẫn nền tảng do sinh viên cung cấp cho bản đồ này. Mọi phân tích, giải thích và gợi ý BẮT BUỘC phải dựa trên ngữ cảnh chuyên môn này!)\n`
        : '';

    return `Bạn là một trợ lý AI thông minh chuyên phân tích, giải thích, tóm tắt và mở rộng Sơ đồ tư duy (Mind Map).
Người dùng đang làm việc trên sơ đồ tư duy có tên: "${mapData.name}".
${contextSection}
=== THÔNG TIN SƠ ĐỒ TƯ DUY HIỆN TẠI ===
* Tổng số ô ghi chú (nodes): ${mapData.nodes.length}
* Các liên kết giữa các ô (edges):
${edgesInfo}

* Chi tiết từng ô ghi chú:
${nodesInfo}

=== QUY TẮC PHẢN HỒI QUAN TRỌNG ===
1. NGÔN NGỮ: BẮT BUỘC 100% SỬ DỤNG TIẾNG VIỆT HOÀN TOÀN TỰ NHIÊN, TRONG SÁNG.
   - TUYỆT ĐỐI KHÔNG dùng tiếng Trung.
   - KHÔNG ĐƯỢC CHÈN bất kỳ đoạn báo cáo telemetry/audit format như [ATLAS-OK], 问题, 改动, 方法, 验证 ở cuối phản hồi.
   - Chỉ trả lời trực tiếp nội dung người dùng hỏi, không thêm bất kỳ metadata nào ở cuối.
2. NGẮN GỌN & RÕ RÀNG: Trả lời đúng trọng tâm bằng tiếng Việt, có bố cục đẹp (bullet points, in đậm từ khóa quan trọng).
3. TRÍCH DẪN Ô NOTE: Khi đề cập đến bất kỳ ô ghi chú nào trong sơ đồ, BẮT BUỘC dùng định dạng markdown:
   [Tên ô ghi chú](node:ID_CỦA_NODE)
   Ví dụ: "Bạn có thể xem lại công thức trong [Khai Triển Taylor](node:node-taylor) và đối chiếu với [Định Lý Lagrange](node:node-lagrange)."
   Nhờ đó, người dùng có thể bấm vào liên kết và màn hình sơ đồ sẽ tự động chuyển đến đúng ô đó.
4. CÔNG THỨC TOÁN HỌC: Nếu giải thích toán học hoặc khoa học, hãy sử dụng KaTeX chuẩn ($...$ cho inline và $$...$$ cho display block).
5. TƯ DUY PHẢN BIỆN: Nếu người dùng hỏi xin ý kiến về sơ đồ, hãy chỉ ra các nhánh còn thiếu, các điểm mâu thuẫn hoặc gợi ý mở rộng thêm các ý tưởng con logic.`;
  },

  /**
   * Tạo system prompt cho chế độ AI Agent (Tự động xây dựng, mở rộng và chỉnh sửa Mind Map)
   * Đã nâng cấp: Cung cấp đầy đủ nội dung và mô tả ảnh của các ô hiện có để Agent không làm mất dữ liệu cũ!
   */
  buildAgentSystemPrompt(mapData: MapData): string {
    const nodesSummary =
      mapData.nodes.length > 0
        ? mapData.nodes
            .map((n, idx) => {
              const enrichedContent = injectAttachmentCaptionsIntoContent(
                n.data.content || '(trống)',
                mapData.attachmentCaptions
              );
              return `[Ô #${idx + 1}] ID: "${n.id}" | Tiêu đề: "${n.data.label || 'Chưa đặt tên'}" | Dạng: ${n.data.shape || 'pill'} | Màu: ${n.data.color || 'purple'}
Nội dung hiện có:
${enrichedContent}
----------------------------------------`;
            })
            .join('\n')
        : '(Bản đồ hiện đang trống, chưa có ô ghi chú nào)';

    const edgesSummary =
      mapData.edges.length > 0
        ? mapData.edges
            .map((e) => {
              const src = mapData.nodes.find((n) => n.id === e.source)?.data.label || e.source;
              const tgt = mapData.nodes.find((n) => n.id === e.target)?.data.label || e.target;
              return `- "${src}" (${e.source}) ➔ "${tgt}" (${e.target})`;
            })
            .join('\n')
        : '(Chưa có liên kết nối nào)';

    const contextSection =
      mapData.context && mapData.context.trim()
        ? `\n=== ĐỀ CƯƠNG / NGỮ CẢNH SỔ TAY CỦA BẢN ĐỒ ===\n${mapData.context.trim()}\n(LƯU Ý CỰC KỲ QUAN TRỌNG: Đây là đề cương, bài giảng hoặc tài liệu môn học do người dùng cung cấp. Bạn BẮT BUỘC phải đọc kỹ để phân tích và trích xuất cấu trúc kiến thức đầy đủ, khoa học nhất cho sơ đồ!)\n`
        : '\n(Bản đồ hiện chưa có đề cương trong ngữ cảnh. Bạn hãy xây dựng sơ đồ dựa trên yêu cầu trực tiếp của người dùng và các ô hiện có.)\n';

    return `Bạn là NexusNotes AI Agent — Kỹ sư & Kiến trúc sư Sơ đồ tư duy Tự động (Autonomous Mind Map Architect & Builder).
Nhiệm vụ của bạn là: Lắng nghe mệnh lệnh người dùng, phân tích đề cương/ngữ cảnh và TRỰC TIẾP XÂY DỰNG, THÊM BỚT HOẶC TỔ CHỨC LẠI BẢN ĐỒ CHO NGƯỜI DÙNG.

Tên bản đồ hiện tại: "${mapData.name}"
${contextSection}
=== CẤU TRÚC & NỘI DUNG BẢN ĐỒ HIỆN TẠI ===
* Danh sách các ô ghi chú (${mapData.nodes.length}):
${nodesSummary}

* Các đường nối hiện có (${mapData.edges.length}):
${edgesSummary}

=== QUY TẮC BẮT BUỘC KHI LÀM AI AGENT ===
1. NGÔN NGỮ: BẮT BUỘC 100% TIẾNG VIỆT tự nhiên, chu đáo, giải thích rõ cấu trúc bạn thiết kế. Tuyệt đối không dùng tiếng Trung. Không xuất hiện [ATLAS-OK] hay metadata ở cuối.
2. CHẤT LƯỢNG NỘI DUNG TỪNG Ô:
   - "label": Ngắn gọn, súc tích (dưới 40 ký tự), thể hiện rõ chủ đề/khái niệm.
   - "content": Nội dung Markdown phong phú, bao gồm giải thích định nghĩa, công thức KaTeX ($...$ và $$...$$), bullet points, và khung ghi chú (> 📌 Điểm mấu chốt). Nếu sửa ô cũ có chứa thẻ ảnh ![...](attachment:...), BẮT BUỘC giữ nguyên thẻ ảnh ![...](attachment:...) đó trong content (không chép lại dòng "> 🖼️ [Bản tóm tắt AI...]" vào content).
   - "color": 'purple' | 'blue' | 'emerald' | 'amber' | 'rose' | 'cyan' (chọn màu đồng bộ theo từng nhánh hoặc chủ đề).
   - "shape": 'card' (thẻ thông tin đẹp) hoặc 'full' (ô chi tiết toàn bộ công thức) hoặc 'pill' (thẻ nhãn ngắn).
3. ĐƯỜNG NỐI (EDGES): Xác định đường nối phân cấp hình cây logic giữa các ô:
   - Từ ô chủ đề chính (source) trỏ đến các ô nhánh cấp 1 (target), từ nhánh cấp 1 trỏ đến nhánh cấp 2.
4. ĐỊNH DẠNG XUẤT LỆNH BẮT BUỘC CHO HỆ THỐNG THỰC THI:
   Ở cuối câu trả lời, bạn BẮT BUỘC phải xuất ra một khối JSON code block với cú pháp:
\`\`\`json:agent-action
{
  "type": "create_map" | "modify_map",
  "summary": "Tóm tắt ngắn gọn những gì bạn đã tạo/sửa (vd: Đã tạo 5 chủ đề chính và 8 liên kết từ đề cương)",
  "nodes": [
    {
      "id": "node-1",
      "label": "Tên ô",
      "content": "Nội dung Markdown chi tiết...",
      "color": "purple",
      "shape": "card"
    }
  ],
  "edges": [
    {
      "source": "node-1",
      "target": "node-2"
    }
  ]
}
\`\`\`
- Nếu người dùng yêu cầu: "tạo map từ đề cương", "xây lại bản đồ", hoặc bản đồ đang trống: Đặt "type": "create_map".
- Nếu người dùng yêu cầu: "thêm nhánh", "sửa một vài ô", "nối thêm": Đặt "type": "modify_map" (giữ đúng "id" của các ô hiện có khi nối hoặc cập nhật).`;
  },

  /**
   * Trích xuất AgentAction từ phản hồi của AI (Hỗ trợ tự sửa lỗi escape LaTeX trong JSON)
   */
  extractAgentAction(content: string): AgentAction | null {
    if (!content) return null;
    try {
      const match =
        content.match(/```(?:json:agent-action|json)\s*([\s\S]*?)```/) ||
        content.match(/\{[\s\S]*"type"\s*:\s*"(?:create_map|modify_map)"[\s\S]*"nodes"\s*:\s*\[[\s\S]*\][\s\S]*\}/);

      if (!match) return null;
      const jsonStr = match[1] || match[0];
      const parsed = safeParseAiJson<AgentAction>(jsonStr);
      if (
        parsed &&
        (parsed.type === 'create_map' || parsed.type === 'modify_map') &&
        Array.isArray(parsed.nodes)
      ) {
        return parsed;
      }
    } catch {
      // ignore JSON parse errors during streaming
    }
    return null;
  },

  /**
   * Gọi chat completion có streaming Server-Sent Events (SSE)
   */
  async streamChatCompletion({
    baseUrl,
    apiKey,
    model,
    messages,
    onChunk,
    onReasoning,
    signal,
  }: StreamChatOptions): Promise<{ content: string; reasoning: string }> {
    const cleanUrl = cleanBaseUrl(baseUrl);

    const response = await fetch(`${cleanUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        messages,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || `Lỗi API (${response.status})`);
    }

    if (!response.body) {
      throw new Error('API không hỗ trợ ReadableStream response body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedContent = '';
    let accumulatedReasoning = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') {
            return {
              content: cleanAiOutput(accumulatedContent),
              reasoning: accumulatedReasoning,
            };
          }

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;

            if (delta) {
              if (delta.reasoning_content) {
                accumulatedReasoning += delta.reasoning_content;
                onReasoning?.(delta.reasoning_content, accumulatedReasoning);
              }
              if (delta.content) {
                accumulatedContent += delta.content;
                onChunk(delta.content, cleanAiOutput(accumulatedContent));
              }
            }
          } catch {
            // bỏ qua dòng không parse được JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      content: cleanAiOutput(accumulatedContent),
      reasoning: accumulatedReasoning,
    };
  },

  /**
   * AI Tạo Bản Mô Tả Chi Tiết (Image Detailed Description & Transcription) cho một bức ảnh đính kèm
   * Phân tích sâu, trích xuất toàn bộ chữ viết, số liệu, sơ đồ và công thức để AI nắm bắt 100% dữ liệu ảnh.
   */
  async generateImageCaption({
    baseUrl,
    apiKey,
    model,
    imageBase64,
    nodeLabel,
    mapContext,
  }: {
    baseUrl: string;
    apiKey: string;
    model: string;
    imageBase64: string;
    nodeLabel?: string;
    mapContext?: string;
  }): Promise<string> {
    const cleanUrl = cleanBaseUrl(baseUrl);
    const resolvedImage = await resolveImageForAi(imageBase64);

    let systemPrompt = `Bạn là trợ lý thị giác AI cấp cao chuyên đọc hiểu và phiên giải hình ảnh học thuật chi tiết sâu (sơ đồ y khoa, giải phẫu, cơ chế bệnh sinh, đồ thị toán học, công thức LaTeX, bảng số liệu, slide bài giảng và hình chụp minh họa).
Nhiệm vụ của bạn: TUYỆT ĐỐI KHÔNG ĐƯỢC TÓM TẮT SƠ SÀI. Hãy đọc toàn diện bức ảnh và viết một BẢN MÔ TẢ CHI TIẾT ĐẦY ĐỦ TỪNG THÀNH PHẦN CỦA BỨC ẢNH bằng tiếng Việt chuẩn xác:
QUY TẮC BẮT BUỘC:
1. TRÍCH XUẤT TOÀN BỘ CHỮ VIẾT & SỐ LIỆU: Đọc hết mọi tiêu đề, nhãn (labels), chỉ dẫn, giá trị số liệu, bảng biểu xuất hiện trong ảnh. Nếu có công thức toán/hóa/y sinh thì chuyển đổi chính xác sang cú pháp KaTeX ($...$ hoặc $$...$$).
2. MÔ TẢ CẤU TRÚC VÀ SƠ ĐỒ CHI TIẾT: Nêu rõ sơ đồ dòng chảy (flowchart), các khối hình, mũi tên chỉ hướng (từ đâu đến đâu), quan hệ nguyên nhân - kết quả, các nhánh phân loại, màu sắc quy ước và ý nghĩa của từng phần.
3. VỚI HÌNH Y KHOA / LÂM SÀNG: Ghi chi tiết các triệu chứng, tổn thương, xét nghiệm, bước chẩn đoán, thuốc, liều lượng, cơ chế sinh lý bệnh được vẽ trong ảnh.
4. TRÌNH BÀY MẠCH LẠC: Chia thành các đề mục hoặc gạch đầu dòng rõ ràng, đầy đủ thông tin để người không nhìn thấy ảnh vẫn nắm bắt được 100% nội dung ảnh.
5. Tuyệt đối không chào hỏi rườm rà, không thêm bớt ngoài ảnh, chỉ trả về nội dung mô tả chi tiết để làm bộ nhớ dữ liệu cho AI.`;

    if (mapContext && mapContext.trim()) {
      systemPrompt += `\n\n[NGỮ CẢNH BẢN ĐỒ]:\n${mapContext.trim()}`;
    }

    const userText = nodeLabel
      ? `Hình ảnh này nằm trong ô ghi chú "${nodeLabel}". Hãy mô tả chi tiết, đầy đủ toàn bộ nội dung, chữ viết, số liệu, công thức và sơ đồ trong bức ảnh này (tuyệt đối không tóm tắt sơ sài):`
      : `Hãy mô tả chi tiết, đầy đủ toàn bộ nội dung, chữ viết, số liệu, công thức và sơ đồ trong bức ảnh này (tuyệt đối không tóm tắt sơ sài):`;

    const res = await fetch(`${cleanUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText },
              { type: 'image_url', image_url: { url: resolvedImage } },
            ],
          },
        ],
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || `Lỗi tạo mô tả chi tiết ảnh (${res.status})`);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    const cleaned = cleanAiOutput(rawContent).trim();
    if (!cleaned) {
      throw new Error('Model AI không trả về nội dung mô tả chi tiết cho ảnh này.');
    }
    return cleaned;
  },

  /**
   * AI Viết lại / Trau chuốt / Mở rộng nội dung cho 1 ô ghi chú
   */
  async refineNoteContent({
    baseUrl,
    apiKey,
    model,
    nodeLabel,
    currentContent,
    mode,
    customInstruction,
    mapContext,
    images,
    attachmentCaptions,
  }: {
    baseUrl: string;
    apiKey: string;
    model: string;
    nodeLabel: string;
    currentContent: string;
    mode:
      | 'expand'
      | 'summarize'
      | 'formula'
      | 'polish'
      | 'custom'
      | 'explain_image'
      | 'format_table_css'
      | 'reorganize_layout'
      | 'ocr_image'
      | 'describe_image';
    customInstruction?: string;
    mapContext?: string;
    images?: string[];
    attachmentCaptions?: Record<string, string>;
  }): Promise<string> {
    const cleanUrl = cleanBaseUrl(baseUrl);

    let instruction = '';
    switch (mode) {
      case 'expand':
        instruction =
          'Hãy khai triển chi tiết và viết sâu hơn các ý tưởng cho ô ghi chú này. Bổ sung các giải thích rõ ràng, ví dụ cụ thể hoặc các luận điểm quan trọng.';
        break;
      case 'summarize':
        instruction =
          'Hãy tóm tắt toàn bộ nội dung của ô ghi chú này thành các gạch đầu dòng súc tích, ngắn gọn, giữ lại các từ khóa và công thức cốt lõi.';
        break;
      case 'formula':
        instruction =
          'Hãy bổ sung và chuẩn hóa các công thức toán học/khoa học liên quan bằng định dạng KaTeX ($...$ hoặc $$...$$) kèm chú thích rõ ràng từng biến số.';
        break;
      case 'polish':
        instruction =
          'Hãy sửa lỗi chính tả, cải thiện ngữ pháp, làm cho câu từ mượt mà, chuyên nghiệp và chuẩn hóa cấu trúc Markdown (tiêu đề, in đậm, callout box).';
        break;
      case 'reorganize_layout':
        instruction =
          `Hãy đọc hiểu sâu sắc nội dung hiện có để TỰ ĐỘNG SẮP XẾP, TỔ CHỨC VÀ BỐ CỤC LẠI CHO THẬT GỌN GÀNG, KHOA HỌC:
QUY TẮC BẮT BUỘC (TUÂN THỦ TUYỆT ĐỐI):
1. ĐỌC HIỂU ĐỂ SẮP XẾP CHÍNH XÁC: Nhận diện cấu trúc luận điểm, các ý chính, ý phụ, nguyên nhân - kết quả, các bước hoặc nhóm nội dung liên quan để sắp xếp lại theo một trình tự logic, mạch lạc, dễ theo dõi nhất.
2. TUYỆT ĐỐI KHÔNG ĐƯỢC THAY ĐỔI NỘI DUNG: Giữ nguyên 100% toàn bộ thông tin, câu chữ, ý tứ, số liệu, thuật ngữ, công thức của người dùng. KHÔNG tóm tắt làm mất ý, KHÔNG bịa đặt thêm nội dung ngoài bài, KHÔNG viết lại làm sai lệch thông tin gốc.
3. BỐ CỤC ĐƠN GIẢN, TRONG SÁNG:
   - TUYỆT ĐỐI KHÔNG DÙNG ICON / EMOJI (Cấm dùng: 📌, 💡, 🚀, 🎯, ⭐, 📝, v.v.).
   - TUYỆT ĐỐI KHÔNG DÙNG GẠCH NGANG CÁCH DÒNG (Cấm dùng: --- hoặc *** hoặc <hr>).
   - Chỉ dùng cấu trúc Markdown chuẩn mực: Tiêu đề phân cấp (##, ###), danh sách thụt đầu dòng rõ ràng (- hoặc 1.), và đoạn văn gãy gọn.
4. GIỮ NGUYÊN ẢNH: Nếu có thẻ ảnh ![...](attachment:...), phải giữ nguyên đúng vị trí phù hợp trong bài.`;
        break;
      case 'format_table_css':
        instruction =
          'Hãy nhận diện toàn bộ bảng biểu thô, dữ liệu phân cột hoặc các ký tự rời rạc/khó đọc trong ô ghi chú này, và chuyển đổi thành: 1. Bảng Markdown chuẩn (| Cột 1 | Cột 2 |...) căn chỉnh ngay ngắn, 2. Khối đóng ô / Callout box (> 📌 [Tiêu đề]) phong cách Obsidian đẹp mắt, 3. Các ký tự toán/khoa học chuyển thành KaTeX ($...$). Đảm bảo trình bày chuẩn đẹp, không bị lỗi font hay vỡ cấu trúc bảng.';
        break;
      case 'ocr_image':
        instruction =
          'Hãy trích xuất TOÀN BỘ chữ viết, tiêu đề, số liệu, bảng biểu và công thức toán học/khoa học có trong hình ảnh này thành văn bản Markdown chuẩn 100%. Giữ nguyên cấu trúc bảng và dòng, KHÔNG bỏ sót bất kỳ thông tin nào.';
        break;
      case 'describe_image':
        instruction =
          'Hãy quan sát thật kỹ bức ảnh này và viết một bản MÔ TẢ TRỰC QUAN & PHÂN TÍCH TOÀN DIỆN để thay thế hoàn toàn cho bức ảnh (tiết kiệm dung lượng lưu trữ). Hãy mô tả chi tiết: 1. Tổng thể hình ảnh (sơ đồ gì, đồ thị gì, tiêu bản gì); 2. Chi tiết từng đối tượng, vị trí, các mũi tên liên kết chỉ từ đâu đến đâu; 3. Bản chất học thuật, ý nghĩa kiến thức và các công thức/số liệu đi kèm. Trình bày dưới dạng Markdown chuyên nghiệp với khung trích dẫn (> 🖼️ [Mô tả trực quan]) để người đọc chỉ cần đọc văn bản là hình dung rõ ràng như đang xem ảnh thật, và AI sau này đọc lại cũng hiểu 100%!';
        break;
      case 'explain_image':
        instruction =
          'Hãy đọc kỹ hình ảnh được đính kèm và phân tích, giải thích chi tiết các thành phần, cấu trúc, sơ đồ hoặc phương trình có trong ảnh thành nội dung bài học hoàn chỉnh.';
        break;
      case 'custom':
        instruction = customInstruction || 'Hãy tối ưu và cải thiện nội dung ô ghi chú này.';
        break;
    }

    let fullSystemPrompt = `Bạn là trợ lý AI chuyên nghiệp về biên soạn nội dung và tài liệu học tập chuẩn Obsidian Markdown.
QUY TẮC BẮT BUỘC:
1. 100% tiếng Việt tự nhiên, không tiếng Trung, không xuất thẻ hệ thống hay [ATLAS-OK].
2. Sử dụng Markdown đẹp mắt (heading, bold, list, blockquote).
3. Sử dụng KaTeX ($...$ và $$...$$) cho công thức toán học nếu có.
4. Nếu trong bài viết gốc có thẻ ảnh đính kèm dạng ![...](attachment:...), hãy GIỮ NGUYÊN thẻ ![...](attachment:...) đó (trừ khi người dùng yêu cầu mô tả thay ảnh). KHÔNG lặp lại dòng "> 🖼️ [Bản mô tả chi tiết AI của ảnh...]" vào kết quả.
5. CHỈ TRẢ VỀ nội dung Markdown của ô ghi chú. KHÔNG kèm câu chào đầu hay lời giải thích ngoài lề.`;

    if (mode === 'reorganize_layout') {
      fullSystemPrompt += `\nLƯU Ý ĐẶC BIỆT KHI SẮP XẾP BỐ CỤC:
- TUYỆT ĐỐI KHÔNG ĐƯỢC THAY ĐỔI NỘI DUNG CÂU CHỮ VÀ SỐ LIỆU GỐC CỦA NGƯỜI DÙNG.
- CẤM SỬ DỤNG ICON/EMOJI DƯỚI MỌI HÌNH THỨC (không dùng 📌, 💡, 🚀, v.v.).
- CẤM SỬ DỤNG GẠCH NGANG CÁCH DÒNG (không dùng --- hoặc *** hoặc <hr>).
- Bố cục đơn giản, sạch sẽ chỉ với tiêu đề ##, ### và danh sách thụt lề gãy gọn.`;
    }

    if (mapContext && mapContext.trim()) {
      fullSystemPrompt += `\n\n[NGỮ CẢNH SỔ TAY / KIẾN THỨC NỀN CỦA BẢN ĐỒ]:\n${mapContext.trim()}\n(LƯU Ý: Hãy đối chiếu và sử dụng kiến thức, thuật ngữ trong ngữ cảnh này để viết nội dung chính xác theo giáo trình!)`;
    }

    const enrichedCurrent = injectAttachmentCaptionsIntoContent(
      currentContent || '(Chưa có nội dung, hãy viết mới)',
      attachmentCaptions
    );

    const userPrompt = `TIÊU ĐỀ Ô: "${nodeLabel}"

NỘI DUNG HIỆN TẠI:
${enrichedCurrent}

YÊU CẦU:
${instruction}`;

    let userMessageContent: unknown = userPrompt;
    if (images && images.length > 0) {
      const resolvedImages = await Promise.all(images.map((img) => resolveImageForAi(img)));
      userMessageContent = [
        {
          type: 'text',
          text: `${userPrompt}\n\n(Dưới đây là hình ảnh đính kèm của ô ghi chú này, hãy đọc kỹ hình ảnh để giải thích và kết hợp vào bài viết):`,
        },
        ...resolvedImages.map((img) => ({
          type: 'image_url',
          image_url: { url: img },
        })),
      ];
    }

    const res = await fetch(`${cleanUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        messages: [
          { role: 'system', content: fullSystemPrompt },
          { role: 'user', content: userMessageContent },
        ],
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || `Lỗi AI (${res.status})`);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    return cleanAiOutput(rawContent).trim();
  },

  /**
   * Inline AI: Chỉnh sửa / Biến đổi đúng đoạn văn bản đang bôi đen trong trình soạn thảo UnifiedNoteEditor
   * hoặc Tự động gắn [[Wiki-link]] tới các ô liên quan
   */
  async inlineEditSelection({
    baseUrl,
    apiKey,
    model,
    selectedText,
    action,
    customPrompt,
    nodeLabel,
    allNodeLabels,
    mapContext,
  }: {
    baseUrl: string;
    apiKey: string;
    model: string;
    selectedText: string;
    action: 'expand' | 'summarize' | 'katex' | 'table_box' | 'wikilink' | 'polish' | 'reorganize' | 'custom';
    customPrompt?: string;
    nodeLabel?: string;
    allNodeLabels?: string[];
    mapContext?: string;
  }): Promise<string> {
    const cleanUrl = cleanBaseUrl(baseUrl);

    let taskPrompt = '';
    switch (action) {
      case 'expand':
        taskPrompt =
          'Hãy viết chi tiết, rõ ràng và sâu sắc hơn cho đoạn văn bản đang chọn này (giữ nguyên mạch văn để thay thế trực tiếp vào vị trí đang bôi đen).';
        break;
      case 'summarize':
        taskPrompt = 'Hãy cô đọng và tóm tắt ngắn gọn đoạn văn bản đang chọn này thành các ý súc tích nhất.';
        break;
      case 'katex':
        taskPrompt =
          'Hãy chuyển đổi các biểu thức toán học, hóa học, ký hiệu y sinh hoặc đơn vị trong đoạn văn bản này sang chuẩn công thức KaTeX ($...$ hoặc $$...$$) thật đẹp và chuẩn xác.';
        break;
      case 'table_box':
        taskPrompt =
          'Hãy trình bày lại đoạn văn bản đang chọn này thành Bảng Markdown (| Cột 1 | Cột 2 |...) hoặc Khối Callout (> 📌 [Tiêu đề]) sao cho trực quan, dễ học nhất.';
        break;
      case 'wikilink':
        taskPrompt = `Hãy đọc đoạn văn bản đang chọn và tự động chèn liên kết nội bộ dạng [[Tên Ô]] cho các khái niệm trùng hoặc liên quan mật thiết với danh sách các ô đã có trong bản đồ: [${(allNodeLabels || []).join(', ')}]. Nếu có khái niệm quan trọng xứng đáng làm một ô mới, bạn cũng có thể bọc trong [[Tên Khái Niệm]]. Giữ nguyên toàn bộ nội dung và công thức khác.`;
        break;
      case 'polish':
        taskPrompt =
          'Hãy trau chuốt câu từ, sửa lỗi chính tả, in đậm (**...**) các từ khóa cốt lõi trong đoạn văn bản này.';
        break;
      case 'reorganize':
        taskPrompt =
          'Hãy đọc hiểu logic đoạn văn bản đang chọn và sắp xếp lại bố cục thật gọn gàng, khoa học. TUYỆT ĐỐI KHÔNG ĐƯỢC THAY ĐỔI NỘI DUNG, không thêm bớt ý, giữ nguyên 100% câu chữ và số liệu gốc. Bố cục đơn giản: CẤM DÙNG ICON/EMOJI (📌, 💡, 🚀...), CẤM DÙNG GẠCH NGANG CÁCH DÒNG (---). Chỉ dùng tiêu đề và danh sách phân cấp chuẩn mực.';
        break;
      case 'custom':
        taskPrompt = customPrompt || 'Hãy cải thiện đoạn văn bản đang chọn này.';
        break;
    }

    let systemPrompt = `Bạn là trợ lý biên tập Inline AI thông minh ngay tại con trỏ soạn thảo.
QUY TẮC TUYỆT ĐỐI:
1. 100% tiếng Việt, không dùng tiếng Trung, không xuất [ATLAS-OK].
2. CHỈ TRẢ VỀ đúng phần văn bản/Markdown mới để thay thế trực tiếp cho đoạn văn bản người dùng đang bôi đen.
3. KHÔNG viết lời chào, không giải thích, không bọc trong \`\`\`markdown.`;

    if (mapContext && mapContext.trim()) {
      systemPrompt += `\n\n[NGỮ CẢNH MÔN HỌC]:\n${mapContext.trim()}`;
    }

    const userPrompt = `Ô GHI CHÚ HIỆN TẠI: "${nodeLabel || 'Ghi chú'}"
ĐOẠN VĂN BẢN ĐANG BÔI ĐEN:
"""
${selectedText}
"""

YÊU CẦU XỬ LÝ:
${taskPrompt}`;

    const res = await fetch(`${cleanUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || `Lỗi Inline AI (${res.status})`);
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    return cleanAiOutput(rawContent)
      .replace(/^```(?:markdown|md)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  },

  /**
   * AI TÁCH Ý TRONG Ô HIỆN TẠI THÀNH CÁC Ô NHÁNH CON MỚI (Smart Split Node into Child Branches)
   * - Đọc nội dung của ô cha A (ví dụ: 1 ý chính + các ý phụ / mục nhỏ).
   * - Giữ lại phần Ý CHÍNH cốt lõi ở ô A (kèm liên kết [[Tên nhánh]]).
   * - Chuyển các Ý PHỤ sang các ô nhánh con mới được kết nối trực tiếp với ô A!
   */
  async splitNodeIntoBranches({
    baseUrl,
    apiKey,
    model,
    parentLabel,
    parentContent,
    mapName,
    mapContext,
    attachmentCaptions,
  }: {
    baseUrl: string;
    apiKey: string;
    model: string;
    parentLabel: string;
    parentContent: string;
    mapName: string;
    mapContext?: string;
    attachmentCaptions?: Record<string, string>;
  }): Promise<SplitNodeResult> {
    const cleanUrl = cleanBaseUrl(baseUrl);
    const enrichedParentContent = injectAttachmentCaptionsIntoContent(
      parentContent,
      attachmentCaptions
    );

    let systemPrompt = `Bạn là chuyên gia cấu trúc hóa Sơ đồ tư duy (Mind Map).
Nhiệm vụ của bạn là: Đọc toàn bộ nội dung của Ô GHI CHÚ GỐC (Ô A), phân tích các phần/mục/ý bên trong nó để TÁCH CÁC Ý PHỤ RA THÀNH CÁC Ô NHÁNH CON MỚI:
1. Phần "remainingParentContent" (Nội dung còn lại ở Ô A):
   - Chỉ giữ lại phần ĐỊNH NGHĨA TỔNG QUAN / Ý CHÍNH CỐT LÕI nhất của Ô A.
   - Các ý phụ chi tiết, phân loại, hoặc các mục con ĐÃ ĐƯỢC TÁCH ĐI thì phải XÓA KHỎI Ô A (để Ô A gọn gàng, không bị lặp lại).
   - Ở cuối "remainingParentContent", hãy thêm danh sách liên kết nội bộ dạng \`- [[Tên nhánh con 1]]\` để người đọc dễ dàng bấm sang các nhánh vừa tách.
2. Phần "branches" (Mảng các ô nhánh con mới được tách ra từ Ô A):
   - Mỗi ý phụ / mục con trong Ô A được tách thành 1 phần tử trong mảng "branches".
   - BẮT BUỘC giữ nguyên đầy đủ chi tiết, công thức KaTeX ($...$, $$...$$), bảng biểu và thẻ hình ảnh \`![...](attachment:...)\` thuộc về ý phụ đó (KHÔNG làm mất thông tin hay công thức nào của người dùng!). Không chép dòng chú thích hệ thống "> 🖼️ [Bản tóm tắt AI...]" vào content.
   - Nếu nội dung của một ý phụ hơi ngắn, bạn có thể trình bày lại cho rõ ràng, mạch lạc hơn.
3. QUY TẮC ĐỊNH DẠNG:
   - 100% tiếng Việt, không dùng tiếng Trung, không xuất [ATLAS-OK].
   - BẮT BUỘC trả về DUY NHẤT một khối JSON hợp lệ theo cấu trúc sau:
{
  "summary": "Tóm tắt ngắn: Đã giữ lại phần khái niệm chính ở ô gốc và tách 3 mục con thành 3 ô nhánh riêng biệt",
  "remainingParentContent": "Nội dung Markdown của ý chính còn lại trong ô gốc...",
  "branches": [
    {
      "label": "Tên ngắn gọn của ý phụ 1 (dưới 35 ký tự)",
      "content": "Toàn bộ nội dung chi tiết, công thức KaTeX, ảnh đính kèm của ý phụ 1...",
      "color": "cyan",
      "shape": "card"
    }
  ]
}`;

    if (mapContext && mapContext.trim()) {
      systemPrompt += `\n\n[NGỮ CẢNH SỔ TAY / KIẾN THỨC NỀN CỦA BẢN ĐỒ]:\n${mapContext.trim()}`;
    }

    const userPrompt = `BẢN ĐỒ: "${mapName}"
TIÊU ĐỀ Ô GỐC (Ô A): "${parentLabel}"

NỘI DUNG HIỆN TẠI CỦA Ô GỐC CẦN TÁCH NHÁNH:
"""
${enrichedParentContent}
"""

Hãy phân tích và tách các ý phụ trong ô trên thành các ô nhánh con mới, đồng thời trả về nội dung ý chính còn lại cho ô gốc theo đúng định dạng JSON.`;

    const res = await fetch(`${cleanUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || `Lỗi AI khi tách nhánh (${res.status})`);
    }

    const data = await res.json();
    let text = data.choices?.[0]?.message?.content || '';
    text = cleanAiOutput(text);

    const jsonMatch =
      text.match(/```(?:json)?\s*([\s\S]*?)```/) ||
      text.match(/\{[\s\S]*"remainingParentContent"[\s\S]*"branches"\s*:\s*\[[\s\S]*\][\s\S]*\}/);

    if (jsonMatch) {
      const rawJson = jsonMatch[1] || jsonMatch[0];
      const parsed = safeParseAiJson<SplitNodeResult>(rawJson);
      if (parsed && Array.isArray(parsed.branches) && parsed.branches.length > 0) {
        return {
          summary: parsed.summary || `Đã tách thành ${parsed.branches.length} ô nhánh mới`,
          remainingParentContent: String(parsed.remainingParentContent || parentContent).trim(),
          branches: parsed.branches.map((b) => ({
            label: String(b.label || 'Nhánh con').trim(),
            content: String(b.content || '').trim(),
            color: b.color || 'cyan',
            shape: b.shape || 'card',
          })),
        };
      }
    }

    throw new Error('AI không thể phân tách ý từ nội dung hiện tại. Hãy đảm bảo ô có ít nhất 2 ý/đoạn để tách.');
  },

  /**
   * AI Tạo Bộ Thẻ Ôn Tập (Flashcards) từ NHIỀU Ô GHI CHÚ được người dùng chọn (Đọc cả chữ + công thức + ảnh!)
   */
  async generateFlashcardsFromNodes({
    baseUrl,
    apiKey,
    model,
    selectedNodes,
    mapName,
    mapContext,
    attachments,
    attachmentCaptions,
    count = 6,
    cardStyle = 'mixed',
  }: {
    baseUrl: string;
    apiKey: string;
    model: string;
    selectedNodes: CustomNode[];
    mapName: string;
    mapContext?: string;
    attachments?: Record<string, string>;
    attachmentCaptions?: Record<string, string>;
    count?: number;
    cardStyle?: 'mixed' | 'qa' | 'formula_cloze' | 'clinical_case';
  }): Promise<FlashcardItem[]> {
    const cleanUrl = cleanBaseUrl(baseUrl);

    let styleInstruction = '';
    switch (cardStyle) {
      case 'qa':
        styleInstruction = 'Tập trung vào câu hỏi lý thuyết cốt lõi, định nghĩa, phân loại và bản chất cơ chế.';
        break;
      case 'formula_cloze':
        styleInstruction =
          'Tập trung vào hỏi công thức toán học/khoa học (KaTeX $...$), điều kiện áp dụng, ý nghĩa các biến số và các con số/ngưỡng chẩn đoán quan trọng.';
        break;
      case 'clinical_case':
        styleInstruction =
          'Tập trung vào câu hỏi tình huống vận dụng, ca lâm sàng / bài tập thực tế hoặc phân biệt chẩn đoán giữa các nhánh.';
        break;
      default:
        styleInstruction =
          'Kết hợp đa dạng: câu hỏi bản chất khái niệm, công thức KaTeX/ngưỡng số liệu, và câu hỏi tình huống vận dụng.';
    }

    // Thu thập nội dung từng ô được chọn + kiểm tra nếu có ảnh chưa được tóm tắt thì gửi kèm tối đa 3 ảnh gốc qua Vision
    const rawUncaptionedImages: string[] = [];

    const nodesFormatted = selectedNodes
      .map((n, idx) => {
        const contentWithCaptions = injectAttachmentCaptionsIntoContent(
          n.data.content || '(trống)',
          attachmentCaptions
        );

        // Nếu trong ô có ảnh mà chưa có caption trong attachmentCaptions, lấy ảnh gốc đưa vào Vision
        const imgMatches = [...(n.data.content || '').matchAll(/attachment:([^\s)]+)/g)];
        for (const m of imgMatches) {
          const attId = m[1];
          if (!attachmentCaptions?.[attId] && attachments?.[attId] && rawUncaptionedImages.length < 3) {
            rawUncaptionedImages.push(attachments[attId]);
          }
        }

        return `[Ô được chọn #${idx + 1}]
- sourceNodeId: "${n.id}"
- sourceNodeLabel: "${n.data.label || 'Chưa đặt tên'}"
- Nội dung & Mô tả hình ảnh:
${contentWithCaptions}
----------------------------------------`;
      })
      .join('\n');

    let systemPrompt = `Bạn là chuyên gia giáo dục và khảo thí đại học (Y khoa, Toán - Kỹ thuật, Kinh tế).
Nhiệm vụ của bạn là đọc kỹ ${selectedNodes.length} ô ghi chú do người dùng chọn trong bản đồ "${mapName}" và tạo ra chính xác ${count} thẻ Flashcard (Hỏi - Đáp) chất lượng cao nhất giúp người dùng tự ôn tập (Active Recall).

QUY TẮC BẮT BUỘC:
1. 100% tiếng Việt tự nhiên, chuẩn thuật ngữ chuyên ngành, không dùng tiếng Trung, không xuất [ATLAS-OK].
2. Bám sát nội dung văn bản, công thức KaTeX ($...$ và $$...$$), bảng biểu VÀ dữ liệu từ hình ảnh trong các ô được chọn.
3. Phong cách câu hỏi: ${styleInstruction}
4. BẮT BUỘC trả về DUY NHẤT một mảng JSON hợp lệ theo đúng cấu trúc:
[
  {
    "question": "Câu hỏi ngắn gọn, rõ ràng, kích thích tư duy nhớ bài (hỗ trợ Markdown & KaTeX $...$)",
    "answer": "Đáp án chi tiết, đầy đủ ý cốt lõi, giải thích ngắn gọn hoặc công thức KaTeX chuẩn xác",
    "sourceNodeId": "ID của ô ghi chú gốc chứa kiến thức này",
    "sourceNodeLabel": "Tên tiêu đề của ô ghi chú gốc"
  }
]`;

    if (mapContext && mapContext.trim()) {
      systemPrompt += `\n\n[NGỮ CẢNH SỔ TAY / ĐỀ CƯƠNG CỦA BẢN ĐỒ]:\n${mapContext.trim()}`;
    }

    const userText = `Dưới đây là ${selectedNodes.length} ô ghi chú được chọn để tạo Flashcard ôn tập:

${nodesFormatted}

Hãy tạo đúng ${count} thẻ Flashcard bao quát đều các kiến thức quan trọng nhất của các ô này và trả về mảng JSON hợp lệ.`;

    let userContentPayload: unknown = userText;
    if (rawUncaptionedImages.length > 0) {
      const resolvedImgs = await Promise.all(rawUncaptionedImages.map((img) => resolveImageForAi(img)));
      userContentPayload = [
        { type: 'text', text: userText },
        ...resolvedImgs.map((url) => ({
          type: 'image_url',
          image_url: { url },
        })),
      ];
    }

    const res = await fetch(`${cleanUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContentPayload },
        ],
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || `Lỗi tạo Flashcard (${res.status})`);
    }

    const data = await res.json();
    let text = data.choices?.[0]?.message?.content || '';
    text = cleanAiOutput(text);

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = safeParseAiJson<
        Array<{
          question?: string;
          answer?: string;
          sourceNodeId?: string;
          sourceNodeLabel?: string;
        }>
      >(jsonMatch[0]);

      if (Array.isArray(parsed) && parsed.length > 0) {
        const now = Date.now();
        return parsed.map((item, i) => ({
          id: `fc-${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          question: String(item.question || 'Câu hỏi ôn tập').trim(),
          answer: String(item.answer || '').trim(),
          sourceNodeId: item.sourceNodeId ? String(item.sourceNodeId) : selectedNodes[0]?.id,
          sourceNodeLabel: item.sourceNodeLabel
            ? String(item.sourceNodeLabel)
            : selectedNodes[0]?.data.label,
          status: 'new' as const,
          createdAt: now,
        }));
      }
    }

    throw new Error('Không thể phân tích dữ liệu Flashcard từ phản hồi của AI. Vui lòng thử lại.');
  },
};
