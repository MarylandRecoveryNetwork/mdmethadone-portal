-- ═══════════════════════════════════════════════════════════════
-- MD METHADONE FINDER — Supabase schema
-- Run this whole file once in: Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- ── ENUMS ──────────────────────────────────────────────────────
do $$ begin
  create type user_role        as enum ('global_admin','regional_admin','clinic_manager','viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type region_type      as enum ('Central','Western','Capital','Southern','Eastern');
exception when duplicate_object then null; end $$;

do $$ begin
  create type accepting_status as enum ('accepting','waitlist','not_accepting');
exception when duplicate_object then null; end $$;

-- ── CLINICS ────────────────────────────────────────────────────
create table if not exists public.clinics (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  slug                 text unique,
  address              text,
  city                 text,
  county               text not null,
  region               region_type not null default 'Central',
  zip                  text,
  lat                  double precision,
  lng                  double precision,
  phone_number         text,
  website_url          text,
  intake_email         text,
  hours                text,
  offers_methadone     boolean not null default true,
  offers_buprenorphine boolean not null default false,
  offers_naltrexone    boolean not null default false,
  accepts_medicaid     boolean not null default false,
  accepts_medicare     boolean not null default false,
  accepts_private      boolean not null default false,
  sliding_scale        boolean not null default false,
  uninsured_ok         boolean not null default false,
  telehealth           boolean not null default false,
  description          text,
  is_active            boolean not null default true,
  is_verified          boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_clinics_county on public.clinics(county);
create index if not exists idx_clinics_slug   on public.clinics(slug);

-- ── CLINIC STATUS (one row per clinic) ─────────────────────────
create table if not exists public.clinic_status (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null unique references public.clinics(id) on delete cascade,
  accepting_status accepting_status not null default 'accepting',
  waitlist_note    text,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id),
  next_update_due  timestamptz
);
create index if not exists idx_status_clinic on public.clinic_status(clinic_id);

-- ── PROFILES (extends auth.users) ──────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  phone         text,
  role          user_role not null default 'viewer',
  clinic_id     uuid references public.clinics(id),
  is_active     boolean not null default false,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── AUDIT LOG ──────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid,
  user_email   text,
  user_role    user_role,
  ip_address   text,
  user_agent   text,
  action       text not null,
  clinic_id    uuid,
  before_state jsonb,
  after_state  jsonb,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_audit_created on public.audit_logs(created_at desc);

-- ── keep updated_at fresh ──────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_clinics_touch on public.clinics;
create trigger trg_clinics_touch before update on public.clinics
  for each row execute function public.touch_updated_at();

-- ── auto-create a status row when a clinic is added ────────────
create or replace function public.seed_clinic_status()
returns trigger language plpgsql as $$
begin
  insert into public.clinic_status(clinic_id, accepting_status)
  values (new.id, 'accepting')
  on conflict (clinic_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_seed_status on public.clinics;
create trigger trg_seed_status after insert on public.clinics
  for each row execute function public.seed_clinic_status();

-- ═══════════════════════════════════════════════════════════════
-- PUBLIC VIEW — what the website reads (joins clinic + live status)
-- Freshness windows are in DAYS (intake status changes slowly).
-- ═══════════════════════════════════════════════════════════════
create or replace view public.v_methadone_live_status as
select
  c.id, c.name, c.slug, c.address, c.city, c.county, c.region, c.zip,
  c.lat, c.lng, c.phone_number, c.website_url, c.intake_email, c.hours,
  c.offers_methadone, c.offers_buprenorphine, c.offers_naltrexone,
  c.accepts_medicaid, c.accepts_medicare, c.accepts_private,
  c.sliding_scale, c.uninsured_ok, c.telehealth,
  coalesce(s.accepting_status, 'accepting') as accepting_status,
  s.waitlist_note,
  s.updated_at as status_updated_at,
  case
    when s.updated_at is null                          then 'stale'
    when s.updated_at > now() - interval '7 days'      then 'live'
    when s.updated_at > now() - interval '30 days'     then 'warning'
    else 'stale'
  end as freshness_status
from public.clinics c
left join public.clinic_status s on s.clinic_id = c.id
where c.is_active = true;

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════
alter table public.clinics       enable row level security;
alter table public.clinic_status enable row level security;
alter table public.profiles      enable row level security;
alter table public.audit_logs    enable row level security;

-- helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role in ('global_admin','regional_admin') and is_active
  );
$$;

-- helper: which clinic does the current user manage?
create or replace function public.my_clinic()
returns uuid language sql security definer stable as $$
  select clinic_id from public.profiles where id = auth.uid();
$$;

-- CLINICS: anyone can read active clinics; admins manage; managers edit their own.
drop policy if exists clinics_read   on public.clinics;
drop policy if exists clinics_admin  on public.clinics;
drop policy if exists clinics_mgr    on public.clinics;
create policy clinics_read  on public.clinics for select using (is_active = true or public.is_admin());
create policy clinics_admin on public.clinics for all    using (public.is_admin()) with check (public.is_admin());
create policy clinics_mgr   on public.clinics for update using (id = public.my_clinic()) with check (id = public.my_clinic());

-- CLINIC STATUS: public read; admins manage; managers upsert their own clinic's row.
drop policy if exists status_read  on public.clinic_status;
drop policy if exists status_admin on public.clinic_status;
drop policy if exists status_mgr_u on public.clinic_status;
drop policy if exists status_mgr_i on public.clinic_status;
create policy status_read  on public.clinic_status for select using (true);
create policy status_admin on public.clinic_status for all    using (public.is_admin()) with check (public.is_admin());
create policy status_mgr_u on public.clinic_status for update using (clinic_id = public.my_clinic()) with check (clinic_id = public.my_clinic());
create policy status_mgr_i on public.clinic_status for insert with check (clinic_id = public.my_clinic());

-- PROFILES: a user can read/update their own profile; admins can read all.
drop policy if exists profiles_self      on public.profiles;
drop policy if exists profiles_self_upd  on public.profiles;
drop policy if exists profiles_admin     on public.profiles;
create policy profiles_self     on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_upd on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin    on public.profiles for all    using (public.is_admin()) with check (public.is_admin());

-- AUDIT LOGS: only admins can read; inserts come from the service role (server) which bypasses RLS.
drop policy if exists audit_admin_read on public.audit_logs;
create policy audit_admin_read on public.audit_logs for select using (public.is_admin());

-- grant read on the view to anonymous + authenticated visitors
grant select on public.v_methadone_live_status to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Next:
--   1. Import your clinics (Table Editor → clinics → Insert, or CSV import).
--      A status row is created automatically for each clinic.
--   2. Create your admin account (see SETUP.md, "Create your admin user").
-- ═══════════════════════════════════════════════════════════════
