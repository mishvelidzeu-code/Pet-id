create table if not exists public.lost_pet_alert_requests (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint lost_pet_alert_requests_status_check
    check (status in ('pending', 'approved', 'cancelled'))
);

create unique index if not exists lost_pet_alert_requests_one_pending_per_pet_idx
on public.lost_pet_alert_requests (pet_id)
where status = 'pending';

alter table public.lost_pet_alert_requests enable row level security;

drop policy if exists "Owners and admins read lost pet alerts" on public.lost_pet_alert_requests;

create policy "Owners and admins read lost pet alerts"
on public.lost_pet_alert_requests
for select
to authenticated
using (requested_by = auth.uid() or public.is_admin_user());
