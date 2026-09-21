-- Dapur AI — Supabase schema (Opsi B, gratis, tanpa kartu)
-- Cara pakai: Supabase Dashboard > SQL Editor > New query > paste seluruh file ini > Run.
-- Model: offline-first. IndexedDB lokal tetap utama; cloud hanya cermin sinkronisasi.
-- Tabel generik: satu baris per entity, kolom data JSONB + updated_at untuk last-write-wins.
-- RLS dinyalakan dengan policy permisif untuk anon key single-user.
-- Kalau nanti mau multi-user/auth, ganti policy dengan auth.uid() = user_id.

create table if not exists public.recipes (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_items (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_transactions (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.recipes enable row level security;
alter table public.stock_items enable row level security;
alter table public.shopping_items enable row level security;
alter table public.usage_transactions enable row level security;

-- Kebijakan single-user: izinkan anon read/write. Aman untuk pemakaian pribadi
-- selama anon key tidak disebar. Untuk produksi multi-user, ganti dengan
-- kebijakan berbasis auth.uid().
drop policy if exists "anon all recipes" on public.recipes;
create policy "anon all recipes" on public.recipes for all to anon using (true) with check (true);

drop policy if exists "anon all stock" on public.stock_items;
create policy "anon all stock" on public.stock_items for all to anon using (true) with check (true);

drop policy if exists "anon all shopping" on public.shopping_items;
create policy "anon all shopping" on public.shopping_items for all to anon using (true) with check (true);

drop policy if exists "anon all usage" on public.usage_transactions;
create policy "anon all usage" on public.usage_transactions for all to anon using (true) with check (true);
