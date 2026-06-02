create extension if not exists pgcrypto;

alter table public.profiles
add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and coalesce(is_admin, false) = true
  )
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'geogeorgia150@gmail.com';
$$;

create table if not exists public.adoption_posts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  breed text,
  age_label text,
  sex text,
  location text not null,
  temperament text,
  description text,
  contact_name text,
  contact_phone text not null,
  image_url text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.adoption_posts enable row level security;

drop policy if exists "Adoption public read" on public.adoption_posts;
drop policy if exists "Admins manage adoption posts" on public.adoption_posts;

create policy "Adoption public read"
on public.adoption_posts
for select
to public
using (coalesce(is_active, true) = true or public.is_admin_user());

create policy "Admins manage adoption posts"
on public.adoption_posts
for all
to public
using (public.is_admin_user())
with check (public.is_admin_user());

insert into public.adoption_posts (
  name,
  breed,
  age_label,
  sex,
  location,
  temperament,
  description,
  contact_name,
  contact_phone,
  image_url,
  is_featured,
  is_active
)
select *
from (
  values
    (
      'ლუნა',
      'მეტისი',
      '8 თვე',
      'მდედრი',
      'თბილისი, საბურთალო',
      'თბილი, ადამიანზე ორიენტირებული და სწრაფად ეჩვევა ოჯახურ გარემოს.',
      'ლუნა ქუჩიდან გადარჩენილი ლეკვია. აცრილია, ჯანმრთელია და ყველაზე მეტად მშვიდი სახლი სჭირდება, სადაც ყოველდღიური კონტაქტი და გასეირნება ექნება.',
      'ანა',
      '599123456',
      'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=900&q=80',
      true,
      true
    ),
    (
      'ბასტი',
      'ქუჩის კატა',
      '1 წელი',
      'მამრობითი',
      'ბათუმი',
      'წყნარი, სუფთა და ბინაში ცხოვრებასაც მარტივად ეგუება.',
      'ბასტი დროებით გადაყვანილია მზრუნველთან. უყვარს მშვიდი კუთხე, ადამიანთან ჩაწოლა და სტრესის გარეშე ცხოვრობს სხვა კატებთანაც.',
      'ნინო',
      '577100200',
      'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=900&q=80',
      false,
      true
    ),
    (
      'ტობი',
      'მეტისი',
      '2 წელი',
      'მამრობითი',
      'ქუთაისი',
      'აქტიური, მხიარული და ბავშვებთანაც კარგად ურთიერთობს.',
      'ტობი უკვე მიჩვეულია საყელოსა და საბაზისო ბრძანებებს. სჭირდება ოჯახი, რომელსაც ექნება დრო გასეირნებისთვის და მოთამაშე ოთხფეხა მეგობრისთვის.',
      'გიორგი',
      '555667788',
      'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=900&q=80',
      false,
      true
    )
) as seed(
  name,
  breed,
  age_label,
  sex,
  location,
  temperament,
  description,
  contact_name,
  contact_phone,
  image_url,
  is_featured,
  is_active
)
where not exists (
  select 1
  from public.adoption_posts existing
  where existing.name = seed.name
    and existing.contact_phone = seed.contact_phone
);
