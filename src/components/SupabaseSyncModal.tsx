import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Key,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  Wifi,
  UploadCloud,
  DownloadCloud,
  Code2,
  Copy,
  Check,
  User as UserIcon,
  LogOut,
  Zap,
} from 'lucide-react';
import {
  testSupabaseConnection,
  syncAllMapsToSupabase,
  fetchAllMapsFromSupabase,
  SupabaseAuth,
} from '../services/supabase';
import type { MapData, AppSettings } from '../types';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  maps: MapData[];
  onMapsLoaded: (maps: MapData[]) => void;
  settings: AppSettings;
  onSaveSettings: (updates: Partial<AppSettings>) => void;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
  maps,
  onMapsLoaded,
  settings,
  onSaveSettings,
}) => {
  const [url, setUrl] = useState(settings.supabaseUrl || '');
  const [anonKey, setAnonKey] = useState(settings.supabaseAnonKey || '');
  const [autoSync, setAutoSync] = useState(settings.supabaseAutoSync ?? true);
  const [realtime, setRealtime] = useState(settings.supabaseRealtime ?? true);

  const [activeTab, setActiveTab] = useState<'sync' | 'config' | 'sql'>('sync');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auth state
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(settings.supabaseUserEmail || null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authLoading, setAuthLoading] = useState(false);

  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen && settings.supabaseUrl && settings.supabaseAnonKey) {
      SupabaseAuth.getCurrentUser().then((user) => {
        if (user?.email) {
          setCurrentUserEmail(user.email);
          onSaveSettings({ supabaseUserEmail: user.email });
        }
      });
    }
  }, [isOpen, settings.supabaseUrl, settings.supabaseAnonKey]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({
        success: false,
        message: 'Vui lòng nhập đầy đủ Supabase Project URL và Anon Public Key.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const res = await testSupabaseConnection(url.trim(), anonKey.trim());
    setTesting(false);
    setTestResult(res);

    if (res.success) {
      onSaveSettings({
        supabaseUrl: url.trim(),
        supabaseAnonKey: anonKey.trim(),
        supabaseAutoSync: autoSync,
        supabaseRealtime: realtime,
      });
      if (res.user?.email) {
        setCurrentUserEmail(res.user.email);
        onSaveSettings({ supabaseUserEmail: res.user.email });
      }
    }
  };

  const handlePushAll = async () => {
    setSyncing(true);
    setStatusMessage(null);

    try {
      const res = await syncAllMapsToSupabase(maps);
      if (res.error) {
        setStatusMessage({ type: 'error', text: `Lỗi đồng bộ: ${res.error}` });
      } else {
        const now = Date.now();
        onSaveSettings({ lastCloudSyncedAt: now });
        setStatusMessage({
          type: 'success',
          text: `Đã đồng bộ siêu tốc ${res.count}/${maps.length} bản đồ lên Supabase Cloud!`,
        });
      }
    } catch (e: unknown) {
      const err = e as Error;
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi khi tải lên Supabase.' });
    } finally {
      setSyncing(false);
    }
  };

  const handlePullAll = async () => {
    setSyncing(true);
    setStatusMessage(null);

    try {
      const remoteMaps = await fetchAllMapsFromSupabase();
      if (remoteMaps.length === 0) {
        setStatusMessage({
          type: 'success',
          text: 'Kết nối thành công nhưng chưa có bản đồ nào trên Supabase. Hãy bấm "Đẩy lên Cloud" trước!',
        });
      } else {
        onMapsLoaded(remoteMaps);
        const now = Date.now();
        onSaveSettings({ lastCloudSyncedAt: now });
        setStatusMessage({
          type: 'success',
          text: `Đã tải về thành công ${remoteMaps.length} bản đồ từ Supabase!`,
        });
      }
    } catch (e: unknown) {
      const err = e as Error;
      setStatusMessage({ type: 'error', text: err.message || 'Không thể tải dữ liệu từ Supabase.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPass.trim()) return;

    setAuthLoading(true);
    setStatusMessage(null);

    try {
      if (authMode === 'signin') {
        const res = await SupabaseAuth.signIn(authEmail.trim(), authPass.trim());
        setCurrentUserEmail(res.user?.email || authEmail.trim());
        onSaveSettings({ supabaseUserEmail: res.user?.email || authEmail.trim() });
        setStatusMessage({ type: 'success', text: `Đăng nhập thành công: ${res.user?.email}` });
      } else {
        const res = await SupabaseAuth.signUp(authEmail.trim(), authPass.trim());
        setStatusMessage({
          type: 'success',
          text: `Đã đăng ký tài khoản! ${res.session ? 'Đã tự động đăng nhập.' : 'Vui lòng kiểm tra email xác nhận (nếu có).' }`,
        });
        if (res.user?.email) {
          setCurrentUserEmail(res.user.email);
          onSaveSettings({ supabaseUserEmail: res.user.email });
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      setStatusMessage({ type: 'error', text: error.message || 'Lỗi đăng nhập/đăng ký.' });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await SupabaseAuth.signOut();
    setCurrentUserEmail(null);
    onSaveSettings({ supabaseUserEmail: undefined });
    setStatusMessage({ type: 'success', text: 'Đã đăng xuất khỏi Supabase.' });
  };

  const copySqlToClipboard = () => {
    const sqlCode = `-- Bảng maps\ncreate table if not exists public.maps (\n  id text primary key,\n  user_id uuid references auth.users(id) on delete cascade default auth.uid(),\n  name text not null,\n  nodes jsonb not null default '[]'::jsonb,\n  edges jsonb not null default '[]'::jsonb,\n  context text default '',\n  attachments jsonb default '{}'::jsonb,\n  created_at bigint not null,\n  updated_at bigint not null\n);\nalter table public.maps enable row level security;\ncreate policy "Users can access their own maps" on public.maps for all using (auth.uid() = user_id or user_id is null) with check (auth.uid() = user_id or user_id is null);\nalter publication supabase_realtime add table public.maps;\n\n-- Storage bucket\ninsert into storage.buckets (id, name, public) values ('mindnote_attachments', 'mindnote_attachments', true) on conflict (id) do nothing;\ncreate policy "Public Access" on storage.objects for select using (bucket_id = 'mindnote_attachments');\ncreate policy "Upload Access" on storage.objects for insert with check (bucket_id = 'mindnote_attachments');`;
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const isConfigured = Boolean(settings.supabaseUrl && settings.supabaseAnonKey);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-[#161620] border border-[#2c2c3e] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#262636] bg-[#1a1a27]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Đồng bộ Supabase Cloud</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-400" />
                  <span>Realtime & Media CDN</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400">Tốc độ siêu nhanh, lưu trữ hàng Gigabyte và tự động đồng bộ tức thì</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#262636] bg-[#14141e] px-6 gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('sync')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'sync'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Đồng bộ & Trạng thái</span>
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Kết nối API</span>
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'sql'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Script SQL (1-Click)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* TAB 1: SYNC & STATUS */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              {/* Connection Status Card */}
              <div className="p-4 rounded-xl border bg-[#12121a] border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isConfigured ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse' : 'bg-zinc-600'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">
                      {isConfigured ? 'Đã kết nối Supabase Project' : 'Chưa thiết lập kết nối'}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {currentUserEmail ? `Đăng nhập: ${currentUserEmail}` : isConfigured ? 'Chế độ Anonymous Public Key' : 'Vào tab Kết nối API để cấu hình'}
                    </div>
                  </div>
                </div>

                {isConfigured && (
                  <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono bg-emerald-950/40 px-2.5 py-1 rounded-md border border-emerald-500/30">
                    <Wifi className="w-3 h-3" />
                    <span>Realtime Sẵn sàng</span>
                  </div>
                )}
              </div>

              {/* Sync Actions Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handlePushAll}
                  disabled={syncing || !isConfigured}
                  className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-200 disabled:opacity-40 transition-all flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <UploadCloud className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <div className="text-xs font-bold text-white">Đẩy lên Cloud (Push All)</div>
                    <div className="text-[10px] text-emerald-300/80 mt-0.5">
                      Lưu trữ {maps.length} bản đồ lên máy chủ
                    </div>
                  </div>
                </button>

                <button
                  onClick={handlePullAll}
                  disabled={syncing || !isConfigured}
                  className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/20 hover:bg-purple-950/40 text-purple-200 disabled:opacity-40 transition-all flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <DownloadCloud className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <div className="text-xs font-bold text-white">Kéo về máy (Pull All)</div>
                    <div className="text-[10px] text-purple-300/80 mt-0.5">
                      Đồng bộ về IndexedDB trên máy này
                    </div>
                  </div>
                </button>
              </div>

              {/* Realtime & Auto-Sync Settings */}
              <div className="p-3.5 rounded-xl border bg-[#12121a] border-zinc-800/80 space-y-3">
                <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Cấu hình tự động</div>
                
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-zinc-200">Tự động đồng bộ khi sửa (Auto-sync)</div>
                    <div className="text-[11px] text-zinc-400">Tự động gửi cập nhật khi thêm node, vẽ liên kết</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => {
                      setAutoSync(e.target.checked);
                      onSaveSettings({ supabaseAutoSync: e.target.checked });
                    }}
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer pt-1 border-t border-zinc-800/60">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-zinc-200">Kênh Realtime WebSocket tức thì</div>
                    <div className="text-[11px] text-zinc-400">Điện thoại và máy tính tự động nhảy thay đổi tức thì</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={realtime}
                    onChange={(e) => {
                      setRealtime(e.target.checked);
                      onSaveSettings({ supabaseRealtime: e.target.checked });
                    }}
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </label>
              </div>

              {/* User Account / Auth Section */}
              <div className="p-3.5 rounded-xl border bg-[#12121a] border-zinc-800/80">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tài khoản người dùng (Tùy chọn)</span>
                  </div>
                  {currentUserEmail && (
                    <button
                      onClick={handleSignOut}
                      className="text-[11px] text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Đăng xuất</span>
                    </button>
                  )}
                </div>

                {currentUserEmail ? (
                  <div className="text-xs text-emerald-300 bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-500/20">
                    Đang đăng nhập với email: <strong>{currentUserEmail}</strong>. Toàn bộ bản đồ của bạn được bảo mật riêng tư tuyệt đối qua Supabase Row Level Security (RLS).
                  </div>
                ) : (
                  <form onSubmit={handleAuthSubmit} className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="email"
                        placeholder="Email cá nhân..."
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="bg-[#0e0e14] border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-emerald-500 font-sans"
                      />
                      <input
                        type="password"
                        placeholder="Mật khẩu..."
                        value={authPass}
                        onChange={(e) => setAuthPass(e.target.value)}
                        className="bg-[#0e0e14] border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 outline-none focus:border-emerald-500 font-sans"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setAuthMode('signin')}
                          className={`cursor-pointer ${authMode === 'signin' ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}`}
                        >
                          Đăng nhập
                        </button>
                        <span className="text-zinc-600">|</span>
                        <button
                          type="button"
                          onClick={() => setAuthMode('signup')}
                          className={`cursor-pointer ${authMode === 'signup' ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}`}
                        >
                          Tạo tài khoản mới
                        </button>
                      </div>
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-medium cursor-pointer transition-colors"
                      >
                        {authLoading ? 'Đang xử lý...' : authMode === 'signin' ? 'Đăng nhập' : 'Đăng ký'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CONFIG API KEYS */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Supabase Project URL</span>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-normal lowercase"
                  >
                    <span>Lấy tại supabase.com</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full bg-[#121218] border border-zinc-700/80 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-emerald-500 font-mono transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Supabase Anon Public API Key
                </label>
                <input
                  type="password"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-[#121218] border border-zinc-700/80 rounded-lg px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-emerald-500 font-mono transition-colors"
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Key này an toàn để dùng ở phía Client (chỉ có quyền truy cập qua các chính sách RLS).
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  <span>{testing ? 'Đang kiểm tra kết nối...' : 'Lưu & Kiểm tra kết nối'}</span>
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                    testResult.success
                      ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
                  }`}
                >
                  {testResult.message}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SQL SCHEMA GUIDE */}
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Script khởi tạo bảng & Storage (Chạy 1 lần)</div>
                  <div className="text-[11px] text-zinc-400">
                    Vào Supabase Dashboard $\to$ mục <strong>SQL Editor</strong> $\to$ Dán và bấm <strong>Run</strong>
                  </div>
                </div>
                <button
                  onClick={copySqlToClipboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Đã sao chép!' : 'Copy Script SQL'}</span>
                </button>
              </div>

              <div className="relative">
                <pre className="p-3.5 rounded-xl bg-[#0e0e14] border border-zinc-800 text-[11px] text-zinc-300 font-mono overflow-x-auto max-h-56 leading-relaxed select-text">
{`-- 1. Bảng lưu trữ Bản Đồ (Maps)
create table if not exists public.maps (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  context text default '',
  attachments jsonb default '{}'::jsonb,
  created_at bigint not null,
  updated_at bigint not null
);

-- 2. Kích hoạt RLS & Realtime
alter table public.maps enable row level security;
create policy "Users can access their own maps" on public.maps
  for all using (auth.uid() = user_id or user_id is null)
  with check (auth.uid() = user_id or user_id is null);

alter publication supabase_realtime add table public.maps;

-- 3. Tạo Storage Bucket lưu ảnh
insert into storage.buckets (id, name, public)
values ('mindnote_attachments', 'mindnote_attachments', true)
on conflict (id) do nothing;`}
                </pre>
              </div>

              <p className="text-[11px] text-zinc-500 leading-normal">
                💡 File <code className="text-emerald-400 font-mono">supabase_schema.sql</code> hoàn chỉnh đầy đủ cũng đã được lưu sẵn trong thư mục dự án của bạn để bạn có thể mở xem bất kỳ lúc nào.
              </p>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-lg text-xs leading-relaxed ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
              }`}
            >
              {statusMessage.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-[#14141e] border-t border-[#262636]">
          <div className="text-[11px] text-zinc-500">
            {settings.lastCloudSyncedAt ? (
              <span>Đồng bộ gần nhất: {new Date(settings.lastCloudSyncedAt).toLocaleTimeString()}</span>
            ) : (
              <span>Chưa đồng bộ lên Cloud</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-zinc-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
