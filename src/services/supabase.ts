import { createClient, type SupabaseClient, type RealtimeChannel, type User } from '@supabase/supabase-js';
import type { MapData } from '../types';
import { StorageService } from './storage';

let supabaseClient: SupabaseClient | null = null;
let currentUrl: string = '';
let currentKey: string = '';

const ENV_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const ENV_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

/**
 * Lấy hoặc khởi tạo Supabase Client
 */
export function getSupabase(customUrl?: string, customKey?: string): SupabaseClient | null {
  const settings = StorageService.getSettings();
  const url = (customUrl || settings.supabaseUrl || ENV_URL || '').trim();
  const key = (customKey || settings.supabaseAnonKey || ENV_KEY || '').trim();

  if (!url || !key) {
    return null;
  }

  if (supabaseClient && currentUrl === url && currentKey === key) {
    return supabaseClient;
  }

  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    currentUrl = url;
    currentKey = key;
    return supabaseClient;
  } catch (err) {
    console.error('[Supabase] Failed to initialize client:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabase());
}

/**
 * Kiểm tra kết nối tới Supabase Project
 */
export async function testSupabaseConnection(
  url: string,
  key: string
): Promise<{ success: boolean; message: string; user?: User | null }> {
  try {
    const client = createClient(url.trim(), key.trim());

    // 1. Kiểm tra session / auth
    const { data: authData } = await client.auth.getUser();
    const user = authData?.user || null;

    // 2. Kiểm tra truy vấn bảng maps
    const { error: dbError } = await client.from('maps').select('id').limit(1);

    if (dbError) {
      if (dbError.message?.includes('does not exist') || dbError.code === '42P01') {
        return {
          success: false,
          message:
            'Kết nối tới Supabase thành công, nhưng chưa tìm thấy bảng "maps". Vui lòng mở SQL Editor trên Supabase và chạy file "supabase_schema.sql".',
          user,
        };
      }
      return {
        success: false,
        message: `Lỗi truy vấn Database: ${dbError.message} (Mã: ${dbError.code})`,
        user,
      };
    }

    return {
      success: true,
      message: 'Kết nối thành công! Database và bảng "maps" đã sẵn sàng hoạt động.',
      user,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      message: error.message || 'Không thể kết nối đến URL Supabase.',
    };
  }
}

/**
 * Chuyển đổi base64 data URL thành Blob
 */
function base64ToBlob(base64: string): { blob: Blob; mimeType: string } {
  const parts = base64.split(';base64,');
  const mimeType = parts[0]?.replace('data:', '') || 'image/png';
  const byteString = atob(parts[1] || parts[0]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return { blob: new Blob([ab], { type: mimeType }), mimeType };
}

/**
 * Upload ảnh đính kèm lên Supabase Storage Bucket để thay thế Base64
 */
export async function uploadAttachmentToSupabase(
  attachId: string,
  dataUrlOrBase64: string,
  mapId?: string
): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { blob, mimeType } = base64ToBlob(dataUrlOrBase64);
    const ext = mimeType.split('/')[1] || 'png';
    const filePath = mapId ? `uploads/${mapId}/${attachId}.${ext}` : `uploads/${attachId}.${ext}`;

    const { error: uploadErr } = await client.storage
      .from('mindnote_attachments')
      .upload(filePath, blob, {
        upsert: true,
        contentType: mimeType,
      });

    if (uploadErr) {
      console.warn('[Supabase Storage] Lỗi tải ảnh lên bucket, giữ nguyên lưu trữ local:', uploadErr);
      return null;
    }

    const { data: pubData } = client.storage.from('mindnote_attachments').getPublicUrl(filePath);
    const publicUrl = pubData?.publicUrl;
    if (!publicUrl) return null;

    // Kiểm tra xem URL công khai có thực sự truy cập được không (Bucket có bật Public không?)
    try {
      const probeRes = await fetch(publicUrl, { method: 'HEAD' }).catch(() =>
        fetch(publicUrl, { method: 'GET', headers: { Range: 'bytes=0-10' } })
      );
      if (!probeRes.ok) {
        console.warn(
          `[Supabase Storage] Bucket 'mindnote_attachments' chưa được bật 'Public' hoặc bị chặn quyền đọc (HTTP ${probeRes.status}). Giữ nguyên Base64 an toàn để không hỏng ảnh hiển thị.`
        );
        return null;
      }
    } catch (probeErr) {
      console.warn('[Supabase Storage] Không thể kết nối tới CDN ảnh, giữ nguyên Base64:', probeErr);
      return null;
    }

    return publicUrl;
  } catch (e) {
    console.warn('[Supabase Storage] Exception when uploading image:', e);
    return null;
  }
}

