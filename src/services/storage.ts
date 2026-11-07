import type { MapData, AppSettings, ChatSession } from '../types';

const STORAGE_MAPS_KEY = 'infinite_notes_maps_v1';
const STORAGE_SETTINGS_KEY = 'infinite_notes_settings_v1';
const STORAGE_CHAT_SESSIONS_PREFIX = 'infinite_notes_chat_sessions_v1_';

export const DEFAULT_STARTER_MAP: MapData = {
  id: 'starter-calculus-1',
  name: 'Giải Tích 1: Tổng Hợp Kiến Thức',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  nodes: [
    {
      id: 'node-center',
      type: 'mindmap',
      position: { x: 380, y: 220 },
      data: {
        label: 'Giải Tích 1 (Calculus I)',
        color: 'purple',
        shape: 'pill',
        content: `# Giải Tích 1 - Bản Đồ Khái Niệm

Chào mừng bạn đến với **Không gian ghi chú vô tận**! Đây là nơi bạn có thể hệ thống hóa các kiến thức học đại học một cách trực quan, tối giản theo phong cách Obsidian.

### Các thao tác nhanh:
- **Kéo rê (Pan):** Nhấn giữ chuột trái hoặc giữ phím \`Space\` + kéo chuột.
- **Phóng to/Thu nhỏ (Zoom):** Cuộn con lăn chuột.
- **Tạo nút mới:** Nhấp đúp chuột (Double click) vào bất kỳ vị trí trống nào trên bảng.
- **Nối các nút:** Kéo từ một trong các chấm nhỏ (Handles) ở viền nút này sang nút khác để tạo mũi tên.
- **Xem / Sửa ghi chú:** Bấm vào bất kỳ nút nào để mở thanh bên này!

---
> Chúc bạn có những kỳ thi đạt điểm A+ với phương pháp học tập không gian này!`,
      },
    },
    {
      id: 'node-taylor',
      type: 'mindmap',
      position: { x: 740, y: 120 },
      data: {
        label: 'Khai Triển Taylor & Maclaurin',
        color: 'rose',
        shape: 'pill',
        content: `### Công Thức Khai Triển Taylor

Giả sử hàm số $f(x)$ có đạo hàm đến cấp $n+1$ trên lân cận điểm $x_0 = a$:

$$f(x) = \\sum_{k=0}^n \\frac{f^{(k)}(a)}{k!} (x-a)^k + R_n(x)$$

Trong đó phần dư dạng Lagrange:
$$R_n(x) = \\frac{f^{(n+1)}(\\xi)}{(n+1)!} (x-a)^{n+1}$$

#### Các khai triển Maclaurin kinh điển cần nhớ:
1. $e^x = 1 + x + \\frac{x^2}{2!} + \\dots + \\frac{x^n}{n!} + o(x^n)$
2. $\\sin x = x - \\frac{x^3}{3!} + \\frac{x^5}{5!} - \\dots$
3. $\\cos x = 1 - \\frac{x^2}{2!} + \\frac{x^4}{4!} - \\dots$
4. $\\ln(1+x) = x - \\frac{x^2}{2} + \\frac{x^3}{3} - \\dots$`,
      },
    },
    {
      id: 'node-integral',
      type: 'mindmap',
      position: { x: 740, y: 340 },
      data: {
        label: 'Tích Phân Suy Rộng Loại 1',
        color: 'cyan',
        shape: 'pill',
        content: `### Tích Phân Suy Rộng (Improper Integrals)

Định nghĩa tích phân với cận vô tận:
$$\\int_{a}^{+\\infty} f(x)dx = \\lim_{t \\to +\\infty} \\int_{a}^t f(x)dx$$

#### Tiêu chuẩn so sánh:
Nếu $0 \\le f(x) \\le g(x)$ trên $[a, +\\infty)$:
- $\\int g(x)dx$ hội tụ $\\implies \\int f(x)dx$ hội tụ.
- $\\int f(x)dx$ phân kỳ $\\implies \\int g(x)dx$ phân kỳ.

> **Ví dụ mẫu Riemann:**
> $$\\int_{1}^{+\\infty} \\frac{1}{x^\\alpha} dx$$
> - Hội tụ khi $\\alpha > 1$
> - Phân kỳ khi $\\alpha \\le 1$`,
      },
    },
    {
      id: 'node-fourier',
      type: 'mindmap',
      position: { x: 80, y: 140 },
      data: {
        label: 'Chuỗi Fourier & Ứng Dụng',
        color: 'emerald',
        shape: 'pill',
        content: `### Chuỗi Lượng Giác Fourier

Mỗi hàm tuần hoàn chu kỳ $2\\pi$ khả tích có thể xấp xỉ bằng:

$$f(x) \\sim \\frac{a_0}{2} + \\sum_{n=1}^\\infty \\left( a_n \\cos(nx) + b_n \\sin(nx) \\right)$$

Với các hệ số Euler-Fourier:
$$a_n = \\frac{1}{\\pi} \\int_{-\\pi}^\\pi f(x) \\cos(nx) dx$$
$$b_n = \\frac{1}{\\pi} \\int_{-\\pi}^\\pi f(x) \\sin(nx) dx$$`,
      },
    },
    {
      id: 'node-lagrange',
      type: 'mindmap',
      position: { x: 100, y: 340 },
      data: {
        label: 'Định Lý Giá Trị Trung Bình',
        color: 'amber',
        shape: 'pill',
        content: `### Các Định Lý Cốt Lõi Về Đạo Hàm

#### 1. Định lý Rolle:
Nếu $f$ liên tục trên $[a, b]$, khả vi trên $(a, b)$ và $f(a) = f(b)$, thì:
$$\\exists \\xi \\in (a, b): f'(\\xi) = 0$$

#### 2. Định lý Lagrange:
$$\\frac{f(b) - f(a)}{b - a} = f'(\\xi) \\quad (a < \\xi < b)$$

#### 3. Định lý Cauchy:
$$\\frac{f(b) - f(a)}{g(b) - g(a)} = \\frac{f'(\\xi)}{g'(\\xi)}$$`,
      },
    },
  ],
  edges: [
    {
      id: 'e-center-taylor',
      source: 'node-center',
      target: 'node-taylor',
      type: 'default',
      animated: true,
      style: { stroke: '#a855f7' },
    },
    {
      id: 'e-center-integral',
      source: 'node-center',
      target: 'node-integral',
      type: 'default',
      animated: true,
      style: { stroke: '#06b6d4' },
    },
    {
      id: 'e-center-fourier',
      source: 'node-center',
      target: 'node-fourier',
      type: 'default',
      animated: true,
      style: { stroke: '#10b981' },
    },
    {
      id: 'e-center-lagrange',
      source: 'node-center',
      target: 'node-lagrange',
      type: 'default',
      animated: true,
      style: { stroke: '#f59e0b' },
    },
  ],
};

