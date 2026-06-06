create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  name text not null,
  address text,
  phone text,
  description text,
  image_url text,
  lat double precision,
  lng double precision,
  source_table text,
  source_id uuid,
  is_active boolean not null default true,
  is_approved boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint business_profiles_kind_check check (kind in ('shop', 'clinic', 'hotel', 'taxi', 'grooming'))
);

create table if not exists public.business_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  title text not null,
  description text,
  category text,
  price_value numeric(10, 2),
  currency text not null default 'GEL',
  duration_minutes integer,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint business_services_currency_check check (currency in ('GEL', 'USD')),
  constraint business_services_duration_check check (duration_minutes is null or duration_minutes > 0)
);

alter table public.shop_products
add column if not exists business_id uuid references public.business_profiles(id) on delete set null,
add column if not exists category text,
add column if not exists stock_quantity integer,
add column if not exists discount_price numeric(10, 2);

alter table public.shop_orders
add column if not exists business_id uuid references public.business_profiles(id) on delete set null;

create index if not exists business_profiles_owner_id_idx on public.business_profiles(owner_id);
create index if not exists business_profiles_kind_idx on public.business_profiles(kind);
create index if not exists business_services_business_id_idx on public.business_services(business_id);
create index if not exists shop_products_business_id_idx on public.shop_products(business_id);
create index if not exists shop_orders_business_id_idx on public.shop_orders(business_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists business_profiles_touch_updated_at on public.business_profiles;
create trigger business_profiles_touch_updated_at
before update on public.business_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists business_services_touch_updated_at on public.business_services;
create trigger business_services_touch_updated_at
before update on public.business_services
for each row execute function public.touch_updated_at();

create or replace function public.set_shop_order_business_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.business_id is null and new.product_id is not null then
    select business_id
    into new.business_id
    from public.shop_products
    where id = new.product_id;
  end if;

  return new;
end;
$$;

drop trigger if exists shop_orders_set_business_id on public.shop_orders;
create trigger shop_orders_set_business_id
before insert on public.shop_orders
for each row execute function public.set_shop_order_business_id();

alter table public.business_profiles enable row level security;
alter table public.business_services enable row level security;

drop policy if exists "Business profiles public read approved" on public.business_profiles;
drop policy if exists "Partners read own business profiles" on public.business_profiles;
drop policy if exists "Partners create own business profiles" on public.business_profiles;
drop policy if exists "Partners update own business profiles" on public.business_profiles;
drop policy if exists "Partners delete own business profiles" on public.business_profiles;
drop policy if exists "Admins manage all business profiles" on public.business_profiles;

create policy "Business profiles public read approved"
on public.business_profiles
for select
to public
using (is_active = true and is_approved = true);

create policy "Partners read own business profiles"
on public.business_profiles
for select
to authenticated
using (owner_id = auth.uid() or public.is_admin_user());

create policy "Partners create own business profiles"
on public.business_profiles
for insert
to authenticated
with check (owner_id = auth.uid() or public.is_admin_user());

create policy "Partners update own business profiles"
on public.business_profiles
for update
to authenticated
using (owner_id = auth.uid() or public.is_admin_user())
with check (owner_id = auth.uid() or public.is_admin_user());

create policy "Partners delete own business profiles"
on public.business_profiles
for delete
to authenticated
using (owner_id = auth.uid() or public.is_admin_user());

create policy "Admins manage all business profiles"
on public.business_profiles
for all
to public
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Business services public read active" on public.business_services;
drop policy if exists "Partners read own business services" on public.business_services;
drop policy if exists "Partners create own business services" on public.business_services;
drop policy if exists "Partners update own business services" on public.business_services;
drop policy if exists "Partners delete own business services" on public.business_services;
drop policy if exists "Admins manage all business services" on public.business_services;

create policy "Business services public read active"
on public.business_services
for select
to public
using (
  is_active = true
  and exists (
    select 1
    from public.business_profiles bp
    where bp.id = business_services.business_id
      and bp.is_active = true
      and bp.is_approved = true
  )
);

create policy "Partners read own business services"
on public.business_services
for select
to authenticated
using (
  exists (
    select 1
    from public.business_profiles bp
    where bp.id = business_services.business_id
      and (bp.owner_id = auth.uid() or public.is_admin_user())
  )
);

create policy "Partners create own business services"
on public.business_services
for insert
to authenticated
with check (
  exists (
    select 1
    from public.business_profiles bp
    where bp.id = business_services.business_id
      and (bp.owner_id = auth.uid() or public.is_admin_user())
  )
);

create policy "Partners update own business services"
on public.business_services
for update
to authenticated
using (
  exists (
    select 1
    from public.business_profiles bp
    where bp.id = business_services.business_id
      and (bp.owner_id = auth.uid() or public.is_admin_user())
  )
)
with check (
  exists (
    select 1
    from public.business_profiles bp
    where bp.id = business_services.business_id
      and (bp.owner_id = auth.uid() or public.is_admin_user())
  )
);

create policy "Partners delete own business services"
on public.business_services
for delete
to authenticated
using (
  exists (
    select 1
    from public.business_profiles bp
    where bp.id = business_services.business_id
      and (bp.owner_id = auth.uid() or public.is_admin_user())
  )
);

create policy "Admins manage all business services"
on public.business_services
for all
to public
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Partners manage own shop products" on public.shop_products;
create policy "Partners manage own shop products"
on public.shop_products
for all
to authenticated
using (
  exists (
    select 1
    from public.business_profiles bp
    where bp.id = shop_products.business_id
      and bp.kind = 'shop'
      and (bp.owner_id = auth.uid() or public.is_admin_user())
  )
)
with check (
  exists (
    select 1
    from public.business_profiles bp
    where bp.id = shop_products.business_id
      and bp.kind = 'shop'
      and (bp.owner_id = auth.uid() or public.is_admin_user())
  )
);

drop policy if exists "Partners view own shop orders" on public.shop_orders;
drop policy if exists "Partners update own shop orders" on public.shop_orders;

create policy "Partners view own shop orders"
on public.shop_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.business_profiles bp
    where bp.id = shop_orders.business_id
      and bp.owner_id = auth.uid()
  )
  or public.is_admin_user()
);

create policy "Partners update own shop orders"
on public.shop_orders
for update
to authenticated
using (
  exists (
    select 1
    from public.business_profiles bp
    where bp.id = shop_orders.business_id
      and bp.owner_id = auth.uid()
  )
  or public.is_admin_user()
)
with check (
  exists (
    select 1
    from public.business_profiles bp
    where bp.id = shop_orders.business_id
      and bp.owner_id = auth.uid()
  )
  or public.is_admin_user()
);

insert into storage.buckets (id, name, public)
values ('business-assets', 'business-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "Business assets public read" on storage.objects;
drop policy if exists "Partners upload own business assets" on storage.objects;
drop policy if exists "Partners update own business assets" on storage.objects;
drop policy if exists "Partners delete own business assets" on storage.objects;

create policy "Business assets public read"
on storage.objects
for select
to public
using (bucket_id = 'business-assets');

create policy "Partners upload own business assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Partners update own business assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'business-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Partners delete own business assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);
