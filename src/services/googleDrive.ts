import type { MapData, DriveFileItem, SingleMapExportPayload } from '../types';
import { StorageService } from './storage';

export const GOOGLE_APPS_SCRIPT_CODE = `// ============================================================================
// MINDNOTE GOOGLE DRIVE 1-CLICK SYNC (GOOGLE APPS SCRIPT)
// Hướng dẫn:
// 1. Truy cập https://script.google.com -> Dự án mới (New project)
// 2. Xóa mã mặc định, dán toàn bộ đoạn mã này vào và bấm Lưu (Ctrl+S)
// 3. Bấm "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment)
// 4. Chọn loại: "Ứng dụng web" (Web app)
//    - Thực thi dưới dạng (Execute as): "Tôi" (Me)
//    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)
// 5. Bấm Triển khai -> Cấp quyền -> Copy URL Web App dán vào Mindnote!
// ============================================================================

var FOLDER_NAME = 'Mindnote';

function getOrCreateMindnoteFolder() {
  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(FOLDER_NAME);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'list';
    var folder = getOrCreateMindnoteFolder();

    if (action === 'ping' || action === 'list') {
      var files = folder.getFiles();
      var list = [];
      while (files.hasNext()) {
        var f = files.next();
        var name = f.getName();
        if (name.toLowerCase().indexOf('.json') !== -1 && !f.isTrashed()) {
          list.push({
            id: f.getId(),
            name: name,
            updatedAt: f.getLastUpdated().getTime(),
            size: f.getSize(),
            url: f.getUrl()
          });
        }
      }
      list.sort(function(a, b) { return b.updatedAt - a.updatedAt; });
      return jsonResponse({
        success: true,
        folderName: FOLDER_NAME,
        folderUrl: folder.getUrl(),
        files: list
      });
    }

    if (action === 'get') {
      var fileId = e.parameter.fileId;
      var fileName = e.parameter.fileName;
      var targetFile = null;

      if (fileId) {
        targetFile = DriveApp.getFileById(fileId);
      } else if (fileName) {
        var matched = folder.getFilesByName(fileName);
        if (matched.hasNext()) targetFile = matched.next();
      }

      if (!targetFile) {
        return jsonResponse({ success: false, error: 'Không tìm thấy file trên Google Drive.' });
      }

      var content = targetFile.getBlob().getDataAsString('UTF-8');
      return jsonResponse({
        success: true,
        fileName: targetFile.getName(),
        updatedAt: targetFile.getLastUpdated().getTime(),
        data: JSON.parse(content)
      });
    }

    return jsonResponse({ success: false, error: 'Action không hợp lệ.' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var fileName = body.fileName || 'mindnote_vault_backup.json';
    var contentStr = typeof body.content === 'string' ? body.content : JSON.stringify(body.content, null, 2);

    var folder = getOrCreateMindnoteFolder();
    var existing = folder.getFilesByName(fileName);
    var file;

    if (existing.hasNext()) {
      // Ghi đè nội dung vào file sẵn có (giữ nguyên File ID & lịch sử phiên bản trên Drive)
      file = existing.next();
      file.setContent(contentStr);
    } else {
      file = folder.createFile(fileName, contentStr, MimeType.PLAIN_TEXT);
    }

    return jsonResponse({
      success: true,
      id: file.getId(),
      name: file.getName(),
      updatedAt: file.getLastUpdated().getTime(),
      url: file.getUrl()
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}
`;

export function isDriveScriptConfigured(url?: string): boolean {
  const settings = StorageService.getSettings();
  const target = (url ?? settings.googleDriveScriptUrl ?? '').trim();
  return target.startsWith('https://script.google.com/macros/s/');
}

/**
 * Kiểm tra kết nối Google Apps Script Web App và lấy danh sách file
 */
