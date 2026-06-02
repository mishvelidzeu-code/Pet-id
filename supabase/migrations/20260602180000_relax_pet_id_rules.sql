drop index if exists public.pets_short_code_unique_idx;

create unique index pets_short_code_unique_idx
on public.pets (lower(btrim(short_code)))
where short_code is not null;

create or replace function public.is_pet_code_available(
  pet_code text,
  current_pet_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.pets
    where lower(btrim(short_code)) = lower(btrim(coalesce(pet_code, '')))
      and (current_pet_id is null or id <> current_pet_id)
  );
$$;

revoke all on function public.is_pet_code_available(text, uuid) from public;
grant execute on function public.is_pet_code_available(text, uuid) to authenticated;

drop function if exists public.find_public_lost_pet_by_code(text);

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
    and lower(btrim(pets.short_code)) = lower(btrim(coalesce(pet_code, '')))
  limit 1;
$$;

revoke all on function public.find_public_lost_pet_by_code(text) from public;
grant execute on function public.find_public_lost_pet_by_code(text) to anon, authenticated;
