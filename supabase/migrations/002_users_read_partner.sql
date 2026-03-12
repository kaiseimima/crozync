-- Migration: Allow reading partner's user record (timezone, etc.)
-- Run manually on Supabase Dashboard SQL Editor
-- Date: 2026-03-13

create policy "users: read partner" on public.users
  for select using (
    exists (
      select 1 from public.pairs
      where (user_1_id = auth.uid() and user_2_id = users.id)
         or (user_2_id = auth.uid() and user_1_id = users.id)
    )
  );