export async function testDriveScriptConnection(scriptUrl: string): Promise<{
  success: boolean;
  message: string;
  files?: DriveFileItem[];
  folderUrl?: string;
}> {
  const cleanUrl = scriptUrl.trim();
  if (!cleanUrl.startsWith('https://script.google.com/')) {
    return {
      success: false,
      message: 'URL không hợp lệ. URL cần bắt đầu bằng https://script.google.com/macros/s/.../exec',
    };
  }

  try {
    const separator = cleanUrl.includes('?') ? '&' : '?';
    const res = await fetch(`${cleanUrl}${separator}action=list&_t=${Date.now()}`, {
      method: 'GET',
      redirect: 'follow',
    });

    if (!res.ok) {
      return {
        success: false,
        message: `Lỗi kết nối HTTP ${res.status}. Hãy đảm bảo bạn chọn "Bất kỳ ai (Anyone)" khi Deploy Web App.`,
      };
    }

    const json = await res.json();
    if (!json.success) {
      return {
        success: false,
        message: json.error || 'Google Apps Script trả về lỗi.',
      };
    }

    const files: DriveFileItem[] = (json.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      updatedAt: Number(f.updatedAt) || Date.now(),
      size: f.size,
      url: f.url,
      source: 'script' as const,
    }));

    return {
      success: true,
      message: `Kết nối thành công! Đã tìm thấy thư mục "${json.folderName || 'Mindnote'}" với ${files.length} tệp lưu trữ.`,
      files,
      folderUrl: json.folderUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      message:
        err?.message ||
        'Không thể kết nối tới Google Apps Script. Hãy kiểm tra quyền truy cập "Anyone (Bất kỳ ai)" khi Deploy.',
    };
  }
}

/**
 * Lấy danh sách file từ Google Drive (Kết hợp cả ổ G:\ trên Desktop và Google Apps Script trên Web/Mobile)
 */
export async function listGoogleDriveFiles(scriptUrl?: string): Promise<{
  files: DriveFileItem[];
  desktopAvailable: boolean;
  desktopFolder?: string | null;
  error?: string;
}> {
  const results: DriveFileItem[] = [];
  let desktopAvailable = false;
  let desktopFolder: string | null = null;
  let errorMsg: string | undefined;

  // 1. Nếu đang chạy trên Desktop Electron và có ổ Google Drive (G:\My Drive\Mindnote)
  if (typeof window !== 'undefined' && window.mindnoteDesktop?.isDesktop) {
    try {
      const info = await window.mindnoteDesktop.getGoogleDriveInfo();
      desktopAvailable = info.isAvailable;
      desktopFolder = info.mindnoteDir;
      if (info.isAvailable && window.mindnoteDesktop.listGoogleDriveFiles) {
        const localFiles = await window.mindnoteDesktop.listGoogleDriveFiles();
        results.push(...localFiles);
      }
    } catch (e) {
      console.warn('[GoogleDrive] Không thể đọc danh sách file từ ổ G:\\:', e);
    }
  }

  // 2. Nếu có cấu hình Google Apps Script URL (Hoạt động trên mọi thiết bị Web / Mobile / PC)
  const cleanUrl = (scriptUrl ?? StorageService.getSettings().googleDriveScriptUrl ?? '').trim();
  if (cleanUrl && cleanUrl.startsWith('https://script.google.com/')) {
    try {
      const res = await testDriveScriptConnection(cleanUrl);
      if (res.success && res.files) {
        for (const remoteFile of res.files) {
          // Tránh hiển thị trùng lặp nếu cùng tên file đã có ở danh sách Desktop
          const alreadyInDesktop = results.some(
            (r) => r.source === 'desktop' && r.name.toLowerCase() === remoteFile.name.toLowerCase()
          );
          if (!alreadyInDesktop) {
            results.push(remoteFile);
          }
        }
      } else if (!desktopAvailable) {
        errorMsg = res.message;
      }
    } catch (e: any) {
      if (!desktopAvailable) {
        errorMsg = e?.message || 'Lỗi tải danh sách từ Google Apps Script.';
      }
    }
  }

  results.sort((a, b) => b.updatedAt - a.updatedAt);
  return {
    files: results,
    desktopAvailable,
    desktopFolder,
    error: errorMsg,
  };
}

/**
 * Đẩy 1 Map hoặc Toàn bộ kho (Vault) lên Google Drive với 1 Click
 */
