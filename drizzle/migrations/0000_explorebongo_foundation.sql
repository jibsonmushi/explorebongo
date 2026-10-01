
create type public.app_role as enum ('admin','provider','tourist');
create type public.verification_status as enum ('PENDING','UNDER_REVIEW','APPROVED','REJECTED','SUSPENDED');
create type public.provider_type as enum ('transport','activity','guide','restaurant','accommodation','experience_host','other');
create type public.booking_status as enum ('draft','requested','confirmed','cancelled','completed');
create type public.payment_status as enum ('pending','paid','failed','refunded');

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at = now(); return new; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text, last_name text, email text, phone text, country text,
  avatar_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null, unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create trigger profiles_upd before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role','tourist');
begin
  insert into public.profiles(id, first_name, last_name, email, phone, country)
  values (new.id, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name', new.email,
          new.raw_user_meta_data->>'phone', new.raw_user_meta_data->>'country');
  if r not in ('tourist','provider') then r := 'tourist'; end if;
  insert into public.user_roles(user_id, role) values (new.id, r::app_role);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null, description text, provider_type provider_type not null default 'other',
  country text default 'Tanzania', region text, city text, address text,
  business_phone text, business_email text,
  verification_status verification_status not null default 'PENDING',
  documents_pending boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, insert, update on public.provider_profiles to authenticated;
grant select on public.provider_profiles to anon;
grant all on public.provider_profiles to service_role;
alter table public.provider_profiles enable row level security;
create policy "public approved providers" on public.provider_profiles for select to anon, authenticated using (verification_status='APPROVED');
create policy "owner read provider" on public.provider_profiles for select to authenticated using (user_id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "owner insert provider" on public.provider_profiles for insert to authenticated with check (user_id=auth.uid() and verification_status='PENDING');
create policy "owner update provider" on public.provider_profiles for update to authenticated using (user_id=auth.uid());
create policy "admin update provider" on public.provider_profiles for update to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger pp_upd before update on public.provider_profiles for each row execute function public.set_updated_at();

create or replace function public.guard_verification() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.verification_status is distinct from old.verification_status and not public.has_role(auth.uid(),'admin') then
    raise exception 'Only admins can change verification status';
  end if;
  return new;
end $$;
create trigger pp_guard before update on public.provider_profiles for each row execute function public.guard_verification();

create table public.provider_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  document_type text not null, file_path text, status verification_status not null default 'PENDING',
  created_at timestamptz not null default now()
);
grant select, insert on public.provider_documents to authenticated;
grant all on public.provider_documents to service_role;
alter table public.provider_documents enable row level security;
create policy "owner docs" on public.provider_documents for select to authenticated using (
  exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "owner add docs" on public.provider_documents for insert to authenticated with check (
  exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()));

create table public.categories (id uuid primary key default gen_random_uuid(), name text not null unique, slug text not null unique, created_at timestamptz not null default now());
create table public.destinations (id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, region text, description text, created_at timestamptz not null default now());
grant select on public.categories, public.destinations to anon, authenticated;
grant all on public.categories, public.destinations to service_role;
alter table public.categories enable row level security;
alter table public.destinations enable row level security;
create policy "public read cat" on public.categories for select using (true);
create policy "public read dest" on public.destinations for select using (true);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  category_id uuid references public.categories(id), destination_id uuid references public.destinations(id),
  title text not null, description text, price numeric(12,2) not null default 0, currency text not null default 'USD',
  capacity int, duration_minutes int, is_published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select on public.services to anon;
grant select, insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "public published services" on public.services for select to anon, authenticated using (is_published);
create policy "owner services" on public.services for all to authenticated
  using (exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()) or public.has_role(auth.uid(),'admin'))
  with check (exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()) or public.has_role(auth.uid(),'admin'));
create trigger svc_upd before update on public.services for each row execute function public.set_updated_at();

create table public.availability (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  date date not null, capacity int not null default 0, booked int not null default 0,
  created_at timestamptz not null default now(), unique(service_id, date)
);
grant select on public.availability to anon;
grant select, insert, update, delete on public.availability to authenticated;
grant all on public.availability to service_role;
alter table public.availability enable row level security;
create policy "public avail" on public.availability for select using (true);
create policy "owner avail" on public.availability for all to authenticated
  using (exists(select 1 from public.services s join public.provider_profiles p on p.id=s.provider_id where s.id=service_id and p.user_id=auth.uid()))
  with check (exists(select 1 from public.services s join public.provider_profiles p on p.id=s.provider_id where s.id=service_id and p.user_id=auth.uid()));

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  tourist_id uuid not null references auth.users(id) on delete cascade,
  status booking_status not null default 'draft', total_amount numeric(12,2) not null default 0, currency text not null default 'USD',
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  service_id uuid not null references public.services(id),
  provider_id uuid not null references public.provider_profiles(id),
  date date, quantity int not null default 1, unit_price numeric(12,2) not null default 0,
  status booking_status not null default 'requested', created_at timestamptz not null default now()
);
grant select, insert, update on public.bookings, public.booking_items to authenticated;
grant all on public.bookings, public.booking_items to service_role;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
create policy "tourist bookings" on public.bookings for select to authenticated using (tourist_id=auth.uid() or public.has_role(auth.uid(),'admin')
  or exists(select 1 from public.booking_items bi join public.provider_profiles p on p.id=bi.provider_id where bi.booking_id=bookings.id and p.user_id=auth.uid()));
