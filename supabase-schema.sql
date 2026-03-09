-- ================================================
-- EKONOMI-APP — Supabase Schema
-- Kör detta i: Supabase → SQL Editor → New Query
-- ================================================

-- Tabell för budgetdata (en rad per användare)
create table if not exists budget (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null default '{"income":[],"fixed":[],"variable":[],"periodic":[]}'::jsonb,
  updated_at timestamptz default now()
);

-- En användare = en rad
create unique index if not exists budget_user_id_idx on budget (user_id);

-- Row Level Security – endast inloggad ägare får se/ändra sin data
alter table budget enable row level security;

create policy "Egna data"
  on budget for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ================================================
-- VIKTIGT – Stäng av public signup
-- (Eftersom bara du ska kunna logga in)
--
-- Gå till: Authentication → Settings → Email Auth
-- Stäng AV "Enable Signups"
--
-- Skapa ditt konto manuellt under:
-- Authentication → Users → Add user
-- ================================================
