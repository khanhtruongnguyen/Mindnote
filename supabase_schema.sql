-- ==========================================================
-- MINDNOTE - SUPABASE DATABASE & STORAGE SCHEMA
-- ==========================================================
-- Hướng dẫn: Mở Supabase Dashboard -> Vào mục SQL Editor -> Dán toàn bộ script này và bấm 'Run'.

-- 1. Bảng lưu trữ Bản Đồ (Maps)
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

-- 2. Bảng lưu trữ Lịch sử Chat AI (Chat Sessions)
create table if not exists public.chat_sessions (
  id text primary key,
  map_id text not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  updated_at bigint not null
);

-- 3. Kích hoạt Row Level Security (RLS) để bảo vệ dữ liệu cá nhân
alter table public.maps enable row level security;
alter table public.chat_sessions enable row level security;

-- Policies cho bảng maps:
-- Hỗ trợ cả đăng nhập tài khoản (auth.uid) hoặc dùng Anon Key cá nhân
drop policy if exists "Users can access their own maps" on public.maps;
create policy "Users can access their own maps" on public.maps
  for all using (
    auth.uid() = user_id or user_id is null
  )
  with check (
    auth.uid() = user_id or user_id is null
  );

-- Policies cho bảng chat_sessions:
drop policy if exists "Users can access their own chat sessions" on public.chat_sessions;
create policy "Users can access their own chat sessions" on public.chat_sessions
  for all using (
    auth.uid() = user_id or user_id is null
  )
  with check (
    auth.uid() = user_id or user_id is null
  );

-- 4. Bật Realtime cho bảng maps (Để điện thoại và máy tính tự nhảy thay đổi tức thì)
begin;
  -- Kiểm tra và thêm bảng maps vào publication realtime
  do $$
  begin
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'maps'
    ) then
      alter publication supabase_realtime add table public.maps;
    end if;
  end $$;
commit;

-- 5. Tạo Storage Bucket để lưu trữ ảnh đính kèm (Media Bucket)
insert into storage.buckets (id, name, public)
values ('mindnote_attachments', 'mindnote_attachments', true)
on conflict (id) do nothing;

-- Cấp quyền xem ảnh công khai cho mọi người
drop policy if exists "Public Access for Mindnote Attachments" on storage.objects;
create policy "Public Access for Mindnote Attachments" on storage.objects
  for select using (bucket_id = 'mindnote_attachments');

-- Cấp quyền tải ảnh lên bucket
drop policy if exists "Upload Mindnote Attachments" on storage.objects;
create policy "Upload Mindnote Attachments" on storage.objects
  for insert with check (bucket_id = 'mindnote_attachments');

drop policy if exists "Update Mindnote Attachments" on storage.objects;
create policy "Update Mindnote Attachments" on storage.objects
  for update using (bucket_id = 'mindnote_attachments');

drop policy if exists "Delete Mindnote Attachments" on storage.objects;
create policy "Delete Mindnote Attachments" on storage.objects
  for delete using (bucket_id = 'mindnote_attachments');
