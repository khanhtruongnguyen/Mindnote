import type { CustomNode, MapData } from '../types';

export interface ImageOptimizationResult {
  dataUrl: string;
  wasCompressed: boolean;
  originalSize: number;
  compressedSize: number;
}

/**
 * Nén ảnh vừa phải (Chế độ An Toàn & Bảo Toàn Độ Nét):
 * - Nếu ảnh nhỏ (<= 800KB): Giữ nguyên 100% gốc, không nén hay resize để tránh suy hao ảnh vốn đã mờ/chữ nhỏ.
 * - Nếu ảnh lớn (> 800KB):
 *   + Giới hạn kích thước tối đa 2560px (chuẩn 2K/QHD siêu sắc nét cho công thức toán & scan).
 *   + Nén sang WebP chất lượng cao (0.90 - 90%), hầu như không nhận ra sự khác biệt bằng mắt thường.
 *   + Nếu kết quả sau nén không nhỏ hơn bản gốc thì giữ lại bản gốc.
 */
export async function optimizeImageModerately(
  input: File | string,
  options: {
    maxDimension?: number;
    quality?: number;
    skipThresholdBytes?: number;
  } = {}
): Promise<ImageOptimizationResult> {
  const {
    maxDimension = 2560,
    quality = 0.90,
    skipThresholdBytes = 800 * 1024, // 800KB
  } = options;

  let originalDataUrl = '';
  let originalSize = 0;

  if (typeof input === 'string') {
    originalDataUrl = input;
    // Ước lượng dung lượng binary từ base64: length * 0.75
    const base64Part = originalDataUrl.split(',')[1] || originalDataUrl;
    originalSize = Math.round((base64Part.length * 3) / 4);
  } else {
    originalSize = input.size;
    originalDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(input);
    });
  }

  // 1. Kiểm tra ngưỡng an toàn: Nếu file đã nhẹ (<= 800KB) hoặc là SVG/GIF, không nén!
  const mimeType = originalDataUrl.split(';')[0]?.replace('data:', '') || '';
  if (mimeType.includes('svg') || mimeType.includes('gif')) {
    return {
      dataUrl: originalDataUrl,
      wasCompressed: false,
      originalSize,
      compressedSize: originalSize,
    };
  }

  if (originalSize <= skipThresholdBytes) {
    return {
      dataUrl: originalDataUrl,
      wasCompressed: false,
      originalSize,
      compressedSize: originalSize,
    };
  }

  // 2. Tải ảnh vào đối tượng Image để kiểm tra kích thước
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = originalDataUrl;
    });

    let { width, height } = img;
    let needsResize = false;

    if (width > maxDimension || height > maxDimension) {
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      needsResize = true;
    }

    // Vẽ lên Canvas với bộ lọc chất lượng cao (High Quality Bicubic/Lanczos)
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        dataUrl: originalDataUrl,
        wasCompressed: false,
        originalSize,
        compressedSize: originalSize,
      };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // Xuất sang định dạng WebP với quality 0.90
    let compressedDataUrl = canvas.toDataURL('image/webp', quality);
    
    // Nếu trình duyệt không xuất được webp (vẫn trả image/png) hoặc kích thước lớn hơn
    if (!compressedDataUrl.startsWith('data:image/webp')) {
      compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    const compressedBase64 = compressedDataUrl.split(',')[1] || '';
    const compressedSize = Math.round((compressedBase64.length * 3) / 4);

    // Nếu sau khi nén mà không nhỏ hơn ảnh gốc, giữ nguyên ảnh gốc
    if (compressedSize >= originalSize && !needsResize) {
      return {
        dataUrl: originalDataUrl,
        wasCompressed: false,
        originalSize,
        compressedSize: originalSize,
      };
    }

    return {
      dataUrl: compressedDataUrl,
      wasCompressed: true,
      originalSize,
      compressedSize,
    };
  } catch (err) {
    console.warn('[ImageOptimizer] Lỗi nén ảnh, giữ nguyên bản gốc:', err);
    return {
      dataUrl: originalDataUrl,
      wasCompressed: false,
      originalSize,
      compressedSize: originalSize,
    };
  }
}

