
-- Bookings: reference + payment state
alter table public.bookings add column if not exists reference text unique default ('EB-' || upper(substr(md5(gen_random_uuid()::text),1,8)));
alter table public.bookings add column if not exists payment_state text not null default 'PENDING_PAYMENT'
  check (payment_state in ('PENDING_PAYMENT','PAYMENT_PROCESSING','PAYMENT_CONFIRMED','AWAITING_PROVIDERS','PARTIALLY_CONFIRMED','CONFIRMED','IN_PROGRESS','COMPLETED','PAYMENT_FAILED','EXPIRED','CANCELLED'));

-- Payments
alter table public.payments add column if not exists customer_id uuid;
alter table public.payments add column if not exists payment_method text;
alter table public.payments add column if not exists payment_provider text;
alter table public.payments add column if not exists transaction_reference text unique;
alter table public.payments add column if not exists state text not null default 'PENDING'
  check (state in ('PENDING','PROCESSING','PAID','FAILED','CANCELLED','REFUND_PENDING','REFUNDED','PARTIALLY_REFUNDED'));
alter table public.payments add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.payments add column if not exists updated_at timestamptz not null default now();
alter table public.payments add column if not exists paid_at timestamptz;
alter table public.payments add column if not exists failed_at timestamptz;
alter table public.payments add column if not exists refunded_at timestamptz;
alter table public.payments add column if not exists refunded_amount numeric(14,2) not null default 0;
comment on column public.payments.status is 'DEPRECATED: replaced by state';
create unique index if not exists one_paid_payment_per_booking on public.payments(booking_id) where state in ('PAID','PARTIALLY_REFUNDED','REFUNDED','REFUND_PENDING');
create unique index if not exists one_open_payment_per_booking on public.payments(booking_id) where state in ('PENDING','PROCESSING');

-- Commission settings
create table if not exists public.commission_settings (
  id uuid primary key default gen_random_uuid(),
  rate numeric(6,4) not null check (rate >= 0 and rate < 1),
  is_active boolean not null default false,
  effective_from timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.commission_settings to authenticated;
grant all on public.commission_settings to service_role;
alter table public.commission_settings enable row level security;
create policy "admins read commission settings" on public.commission_settings for select to authenticated using (public.has_role(auth.uid(),'admin'));
create unique index if not exists one_active_commission on public.commission_settings(is_active) where is_active;
insert into public.commission_settings(rate, is_active) select 0.10, true where not exists (select 1 from public.commission_settings);

-- Commissions: link to payment, store net
alter table public.commissions add column if not exists payment_id uuid references public.payments(id);
alter table public.commissions add column if not exists gross_amount numeric(14,2);
alter table public.commissions add column if not exists provider_net numeric(14,2);
alter table public.commissions add column if not exists refunded_amount numeric(14,2) not null default 0;
alter table public.commissions add column if not exists currency text;
create unique index if not exists one_commission_per_item_payment on public.commissions(booking_item_id, payment_id) where payment_id is not null;

-- Payouts
alter table public.provider_payouts add column if not exists state text not null default 'PENDING' check (state in ('PENDING','PROCESSING','PAID','FAILED','CANCELLED'));
alter table public.provider_payouts add column if not exists payout_reference text;
alter table public.provider_payouts add column if not exists payment_method text;
alter table public.provider_payouts add column if not exists requested_at timestamptz not null default now();
alter table public.provider_payouts add column if not exists processed_at timestamptz;
alter table public.provider_payouts add column if not exists failed_at timestamptz;
alter table public.provider_payouts add column if not exists failure_reason text;
alter table public.provider_payouts add column if not exists notes text;
comment on column public.provider_payouts.status is 'DEPRECATED: replaced by state';
update public.provider_payouts set state = upper(status::text) where status::text in ('paid','failed');

-- Refunds
create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  booking_id uuid not null references public.bookings(id),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null,
  reason text not null,
  status text not null default 'REFUND_PENDING' check (status in ('REFUND_PENDING','REFUNDED','PARTIALLY_REFUNDED','FAILED')),
  reference text unique default ('RF-' || upper(substr(md5(gen_random_uuid()::text),1,10))),
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.refunds to authenticated;
grant all on public.refunds to service_role;
alter table public.refunds enable row level security;
create policy "refunds read" on public.refunds for select to authenticated using (
  public.has_role(auth.uid(),'admin') or exists (select 1 from public.bookings b where b.id = refunds.booking_id and b.tourist_id = auth.uid()));

-- Lock financial tables: only internal functions may write
drop policy if exists "admin manage payments" on public.payments;
drop policy if exists "admin manage commissions" on public.commissions;
drop policy if exists "admin manage payouts" on public.provider_payouts;
revoke insert, update, delete on public.payments, public.commissions, public.provider_payouts, public.refunds, public.commission_settings from authenticated, anon;

create or replace function public.guard_finance() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('eb.internal', true), '0') <> '1' then
    raise exception 'Financial records can only be changed by the system';
  end if;
  return coalesce(new, old);
