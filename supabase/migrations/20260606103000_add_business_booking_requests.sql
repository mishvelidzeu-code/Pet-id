create table if not exists public.business_booking_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  requester_id uuid references auth.users(id) on delete set null,
  requester_name text not null,
  phone text not null,
  note text,
  status text not null default 'new',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint business_booking_requests_status_check check (status in ('new', 'confirmed', 'done', 'cancelled'))
);

create index if not exists business_booking_requests_business_id_idx
on public.business_booking_requests(business_id);

create index if not exists business_booking_requests_requester_id_idx
on public.business_booking_requests(requester_id);

drop trigger if exists business_booking_requests_touch_updated_at
on public.business_booking_requests;

create trigger business_booking_requests_touch_updated_at
before update on public.business_booking_requests
for each row execute function public.touch_updated_at();

alter table public.business_booking_requests enable row level security;

drop policy if exists "Anyone can create business booking requests"
on public.business_booking_requests;
drop policy if exists "Partners view own booking requests"
on public.business_booking_requests;
drop policy if exists "Partners update own booking requests"
on public.business_booking_requests;
drop policy if exists "Admins manage all booking requests"
on public.business_booking_requests;

create policy "Anyone can create business booking requests"
on public.business_booking_requests
for insert
to public
with check (
  exists (
    select 1
    from public.business_profiles bp
    where bp.id = business_booking_requests.business_id
      and bp.is_active = true
      and bp.is_approved = true
  )
);

create policy "Partners view own booking requests"
on public.business_booking_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.business_profiles bp
    where bp.id = business_booking_requests.business_id
      and bp.owner_id = auth.uid()
  )
  or public.is_admin_user()
);

create policy "Partners update own booking requests"
on public.business_booking_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.business_profiles bp
    where bp.id = business_booking_requests.business_id
      and bp.owner_id = auth.uid()
  )
  or public.is_admin_user()
)
with check (
  exists (
    select 1
    from public.business_profiles bp
    where bp.id = business_booking_requests.business_id
      and bp.owner_id = auth.uid()
  )
  or public.is_admin_user()
);

create policy "Admins manage all booking requests"
on public.business_booking_requests
for all
to public
using (public.is_admin_user())
with check (public.is_admin_user());