/**
 * Trích xuất toàn bộ các key đính kèm (attachId) và file URL đang được sử dụng trong các Node
 */
export function extractUsedAttachmentKeys(nodes: CustomNode[]): Set<string> {
  const usedKeys = new Set<string>();

  for (const node of nodes || []) {
    const content = node.data?.content || '';
    if (!content) continue;

    // 1. Tìm cú pháp attachment:id
    const attachRegex = /attachment:([a-zA-Z0-9_\-.:]+)/g;
    let match: RegExpExecArray | null;
    while ((match = attachRegex.exec(content)) !== null) {
      if (match[1]) usedKeys.add(match[1].trim());
    }

    // 2. Tìm cú pháp markdown ảnh: ![alt](url)
    const mdImgRegex = /!\[.*?\]\((.*?)\)/g;
    while ((match = mdImgRegex.exec(content)) !== null) {
      const src = match[1]?.trim();
      if (!src) continue;
      if (src.startsWith('attachment:')) {
        usedKeys.add(src.replace('attachment:', ''));
      } else {
        // Lấy tên file hoặc đường dẫn tương đối
        const parts = src.split('/');
        const fileName = parts[parts.length - 1]?.split('?')[0];
        if (fileName) usedKeys.add(fileName);
      }
    }

    // 3. Tìm thẻ img HTML: <img ... src="..." />
    const htmlImgRegex = /<img[^>]+src=["']([^"']+)["']/g;
    while ((match = htmlImgRegex.exec(content)) !== null) {
      const src = match[1]?.trim();
      if (!src) continue;
      if (src.startsWith('attachment:')) {
        usedKeys.add(src.replace('attachment:', ''));
      } else {
        const parts = src.split('/');
        const fileName = parts[parts.length - 1]?.split('?')[0];
        if (fileName) usedKeys.add(fileName);
      }
    }
  }

  return usedKeys;
}

/**
 * Dọn dẹp các ảnh mồ côi (không còn được trích dẫn trong bất kỳ node nào) của 1 Map
 */
export function cleanMapOrphanAttachments(map: MapData): {
  cleanedMap: MapData;
  removedKeys: string[];
  freedBytesEstimate: number;
} {
  const usedKeys = extractUsedAttachmentKeys(map.nodes || []);
  const currentAttachments = map.attachments || {};
  const nextAttachments: Record<string, string> = {};
  const removedKeys: string[] = [];
  let freedBytesEstimate = 0;

  for (const [key, value] of Object.entries(currentAttachments)) {
    // Kiểm tra key hoặc tên file có được trích dẫn hay không
    let isUsed = usedKeys.has(key);
    if (!isUsed && typeof value === 'string') {
      const parts = value.split('/');
      const fileName = parts[parts.length - 1]?.split('?')[0];
      if (fileName && usedKeys.has(fileName)) {
        isUsed = true;
      }
    }

    if (isUsed) {
      nextAttachments[key] = value;
    } else {
      removedKeys.push(key);
      if (typeof value === 'string' && value.startsWith('data:')) {
        const b64Part = value.split(',')[1] || '';
        freedBytesEstimate += Math.round((b64Part.length * 3) / 4);
      } else {
        freedBytesEstimate += 200 * 1024; // Ước lượng 200KB nếu là URL file
      }
    }
  }

  // Dọn dẹp cả attachmentCaptions tương ứng
  const currentCaptions = map.attachmentCaptions || {};
  const nextCaptions: Record<string, string> = {};
  for (const [key, cap] of Object.entries(currentCaptions)) {
    if (!removedKeys.includes(key)) {
      nextCaptions[key] = cap;
    }
  }

  return {
    cleanedMap: {
      ...map,
      attachments: nextAttachments,
      attachmentCaptions: nextCaptions,
      updatedAt: Date.now(),
    },
    removedKeys,
    freedBytesEstimate,
  };
}