export const DEFAULT_AI_CONFIG = {
  aiBaseUrl: 'https://api.xah.io/v1',
  aiApiKey: 'sk-6e5bd68e2310d13bcf3747838f1cf8138d68e14e318e4e7e68cfb62a30aff59b',
  aiModel: 'dungcsnd113/gemini-flash-3.8',
  saveChatHistory: true,
};

export const StorageService = {
  getMaps(): MapData[] {
    try {
      const data = localStorage.getItem(STORAGE_MAPS_KEY);
      if (!data) {
        this.saveMaps([DEFAULT_STARTER_MAP]);
        return [DEFAULT_STARTER_MAP];
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        this.saveMaps([DEFAULT_STARTER_MAP]);
        return [DEFAULT_STARTER_MAP];
      }
      return parsed;
    } catch (e) {
      console.error('Failed to load maps from local storage:', e);
      return [DEFAULT_STARTER_MAP];
    }
  },

  saveMaps(maps: MapData[]): void {
    try {
      localStorage.setItem(STORAGE_MAPS_KEY, JSON.stringify(maps));
    } catch (e) {
      console.error('Failed to save maps to local storage:', e);
    }
  },

  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (!data) {
        return {
          activeMapId: DEFAULT_STARTER_MAP.id,
          ...DEFAULT_AI_CONFIG,
        };
      }
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_AI_CONFIG,
        ...parsed,
      };
    } catch {
      return {
        activeMapId: DEFAULT_STARTER_MAP.id,
        ...DEFAULT_AI_CONFIG,
      };
    }
  },

  saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  },

  getChatSessions(mapId: string): ChatSession[] {
    try {
      const raw = localStorage.getItem(`${STORAGE_CHAT_SESSIONS_PREFIX}${mapId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  saveChatSessions(mapId: string, sessions: ChatSession[]): void {
    try {
      localStorage.setItem(`${STORAGE_CHAT_SESSIONS_PREFIX}${mapId}`, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to save chat sessions:', e);
    }
  },

  deleteChatSession(mapId: string, sessionId: string): void {
    const sessions = this.getChatSessions(mapId).filter((s) => s.id !== sessionId);
    this.saveChatSessions(mapId, sessions);
  },

  clearAllChatSessions(mapId: string): void {
    try {
      localStorage.removeItem(`${STORAGE_CHAT_SESSIONS_PREFIX}${mapId}`);
    } catch (e) {
      console.error('Failed to clear chat sessions:', e);
    }
  },

  exportBackup(maps: MapData[]) {
    const jsonStr = JSON.stringify(maps, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmap_notes_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importBackup(file: File): Promise<MapData[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            resolve(parsed);
          } else {
            reject(new Error('Định dạng file sao lưu không hợp lệ.'));
          }
        } catch {
          reject(new Error('Không thể đọc file JSON.'));
        }
      };
      reader.onerror = () => reject(new Error('Lỗi khi đọc file.'));
      reader.readAsText(file);
    });
  },

  // GitHub Gist Integration
  async syncToGist(token: string, gistId: string | null, maps: MapData[]): Promise<{ gistId: string; url: string }> {
    const payload = {
      description: 'MindMap Infinite Notes Backup',
      public: false,
      files: {
        'mindmap_notes.json': {
          content: JSON.stringify(maps, null, 2),
        },
      },
    };

    const url = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
    const method = gistId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Lỗi khi kết nối GitHub Gist (Status ${res.status})`);
    }

    const data = await res.json();
    return {
      gistId: data.id,
      url: data.html_url,
    };
  },

  async loadFromGist(token: string, gistId: string): Promise<MapData[]> {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!res.ok) {
      throw new Error(`Không thể tải Gist (Status ${res.status})`);
    }

    const data = await res.json();
    const file = data.files?.['mindmap_notes.json'];
    if (!file || !file.content) {
      throw new Error('Không tìm thấy file mindmap_notes.json trong Gist.');
    }

    const parsed = JSON.parse(file.content);
    if (!Array.isArray(parsed)) {
      throw new Error('Dữ liệu Gist không đúng định dạng MapData[].');
    }

    return parsed;
  },
};