/**
 * Xóa toàn bộ ảnh của 1 Map trên Supabase Storage
 */
export async function deleteMapAttachmentsFromSupabase(
  mapId: string,
  extraAttachments?: Record<string, string>
): Promise<number> {
  const client = getSupabase();
  if (!client) return 0;

  let totalRemoved = 0;
  try {
    // 1. Quét toàn bộ file trong thư mục uploads/${mapId}/
    const folderPath = `uploads/${mapId}`;
    const { data: files, error: listErr } = await client.storage
      .from('mindnote_attachments')
      .list(folderPath, { limit: 1000 });

    if (!listErr && files && files.length > 0) {
      const filePaths = files
        .filter((f) => f.name && f.name !== '.emptyFolderPlaceholder')
        .map((f) => `${folderPath}/${f.name}`);

      if (filePaths.length > 0) {
        const { error: removeErr } = await client.storage
          .from('mindnote_attachments')
          .remove(filePaths);

        if (!removeErr) {
          totalRemoved += filePaths.length;
        } else {
          console.warn('[Supabase Storage] Lỗi xóa ảnh trong thư mục map:', removeErr);
        }
      }
    }

    // 2. Nếu có danh sách ảnh cũ (legacy) nằm ngoài thư mục uploads/${mapId}/
    if (extraAttachments) {
      const legacyPaths: string[] = [];
      for (const uri of Object.values(extraAttachments)) {
        if (typeof uri === 'string' && uri.includes('/mindnote_attachments/')) {
          const match = uri.match(/mindnote_attachments\/(uploads\/[^?#]+)/);
          if (match && match[1]) {
            legacyPaths.push(match[1]);
          }
        }
      }
      if (legacyPaths.length > 0) {
        const { error } = await client.storage.from('mindnote_attachments').remove(legacyPaths);
        if (!error) totalRemoved += legacyPaths.length;
      }
    }

    return totalRemoved;
  } catch (err) {
    console.warn('[Supabase Storage] Exception deleting map attachments:', err);
    return totalRemoved;
  }
}

/**
 * Xóa các ảnh rác (mồ côi) của 1 Map trên Supabase Storage
 */
export async function deleteOrphanAttachmentsFromSupabase(
  mapId: string,
  usedKeys: Set<string>
): Promise<{ removedCount: number; removedFiles: string[] }> {
  const client = getSupabase();
  if (!client) return { removedCount: 0, removedFiles: [] };

  try {
    const folderPath = `uploads/${mapId}`;
    const { data: files, error: listErr } = await client.storage
      .from('mindnote_attachments')
      .list(folderPath, { limit: 1000 });

    if (listErr || !files || files.length === 0) {
      return { removedCount: 0, removedFiles: [] };
    }

    const orphanPaths: string[] = [];
    const removedFiles: string[] = [];

    for (const f of files) {
      if (!f.name || f.name === '.emptyFolderPlaceholder') continue;
      
      const fileName = f.name;
      const baseName = fileName.replace(/\.[^/.]+$/, ''); // Bỏ đuôi .png/.webp

      const isUsed = usedKeys.has(fileName) || usedKeys.has(baseName);
      if (!isUsed) {
        orphanPaths.push(`${folderPath}/${fileName}`);
        removedFiles.push(fileName);
      }
    }

    if (orphanPaths.length > 0) {
      const { error: removeErr } = await client.storage
        .from('mindnote_attachments')
        .remove(orphanPaths);

      if (removeErr) {
        console.warn('[Supabase Storage] Lỗi xóa file ảnh mồ côi:', removeErr);
        return { removedCount: 0, removedFiles: [] };
      }
    }

    return { removedCount: orphanPaths.length, removedFiles };
  } catch (err) {
    console.warn('[Supabase Storage] Exception deleting orphan files:', err);
    return { removedCount: 0, removedFiles: [] };
  }
}

/**
 * Đẩy toàn bộ ảnh Base64 trong 1 Map lên Supabase Storage và chuyển đổi thành URL CDN
 */
export async function uploadMapAttachmentsToSupabase(
  map: MapData,
  onProgress?: (current: number, total: number) => void
): Promise<{ updatedMap: MapData; uploadedCount: number }> {
  const client = getSupabase();
  if (!client) return { updatedMap: map, uploadedCount: 0 };

  const currentAttachments = { ...(map.attachments || {}) };
  const entriesToUpload: [string, string][] = Object.entries(currentAttachments).filter(
    ([, val]) => typeof val === 'string' && val.startsWith('data:image/')
  );

  if (entriesToUpload.length === 0) {
    return { updatedMap: map, uploadedCount: 0 };
  }

  let uploadedCount = 0;
  for (let i = 0; i < entriesToUpload.length; i++) {
    const [attachId, base64] = entriesToUpload[i];
    onProgress?.(i + 1, entriesToUpload.length);

    try {
      const cdnUrl = await uploadAttachmentToSupabase(attachId, base64, map.id);
      if (cdnUrl) {
        currentAttachments[attachId] = cdnUrl;
        uploadedCount++;
      }
    } catch (e) {
      console.warn(`[Supabase Storage] Lỗi upload ảnh ${attachId}:`, e);
    }
  }

  const updatedMap: MapData = {
    ...map,
    attachments: currentAttachments,
    updatedAt: Date.now(),
  };

  return { updatedMap, uploadedCount };
}

/**
 * Đồng bộ 1 Map lên Supabase (Upsert).
 * Tự động đẩy các ảnh Base64 lên Supabase Storage trước khi lưu để DB luôn siêu nhẹ!
 */
export async function syncMapToSupabase(
  map: MapData,
  autoUploadImages: boolean = true
): Promise<{ success: boolean; updatedMap: MapData; uploadedImagesCount: number }> {
  const client = getSupabase();
  if (!client) return { success: false, updatedMap: map, uploadedImagesCount: 0 };

  try {
    let effectiveMap = map;
    let uploadedImagesCount = 0;

    // Tự động đẩy ảnh Base64 lên Supabase Storage nếu có
    if (autoUploadImages && map.attachments) {
      const hasBase64 = Object.values(map.attachments).some(
        (v) => typeof v === 'string' && v.startsWith('data:image/')
      );
      if (hasBase64) {
        const uploadRes = await uploadMapAttachmentsToSupabase(map);
        effectiveMap = uploadRes.updatedMap;
        uploadedImagesCount = uploadRes.uploadedCount;
      }
    }

    const { data: authData } = await client.auth.getUser();
    const userId = authData?.user?.id || null;

    // Làm sạch closures trước khi lưu
    const cleanNodes = (effectiveMap.nodes || []).map((node) => {
      const rawData = (node.data || {}) as Record<string, unknown>;
      const { attachments, onNavigate, onNodeClick, ...cleanData } = rawData;
      return {
        ...node,
        data: cleanData,
      };
    });

    const payload = {
      id: effectiveMap.id,
      name: effectiveMap.name,
      nodes: cleanNodes,
      edges: effectiveMap.edges || [],
      context: effectiveMap.context || '',
      attachments: effectiveMap.attachments || {},
      created_at: effectiveMap.createdAt || Date.now(),
      updated_at: effectiveMap.updatedAt || Date.now(),
      ...(userId ? { user_id: userId } : {}),
    };

    const { error } = await client.from('maps').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase] Error syncing map:', error);
      return { success: false, updatedMap: effectiveMap, uploadedImagesCount };
    }
    return { success: true, updatedMap: effectiveMap, uploadedImagesCount };
  } catch (err) {
    console.error('[Supabase] syncMapToSupabase exception:', err);
    return { success: false, updatedMap: map, uploadedImagesCount: 0 };
  }
}

/**
 * Đồng bộ toàn bộ danh sách Map lên Supabase
 */
export async function syncAllMapsToSupabase(
  maps: MapData[],
  autoUploadImages: boolean = true
): Promise<{ count: number; updatedMaps: MapData[]; error?: string }> {
  const client = getSupabase();
  if (!client) {
    return { count: 0, updatedMaps: maps, error: 'Chưa cấu hình Supabase URL & Anon Key.' };
  }

  try {
    let successCount = 0;
    const updatedMaps: MapData[] = [];

    for (const map of maps) {
      const res = await syncMapToSupabase(map, autoUploadImages);
      if (res.success) {
        successCount++;
        updatedMaps.push(res.updatedMap);
      } else {
        updatedMaps.push(map);
      }
    }
    return { count: successCount, updatedMaps };
  } catch (e: unknown) {
    const err = e as Error;
    return { count: 0, updatedMaps: maps, error: err.message };
  }
}

/**
 * Tải toàn bộ Map từ Supabase về
 */
export async function fetchAllMapsFromSupabase(): Promise<MapData[]> {
  const client = getSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('maps')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error || !data) {
      throw new Error(error?.message || 'Không thể tải dữ liệu từ Supabase.');
    }

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      nodes: row.nodes || [],
      edges: row.edges || [],
      context: row.context || '',
      attachments: row.attachments || {},
      createdAt: Number(row.created_at) || Date.now(),
      updatedAt: Number(row.updated_at) || Date.now(),
    }));
  } catch (err) {
    console.error('[Supabase] fetchAllMapsFromSupabase error:', err);
    throw err;
  }
}