end $$;
create trigger pay_guard before insert or update or delete on public.payments for each row execute function public.guard_finance();
create trigger com_guard before insert or update or delete on public.commissions for each row execute function public.guard_finance();
create trigger po_guard before insert or update or delete on public.provider_payouts for each row execute function public.guard_finance();
create trigger rf_guard before insert or update or delete on public.refunds for each row execute function public.guard_finance();
create trigger cs_guard before insert or update or delete on public.commission_settings for each row execute function public.guard_finance();

-- Bookings: payment_state is system-only
create or replace function public.guard_booking() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.has_role(auth.uid(),'admin') or coalesce(current_setting('eb.internal',true),'0') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.total_amount := 0; new.status := 'draft'; new.payment_state := 'PENDING_PAYMENT';
  else
    new.total_amount := old.total_amount; new.tourist_id := old.tourist_id; new.currency := old.currency; new.status := old.status;
    new.payment_state := old.payment_state; new.reference := old.reference;
  end if;
  return new;
end $$;

-- Commission no longer charged at request time
create or replace function public.after_booking_item() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('eb.internal','1',true);
  update public.bookings set total_amount = total_amount + new.unit_price * new.quantity, status = 'requested' where id = new.booking_id;
  perform set_config('eb.internal','0',true);
  insert into public.notifications(user_id, title, body)
    select p.user_id, 'New booking request', 'You have a new booking request for '||new.date||'.' from public.provider_profiles p where p.id = new.provider_id;
  return new;
end $$;

-- Payment-aware booking rollup
create or replace function public.rollup_booking_status() returns trigger language plpgsql security definer set search_path = public as $$
declare total int; pending int; cancelled int; done int; conf int; t uuid; ps text;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.date is not null then
    update public.availability set booked = greatest(booked - new.quantity, 0) where service_id = new.service_id and date = new.date;
  end if;
  select count(*), count(*) filter (where status='requested'), count(*) filter (where status='cancelled'), count(*) filter (where status='completed'), count(*) filter (where status='confirmed')
    into total, pending, cancelled, done, conf from public.booking_items where booking_id = new.booking_id;
  select payment_state, tourist_id into ps, t from public.bookings where id = new.booking_id;
  perform set_config('eb.internal','1',true);
  if cancelled = total then update public.bookings set status='cancelled' where id=new.booking_id;
  elsif pending = 0 and done = total - cancelled then update public.bookings set status='completed' where id=new.booking_id;
  elsif pending = 0 then update public.bookings set status='confirmed' where id=new.booking_id;
  else update public.bookings set status='requested' where id=new.booking_id; end if;
  if ps in ('PAYMENT_CONFIRMED','AWAITING_PROVIDERS','PARTIALLY_CONFIRMED','CONFIRMED','IN_PROGRESS') then
    update public.bookings set payment_state = case
      when cancelled = total then 'CANCELLED'
      when pending = 0 and done = total - cancelled then 'COMPLETED'
      when done > 0 then 'IN_PROGRESS'
      when pending = 0 then 'CONFIRMED'
      when conf > 0 then 'PARTIALLY_CONFIRMED'
      else 'AWAITING_PROVIDERS' end where id = new.booking_id;
  end if;
  perform set_config('eb.internal','0',true);
  if new.status is distinct from old.status and t is distinct from auth.uid() then
    insert into public.notifications(user_id,title,body) values (t, 'Booking update', 'A provider marked part of your trip as '||new.status||'.');
  end if;
  return new;
end $$;

