create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  price_value numeric(10, 2),
  currency text not null default 'GEL',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint shop_products_currency_check check (currency in ('GEL', 'USD'))
);

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.shop_products(id) on delete set null,
  buyer_id uuid references auth.users(id) on delete set null,
  buyer_name text not null,
  phone text not null,
  quantity integer not null default 1,
  note text,
  status text not null default 'new',
  product_title text,
  product_price numeric(10, 2),
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint shop_orders_quantity_check check (quantity >= 1),
  constraint shop_orders_status_check check (status in ('new', 'confirmed', 'done', 'cancelled'))
);

alter table public.shop_products enable row level security;
alter table public.shop_orders enable row level security;

drop policy if exists "Shop products public read" on public.shop_products;
drop policy if exists "Admins manage shop products" on public.shop_products;
drop policy if exists "Authenticated users can create shop orders" on public.shop_orders;
drop policy if exists "Admins view shop orders" on public.shop_orders;
drop policy if exists "Admins update shop orders" on public.shop_orders;
drop policy if exists "Admins delete shop orders" on public.shop_orders;

create policy "Shop products public read"
on public.shop_products
for select
to public
using (coalesce(is_active, true) = true or public.is_admin_user());

create policy "Admins manage shop products"
on public.shop_products
for all
to public
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Authenticated users can create shop orders"
on public.shop_orders
for insert
to authenticated
with check (true);

create policy "Admins view shop orders"
on public.shop_orders
for select
to public
using (public.is_admin_user());

create policy "Admins update shop orders"
on public.shop_orders
for update
to public
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins delete shop orders"
on public.shop_orders
for delete
to public
using (public.is_admin_user());

-- სურვილის შემთხვევაში, Pet ID-სთვის უნიკალური ინდექსიც გაუშვი ცალკე:
-- create unique index if not exists pets_short_code_unique_idx
-- on public.pets (short_code)
-- where short_code is not null;
