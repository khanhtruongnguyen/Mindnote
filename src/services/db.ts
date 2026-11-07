import type { MapData, ChatSession } from '../types';

const DB_NAME = 'MindNoteDB';
const DB_VERSION = 1;
const STORE_MAPS = 'maps';
const STORE_CHATS = 'chat_sessions';

let dbInstance: IDBDatabase | null = null;
let initPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Open and initialize the IndexedDB instance
 * Supports iOS Safari, Android, Chrome, Edge, Firefox, desktop & mobile
 */
export function openDB(): Promise<IDBDatabase | null> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('[IndexedDB] indexedDB is not supported in this environment.');
      resolve(null);
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_MAPS)) {
          db.createObjectStore(STORE_MAPS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CHATS)) {
          db.createObjectStore(STORE_CHATS, { keyPath: 'mapId' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        dbInstance.onversionchange = () => {
          dbInstance?.close();
          dbInstance = null;
        };
        resolve(dbInstance);

        // Yêu cầu Safari / WebKit bảo vệ IndexedDB vĩnh viễn, chống tự động dọn rác
        if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
          navigator.storage.persist().catch(() => {});
        }
      };

      request.onerror = (event) => {
        console.error('[IndexedDB] Failed to open database:', (event.target as IDBOpenDBRequest).error);
        resolve(null);
      };
    } catch (err) {
      console.error('[IndexedDB] Exception when opening database:', err);
      resolve(null);
    }
  });

  return initPromise;
}

/**
 * Load all maps from IndexedDB
 */
export async function idbGetAllMaps(): Promise<MapData[] | null> {
  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MAPS, 'readonly');
      const store = tx.objectStore(STORE_MAPS);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as MapData[]) || []);
      };

      request.onerror = () => {
        console.error('[IndexedDB] Error fetching all maps:', request.error);
        resolve(null);
      };
    } catch (err) {
      console.error('[IndexedDB] Transaction error in idbGetAllMaps:', err);
      resolve(null);
    }
  });
}

/**
 * Save all maps to IndexedDB (clears store first to prune removed maps)
 */
export async function idbSaveAllMaps(maps: MapData[]): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;

  // Đảm bảo dữ liệu thuần túy (không chứa functions hay closures như onDelete, onNavigate)
  // để tránh lỗi DataCloneError trong IndexedDB structuredClone
  const safeMaps = JSON.parse(JSON.stringify(maps));

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MAPS, 'readwrite');
      const store = tx.objectStore(STORE_MAPS);

      store.clear();
      for (const map of safeMaps) {
        store.put(map);
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => {
        console.error('[IndexedDB] Transaction error saving maps:', tx.error || e);
        resolve(false);
      };
    } catch (err) {
      console.error('[IndexedDB] Exception in idbSaveAllMaps:', err);
      resolve(false);
    }
  });
}

/**
 * Get chat sessions for a specific map
 */
export async function idbGetChatSessions(mapId: string): Promise<ChatSession[] | null> {
  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_CHATS, 'readonly');
      const store = tx.objectStore(STORE_CHATS);
      const request = store.get(mapId);

      request.onsuccess = () => {
        const res = request.result;
        resolve(res && Array.isArray(res.sessions) ? res.sessions : []);
      };

      request.onerror = () => {
        console.error('[IndexedDB] Error getting chat sessions:', request.error);
        resolve(null);
      };
    } catch (err) {
      console.error('[IndexedDB] Exception in idbGetChatSessions:', err);
      resolve(null);
    }
  });
}

/**
 * Save chat sessions for a specific map
 */
export async function idbSaveChatSessions(mapId: string, sessions: ChatSession[]): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_CHATS, 'readwrite');
      const store = tx.objectStore(STORE_CHATS);
      store.put({ mapId, sessions, updatedAt: Date.now() });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.error('[IndexedDB] Error saving chat sessions:', tx.error);
        resolve(false);
      };
    } catch (err) {
      console.error('[IndexedDB] Exception in idbSaveChatSessions:', err);
      resolve(false);
    }
  });
}

/**
 * Delete chat sessions for a specific map
 */
export async function idbDeleteChatSessions(mapId: string): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_CHATS, 'readwrite');
      const store = tx.objectStore(STORE_CHATS);
      store.delete(mapId);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.error('[IndexedDB] Error deleting chat sessions:', tx.error);
        resolve(false);
      };
    } catch (err) {
      console.error('[IndexedDB] Exception in idbDeleteChatSessions:', err);
      resolve(false);
    }
  });
}
