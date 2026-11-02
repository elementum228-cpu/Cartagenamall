-- Los locales creados al aprobar una solicitud quedan con la configuración inicial pendiente:
-- el dueño ve «¡Eres dueño de un local!» y elige si es restaurante, tienda o servicio.
create or replace function public.create_store_from_request(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  r public.store_requests%rowtype;
  v_id text; v_cat text; v_zone text; v_color text; v_logo text;
begin
  select * into r from public.store_requests where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if r.store_id is not null then return r.store_id; end if;

  select case r.category
           when 'Moda' then 'moda-femenina' when 'Tecnología' then 'electronica' when 'Belleza' then 'cuidado-personal'
           when 'Lifestyle' then 'hogar' when 'Gastronomía' then 'gastronomia' else 'regalos' end,
         case r.category
           when 'Moda' then 'A' when 'Tecnología' then 'B' when 'Belleza' then 'C'
           when 'Gastronomía' then 'E' when 'Servicios' then 'F' else 'D' end
    into v_cat, v_zone;
  v_color := (array['#d9826a','#2f6fd6','#7a5ea8','#2f9e8f','#d49a2a','#c2566b'])[1 + (abs(hashtext(r.id::text)) % 6)];
  v_logo := upper(left(regexp_replace(r.business_name, '[^[:alnum:]]', '', 'g'), 6));
  v_id := 'STORE-' || upper(substr(replace(r.id::text, '-', ''), 1, 8));

  insert into public.stores (id, doc) values (v_id, jsonb_build_object(
    'id', v_id, 'name', trim(r.business_name), 'logoText', coalesce(nullif(v_logo, ''), 'LOCAL'),
    'tagline', r.category, 'description', r.description, 'categoryId', v_cat, 'zoneId', v_zone,
    'brandColor', v_color, 'accentColor', '#f3ece4', 'facade', 'awning',
    'instagram', '', 'whatsapp', r.phone, 'status', 'open', 'setup', 'pending'
  )) on conflict (id) do nothing;
  insert into public.store_members (user_id, store_id) values (r.user_id, v_id) on conflict do nothing;
  update public.store_requests set store_id = v_id where id = p_id;
  return v_id;
end $$;
revoke all on function public.create_store_from_request(uuid) from public, anon, authenticated;