-- Checkout: authoritative amount, idempotent
create or replace function public.start_checkout(_booking_id uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare b record; amt numeric(14,2); pid uuid;
begin
  select * into b from public.bookings where id = _booking_id for update;
  if b.id is null or b.tourist_id <> auth.uid() then raise exception 'Booking not found'; end if;
  if b.status = 'cancelled' then raise exception 'This booking is cancelled'; end if;
  if exists (select 1 from public.payments where booking_id = b.id and state in ('PAID','REFUND_PENDING','REFUNDED','PARTIALLY_REFUNDED')) then raise exception 'This booking is already paid'; end if;
  select id into pid from public.payments where booking_id = b.id and state in ('PENDING','PROCESSING');
  if pid is not null then return pid; end if;
  select coalesce(sum(unit_price * quantity),0) into amt from public.booking_items where booking_id = b.id and status <> 'cancelled';
  if amt <= 0 then raise exception 'Nothing to pay for'; end if;
  perform set_config('eb.internal','1',true);
  insert into public.payments(booking_id, customer_id, amount, currency, state, payment_method, payment_provider)
    values (b.id, b.tourist_id, amt, b.currency, 'PENDING', 'test', 'TEST_MODE') returning id into pid;
  update public.bookings set payment_state = 'PENDING_PAYMENT' where id = b.id;
  insert into public.audit_logs(actor_id, action, entity, entity_id, metadata) values (auth.uid(), 'payment.created', 'payment', pid, jsonb_build_object('amount', amt));
  perform set_config('eb.internal','0',true);
  return pid;
end $$;

-- Test payment (no real money)
create or replace function public.complete_test_payment(_payment_id uuid, _success boolean) returns text language plpgsql security definer set search_path = public as $$
declare p record; b record; r numeric; amt numeric(14,2);
begin
  select * into p from public.payments where id = _payment_id for update;
  if p.id is null then raise exception 'Payment not found'; end if;
  select * into b from public.bookings where id = p.booking_id for update;
  if b.tourist_id <> auth.uid() then raise exception 'Payment not found'; end if;
  if p.state <> 'PENDING' then return p.state; end if; -- idempotent: repeat clicks do nothing
  if p.payment_provider <> 'TEST_MODE' then raise exception 'Not a test payment'; end if;
  select coalesce(sum(unit_price * quantity),0) into amt from public.booking_items where booking_id = b.id and status <> 'cancelled';
  perform set_config('eb.internal','1',true);
  if not _success or amt <> p.amount then
    update public.payments set state='FAILED', failed_at=now(), updated_at=now(),
      metadata = metadata || jsonb_build_object('reason', case when amt <> p.amount then 'amount_changed' else 'test_failure' end) where id = p.id;
    update public.bookings set payment_state='PAYMENT_FAILED' where id = b.id;
    insert into public.notifications(user_id,title,body) values (b.tourist_id, 'Payment failed', 'Your test payment for booking '||b.reference||' failed. You can try again.');
    insert into public.audit_logs(actor_id, action, entity, entity_id) values (auth.uid(), 'payment.failed', 'payment', p.id);
    perform set_config('eb.internal','0',true);
    return 'FAILED';
  end if;
  select rate into r from public.commission_settings where is_active;
  r := coalesce(r, 0);
  update public.payments set state='PAID', paid_at=now(), updated_at=now(), transaction_reference = 'TEST-' || upper(replace(gen_random_uuid()::text,'-','')) where id = p.id;
  insert into public.commissions(booking_item_id, payment_id, rate, gross_amount, amount, provider_net, currency)
    select bi.id, p.id, r, bi.unit_price*bi.quantity, round(bi.unit_price*bi.quantity*r, 2), bi.unit_price*bi.quantity - round(bi.unit_price*bi.quantity*r, 2), p.currency
    from public.booking_items bi where bi.booking_id = b.id and bi.status <> 'cancelled';
  update public.bookings set payment_state = case
    when exists (select 1 from public.booking_items where booking_id=b.id and status='requested') then
      case when exists (select 1 from public.booking_items where booking_id=b.id and status='confirmed') then 'PARTIALLY_CONFIRMED' else 'AWAITING_PROVIDERS' end
    else 'CONFIRMED' end where id = b.id;
  insert into public.notifications(user_id,title,body) values (b.tourist_id, 'Payment successful', 'Test payment received for booking '||b.reference||'.');
  insert into public.notifications(user_id,title,body)
    select distinct pp.user_id, 'Booking paid', 'Booking '||b.reference||' has been paid.' from public.booking_items bi join public.provider_profiles pp on pp.id=bi.provider_id where bi.booking_id=b.id;
  insert into public.audit_logs(actor_id, action, entity, entity_id, metadata) values (auth.uid(), 'payment.paid', 'payment', p.id, jsonb_build_object('amount', p.amount, 'rate', r));
  perform set_config('eb.internal','0',true);
  return 'PAID';
end $$;

-- Admin: commission rate
create or replace function public.set_commission_rate(_percent numeric) returns void language plpgsql security definer set search_path = public as $$
declare old_rate numeric;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  if _percent is null or _percent < 0 or _percent >= 100 then raise exception 'Rate must be between 0 and 99.99%%'; end if;
  perform set_config('eb.internal','1',true);
  select rate into old_rate from public.commission_settings where is_active;
  update public.commission_settings set is_active=false, updated_at=now() where is_active;
  insert into public.commission_settings(rate, is_active, created_by) values (round(_percent/100, 4), true, auth.uid());
  insert into public.audit_logs(actor_id, action, entity, metadata) values (auth.uid(), 'commission.changed', 'commission_settings', jsonb_build_object('from', old_rate, 'to', round(_percent/100,4)));
  perform set_config('eb.internal','0',true);
end $$;

-- Provider finance summary (trusted)
create or replace function public.provider_balance(_provider_id uuid) returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select sum(c.provider_net - round(c.refunded_amount * (1 - c.rate), 2))
     from public.commissions c join public.booking_items bi on bi.id=c.booking_item_id
     where c.payment_id is not null and bi.provider_id=_provider_id and bi.status in ('confirmed','completed')),0)
   - coalesce((select sum(amount) from public.provider_payouts where provider_id=_provider_id and state in ('PENDING','PROCESSING','PAID')),0)
