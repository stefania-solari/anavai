create extension if not exists "pgcrypto";

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null,
  submitted_at timestamptz,
  email text not null,
  full_name text,
  phone text,
  location text,
  country text,
  client_type text,
  sample_requested text,
  budget text,
  message text,
  status text not null default 'new',
  currency text default 'EUR',
  cart_total numeric(12,2) default 0,
  cart_items jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb
);

alter table public.enquiries add column if not exists location text;
alter table public.enquiries add column if not exists status text not null default 'new';

create index if not exists enquiries_created_at_idx on public.enquiries (created_at desc);
create index if not exists enquiries_email_idx on public.enquiries (email);
create index if not exists enquiries_source_idx on public.enquiries (source);
create index if not exists enquiries_status_idx on public.enquiries (status);

-- Optional: restrict table access to service role only.
alter table public.enquiries enable row level security;

drop policy if exists "No direct public read" on public.enquiries;
create policy "No direct public read" on public.enquiries
  for select
  to anon, authenticated
  using (false);

drop policy if exists "Allow insert from API" on public.enquiries;
create policy "Allow insert from API" on public.enquiries
  for insert
  to anon, authenticated
  with check (
    email is not null
    and length(email) > 3
    and source is not null
    and length(source) > 0
  );

drop policy if exists "Allow read for authenticated" on public.enquiries;
create policy "Allow read for authenticated" on public.enquiries
  for select
  to authenticated
  using (true);

drop policy if exists "Allow update for authenticated" on public.enquiries;
create policy "Allow update for authenticated" on public.enquiries
  for update
  to authenticated
  using (true)
  with check (true);
