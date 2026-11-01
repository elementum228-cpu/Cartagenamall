-- Pruebas de reglas de acceso (RLS) del Cartagena Mall contra un Postgres local.
\set ON_ERROR_STOP on

-- Cuántas filas ve el rol actual (0 si ni siquiera tiene permiso de lectura).
create or replace function pg_temp.visibles(p_table text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I', p_table) into n;
  return n;
exception when insufficient_privilege then return 0;
end $$;

create or replace function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false);
  perform set_config('request.jwt.claim.role', case when p_uid is null then 'anon' else 'authenticated' end, false);
  if p_uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@mall.test'),
  ('22222222-2222-2222-2222-222222222222', 'nodo@mall.test'),
  ('33333333-3333-3333-3333-333333333333', 'otra@mall.test');
insert into public.admins values ('11111111-1111-1111-1111-111111111111');

-- 1. El admin carga el catálogo
select pg_temp.como('11111111-1111-1111-1111-111111111111');
insert into public.stores (id, doc) values ('STORE-003', '{"id":"STORE-003","name":"Nodo Tech"}'), ('STORE-005', '{"id":"STORE-005","name":"Casa Bahía"}');
insert into public.products (id, store_id, doc) values ('P-1', 'STORE-003', '{"id":"P-1","storeId":"STORE-003","price":1000}');
insert into public.space_assignments values ('P1-B2', 'STORE-003');
select public.add_store_member('STORE-003', 'NODO@mall.test') as vincular;
reset role;

-- 2. Anónimo: lee catálogo, no puede escribirlo
select pg_temp.como(null);
do $$ begin
  assert (select count(*) from public.stores) = 2, 'anon lee tiendas';
  begin
    insert into public.stores (id, doc) values ('X', '{"id":"X"}');
    raise exception 'anon NO debería crear tiendas';
  exception when insufficient_privilege then null; end;
  begin
    update public.products set doc = doc || '{"price":1}' where id = 'P-1';
    raise exception 'anon NO debería cambiar precios';
  exception when insufficient_privilege then null; end;
end $$;
-- 3. Anónimo: envía pedido, solicitud y reserva; no puede leerlos
insert into public.orders (id, doc) values ('ORD-1', '{"id":"ORD-1","customer":{"name":"Ana","whatsapp":"300"}}');
insert into public.sub_orders (id, order_id, store_id, doc) values ('ORD-1-A', 'ORD-1', 'STORE-003', '{}'), ('ORD-1-B', 'ORD-1', 'STORE-005', '{}');
insert into public.space_claims (id, doc) values ('REQ-1', '{"email":"x@y.z"}');
insert into public.court_reservations (id, day, hour, doc) values ('RES-1', '2026-11-01', 19, '{"name":"Ana"}');
do $$ begin
  assert pg_temp.visibles('orders') = 0, 'anon no lee pedidos';
  assert pg_temp.visibles('space_claims') = 0, 'anon no lee solicitudes';
  assert pg_temp.visibles('court_reservations') = 0, 'anon no lee reservas';
  assert (select count(*) from public.court_taken_hours('2026-11-01')) = 1, 'anon ve horas ocupadas';
  begin
    insert into public.court_reservations (id, day, hour, doc) values ('RES-2', '2026-11-01', 19, '{}');
    raise exception 'no se puede reservar dos veces el mismo horario';
  exception when unique_violation then null; end;
  begin
    insert into public.sub_orders (id, order_id, store_id, status, doc) values ('ORD-1-C', 'ORD-1', 'STORE-003', 'confirmed', '{}');
    raise exception 'anon no crea subpedidos ya confirmados';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 4. Comerciante de Nodo Tech: edita lo suyo, ve solo sus subpedidos
