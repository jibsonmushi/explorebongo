ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';

-- Only admins may publish/unpublish services
CREATE OR REPLACE FUNCTION public.guard_service_publish() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if tg_op = 'INSERT' then
    if new.is_published and not public.has_role(auth.uid(),'admin') then new.is_published := false; end if;
  elsif new.is_published is distinct from old.is_published and not public.has_role(auth.uid(),'admin') then
    raise exception 'Only admins can approve or unpublish services';
  end if;
  return new;
end $$;
CREATE TRIGGER svc_publish_guard BEFORE INSERT OR UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.guard_service_publish();

-- Booking items: price/provider always come from the service
CREATE OR REPLACE FUNCTION public.prepare_booking_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare s record;
begin
  select id, provider_id, price, is_published into s from public.services where id = new.service_id;
  if s.id is null or not s.is_published then raise exception 'Service is not available'; end if;
  if new.quantity < 1 or new.quantity > 50 then raise exception 'Invalid quantity'; end if;
  new.provider_id := s.provider_id;
  new.unit_price := s.price;
  new.status := 'requested';
  return new;
end $$;
CREATE TRIGGER bi_prepare BEFORE INSERT ON public.booking_items FOR EACH ROW EXECUTE FUNCTION public.prepare_booking_item();

CREATE OR REPLACE FUNCTION public.after_booking_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  update public.bookings set total_amount = total_amount + new.unit_price * new.quantity, status = 'requested' where id = new.booking_id;
  insert into public.commissions(booking_item_id, rate, amount) values (new.id, 0.10, round(new.unit_price * new.quantity * 0.10, 2));
  insert into public.notifications(user_id, title, body)
    select p.user_id, 'New booking request', 'You have a new booking request.' from public.provider_profiles p where p.id = new.provider_id;
  return new;
end $$;
CREATE TRIGGER bi_after AFTER INSERT ON public.booking_items FOR EACH ROW EXECUTE FUNCTION public.after_booking_item();

-- Providers may only change item status
CREATE OR REPLACE FUNCTION public.guard_booking_item_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if not public.has_role(auth.uid(),'admin') then
    new.unit_price := old.unit_price; new.quantity := old.quantity; new.service_id := old.service_id;
    new.provider_id := old.provider_id; new.booking_id := old.booking_id; new.date := old.date;
    if new.status not in ('confirmed','cancelled','completed') then raise exception 'Invalid status'; end if;
  end if;
  return new;
end $$;
CREATE TRIGGER bi_guard BEFORE UPDATE ON public.booking_items FOR EACH ROW EXECUTE FUNCTION public.guard_booking_item_update();

CREATE OR REPLACE FUNCTION public.rollup_booking_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare total int; pending int; cancelled int; t uuid;
begin
  select count(*), count(*) filter (where status='requested'), count(*) filter (where status='cancelled')
    into total, pending, cancelled from public.booking_items where booking_id = new.booking_id;
  if cancelled = total then update public.bookings set status='cancelled' where id=new.booking_id;
  elsif pending = 0 then update public.bookings set status='confirmed' where id=new.booking_id; end if;
  select tourist_id into t from public.bookings where id=new.booking_id;
  if new.status is distinct from old.status then
    insert into public.notifications(user_id,title,body) values (t, 'Booking update', 'A provider marked part of your trip as '||new.status||'.');
  end if;
  return new;
end $$;
CREATE TRIGGER bi_rollup AFTER UPDATE ON public.booking_items FOR EACH ROW EXECUTE FUNCTION public.rollup_booking_status();

-- Admin management of money records
GRANT SELECT, INSERT, UPDATE ON public.payments, public.provider_payouts, public.commissions TO authenticated;
CREATE POLICY "admin manage payments" ON public.payments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage payouts" ON public.provider_payouts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage commissions" ON public.commissions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "provider reads own commissions" ON public.commissions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.booking_items bi JOIN public.provider_profiles p ON p.id=bi.provider_id WHERE bi.id=commissions.booking_item_id AND p.user_id=auth.uid()));
CREATE POLICY "admin manage bookings" ON public.bookings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "tourists see booked providers" ON public.profiles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.bookings b JOIN public.booking_items bi ON bi.booking_id=b.id JOIN public.provider_profiles p ON p.id=bi.provider_id WHERE b.tourist_id=profiles.id AND p.user_id=auth.uid()));