$$;

create or replace function public.my_provider_finance() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pid uuid; res jsonb;
begin
  select id into pid from public.provider_profiles where user_id = auth.uid();
  if pid is null then raise exception 'Not a provider'; end if;
  select jsonb_build_object(
    'gross', coalesce(sum(c.gross_amount),0),
    'commission', coalesce(sum(c.amount - round(c.refunded_amount*c.rate,2)),0),
    'net', coalesce(sum(c.provider_net - round(c.refunded_amount*(1-c.rate),2)),0),
    'refunds', coalesce(sum(c.refunded_amount),0),
    'pending', coalesce(sum(c.provider_net - round(c.refunded_amount*(1-c.rate),2)) filter (where bi.status='requested'),0),
    'paid_out', (select coalesce(sum(amount),0) from public.provider_payouts where provider_id=pid and state='PAID'),
    'available', public.provider_balance(pid),
    'rows', coalesce(jsonb_agg(jsonb_build_object('reference', b.reference, 'date', bi.date, 'service', s.title, 'status', bi.status,
        'gross', c.gross_amount, 'rate', c.rate, 'commission', c.amount, 'net', c.provider_net, 'refunded', c.refunded_amount, 'currency', c.currency) order by c.created_at desc) filter (where c.id is not null), '[]'::jsonb))
  into res
  from public.commissions c join public.booking_items bi on bi.id=c.booking_item_id join public.bookings b on b.id=bi.booking_id join public.services s on s.id=bi.service_id
  where c.payment_id is not null and bi.provider_id = pid;
  return res;
end $$;

create or replace function public.request_payout(_amount numeric, _method text) returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; bal numeric; cur text; oid uuid;
begin
  select id into pid from public.provider_profiles where user_id = auth.uid() for update;
  if pid is null then raise exception 'Not a provider'; end if;
  bal := public.provider_balance(pid);
  if _amount is null or _amount <= 0 or _amount > bal then raise exception 'Amount must be between 0 and your available balance (%)', bal; end if;
  select c.currency into cur from public.commissions c join public.booking_items bi on bi.id=c.booking_item_id where bi.provider_id=pid and c.payment_id is not null limit 1;
  perform set_config('eb.internal','1',true);
  insert into public.provider_payouts(provider_id, amount, currency, state, payment_method) values (pid, round(_amount,2), coalesce(cur,'TZS'), 'PENDING', left(_method,100)) returning id into oid;
  insert into public.audit_logs(actor_id, action, entity, entity_id, metadata) values (auth.uid(), 'payout.requested', 'payout', oid, jsonb_build_object('amount', _amount));
  insert into public.notifications(user_id,title,body) select ur.user_id, 'Payout requested', 'A provider requested a payout.' from public.user_roles ur where ur.role='admin';
  perform set_config('eb.internal','0',true);
  return oid;
end $$;

