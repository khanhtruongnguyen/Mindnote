import type { MapData, AgentAction } from '../types';

export interface StreamChatOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  onChunk: (contentChunk: string, fullContent: string) => void;
  onReasoning?: (reasoningChunk: string, fullReasoning: string) => void;
  signal?: AbortSignal;
}

export const cleanBaseUrl = (url: string): string => {
  return url.trim().replace(/\/+$/, '');
};

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
   * Tạo system prompt cung cấp toàn bộ ngữ cảnh Mind Map cho AI
   */
  buildMindMapSystemPrompt(mapData: MapData): string {
    const nodesInfo = mapData.nodes.map((node, index) => {
      return `[Node #${index + 1}]
- ID: "${node.id}"
- Tiêu đề: "${node.data.label || 'Chưa đặt tên'}"
- Dạng hình: ${node.data.shape || 'pill'}, Màu sắc: ${node.data.color || 'purple'}
- Tọa độ: x=${Math.round(node.position.x)}, y=${Math.round(node.position.y)}
- Nội dung chi tiết:
${node.data.content || '(trống)'}
----------------------------------------`;
    }).join('\n');

    const edgesInfo = mapData.edges.length > 0
      ? mapData.edges.map((edge) => {
          const sourceNode = mapData.nodes.find((n) => n.id === edge.source);
          const targetNode = mapData.nodes.find((n) => n.id === edge.target);
          return `- "${sourceNode?.data.label || edge.source}" (id: ${edge.source}) ➔ "${targetNode?.data.label || edge.target}" (id: ${edge.target})`;
        }).join('\n')
      : '(Hiện tại các nút chưa có liên kết mũi tên nào)';

    const contextSection = mapData.context && mapData.context.trim()
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
   */
  buildAgentSystemPrompt(mapData: MapData): string {
    const nodesSummary = mapData.nodes.length > 0
      ? mapData.nodes.map((n, idx) => `- #${idx + 1} ID: "${n.id}", Tiêu đề: "${n.data.label || 'Chưa đặt tên'}", Dạng: ${n.data.shape || 'pill'}, Màu: ${n.data.color || 'purple'}`).join('\n')
      : '(Bản đồ hiện đang trống, chưa có ô ghi chú nào)';

    const edgesSummary = mapData.edges.length > 0
      ? mapData.edges.map(e => {
          const src = mapData.nodes.find(n => n.id === e.source)?.data.label || e.source;
          const tgt = mapData.nodes.find(n => n.id === e.target)?.data.label || e.target;
          return `- "${src}" ➔ "${tgt}" (id: ${e.id})`;
        }).join('\n')
      : '(Chưa có liên kết nối nào)';

    const contextSection = mapData.context && mapData.context.trim()
      ? `\n=== ĐỀ CƯƠNG / NGỮ CẢNH SỔ TAY CỦA BẢN ĐỒ ===\n${mapData.context.trim()}\n(LƯU Ý CỰC KỲ QUAN TRỌNG: Đây là đề cương, bài giảng hoặc tài liệu môn học do người dùng cung cấp. Bạn BẮT BUỘC phải đọc kỹ để phân tích và trích xuất cấu trúc kiến thức đầy đủ, khoa học nhất cho sơ đồ!)\n`
      : '\n(Bản đồ hiện chưa có đề cương trong ngữ cảnh. Bạn hãy xây dựng sơ đồ dựa trên yêu cầu trực tiếp của người dùng.)\n';

    return `Bạn là NexusNotes AI Agent — Kỹ sư & Kiến trúc sư Sơ đồ tư duy Tự động (Autonomous Mind Map Architect & Builder).
Nhiệm vụ của bạn là: Lắng nghe mệnh lệnh người dùng, phân tích đề cương/ngữ cảnh và TRỰC TIẾP XÂY DỰNG, THÊM BỚT HOẶC TỔ CHỨC LẠI BẢN ĐỒ CHO NGƯỜI DÙNG.

Tên bản đồ hiện tại: "${mapData.name}"
${contextSection}
=== CẤU TRÚC BẢN ĐỒ HIỆN TẠI ===
* Danh sách các ô ghi chú (${mapData.nodes.length}):
${nodesSummary}

* Các đường nối hiện có (${mapData.edges.length}):
${edgesSummary}

=== QUY TẮC BẮT BUỘC KHI LÀM AI AGENT ===
1. NGÔN NGỮ: BẮT BUỘC 100% TIẾNG VIỆT tự nhiên, chu đáo, giải thích rõ cấu trúc bạn thiết kế. Tuyệt đối không dùng tiếng Trung. Không xuất hiện [ATLAS-OK] hay metadata ở cuối.
2. CHẤT LƯỢNG NỘI DUNG TỪNG Ô:
   - "label": Ngắn gọn, súc tích (dưới 40 ký tự), thể hiện rõ chủ đề/khái niệm.
   - "content": Nội dung Markdown phong phú, bao gồm giải thích định nghĩa, công thức KaTeX ($...$ và $$...$$), bullet points, và khung ghi chú (> 📌 Điểm mấu chốt). Không viết nội dung sơ sài!
   - "color": 'purple' | 'blue' | 'emerald' | 'amber' | 'rose' | 'cyan' (chọn màu đồng bộ theo từng nhánh hoặc chủ đề).
   - "shape": 'card' (thẻ thông tin đẹp) hoặc 'full' (ô chi tiết toàn bộ công thức) hoặc 'pill' (thẻ nhãn ngắn).
3. ĐƯỜNG NỐI (EDGES): Xác định đường nối logic giữa các ô:
   - Từ ô chủ đề chính (source) trỏ đến các ô nhánh con (target).
   - Các đường liên kết chéo giữa các kiến thức có mối tương quan.
4. ĐỊNH DẠNG XUẤT LỆNH BẮT BUỘC CHO HỆ THỐNG THỰC THI:
   Ở cuối câu trả lời, bạn BẮT BUỘC phải xuất ra một khối JSON code block với cú pháp:
\`\`\`json:agent-action
{
  "type": "create_map" | "modify_map",
  "summary": "Tóm tắt ngắn gọn những gì bạn đã tạo/sửa (vd: Đã tạo 5 chủ đề chính và 8 liên kết từ đề cương Giải Tích 1)",
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
- Nếu người dùng yêu cầu: "thêm nhánh", "sửa một vài ô", "nối thêm": Đặt "type": "modify_map".
- Hãy tự đặt "id" cho các node logic (ví dụ "node-taylor", "node-lagrange", "node-fourier", v.v.) và dùng các id này trong mảng "edges" để liên kết chính xác.`;
  },

  /**
   * Trích xuất AgentAction từ phản hồi của AI
   */
  extractAgentAction(content: string): AgentAction | null {
    if (!content) return null;
    try {
      // Tìm khối ```json:agent-action hoặc ```json
      const match = content.match(/```(?:json:agent-action|json)\s*([\s\S]*?)```/)
        || content.match(/\{[\s\S]*"type"\s*:\s*"(?:create_map|modify_map)"[\s\S]*"nodes"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
      
      if (!match) return null;
      const jsonStr = match[1] || match[0];
      const parsed = JSON.parse(jsonStr.trim());
      if (parsed && (parsed.type === 'create_map' || parsed.type === 'modify_map') && Array.isArray(parsed.nodes)) {
        return parsed as AgentAction;
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

    // Nếu không có response body (môi trường đặc biệt)
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
      | 'ocr_image'
      | 'describe_image';
    customInstruction?: string;
    mapContext?: string;
    images?: string[];
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
4. Có khả năng đọc và phân tích hình ảnh đính kèm (sơ đồ y khoa, tế bào, đồ thị toán, công thức viết tay...).
5. CHỈ TRẢ VỀ nội dung Markdown của ô ghi chú. KHÔNG kèm câu chào đầu hay lời giải thích ngoài lề.`;

    if (mapContext && mapContext.trim()) {
      fullSystemPrompt += `\n\n[NGỮ CẢNH SỔ TAY / KIẾN THỨC NỀN CỦA BẢN ĐỒ]:\n${mapContext.trim()}\n(LƯU Ý: Hãy đối chiếu và sử dụng kiến thức, thuật ngữ trong ngữ cảnh này để viết nội dung chính xác theo giáo trình!)`;
    }

    const userPrompt = `TIÊU ĐỀ Ô: "${nodeLabel}"

NỘI DUNG HIỆN TẠI:
${currentContent || '(Chưa có nội dung, hãy viết mới)'}

YÊU CẦU:
${instruction}`;

    // Payload người dùng: nếu có ảnh đính kèm, gửi dạng Multimodal Image Parts
    let userMessageContent: unknown = userPrompt;
    if (images && images.length > 0) {
      userMessageContent = [
        {
          type: 'text',
          text: `${userPrompt}\n\n(Dưới đây là hình ảnh đính kèm của ô ghi chú này, hãy đọc kỹ hình ảnh để giải thích và kết hợp vào bài viết):`,
        },
        ...images.map((img) => ({
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
   * AI Gợi ý và tự động sinh các nhánh con mới cho 1 ô cha
   */
  async generateChildBranches({
    baseUrl,
    apiKey,
    model,
    parentLabel,
    parentContent,
    mapName,
    existingNodeLabels,
    mapContext,
    count = 3,
  }: {
    baseUrl: string;
    apiKey: string;
    model: string;
    parentLabel: string;
    parentContent: string;
    mapName: string;
    existingNodeLabels?: string[];
    mapContext?: string;
    count?: number;
  }): Promise<Array<{ label: string; content: string }>> {
    const cleanUrl = cleanBaseUrl(baseUrl);

    let systemPrompt = `Bạn là chuyên gia tư duy logic và cấu trúc sơ đồ tư duy (Mind Map).
Nhiệm vụ của bạn là phân tích ô ghi chú cha và đề xuất chính xác ${count} nhánh con logic tiếp theo.
QUY TẮC:
1. 100% tiếng Việt, không tiếng Trung, không [ATLAS-OK].
2. BẮT BUỘC trả về duy nhất một mảng JSON hợp lệ dạng:
[
  {
    "label": "Tên ngắn của nhánh con (dưới 30 ký tự)",
    "content": "Nội dung tóm tắt giải thích chi tiết hoặc công thức KaTeX của nhánh con này"
  }
]
3. KHÔNG viết thêm bất kỳ câu mở đầu, kết thúc hay giải thích nào bên ngoài khối JSON.`;

    if (mapContext && mapContext.trim()) {
      systemPrompt += `\n\n[NGỮ CẢNH SỔ TAY / KIẾN THỨC NỀN CỦA BẢN ĐỒ]:\n${mapContext.trim()}\nHãy đối chiếu giáo trình này để sinh các nhánh con chuẩn xác chuyên môn nhất.`;
    }

    const userPrompt = `BẢN ĐỒ: "${mapName}"
Ô CHA: "${parentLabel}"
NỘI DUNG Ô CHA:
${parentContent || '(Không có)'}

CÁC Ô ĐÃ CÓ TRONG BẢN ĐỒ:
${existingNodeLabels?.join(', ') || '(Chưa có)'}

Hãy sinh đúng ${count} nhánh con mới logic nhất, tránh trùng lặp với các ô đã có.`;

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
      throw new Error(err.error?.message || err.message || `Lỗi AI (${res.status})`);
    }

    const data = await res.json();
    let text = data.choices?.[0]?.message?.content || '';
    text = cleanAiOutput(text);

    // Extract JSON array
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => ({
            label: String(item.label || 'Nhánh mới').trim(),
            content: String(item.content || '').trim(),
          }));
        }
      } catch {
        // Fallback
      }
    }

    // Fallback parsing if JSON wasn't returned cleanly
    return [
      {
        label: `${parentLabel} - Nhánh 1`,
        content: `Nội dung mở rộng cho ${parentLabel}`,
      },
    ];
  },
};
