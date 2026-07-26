-- Tether Health schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Assumes Supabase Auth is enabled (auth.users already exists).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user, personal info collected at onboarding
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    full_name text not null,
    age integer,
    phone text,
    preferred_language text not null default 'en',
    accountability_partner_name text,
    accountability_partner_relationship text,
    onboarding_completed boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- medications: user-defined meds with a schedule
-- ---------------------------------------------------------------------------
create table if not exists public.medications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    dosage text,
    instructions text,
    frequency_per_day integer not null default 1,
    -- times of day the medication is scheduled, e.g. ['08:00', '20:00']
    scheduled_times text[] not null default '{}',
    -- days of week it's taken; null/empty means every day. 0=Sunday .. 6=Saturday
    days_of_week integer[] default '{}',
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists medications_user_id_idx on public.medications (user_id);

-- ---------------------------------------------------------------------------
-- medication_logs: adherence history - one row per scheduled dose
-- ---------------------------------------------------------------------------
create type public.medication_log_status as enum ('taken', 'missed', 'snoozed', 'pending');

create table if not exists public.medication_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    medication_id uuid not null references public.medications (id) on delete cascade,
    scheduled_for timestamptz not null,
    status public.medication_log_status not null default 'pending',
    responded_at timestamptz,
    snoozed_until timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists medication_logs_user_id_idx on public.medication_logs (user_id);
create index if not exists medication_logs_medication_id_idx on public.medication_logs (medication_id);
create index if not exists medication_logs_scheduled_for_idx on public.medication_logs (scheduled_for);

-- ---------------------------------------------------------------------------
-- calls: LiveKit voice call sessions tied to a reminder
-- ---------------------------------------------------------------------------
create type public.call_status as enum ('created', 'ringing', 'in_progress', 'completed', 'missed', 'failed');

create table if not exists public.calls (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    medication_id uuid references public.medications (id) on delete set null,
    medication_log_id uuid references public.medication_logs (id) on delete set null,
    room_name text not null unique,
    status public.call_status not null default 'created',
    started_at timestamptz,
    ended_at timestamptz,
    outcome text,
    created_at timestamptz not null default now()
);

create index if not exists calls_user_id_idx on public.calls (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: users can only touch their own rows.
-- Backend uses the Supabase service role key for scheduling/agent writes,
-- which bypasses RLS, so this only constrains direct client access.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.medications enable row level security;
alter table public.medication_logs enable row level security;
alter table public.calls enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

create policy "medications_all_own" on public.medications for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "medication_logs_all_own" on public.medication_logs for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "calls_all_own" on public.calls for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at before update on public.profiles
    for each row execute function public.set_updated_at();

create trigger medications_set_updated_at before update on public.medications
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Carer accounts: a carer manages medications for one or more cared-for
-- people, who still receive the actual calls but lose write access to their
-- own medications once linked. Linking happens via a short-lived invite code
-- generated by the cared-for.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists role text not null default 'independent';

create table if not exists public.carer_links (
    id uuid primary key default gen_random_uuid(),
    carer_id uuid not null references auth.users (id) on delete cascade,
    cared_for_id uuid not null references auth.users (id) on delete cascade unique,
    created_at timestamptz not null default now()
);

create index if not exists carer_links_carer_id_idx on public.carer_links (carer_id);

create table if not exists public.carer_invite_codes (
    code text primary key,
    cared_for_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    used_at timestamptz,
    used_by uuid references auth.users (id)
);

alter table public.carer_links enable row level security;
alter table public.carer_invite_codes enable row level security;

create policy "carer_links_select_own" on public.carer_links for select
    using (auth.uid() = carer_id or auth.uid() = cared_for_id);

create policy "carer_invite_codes_select_own" on public.carer_invite_codes for select
    using (auth.uid() = cared_for_id);
