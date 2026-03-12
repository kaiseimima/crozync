-- Migration: Add RLS policies for pairing and storage
-- Run manually on Supabase Dashboard SQL Editor
-- Date: 2026-03-13

-- ペア作成のRLSポリシー
create policy "pairs: insert" on public.pairs
  for insert with check (auth.uid() = user_1_id or auth.uid() = user_2_id);

-- ペアのターン切り替え用
create policy "pairs: update own" on public.pairs
  for update using (auth.uid() = user_1_id or auth.uid() = user_2_id);

-- 招待の受け入れ（accepted_at更新）
create policy "pair_invites: update accepted" on public.pair_invites
  for update using (true)
  with check (accepted_at is not null);

-- Storageアップロード許可
create policy "stickers: upload" on storage.objects
  for insert with check (
    bucket_id = 'stickers' AND auth.role() = 'authenticated'
  );

-- Storage閲覧許可
create policy "stickers: read" on storage.objects
  for select using (bucket_id = 'stickers');
