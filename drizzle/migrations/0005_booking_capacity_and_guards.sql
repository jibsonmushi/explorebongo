create unique index if not exists availability_service_date_uq on public.availability(service_id, date);

create or replace function public.prepare_booking_item()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare s record; a record;
begin
  select id, provider_id, price, capacity, is_published into s from public.services where id = new.service_id;
  if s.id is null or not s.is_published then raise exception 'Service is not available'; end if;
  if new.quantity < 1 or new.quantity > 50 then raise exception 'Invalid quantity'; end if;
  if new.date is null or new.date < current_date then raise exception 'Please choose a future date'; end if;
  new.provider_id := s.provider_id;
  new.unit_price := s.price;
  new.status := 'requested';
  -- atomic capacity reservation (row lock prevents overbooking)
  select * into a from public.availability where service_id = s.id and date = new.date for update;
  if a.id is null and s.capacity is not null then
    insert into public.availability(service_id, date, capacity, booked) values (s.id, new.date, s.capacity, 0)
      on conflict (service_id, date) do nothing;
    select * into a from public.availability where service_id = s.id and date = new.date for update;
  end if;
  if a.id is not null then
    if a.booked + new.quantity > a.capacity then
      raise exception 'Not enough spots left for % on % (% remaining)', (select title from public.services where id=s.id), new.date, greatest(a.capacity - a.booked, 0);
    end if;
    update public.availability set booked = booked + new.quantity where id = a.id;
  end if;
  return new;
end $$;

create or replace function public.after_booking_item()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform set_config('eb.internal','1',true);
  update public.bookings set total_amount = total_amount + new.unit_price * new.quantity, status = 'requested' where id = new.booking_id;
  perform set_config('eb.internal','0',true);
  insert into public.commissions(booking_item_id, rate, amount) values (new.id, 0.10, round(new.unit_price * new.quantity * 0.10, 2));
  insert into public.notifications(user_id, title, body)
    select p.user_id, 'New booking request', 'You have a new booking request for '||new.date||'.' from public.provider_profiles p where p.id = new.provider_id;
  return new;
end $$;

create or replace function public.rollup_booking_status()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare total int; pending int; cancelled int; done int; t uuid;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.date is not null then
    update public.availability set booked = greatest(booked - new.quantity, 0) where service_id = new.service_id and date = new.date;
  end if;
  select count(*), count(*) filter (where status='requested'), count(*) filter (where status='cancelled'), count(*) filter (where status='completed')
    into total, pending, cancelled, done from public.booking_items where booking_id = new.booking_id;
  perform set_config('eb.internal','1',true);
  if cancelled = total then update public.bookings set status='cancelled' where id=new.booking_id;
  elsif pending = 0 and done = total - cancelled then update public.bookings set status='completed' where id=new.booking_id;
  elsif pending = 0 then update public.bookings set status='confirmed' where id=new.booking_id;
  else update public.bookings set status='requested' where id=new.booking_id; end if;
  perform set_config('eb.internal','0',true);
  select tourist_id into t from public.bookings where id=new.booking_id;
  if new.status is distinct from old.status and t is distinct from auth.uid() then
    insert into public.notifications(user_id,title,body) values (t, 'Booking update', 'A provider marked part of your trip as '||new.status||'.');
  end if;
  return new;
end $$;

create or replace function public.guard_booking_item_update()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.has_role(auth.uid(),'admin') and coalesce(current_setting('eb.internal',true),'0') <> '1' then
    new.unit_price := old.unit_price; new.quantity := old.quantity; new.service_id := old.service_id;
    new.provider_id := old.provider_id; new.booking_id := old.booking_id; new.date := old.date;
    if old.status in ('cancelled','completed') and new.status is distinct from old.status then raise exception 'This booking item is closed'; end if;
    if new.status = 'confirmed' and old.status <> 'requested' then raise exception 'Only requested items can be accepted'; end if;
    if new.status = 'completed' and old.status <> 'confirmed' then raise exception 'Only confirmed items can be completed'; end if;
    if new.status not in ('requested','confirmed','cancelled','completed') then raise exception 'Invalid status'; end if;
  end if;
  return new;
end $$;

-- tourists cannot tamper with totals/status
create or replace function public.guard_booking()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if public.has_role(auth.uid(),'admin') or coalesce(current_setting('eb.internal',true),'0') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.total_amount := 0; new.status := 'draft';
  else
    new.total_amount := old.total_amount; new.tourist_id := old.tourist_id; new.currency := old.currency; new.status := old.status;
  end if;
  return new;
end $$;
drop trigger if exists bk_guard on public.bookings;
create trigger bk_guard before insert or update on public.bookings for each row execute function public.guard_booking();

-- tourist cancellation (whole trip or one item)
create or replace function public.cancel_booking(_booking_id uuid, _item_id uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.bookings where id=_booking_id and tourist_id=auth.uid()) then raise exception 'Not your booking'; end if;
  perform set_config('eb.internal','1',true);
  update public.booking_items set status='cancelled'
   where booking_id=_booking_id and status in ('requested','confirmed') and (_item_id is null or id=_item_id);
  perform set_config('eb.internal','0',true);
  insert into public.notifications(user_id,title,body)
    select distinct p.user_id, 'Booking cancelled', 'A traveler cancelled a booking with you.'
    from public.booking_items bi join public.provider_profiles p on p.id=bi.provider_id
    where bi.booking_id=_booking_id and (_item_id is null or bi.id=_item_id);
end $$;
revoke all on function public.cancel_booking(uuid, uuid) from public, anon;
grant execute on function public.cancel_booking(uuid, uuid) to authenticated;