export async function pushToGoogleDriveOneClick(params: {
  map?: MapData;
  maps?: MapData[];
  isFullVault: boolean;
  scriptUrl?: string;
}): Promise<{
  success: boolean;
  message: string;
  fileName?: string;
}> {
  const { map, maps, isFullVault, scriptUrl } = params;
  const cleanUrl = (scriptUrl ?? StorageService.getSettings().googleDriveScriptUrl ?? '').trim();

  // 1. Ưu tiên đẩy qua ổ đĩa Google Drive for Desktop nếu đang ở bản PC và có ổ G:\
  let savedToDesktopDrive = false;
  let desktopFileName = '';

  if (typeof window !== 'undefined' && window.mindnoteDesktop?.isDesktop) {
    try {
      const info = await window.mindnoteDesktop.getGoogleDriveInfo();
      if (info.isAvailable) {
        const res = await window.mindnoteDesktop.exportToGoogleDrive({
          map,
          maps,
          isFullVault,
          keepSingleFile: true,
        });
        if (res.success) {
          savedToDesktopDrive = true;
          desktopFileName = res.fileName || '';
        }
      }
    } catch (e) {
      console.warn('[GoogleDrive] Lỗi ghi trực tiếp ổ G:\\:', e);
    }
  }

  // 2. Nếu có cấu hình Google Apps Script URL, đẩy lên Cloud qua Webhook
  // (Hoặc nếu đang trên Web/Mobile thì đây là kênh chính)
  if (cleanUrl && cleanUrl.startsWith('https://script.google.com/')) {
    try {
      let fileName = 'mindnote_vault_backup.json';
      let payloadContent: unknown;

      if (isFullVault && maps) {
        const cleaned = StorageService.cleanMapsData(maps);
        fileName = 'mindnote_vault_backup.json';
        payloadContent = cleaned;
      } else if (map) {
        const cleaned = StorageService.cleanMapsData([map])[0];
        const safeName = (map.name || 'map').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
        fileName = `${safeName}_mindnote.json`;
        const singlePayload: SingleMapExportPayload = {
          version: 1,
          type: 'mindnote_single_map',
          exportedAt: Date.now(),
          source: 'web',
          map: cleaned,
        };
        payloadContent = singlePayload;
      } else {
        return { success: false, message: 'Không có dữ liệu bản đồ để đồng bộ.' };
      }

      // Dùng text/plain;charset=utf-8 để tránh lỗi CORS Preflight (OPTIONS) của Google Apps Script
      const res = await fetch(cleanUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          fileName,
          content: payloadContent,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi ghi file trên Google Apps Script.');
      }

      return {
        success: true,
        fileName: json.name || fileName,
        message: isFullVault
          ? `Đã đồng bộ toàn bộ ${maps?.length || 0} bản đồ vào "${fileName}" trên Google Drive!`
          : `Đã đồng bộ bản đồ "${map?.name}" vào "${fileName}" trên Google Drive!`,
      };
    } catch (err: any) {
      if (savedToDesktopDrive) {
        return {
          success: true,
          fileName: desktopFileName,
          message: `Đã lưu trực tiếp vào ổ Google Drive trên máy (${desktopFileName})!`,
        };
      }
      return {
        success: false,
        message: `Lỗi đẩy lên Google Drive: ${err?.message || 'Không xác định'}`,
      };
    }
  }

  if (savedToDesktopDrive) {
    return {
      success: true,
      fileName: desktopFileName,
      message: isFullVault
        ? `Đã đồng bộ cả kho (${maps?.length || 0} bản đồ) vào ổ Google Drive (${desktopFileName})!`
        : `Đã đồng bộ "${map?.name}" vào ổ Google Drive (${desktopFileName})!`,
    };
  }

  return {
    success: false,
    message:
      'Chưa thiết lập kết nối Google Drive. Hãy dán Web App URL ở tab "Cấu hình 1-Click" (hoặc bật Google Drive for Desktop trên PC).',
  };
}

/**
 * Tải nội dung 1 file từ danh sách Google Drive với 1 Click
 */
export async function pullDriveFileOneClick(
  item: DriveFileItem,
  scriptUrl?: string
): Promise<unknown> {
  // 1. Nếu là file từ ổ G:\ trên Desktop
  if (item.source === 'desktop' && window.mindnoteDesktop?.loadGoogleDriveFile) {
    return await window.mindnoteDesktop.loadGoogleDriveFile(item.id);
  }

  // 2. Nếu là file từ Google Apps Script
  const cleanUrl = (scriptUrl ?? StorageService.getSettings().googleDriveScriptUrl ?? '').trim();
  if (!cleanUrl) {
    throw new Error('Chưa cấu hình Google Apps Script URL.');
  }

  const separator = cleanUrl.includes('?') ? '&' : '?';
  const res = await fetch(
    `${cleanUrl}${separator}action=get&fileId=${encodeURIComponent(item.id)}&_t=${Date.now()}`,
    {
      method: 'GET',
      redirect: 'follow',
    }
  );

  if (!res.ok) {
    throw new Error(`Không thể tải tệp từ Google Drive (HTTP ${res.status}).`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Không thể đọc dữ liệu tệp từ Google Drive.');
  }

  return json.data;
}
