-- Fix: infinite recursion in policy for relation "bookings"
-- Root cause: bookings SELECT policy references booking_items, whose SELECT policy references bookings → cycle
-- Fix: replace inline booking_items subquery in bookings SELECT policy with a SECURITY DEFINER helper
--       that queries booking_items + provider_profiles with the function owner's privileges (bypasses RLS)

-- Step 1: Create a narrowly scoped SECURITY DEFINER helper
-- Checks whether the specified user owns a provider profile linked through booking_items to the specified booking.
-- The policy always passes auth.uid() as _user_id; the function does not trust caller-supplied IDs.
create or replace function public.is_booking_provider(_booking_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.booking_items bi
    join public.provider_profiles p on p.id = bi.provider_id
    where bi.booking_id = _booking_id
      and p.user_id = _user_id
  );
$$;

-- Step 2: Revoke default execution from PUBLIC and anon; grant only to authenticated
revoke execute on function public.is_booking_provider(uuid, uuid) from public, anon;
grant execute on function public.is_booking_provider(uuid, uuid) to authenticated;

-- Step 3: Replace only the bookings SELECT policy
drop policy if exists "tourist bookings" on public.bookings;

create policy "tourist bookings" on public.bookings
  for select to authenticated
  using (
    tourist_id = auth.uid()
    or public.has_role(auth.uid(), 'admin'::app_role)
    or public.is_booking_provider(id, auth.uid())
  );
