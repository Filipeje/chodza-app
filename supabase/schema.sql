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

-- Admin: nastavenia mesiaca (fond výhier, obtiažnosť bodu)
create table public.monthly_settings (
  mesiac date primary key, -- prvý deň mesiaca
  fond_eur numeric(10, 2) not null default 0,
  goal_type text not null default 'walk_km'
    check (goal_type in ('walk_km')),
  goal_km_per_point numeric(5, 2) not null default 10,
  max_points_per_day int not null default 3 check (max_points_per_day between 1 and 10),
  updated_at timestamptz not null default now()
);

-- Admin: história výhier (pre filter pri žrebovaní)
create table public.win_history (
  id bigserial primary key,
  id_user uuid not null references public.users (id) on delete cascade,
  mesiac date not null,
  miesto int not null check (miesto >= 1),
  typ text not null check (typ in ('main', 'small')),
  suma_eur numeric(10, 2),
  created_at timestamptz not null default now()
);

create index win_history_user_idx on public.win_history (id_user, mesiac desc);

-- Celkové body (level) – mimo mesačného koša
alter table public.users add column if not exists celkove_body int not null default 0;

-- Mesačné body v tickets už reprezentujú koš; po uzatvorení mesiaca reset na 0
