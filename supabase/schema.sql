-- ============================================
-- Crozync Database Schema
-- ============================================

-- extensions
create extension if not exists "pgcrypto";

-- ============================================
-- ENUMS
-- ============================================
create type crozync_status as enum ('pending', 'completed', 'expired');
create type heart_type as enum ('good_morning', 'good_night');

-- ============================================
-- TABLES
-- ============================================

-- users (Supabase auth.users と連動)
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  timezone      text not null default 'UTC',
  wake_time     time not null default '08:00:00',
  sleep_time    time not null default '22:00:00',
  push_token    text,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

-- pair_invites
create table public.pair_invites (
  id                  uuid primary key default gen_random_uuid(),
  created_by_user_id  uuid not null references public.users(id) on delete cascade,
  code                text not null unique,
  expires_at          timestamptz not null default (now() + interval '24 hours'),
  accepted_at         timestamptz
);

-- pairs
create table public.pairs (
  id                  uuid primary key default gen_random_uuid(),
  user_1_id           uuid not null references public.users(id) on delete cascade,
  user_2_id           uuid not null references public.users(id) on delete cascade,
  next_turn_user_id   uuid not null references public.users(id),
  created_at          timestamptz not null default now(),
  constraint unique_pair unique (user_1_id, user_2_id),
  constraint different_users check (user_1_id <> user_2_id)
);

-- crozync_sessions
create table public.crozync_sessions (
  id                    uuid primary key default gen_random_uuid(),
  pair_id               uuid not null references public.pairs(id) on delete cascade,
  requested_by_user_id  uuid not null references public.users(id),
  status                crozync_status not null default 'pending',
  requested_at          timestamptz not null default now(),
  expires_at            timestamptz not null default (now() + interval '3 minutes'),
  completed_at          timestamptz
);

-- stickers
create table public.stickers (
  id                  uuid primary key default gen_random_uuid(),
  pair_id             uuid not null references public.pairs(id) on delete cascade,
  user_id             uuid not null references public.users(id),
  image_url           text not null,
  is_crozync          boolean not null default false,
  crozync_session_id  uuid references public.crozync_sessions(id),
  deleted_at          timestamptz,
  created_at          timestamptz not null default now()
);

-- hearts
create table public.hearts (
  id            uuid primary key default gen_random_uuid(),
  from_user_id  uuid not null references public.users(id) on delete cascade,
  to_user_id    uuid not null references public.users(id) on delete cascade,
  type          heart_type not null,
  sent_at       timestamptz not null default now(),
  constraint once_per_day unique (from_user_id, type, (sent_at::date))
);

-- ============================================
-- INDEXES
-- ============================================
create index on public.stickers (pair_id, created_at desc) where deleted_at is null;
create index on public.crozync_sessions (pair_id, status);
create index on public.pair_invites (code) where accepted_at is null;
create index on public.hearts (to_user_id, sent_at desc);

-- ============================================
-- RLS (Row Level Security)
-- ============================================
alter table public.users enable row level security;
alter table public.pair_invites enable row level security;
alter table public.pairs enable row level security;
alter table public.crozync_sessions enable row level security;
alter table public.stickers enable row level security;
alter table public.hearts enable row level security;

-- users: 自分のレコードのみ読み書き可能
create policy "users: read own" on public.users
  for select using (auth.uid() = id);
create policy "users: update own" on public.users
  for update using (auth.uid() = id);

-- pair_invites: 自分が作ったもの + codeで取得可能
create policy "pair_invites: read by code" on public.pair_invites
  for select using (true);
create policy "pair_invites: insert own" on public.pair_invites
  for insert with check (auth.uid() = created_by_user_id);

-- pairs: 自分が属するペアのみ
create policy "pairs: read own" on public.pairs
  for select using (auth.uid() = user_1_id or auth.uid() = user_2_id);

-- stickers: 自分のペアのもののみ
create policy "stickers: read pair" on public.stickers
  for select using (
    exists (
      select 1 from public.pairs
      where id = stickers.pair_id
      and (user_1_id = auth.uid() or user_2_id = auth.uid())
    )
  );
create policy "stickers: insert own" on public.stickers
  for insert with check (auth.uid() = user_id);
create policy "stickers: soft delete own" on public.stickers
  for update using (auth.uid() = user_id);

-- crozync_sessions: 自分のペアのもののみ
create policy "crozync_sessions: read pair" on public.crozync_sessions
  for select using (
    exists (
      select 1 from public.pairs
      where id = crozync_sessions.pair_id
      and (user_1_id = auth.uid() or user_2_id = auth.uid())
    )
  );
create policy "crozync_sessions: insert own" on public.crozync_sessions
  for insert with check (auth.uid() = requested_by_user_id);

-- hearts: 自分が送受信したもの
create policy "hearts: read own" on public.hearts
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy "hearts: insert own" on public.hearts
  for insert with check (auth.uid() = from_user_id);

-- ============================================
-- TRIGGER: auth.users 作成時に public.users を自動作成
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'User'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