/**
 * Xóa 1 bản đồ khỏi Supabase (Xóa cả map trong DB và toàn bộ ảnh trên Storage bucket)
 */
export async function deleteMapFromSupabase(
  mapId: string,
  mapAttachments?: Record<string, string>
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    // 1. Xóa toàn bộ ảnh đính kèm của map này trên Storage bucket
    await deleteMapAttachmentsFromSupabase(mapId, mapAttachments);

    // 2. Xóa các phiên chat AI liên quan đến map
    try {
      await client.from('chat_sessions').delete().eq('map_id', mapId);
    } catch {
      // ignore
    }

    // 3. Xóa bản đồ trong bảng maps
    const { error } = await client.from('maps').delete().eq('id', mapId);
    return !error;
  } catch (err) {
    console.error('[Supabase] deleteMapFromSupabase error:', err);
    return false;
  }
}

/**
 * Đăng ký lắng nghe thay đổi thời gian thực (Real-time Sync qua WebSocket)
 */
export function subscribeToRemoteMaps(
  onRemoteUpdate: (map: MapData) => void,
  onRemoteDelete: (mapId: string) => void
): (() => void) | null {
  const client = getSupabase();
  if (!client) return null;

  try {
    const channelName = `mindnote-maps-${Date.now()}`;
    const channel: RealtimeChannel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maps' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row: any = payload.new;
            if (row && row.id) {
              const remoteMap: MapData = {
                id: row.id,
                name: row.name,
                nodes: row.nodes || [],
                edges: row.edges || [],
                context: row.context || '',
                attachments: row.attachments || {},
                createdAt: Number(row.created_at) || Date.now(),
                updatedAt: Number(row.updated_at) || Date.now(),
              };
              onRemoteUpdate(remoteMap);
            }
          } else if (payload.eventType === 'DELETE') {
            const oldRow: any = payload.old;
            if (oldRow && oldRow.id) {
              onRemoteDelete(oldRow.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[Supabase Realtime] Lỗi đăng ký kênh Realtime:', err);
    return null;
  }
}

/**
 * Quản lý xác thực (Auth)
 */
export const SupabaseAuth = {
  async getCurrentUser(): Promise<User | null> {
    const client = getSupabase();
    if (!client) return null;
    const { data } = await client.auth.getUser();
    return data?.user || null;
  },

  async signUp(email: string, password: string) {
    const client = getSupabase();
    if (!client) throw new Error('Chưa cấu hình Supabase.');
    const res = await client.auth.signUp({ email, password });
    if (res.error) throw res.error;
    return res.data;
  },

  async signIn(email: string, password: string) {
    const client = getSupabase();
    if (!client) throw new Error('Chưa cấu hình Supabase.');
    const res = await client.auth.signInWithPassword({ email, password });
    if (res.error) throw res.error;
    return res.data;
  },

  async signOut() {
    const client = getSupabase();
    if (!client) return;
    await client.auth.signOut();
  },

  onAuthStateChange(callback: (user: User | null) => void) {
    const client = getSupabase();
    if (!client) return () => {};
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      callback(session?.user || null);
    });
    return () => data.subscription.unsubscribe();
  },
};
