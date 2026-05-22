-- Krok 3: Supabase schéma podľa vášho návrhu

create table public.users (
  id uuid primary key default gen_random_uuid(),
  meno text not null,
  email text unique not null,
  status_predplatneho text not null default 'free'
    check (status_predplatneho in ('free', 'premium', 'cancelled')),
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

create table public.daily_walks (
  id bigserial primary key,
  id_user uuid not null references public.users (id) on delete cascade,
  datum date not null,
  kilometre numeric(6, 2) not null default 0,
  splnene boolean not null default false,
  unique (id_user, datum)
);

create table public.tickets (
  id bigserial primary key,
  id_user uuid not null references public.users (id) on delete cascade,
  mesiac date not null, -- prvý deň mesiaca, napr. 2026-05-01
  pocet_listkov int not null default 0 check (pocet_listkov >= 0),
  unique (id_user, mesiac)
);

-- Indexy pre denné dotazy a žrebovanie
create index daily_walks_user_datum_idx on public.daily_walks (id_user, datum desc);
create index tickets_mesiac_idx on public.tickets (mesiac);

-- RLS: zapnite v Supabase dashboarde; ukážka politiky pre vlastné dáta
alter table public.users enable row level security;
alter table public.daily_walks enable row level security;
alter table public.tickets enable row level security;

-- Po pripojení auth.uid():
-- create policy "users read own" on public.users for select using (auth.uid() = id);
