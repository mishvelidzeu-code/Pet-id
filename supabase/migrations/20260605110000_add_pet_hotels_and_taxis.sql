create table if not exists public.pet_hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text,
  description text,
  image_url text,
  lat double precision,
  lng double precision,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.pet_taxis (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  description text,
  image_url text,
  lat double precision,
  lng double precision,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.pet_hotels enable row level security;
alter table public.pet_taxis enable row level security;

drop policy if exists "Pet hotels public read" on public.pet_hotels;
drop policy if exists "Admins manage pet hotels" on public.pet_hotels;
drop policy if exists "Pet taxis public read" on public.pet_taxis;
drop policy if exists "Admins manage pet taxis" on public.pet_taxis;

create policy "Pet hotels public read"
on public.pet_hotels
for select
to public
using (coalesce(is_active, true) = true or public.is_admin_user());

create policy "Admins manage pet hotels"
on public.pet_hotels
for all
to public
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Pet taxis public read"
on public.pet_taxis
for select
to public
using (coalesce(is_active, true) = true or public.is_admin_user());

create policy "Admins manage pet taxis"
on public.pet_taxis
for all
to public
using (public.is_admin_user())
with check (public.is_admin_user());

insert into public.pet_hotels (name, address, phone, description, image_url, lat, lng, is_active)
values
  (
    'Pet Hotel Tbilisi',
    'თბილისი, ვაკე',
    '599111222',
    'სატესტო სასტუმრო ძაღლებისა და კატებისთვის, დღიური მოვლით.',
    'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/1.webp',
    41.7099,
    44.7567,
    true
  ),
  (
    'Happy Paws Hotel',
    'თბილისი, საბურთალო',
    '599333444',
    'სატესტო განთავსება, გასეირნება და კვების რეჟიმის დაცვა.',
    'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/4.webp',
    41.7275,
    44.7392,
    true
  )
on conflict do nothing;

insert into public.pet_taxis (name, address, phone, description, image_url, lat, lng, is_active)
values
  (
    'Pet Taxi Tbilisi',
    'თბილისი',
    '599555666',
    'სატესტო ცხოველების ტაქსი კლინიკაში, სასტუმროში ან სახლში გადასაყვანად.',
    'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/2.webp',
    41.7151,
    44.8271,
    true
  ),
  (
    'Zoo Ride',
    'თბილისი, გლდანი',
    '599777888',
    'სატესტო ტრანსპორტირება მცირე და საშუალო ზომის ცხოველებისთვის.',
    'https://qclzhlftlkjhgmuqrawk.supabase.co/storage/v1/object/public/pet_photos/pets/dogs/3.webp',
    41.7904,
    44.8174,
    true
  )
on conflict do nothing;