select pg_temp.como('22222222-2222-2222-2222-222222222222');
do $$ begin
  assert (select public.my_roles() ->> 'is_admin') = 'false', 'no es admin';
  assert (select public.my_roles() -> 'store_ids' ->> 0) = 'STORE-003', 'es de Nodo Tech';
  update public.products set doc = doc || '{"price":900}' where id = 'P-1';
  assert (select (doc->>'price')::int from public.products where id = 'P-1') = 900, 'cambia su precio';
  insert into public.promotions (id, store_id, doc) values ('PR-1', 'STORE-003', '{"id":"PR-1","storeId":"STORE-003"}');
  begin
    insert into public.promotions (id, store_id, doc) values ('PR-2', 'STORE-005', '{"id":"PR-2","storeId":"STORE-005"}');
    raise exception 'no crea promociones de otra tienda';
  exception when insufficient_privilege then null; end;
  update public.stores set doc = doc || '{"name":"Hack"}' where id = 'STORE-005';
  assert (select doc->>'name' from public.stores where id = 'STORE-005') = 'Casa Bahía', 'no edita otra tienda';
  assert (select count(*) from public.sub_orders) = 1, 'solo su subpedido';
  assert (select count(*) from public.orders) = 1, 've el pedido que lo incluye';
  update public.sub_orders set status = 'confirmed' where id = 'ORD-1-A';
  update public.sub_orders set status = 'confirmed' where id = 'ORD-1-B';
  begin
    update public.space_assignments set store_id = 'STORE-003' where space_id = 'P1-B2';
    assert (select count(*) from public.space_assignments where space_id = 'P1-B2') = 1, 'sigue';
  end;
  assert (select count(*) from public.space_claims) = 0, 'no ve solicitudes';
end $$;
reset role;
do $$ begin
  assert (select status from public.sub_orders where id = 'ORD-1-A') = 'confirmed', 'confirmó el suyo';
  assert (select status from public.sub_orders where id = 'ORD-1-B') = 'pending_confirmation', 'no tocó el ajeno';
end $$;

-- 5. Otro usuario sin tienda: no puede nada
select pg_temp.como('33333333-3333-3333-3333-333333333333');
do $$ begin
  assert (select count(*) from public.sub_orders) = 0, 'sin tienda no ve subpedidos';
  begin
    perform public.add_store_member('STORE-005', 'otra@mall.test');
    raise exception 'no se asigna tiendas';
  exception when raise_exception then
    if sqlerrm not like 'Solo un administrador%' then raise; end if;
  end;
end $$;
reset role;

-- 6. Admin: ve todo
select pg_temp.como('11111111-1111-1111-1111-111111111111');
do $$ begin
  assert (select count(*) from public.space_claims) = 1, 'admin ve solicitudes';
  assert (select count(*) from public.court_reservations) = 1, 'admin ve reservas';
  assert (select count(*) from public.sub_orders) = 2, 'admin ve subpedidos';
  assert (select count(*) from public.store_member_emails('STORE-003')) = 1, 'correos de la tienda';
  insert into public.mall_settings (key, doc) values ('pricing', '{"types": {"local": 80000}, "spaces": {}}');
  update public.mall_settings set doc = '{"types": {"local": 90000}, "spaces": {"P1-A1": 50000}}' where key = 'pricing';
end $$;
reset role;

-- 7. Precios del mall: todos leen, solo el admin escribe
set role anon;
do $$ begin
  assert (select (doc->'types'->>'local')::int from public.mall_settings where key = 'pricing') = 90000, 'anon lee precios';
  begin
    update public.mall_settings set doc = '{}' where key = 'pricing';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
do $$ begin
  update public.mall_settings set doc = '{}' where key = 'pricing';
  begin
    insert into public.mall_settings (key, doc) values ('otra', '{}');
    raise exception 'comerciante no debe escribir configuración';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select (doc->'types'->>'local')::int from public.mall_settings where key = 'pricing') = 90000, 'nadie más cambió los precios';
end $$;

-- 8. Invitaciones a la versión de prueba: solo el admin las ve; cualquiera valida su código
select pg_temp.como('11111111-1111-1111-1111-111111111111');
insert into public.demo_invites (code, name, expires_at, max_devices) values
  ('PRUEBA-AB12', 'Juan', now() + interval '7 days', 2),
  ('VENCIDO-123', 'Ana', now() - interval '1 day', 2),
  ('ANULADO-123', 'Luis', now() + interval '7 days', 2);
