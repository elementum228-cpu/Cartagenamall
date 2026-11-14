-- Arcade: historial de partidas de cada persona y su situación en el ranking de la semana. Requiere 0026 y 0027.
-- Cada partida verificada ya queda guardada en arcade_runs; aquí se exponen, sin identificadores de otras personas, las funciones
-- para que cada jugador vea SUS partidas y se compare con la semana (puesto, líder, cuánto le falta).

-- Mis últimas partidas verificadas (más recientes primero).
create or replace function public.arcade_my_history(p_player uuid, p_limit integer default 40)
returns table (score integer, finished_at timestamptz, week_start date)
language sql
stable
security definer
set search_path = public
as $$
  select r.score, r.finished_at, r.week_start
  from public.arcade_runs r
  where r.player_id = p_player and r.status = 'verified'
  order by r.finished_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

-- Mi semana frente a todos: puesto, cuántos juegan, mi mejor puntaje, el del líder y cuánto me falta para alcanzarlo.
-- Sin partidas esta semana devuelve solo los datos de la competencia (players, leader).
create or replace function public.arcade_week_summary(p_player uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with cur as (select date_trunc('week', now() at time zone 'America/Bogota')::date as w),
  wk as (
    select p.player_id, p.week_best, p.updated_at
    from public.arcade_players p, cur
    where p.week_start = cur.w and not p.banned and p.week_best > 0
  ),
  me as (select * from wk where player_id = p_player)
  select jsonb_build_object(
    'players', (select count(*) from wk),
    'leader', coalesce((select max(week_best) from wk), 0),
    'best', (select week_best from me),
    'rank', (select count(*) + 1 from wk o where o.week_best > (select week_best from me)),
    'plays', (select count(*) from public.arcade_runs r, cur
              where r.player_id = p_player and r.status = 'verified' and r.week_start = cur.w),
    'week_start', (select w from cur)
  );
$$;

revoke all on function public.arcade_my_history(uuid, integer) from public;
revoke all on function public.arcade_week_summary(uuid) from public;
grant execute on function public.arcade_my_history(uuid, integer) to anon, authenticated;
grant execute on function public.arcade_week_summary(uuid) to anon, authenticated;
