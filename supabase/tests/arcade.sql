-- Casos del Arcade. Cada línea «OK …» o «FALLA …» sale por NOTICE; los ERROR esperados se atrapan con bloques.
create or replace function pg_temp.expect_error(p_label text, p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql; raise notice 'FALLA % (no dio error)', p_label;
  exception when others then raise notice 'OK % → %', p_label, sqlerrm; end;
end $$;
create or replace function pg_temp.check(p_label text, p_ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when p_ok then 'OK' else 'FALLA' end, p_label; end $$;

do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  c uuid := '00000000-0000-0000-0000-00000000000c';
  run jsonb; run2 jsonb; res jsonb; w date := date_trunc('week', now() at time zone 'America/Bogota')::date;
  n int;
begin
  -- 1. partida: la semilla la pone el servidor; no se puede pedir otra al instante
  run := arcade_run_start(a);
  perform pg_temp.check('start entrega run_id y semilla', run ? 'run_id' and (run->>'seed')::int > 0);
  perform pg_temp.expect_error('segundo start inmediato', format('select arcade_run_start(%L)', a));

  -- 2. no se puede cerrar una partida más rápido que en tiempo real (5400 pasos = 90 s)
  perform pg_temp.expect_error('terminar al instante una partida de 90 s', format('select arcade_run_record(%L, %L, %L, 500, 5400, null)', run->>'run_id', a, 'Ana'));
  perform pg_temp.check('el intento rápido no consume la partida (sigue abierta, y puede cerrarse cuando pase el tiempo real)', (select status from arcade_runs where id = (run->>'run_id')::uuid) = 'open');

  -- 3. partida legítima: tras 100 s se guarda
  update arcade_runs set started_at = now() - interval '5 minutes' where player_id = a;
  run := arcade_run_start(a);
  update arcade_runs set started_at = now() - interval '100 seconds' where id = (run->>'run_id')::uuid;
  res := arcade_run_record((run->>'run_id')::uuid, a, 'Ana Luz', 450, 5400, '[0,-1,0]'::jsonb);
  perform pg_temp.check('450 puntos → 45 de premio, mejor semana 450', (res->>'awarded')::int = 45 and (res->>'week_best')::int = 450);
  perform pg_temp.check('rank semanal 1', (res->>'rank_week')::int = 1);
  perform pg_temp.check('con puntaje ≥ 300 guarda el registro de movimientos', (select inputs is not null from arcade_runs where id = (run->>'run_id')::uuid));

  -- 4. la partida es de un solo uso y solo de su dueño
  perform pg_temp.expect_error('reusar la partida', format('select arcade_run_record(%L, %L, %L, 999, 5400, null)', run->>'run_id', a, 'Ana'));
  update arcade_runs set started_at = now() - interval '5 minutes' where player_id = a;
  run2 := arcade_run_start(a);
  update arcade_runs set started_at = now() - interval '100 seconds' where id = (run2->>'run_id')::uuid;
  perform pg_temp.expect_error('partida de otra persona', format('select arcade_run_record(%L, %L, %L, 100, 5400, null)', run2->>'run_id', b, 'Bob'));
  perform pg_temp.expect_error('puntaje fuera de rango', format('select arcade_run_record(%L, %L, %L, 99999, 5400, null)', run2->>'run_id', a, 'Ana'));

  -- 5. topes: 60 por partida y 240 por día
  for n in 1..6 loop
    update arcade_runs set started_at = now() - interval '5 minutes' where player_id = a and status = 'open';
    update arcade_runs set started_at = started_at - interval '1 hour' where player_id = a;
    run2 := arcade_run_start(a);
    update arcade_runs set started_at = now() - interval '100 seconds' where id = (run2->>'run_id')::uuid;
    res := arcade_run_record((run2->>'run_id')::uuid, a, 'Ana Luz', 1500, 5400, null);
  end loop;
  perform pg_temp.check('tope diario 240', (select earned_today from arcade_players where player_id = a) = 240);
  perform pg_temp.check('mejor puntaje semanal sube al máximo', (select week_best from arcade_players where player_id = a) = 1500);

  -- 6. ranking semanal por mejor puntaje, sin descalificados
  insert into arcade_players (player_id, nickname, week_best, best_score, total_points) values (b, 'Bob', 900, 900, 90), (c, 'Cami', 1700, 1700, 60);
  perform pg_temp.check('top semana: Cami > Ana > Bob', (select string_agg(nickname, '>' order by rank) from arcade_top('week', null, 10)) = 'Cami>Ana Luz>Bob');
  perform pg_temp.check('is_me marca la fila propia', (select is_me from arcade_top('week', b, 10) where nickname = 'Bob'));

  -- 7. descalificar: sale de todos los rankings y del podio
  update arcade_players set banned = true where player_id = c;
  perform pg_temp.check('descalificada: ya no sale en el top', (select count(*) from arcade_top('week', null, 10) where nickname = 'Cami') = 0);

  -- 8. podio de la semana pasada (partidas verificadas con week_start anterior)
  delete from arcade_runs;
  insert into arcade_runs (player_id, seed, status, score, steps, week_start, finished_at) values
    (a, 1, 'verified', 700, 5400, w - 7, now() - interval '5 days'),
    (a, 2, 'verified', 650, 5400, w - 7, now() - interval '6 days'),
    (b, 3, 'verified', 700, 5400, w - 7, now() - interval '6 days'),   -- empata con Ana pero llegó antes: gana
    (c, 4, 'verified', 9999 / 10, 5400, w - 7, now() - interval '4 days'), -- descalificada: no cuenta
    (b, 5, 'verified', 100, 5400, w, now());                           -- de esta semana: no cuenta
  perform pg_temp.check('podio: Bob 1.º (empate, llegó antes), Ana 2.ª', (select string_agg(nickname || ':' || place, ',' order by place) from arcade_winners()) = 'Bob:1,Ana Luz:2');
  perform pg_temp.check('premio por defecto del 1.er puesto', (select prize from arcade_winners() where place = 1) like '30 %%%');
  insert into mall_settings (key, doc) values ('arcade_prizes', '{"1": "Cena para dos en el restaurante aliado"}'::jsonb);
  perform pg_temp.check('premio configurado por la administración', (select prize from arcade_winners() where place = 1) = 'Cena para dos en el restaurante aliado');
  perform pg_temp.check('los demás puestos conservan el texto por defecto', (select prize from arcade_winners() where place = 2) like '20 %%%');

  perform pg_temp.check('arcade_prizes lista los 3 puestos con su texto', (select count(*) from arcade_prizes()) = 3 and (select prize from arcade_prizes() where place = 1) = 'Cena para dos en el restaurante aliado');

  -- 9. mi premio: solo los ganadores, con código estable
  perform pg_temp.check('Bob ve su premio (puesto 1)', (arcade_my_prize(b)->>'place')::int = 1);
  perform pg_temp.check('el código es estable', arcade_my_prize(b)->>'code' = arcade_my_prize(b)->>'code' and (arcade_my_prize(b)->>'code') ~ '^GP-[0-9A-F]{6}$');
  perform pg_temp.check('los códigos de Ana y Bob difieren', arcade_my_prize(a)->>'code' <> arcade_my_prize(b)->>'code');
  perform pg_temp.check('la descalificada no ve premio', arcade_my_prize(c) is null);
  perform pg_temp.check('quien no jugó no ve premio', arcade_my_prize('00000000-0000-0000-0000-0000000000ff') is null);

  -- 10. administración: solo administradores
  perform pg_temp.expect_error('arcade_admin_week sin ser admin', 'select * from arcade_admin_week()');
  perform pg_temp.expect_error('arcade_admin_ban sin ser admin', format('select arcade_admin_ban(%L, true)', a));
end $$;

-- 10b. historial y semana (0028)
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  w date := date_trunc('week', now() at time zone 'America/Bogota')::date;
  sm jsonb;
begin
  delete from arcade_runs;
  update arcade_players set week_start = w, week_best = 0, banned = false;
  update arcade_players set week_best = 900 where player_id = a;
  update arcade_players set week_best = 400 where player_id = b;
  insert into arcade_runs (player_id, seed, status, score, steps, week_start, finished_at) values
    (a, 1, 'verified', 900, 5400, w, now() - interval '2 hours'),
    (a, 2, 'verified', 300, 5400, w, now() - interval '1 hour'),
    (a, 3, 'rejected', 5000, 10, w, now()),
    (b, 4, 'verified', 400, 5400, w, now());
  perform pg_temp.check('historial: solo mis partidas verificadas, la más reciente primero', (select string_agg(score::text, ',' order by finished_at desc) from arcade_my_history(a, 10)) = '300,900');
  perform pg_temp.check('historial de otra persona no se mezcla', (select count(*) from arcade_my_history(b, 10)) = 1);
  sm := arcade_week_summary(b);
  perform pg_temp.check('semana de Bob: puesto 2 de 2, líder 900, mejor 400', (sm->>'rank')::int = 2 and (sm->>'players')::int = 2 and (sm->>'leader')::int = 900 and (sm->>'best')::int = 400);
  perform pg_temp.check('semana de Ana: puesto 1 y 2 partidas', (arcade_week_summary(a)->>'rank')::int = 1 and (arcade_week_summary(a)->>'plays')::int = 2);
  sm := arcade_week_summary('00000000-0000-0000-0000-0000000000ff');
  perform pg_temp.check('quien no jugó ve la competencia pero no tiene puesto', (sm->>'players')::int = 2 and sm->'rank' is null or (sm->>'best') is null);
end $$;

-- 11. permisos de los visitantes anónimos
set role anon;
select pg_temp.expect_error('anon pide partida', $q$select arcade_run_start('00000000-0000-0000-0000-00000000000a')$q$);
select pg_temp.expect_error('anon guarda partida', $q$select arcade_run_record(gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'x', 999, 1, null)$q$);
select pg_temp.expect_error('anon envía puntaje directo (función eliminada)', $q$select arcade_submit('00000000-0000-0000-0000-00000000000a', 'x', 999)$q$);
select pg_temp.expect_error('anon lee la tabla de jugadores', 'select * from arcade_players');
select pg_temp.expect_error('anon lee las partidas', 'select * from arcade_runs');
select pg_temp.check('anon sí puede leer el top', (select count(*) from arcade_top('week', null, 5)) >= 0);
select pg_temp.check('anon sí puede ver el podio', (select count(*) from arcade_winners()) >= 0);
select pg_temp.check('anon puede leer su historial y su semana', (select count(*) from arcade_my_history('00000000-0000-0000-0000-00000000000a', 5)) >= 0 and arcade_week_summary('00000000-0000-0000-0000-00000000000a') is not null);