update public.demo_invites set revoked = true where code = 'ANULADO-123';
reset role;
select pg_temp.como(null);
do $$ begin
  assert pg_temp.visibles('demo_invites') = 0, 'anon no ve los códigos';
  assert pg_temp.visibles('demo_visits') = 0, 'anon no ve las entradas';
  assert (public.demo_enter('prueba-ab12', 'device-aaaa1') ->> 'ok')::boolean, 'código válido (sin importar mayúsculas)';
  assert public.demo_enter('PRUEBA-AB12', 'device-aaaa1') ->> 'name' = 'Juan', 'mismo dispositivo vuelve a entrar';
  assert (public.demo_enter('PRUEBA-AB12', 'device-bbbb2') ->> 'ok')::boolean, 'segundo dispositivo';
  assert public.demo_enter('PRUEBA-AB12', 'device-cccc3') ->> 'reason' = 'full', 'tercer dispositivo: cupo lleno';
  assert public.demo_enter('VENCIDO-123', 'device-aaaa1') ->> 'reason' = 'expired', 'vencido';
  assert public.demo_enter('ANULADO-123', 'device-aaaa1') ->> 'reason' = 'invalid', 'anulado';
  assert public.demo_enter('NOEXISTE-1', 'device-aaaa1') ->> 'reason' = 'invalid', 'inexistente';
  assert public.demo_enter('PRUEBA-AB12', 'x') ->> 'reason' = 'invalid', 'dispositivo inválido';
  begin
    insert into public.demo_invites (code, name, expires_at) values ('HACK-12345', 'x', now() + interval '1 day');
    raise exception 'anon NO debería crear invitaciones';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
do $$ begin
  assert pg_temp.visibles('demo_invites') = 0, 'un comerciante no ve los códigos';
end $$;
reset role;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
do $$ begin
  assert pg_temp.visibles('demo_invites') = 3, 'el admin ve los códigos';
  assert (select count(*) from public.demo_visits where code = 'PRUEBA-AB12' and not blocked) = 2, 'entradas anotadas una vez por dispositivo';
  assert (select count(*) from public.demo_visits where code = 'PRUEBA-AB12' and blocked) = 1, 'intento bloqueado anotado';
  -- invitación de un solo dispositivo (por defecto): el enlace reenviado se bloquea
  insert into public.demo_invites (code, name, expires_at) values ('UNICO-12345', 'Pedro', now() + interval '7 days');
end $$;
reset role;
select pg_temp.como(null);
do $$ begin
  assert (public.demo_enter('UNICO-12345', 'celular-pedro') ->> 'ok')::boolean, 'el primero lo toma';
  assert public.demo_enter('UNICO-12345', 'celular-amigo') ->> 'reason' = 'full', 'reenviado: bloqueado';
  assert (public.demo_enter('UNICO-12345', 'celular-pedro') ->> 'ok')::boolean, 'el dueño sigue entrando';
end $$;
reset role;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
do $$ begin
  delete from public.demo_visits where code = 'UNICO-12345';
end $$;
reset role;
select pg_temp.como(null);
do $$ begin
  assert (public.demo_enter('UNICO-12345', 'celular-nuevo') ->> 'ok')::boolean, 'liberado: lo toma el siguiente';
end $$;
reset role;

-- 9. Dos canchas: el mismo horario se reserva una vez por cancha
select pg_temp.como(null);
do $$ begin
  insert into public.court_reservations (id, day, hour, court, doc) values ('RES-B', '2026-11-01', 19, 'B', '{}');
  assert (select count(*) from public.court_taken_hours('2026-11-01', 'B')) = 1, 'cancha B ocupada a las 19';
  assert (select count(*) from public.court_taken_hours('2026-11-01', 'A')) = 1, 'cancha A sigue con su reserva';
  begin
    insert into public.court_reservations (id, day, hour, court, doc) values ('RES-B2', '2026-11-01', 19, 'B', '{}');
    raise exception 'no se puede reservar dos veces la cancha B';
  exception when unique_violation then null; end;
  begin
    insert into public.court_reservations (id, day, hour, court, doc) values ('RES-C', '2026-11-01', 20, 'C', '{}');
    raise exception 'solo existen las canchas A y B';
  exception when check_violation then null; end;
end $$;
reset role;
select 'OK: reglas de acceso verificadas' as resultado;
