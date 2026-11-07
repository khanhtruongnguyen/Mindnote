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
  dataUrlOrBase64: string
): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { blob, mimeType } = base64ToBlob(dataUrlOrBase64);
    const ext = mimeType.split('/')[1] || 'png';
    const filePath = `uploads/${attachId}.${ext}`;

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
    return pubData?.publicUrl || null;
  } catch (e) {
    console.warn('[Supabase Storage] Exception when uploading image:', e);
    return null;
  }
}

/**
 * Đồng bộ 1 Map lên Supabase (Upsert)
 */
export async function syncMapToSupabase(map: MapData): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { data: authData } = await client.auth.getUser();
    const userId = authData?.user?.id || null;

    // Làm sạch attachments/closure trước khi lưu
    const cleanNodes = (map.nodes || []).map((node) => {
      const rawData = (node.data || {}) as Record<string, unknown>;
      const { attachments, onNavigate, onNodeClick, ...cleanData } = rawData;
      return {
        ...node,
        data: cleanData,
      };
    });

    const payload = {
      id: map.id,
      name: map.name,
      nodes: cleanNodes,
      edges: map.edges || [],
      context: map.context || '',
      attachments: map.attachments || {},
      created_at: map.createdAt || Date.now(),
      updated_at: map.updatedAt || Date.now(),
      ...(userId ? { user_id: userId } : {}),
    };

    const { error } = await client.from('maps').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase] Error syncing map:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] syncMapToSupabase exception:', err);
    return false;
  }
}

/**
 * Đồng bộ toàn bộ danh sách Map lên Supabase
 */
export async function syncAllMapsToSupabase(maps: MapData[]): Promise<{ count: number; error?: string }> {
  const client = getSupabase();
  if (!client) {
    return { count: 0, error: 'Chưa cấu hình Supabase URL & Anon Key.' };
  }

  try {
    let successCount = 0;
    for (const map of maps) {
      const ok = await syncMapToSupabase(map);
      if (ok) successCount++;
    }
    return { count: successCount };
  } catch (e: unknown) {
    const err = e as Error;
    return { count: 0, error: err.message };
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
 * Xóa 1 bản đồ khỏi Supabase
 */
export async function deleteMapFromSupabase(mapId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('maps').delete().eq('id', mapId);
    return !error;
  } catch {
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
