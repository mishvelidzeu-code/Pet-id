insert into public.profiles (id, full_name, phone_number)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
  coalesce(u.phone, u.raw_user_meta_data ->> 'phone_number', '')
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
);
