-- Supabase schema for duty-schedule-website
-- Run in Supabase SQL Editor once.

create table if not exists public.schedule_entries (
    id bigint generated always as identity primary key,
    date date not null,
    floor text not null check (floor in ('二层', '三层', '四层')),
    slot smallint not null check (slot in (1, 2)),
    time text not null,
    name text not null,
    updated_at timestamptz not null default now(),
    unique (date, floor, slot)
);

create table if not exists public.change_logs (
    id bigint generated always as identity primary key,
    type text not null check (type in ('swap', 'move', 'edit')),
    "timestamp" timestamptz not null default now(),
    source jsonb not null,
    target jsonb not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_schedule_entries_date on public.schedule_entries (date);
create index if not exists idx_change_logs_timestamp on public.change_logs ("timestamp" desc);

alter table public.schedule_entries enable row level security;
alter table public.change_logs enable row level security;

drop policy if exists "schedule_entries_anon_all" on public.schedule_entries;
create policy "schedule_entries_anon_all"
on public.schedule_entries
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "change_logs_anon_all" on public.change_logs;
create policy "change_logs_anon_all"
on public.change_logs
for all
to anon, authenticated
using (true)
with check (true);
