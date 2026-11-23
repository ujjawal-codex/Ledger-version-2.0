-- SpiceLedger schema. Run in Supabase SQL Editor.
-- IMPORTANT: enable RLS. Never expose the service_role key in the browser.

create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_name text,
  mobile text,
  address text,
  gst_number text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_rate numeric(12,2) not null check (default_rate >= 0),
  default_unit text not null default 'kg' check (default_unit in ('kg','g')),
  created_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  bill_date date not null default current_date,
  total_amount numeric(14,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null check (unit in ('kg','g')),
  rate_per_kg numeric(12,2) not null check (rate_per_kg >= 0),
  line_total numeric(14,2) not null check (line_total >= 0)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  payment_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  mode text not null default 'Cash',
  note text,
  created_at timestamptz not null default now()
);

-- Single-admin access: only authenticated account(s) explicitly allowlisted here.
create table if not exists public.admin_allowlist (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;
alter table public.payments enable row level security;
alter table public.admin_allowlist enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_allowlist a
    where a.user_id = auth.uid()
  );
$$;

create policy "admin only customers" on public.customers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin only products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin only bills" on public.bills for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin only bill items" on public.bill_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin only payments" on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- No public policies are created. Keep admin_allowlist changes restricted to project owner
-- through the Supabase dashboard. Add your own auth user UUID to admin_allowlist after signup.
