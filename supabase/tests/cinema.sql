-- Pruebas de acceso (RLS) de las tablas de horarios de cine (migración 0025) contra un Postgres local. Ver cinema.sh.
-- Comprueba: anónimos no leen ni escriben, usuarios comunes tampoco, la administración lee y puede apagar una cadena,
-- la limpieza del historial no la ejecuta nadie desde la app, y las semillas son las tres cadenas con su cartelera oficial.
\set ON_ERROR_STOP on
create or replace function pg_temp.visibles(p_table text) returns bigint language plpgsql as $$
declare n bigint;
begin execute format('select count(*) from public.%I', p_table) into n; return n;
exception when insufficient_privilege then return 0; end $$;
create or replace function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false);
  perform set_config('request.jwt.claim.role', case when p_uid is null then 'anon' else 'authenticated' end, false);
  if p_uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111','admin@t'),('22222222-2222-2222-2222-222222222222','otra@t');
insert into public.admins values ('11111111-1111-1111-1111-111111111111');
-- la función (servicio) escribe caché e historial
insert into public.cinema_showtimes_cache (provider_id, city, date, payload, fetched_at) values ('procinal','cartagena','2026-11-13','[{"id":"s"}]', now());
insert into public.cinema_fetch_log (provider_id, city, date, ok, error_code) values ('procinal','cartagena','2026-11-13', false, 'timeout');
create or replace function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin if ok then raise notice 'OK    %', label; else raise exception 'FALLÓ %', label; end if; end $$;
grant execute on function pg_temp.visibles(text), pg_temp.como(uuid), pg_temp.check(text, boolean) to public;

select pg_temp.como(null);
select pg_temp.check('anónimo no lee cinema_sources', pg_temp.visibles('cinema_sources') = 0);
select pg_temp.check('anónimo no lee la caché', pg_temp.visibles('cinema_showtimes_cache') = 0);
select pg_temp.check('anónimo no lee el historial', pg_temp.visibles('cinema_fetch_log') = 0);
do $$ begin begin insert into public.cinema_showtimes_cache(provider_id, city, date) values ('procinal','x','2026-11-14'); raise exception 'anónimo pudo escribir'; exception when insufficient_privilege then null; end; end $$;
reset role;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select pg_temp.check('usuario común no ve fuentes', pg_temp.visibles('cinema_sources') = 0);
select pg_temp.check('usuario común no ve caché', pg_temp.visibles('cinema_showtimes_cache') = 0);
update public.cinema_sources set enabled = false where id = 'procinal';
do $$ begin begin insert into public.cinema_showtimes_cache(provider_id, city, date) values ('procinal','x','2026-11-14'); raise exception 'usuario pudo escribir caché'; exception when insufficient_privilege then null; when others then if sqlerrm like '%row-level security%' then null; else raise; end if; end; end $$;
reset role;
select pg_temp.check('usuario común no pudo apagar una cadena', (select enabled from public.cinema_sources where id='procinal'));
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select pg_temp.check('admin ve las 3 fuentes', pg_temp.visibles('cinema_sources') = 3);
select pg_temp.check('admin ve la caché', pg_temp.visibles('cinema_showtimes_cache') = 1);
select pg_temp.check('admin ve el historial', pg_temp.visibles('cinema_fetch_log') = 1);
update public.cinema_sources set enabled = false, partnership = '{"acuerdo":"pendiente"}' where id = 'procinal';
reset role;
select pg_temp.check('admin pudo apagar la cadena y guardar la alianza', (select not enabled and partnership->>'acuerdo' = 'pendiente' from public.cinema_sources where id='procinal'));
select pg_temp.como('11111111-1111-1111-1111-111111111111');
do $$ begin begin perform public.cinema_prune_fetch_log(1); raise exception 'admin ejecutó la limpieza'; exception when insufficient_privilege then null; end; end $$;
reset role;
select pg_temp.check('semillas: 3 cadenas con su cartelera oficial', (select count(*) = 3 and bool_and(official_url like 'https://%') from public.cinema_sources));
select pg_temp.check('limpieza borra lo viejo y respeta lo reciente', (select public.cinema_prune_fetch_log(30)) = 0);
update public.cinema_fetch_log set created_at = now() - interval '40 days';
select pg_temp.check('limpieza de 40 días', (select public.cinema_prune_fetch_log(30)) = 1);
delete from public.cinema_sources where id = 'procinal';
select pg_temp.check('borrar la fuente borra su caché', (select count(*) from public.cinema_showtimes_cache) = 0);
