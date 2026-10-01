
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  r text := coalesce(m->>'role','tourist');
  ptype text := coalesce(m->>'provider_type','other');
begin
  insert into public.profiles(id, first_name, last_name, email, phone, country)
  values (new.id, coalesce(m->>'first_name', split_part(coalesce(m->>'full_name',''),' ',1)), m->>'last_name', new.email, m->>'phone', m->>'country');
  if r not in ('tourist','provider') then r := 'tourist'; end if;
  insert into public.user_roles(user_id, role) values (new.id, r::app_role);
  if r = 'provider' and coalesce(m->>'business_name','') <> '' then
    if ptype not in ('transport','activity','guide','restaurant','accommodation','experience_host','other') then ptype := 'other'; end if;
    insert into public.provider_profiles(user_id, business_name, description, provider_type, country, region, city, address, business_phone, business_email, documents_pending)
    values (new.id, left(m->>'business_name',150), left(m->>'description',2000), ptype::provider_type, coalesce(m->>'business_country','Tanzania'),
            m->>'region', m->>'city', m->>'address', m->>'business_phone', m->>'business_email', coalesce((m->>'documents_pending')::boolean,false));
  end if;
  return new;
end $$;
