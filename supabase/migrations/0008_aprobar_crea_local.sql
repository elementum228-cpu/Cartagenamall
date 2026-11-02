-- Al aprobar una solicitud se crea el local y se vincula a quien lo pidió (aparece en «Mi negocio»).

alter table public.store_requests add column if not exists store_id text references public.stores(id) on delete set null;

-- Crea la tienda de una solicitud y vincula al solicitante. Interna: no se expone al cliente.
create or replace function public.create_store_from_request(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  r public.store_requests%rowtype;
  v_id text;
  v_cat text;
  v_zone text;
  v_color text;
  v_logo text;
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
    'instagram', '', 'whatsapp', r.phone, 'status', 'open'
  )) on conflict (id) do nothing;
  insert into public.store_members (user_id, store_id) values (r.user_id, v_id) on conflict do nothing;
  update public.store_requests set store_id = v_id where id = p_id;
  return v_id;
end $$;
revoke all on function public.create_store_from_request(uuid) from public, anon, authenticated;

-- Decisión del administrador: aprobar (crea el local) o rechazar.
create or replace function public.decide_store_request(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_site_admin() then raise exception 'Solo un administrador puede decidir solicitudes'; end if;
  if p_status not in ('aprobada','rechazada') then raise exception 'Estado no válido'; end if;
  update public.store_requests set status = p_status where id = p_id;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if p_status = 'aprobada' then perform public.create_store_from_request(p_id); end if;
end $$;
grant execute on function public.decide_store_request(uuid, text) to authenticated;

-- Solicitudes que ya estaban aprobadas: crear su local ahora.
do $$ declare x uuid; begin
  for x in select id from public.store_requests where status = 'aprobada' and store_id is null loop
    perform public.create_store_from_request(x);
  end loop;
end $$;
