create unique index if not exists pets_short_code_unique_idx
on public.pets (short_code)
where short_code is not null;

alter table public.pets enable row level security;
alter table public.medical_records enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pets'
  loop
    execute format('drop policy if exists %I on public.pets', policy_row.policyname);
  end loop;

  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'medical_records'
  loop
    execute format('drop policy if exists %I on public.medical_records', policy_row.policyname);
  end loop;
end
$$;

create policy "Owners and admins read pets"
on public.pets
for select
to authenticated
using (owner_id = auth.uid() or public.is_admin_user());

create policy "Owners and admins create pets"
on public.pets
for insert
to authenticated
with check (owner_id = auth.uid() or public.is_admin_user());

create policy "Owners and admins update pets"
on public.pets
for update
to authenticated
using (owner_id = auth.uid() or public.is_admin_user())
with check (owner_id = auth.uid() or public.is_admin_user());

create policy "Owners and admins delete pets"
on public.pets
for delete
to authenticated
using (owner_id = auth.uid() or public.is_admin_user());

create policy "Owners and admins read medical records"
on public.medical_records
for select
to authenticated
using (
  exists (
    select 1
    from public.pets
    where pets.id = medical_records.pet_id
      and (pets.owner_id = auth.uid() or public.is_admin_user())
  )
);

create policy "Owners and admins create medical records"
on public.medical_records
for insert
to authenticated
with check (
  exists (
    select 1
    from public.pets
    where pets.id = medical_records.pet_id
      and (pets.owner_id = auth.uid() or public.is_admin_user())
  )
);

create policy "Owners and admins update medical records"
on public.medical_records
for update
to authenticated
using (
  exists (
    select 1
    from public.pets
    where pets.id = medical_records.pet_id
      and (pets.owner_id = auth.uid() or public.is_admin_user())
  )
)
with check (
  exists (
    select 1
    from public.pets
    where pets.id = medical_records.pet_id
      and (pets.owner_id = auth.uid() or public.is_admin_user())
  )
);

create policy "Owners and admins delete medical records"
on public.medical_records
for delete
to authenticated
using (
  exists (
    select 1
    from public.pets
    where pets.id = medical_records.pet_id
      and (pets.owner_id = auth.uid() or public.is_admin_user())
  )
);

create or replace function public.list_public_lost_pets()
returns table (
  id uuid,
  name text,
  breed text,
  photo_url text,
  is_lost boolean,
  short_code text,
  color text,
  weight text,
  location text,
  sex text,
  description text,
  created_at timestamptz,
  owner_full_name text,
  owner_phone_number text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pets.id,
    pets.name,
    pets.breed,
    pets.photo_url,
    pets.is_lost,
    pets.short_code,
    pets.color,
    pets.weight,
    pets.location,
    pets.sex,
    pets.description,
    pets.created_at,
    profiles.full_name,
    profiles.phone_number
  from public.pets
  left join public.profiles on profiles.id = pets.owner_id
  where pets.is_lost = true
  order by pets.created_at desc;
$$;

create or replace function public.find_public_lost_pet_by_code(pet_code text)
returns table (
  id uuid,
  name text,
  breed text,
  photo_url text,
  is_lost boolean,
  short_code text,
  color text,
  weight text,
  location text,
  sex text,
  description text,
  created_at timestamptz,
  owner_full_name text,
  owner_phone_number text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pets.id,
    pets.name,
    pets.breed,
    pets.photo_url,
    pets.is_lost,
    pets.short_code,
    pets.color,
    pets.weight,
    pets.location,
    pets.sex,
    pets.description,
    pets.created_at,
    profiles.full_name,
    profiles.phone_number
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