create policy "tourist booking insert" on public.bookings for insert to authenticated with check (tourist_id=auth.uid());
create policy "tourist booking update" on public.bookings for update to authenticated using (tourist_id=auth.uid());
create policy "items read" on public.booking_items for select to authenticated using (
  exists(select 1 from public.bookings b where b.id=booking_id and b.tourist_id=auth.uid())
  or exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid())
  or public.has_role(auth.uid(),'admin'));
create policy "items insert" on public.booking_items for insert to authenticated with check (
  exists(select 1 from public.bookings b where b.id=booking_id and b.tourist_id=auth.uid()));
create policy "items provider update" on public.booking_items for update to authenticated using (
  exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()));
create trigger bk_upd before update on public.bookings for each row execute function public.set_updated_at();

create table public.payments (id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade, amount numeric(12,2) not null, currency text not null default 'USD', status payment_status not null default 'pending', provider_ref text, created_at timestamptz not null default now());
create table public.commissions (id uuid primary key default gen_random_uuid(), booking_item_id uuid not null references public.booking_items(id) on delete cascade, rate numeric(5,4) not null, amount numeric(12,2) not null, created_at timestamptz not null default now());
create table public.provider_payouts (id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.provider_profiles(id) on delete cascade, amount numeric(12,2) not null, currency text not null default 'USD', status payment_status not null default 'pending', paid_at timestamptz, created_at timestamptz not null default now());
grant select on public.payments, public.commissions, public.provider_payouts to authenticated;
grant all on public.payments, public.commissions, public.provider_payouts to service_role;
alter table public.payments enable row level security;
alter table public.commissions enable row level security;
alter table public.provider_payouts enable row level security;
create policy "payments read" on public.payments for select to authenticated using (public.has_role(auth.uid(),'admin') or exists(select 1 from public.bookings b where b.id=booking_id and b.tourist_id=auth.uid()));
create policy "commissions admin" on public.commissions for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "payouts read" on public.provider_payouts for select to authenticated using (public.has_role(auth.uid(),'admin') or exists(select 1 from public.provider_profiles p where p.id=provider_id and p.user_id=auth.uid()));

create table public.reviews (id uuid primary key default gen_random_uuid(), service_id uuid not null references public.services(id) on delete cascade, tourist_id uuid not null references auth.users(id) on delete cascade, booking_item_id uuid references public.booking_items(id), rating int not null check (rating between 1 and 5), comment text, created_at timestamptz not null default now());
grant select on public.reviews to anon;
grant select, insert, update, delete on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "public reviews" on public.reviews for select using (true);
create policy "own reviews" on public.reviews for all to authenticated using (tourist_id=auth.uid()) with check (tourist_id=auth.uid());

create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, title text not null, body text, read boolean not null default false, created_at timestamptz not null default now());
create table public.itineraries (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, title text not null, content jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.favorites (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, service_id uuid not null references public.services(id) on delete cascade, created_at timestamptz not null default now(), unique(user_id, service_id));
create table public.support_tickets (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, subject text not null, message text not null, status text not null default 'open', created_at timestamptz not null default now());
grant select, insert, update, delete on public.notifications, public.itineraries, public.favorites, public.support_tickets to authenticated;
grant all on public.notifications, public.itineraries, public.favorites, public.support_tickets to service_role;
alter table public.notifications enable row level security;
alter table public.itineraries enable row level security;
alter table public.favorites enable row level security;
alter table public.support_tickets enable row level security;
create policy "own notif" on public.notifications for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "own itin" on public.itineraries for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "own fav" on public.favorites for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "own tickets" on public.support_tickets for all to authenticated using (user_id=auth.uid() or public.has_role(auth.uid(),'admin')) with check (user_id=auth.uid());

create table public.audit_logs (id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null, action text not null, entity text, entity_id uuid, metadata jsonb, created_at timestamptz not null default now());
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "admin audit" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'admin'));

insert into public.categories(name, slug) values ('Safari','safari'),('Cultural','cultural'),('Beach','beach'),('Hiking','hiking'),('Food','food'),('Transport','transport'),('Accommodation','accommodation');
insert into public.destinations(name, slug, region) values ('Arusha','arusha','Arusha'),('Serengeti','serengeti','Mara'),('Ngorongoro','ngorongoro','Arusha'),('Zanzibar','zanzibar','Zanzibar'),('Kilimanjaro','kilimanjaro','Kilimanjaro');
