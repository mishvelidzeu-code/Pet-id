alter table public.pets
add column if not exists size text;

drop function if exists public.list_public_lost_pets();
drop function if exists public.find_public_lost_pet_by_code(text);

create function public.list_public_lost_pets()
returns table (
  id uuid, name text, breed text, photo_url text, is_lost boolean,
  short_code text, color text, size text, weight text, location text,
  sex text, description text, created_at timestamptz,
  owner_full_name text, owner_phone_number text
)
language sql stable security definer set search_path = public
as $$
  select
    pets.id, pets.name, pets.breed, pets.photo_url, pets.is_lost,
    pets.short_code, pets.color, pets.size, pets.weight, pets.location,
    pets.sex, pets.description, pets.created_at,
    profiles.full_name, profiles.phone_number
  from public.pets
  left join public.profiles on profiles.id = pets.owner_id
  where pets.is_lost = true
  order by pets.created_at desc;
$$;

create function public.find_public_lost_pet_by_code(pet_code text)
returns table (
  id uuid, name text, breed text, photo_url text, is_lost boolean,
  short_code text, color text, size text, weight text, location text,
  sex text, description text, created_at timestamptz,
  owner_full_name text, owner_phone_number text
)
language sql stable security definer set search_path = public
as $$
  select
    pets.id, pets.name, pets.breed, pets.photo_url, pets.is_lost,
    pets.short_code, pets.color, pets.size, pets.weight, pets.location,
    pets.sex, pets.description, pets.created_at,
    profiles.full_name, profiles.phone_number
  from public.pets
  left join public.profiles on profiles.id = pets.owner_id
  where pets.is_lost = true
    and pets.short_code = upper(regexp_replace(coalesce(pet_code, ''), '[^a-zA-Z0-9]', '', 'g'))
  limit 1;
$$;

revoke all on function public.list_public_lost_pets() from public;
revoke all on function public.find_public_lost_pet_by_code(text) from public;
grant execute on function public.list_public_lost_pets() to anon, authenticated;
grant execute on function public.find_public_lost_pet_by_code(text) to anon, authenticated;