create or replace function public.admin_update_payout(_id uuid, _state text, _reference text default null, _notes text default null, _reason text default null) returns void language plpgsql security definer set search_path = public as $$
declare po record;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  select * into po from public.provider_payouts where id=_id for update;
  if po.id is null then raise exception 'Payout not found'; end if;
  if po.state in ('PAID','FAILED','CANCELLED') then raise exception 'This payout is closed'; end if;
  if _state not in ('PROCESSING','PAID','FAILED','CANCELLED') then raise exception 'Invalid status'; end if;
  if _state = 'PAID' and coalesce(_reference, po.payout_reference, '') = '' then raise exception 'Add a payout reference'; end if;
  perform set_config('eb.internal','1',true);
  update public.provider_payouts set state=_state,
    status = case when _state='PAID' then 'paid'::payment_status when _state='FAILED' then 'failed'::payment_status else status end,
    payout_reference = coalesce(nullif(_reference,''), payout_reference), notes = coalesce(nullif(_notes,''), notes),
    processed_at = case when _state in ('PROCESSING','PAID') then now() else processed_at end,
    paid_at = case when _state='PAID' then now() else paid_at end,
    failed_at = case when _state='FAILED' then now() else failed_at end,
    failure_reason = case when _state='FAILED' then _reason else failure_reason end
  where id=_id;
  insert into public.audit_logs(actor_id, action, entity, entity_id, metadata) values (auth.uid(), 'payout.'||lower(_state), 'payout', _id, jsonb_build_object('reference', _reference));
  insert into public.notifications(user_id,title,body) select p.user_id, 'Payout '||lower(_state), 'Your payout of '||po.currency||' '||po.amount||' is now '||lower(_state)||'.' from public.provider_profiles p where p.id=po.provider_id;
  perform set_config('eb.internal','0',true);
end $$;

create or replace function public.admin_refund(_payment_id uuid, _amount numeric, _reason text) returns uuid language plpgsql security definer set search_path = public as $$
declare p record; b record; remaining numeric; rid uuid; full_ref boolean;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  if coalesce(trim(_reason),'') = '' then raise exception 'A reason is required'; end if;
  select * into p from public.payments where id=_payment_id for update;
  if p.id is null or p.state not in ('PAID','PARTIALLY_REFUNDED') then raise exception 'Only paid payments can be refunded'; end if;
  remaining := p.amount - p.refunded_amount;
  if _amount is null or _amount <= 0 or _amount > remaining then raise exception 'Refund must be between 0 and %', remaining; end if;
  full_ref := round(_amount,2) = remaining;
  select * into b from public.bookings where id=p.booking_id;
  perform set_config('eb.internal','1',true);
  insert into public.refunds(payment_id, booking_id, amount, currency, reason, status, created_by)
    values (p.id, p.booking_id, round(_amount,2), p.currency, left(_reason,500), case when full_ref then 'REFUNDED' else 'PARTIALLY_REFUNDED' end, auth.uid()) returning id into rid;
  update public.payments set refunded_amount = refunded_amount + round(_amount,2), refunded_at=now(), updated_at=now(),
    state = case when full_ref then 'REFUNDED' else 'PARTIALLY_REFUNDED' end where id=p.id;
  -- spread refund across items proportionally to their gross
  update public.commissions c set refunded_amount = c.refunded_amount + round(_amount * c.gross_amount / p.amount, 2) where c.payment_id = p.id;
  insert into public.notifications(user_id,title,body) values (b.tourist_id, 'Refund issued', 'A refund of '||p.currency||' '||round(_amount,2)||' was recorded for booking '||b.reference||'.');
  insert into public.notifications(user_id,title,body) select distinct pp.user_id, 'Refund on your booking', 'A refund was recorded for booking '||b.reference||'.' from public.booking_items bi join public.provider_profiles pp on pp.id=bi.provider_id where bi.booking_id=b.id;
  insert into public.audit_logs(actor_id, action, entity, entity_id, metadata) values (auth.uid(), 'refund.created', 'payment', p.id, jsonb_build_object('amount', _amount, 'reason', _reason));
  perform set_config('eb.internal','0',true);
  return rid;
end $$;

revoke execute on function public.start_checkout(uuid), public.complete_test_payment(uuid, boolean), public.set_commission_rate(numeric), public.my_provider_finance(), public.request_payout(numeric, text), public.admin_update_payout(uuid, text, text, text, text), public.admin_refund(uuid, numeric, text), public.provider_balance(uuid) from anon, public;
grant execute on function public.start_checkout(uuid), public.complete_test_payment(uuid, boolean), public.set_commission_rate(numeric), public.my_provider_finance(), public.request_payout(numeric, text), public.admin_update_payout(uuid, text, text, text, text), public.admin_refund(uuid, numeric, text) to authenticated;
