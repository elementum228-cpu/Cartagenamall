-- Arcade: partidas verificadas por el servidor, ranking semanal por mejor puntaje y premios para los primeros puestos.
-- Requiere 0026. Cambia el modelo: el navegador YA NO envía su puntaje. Pide una partida (semilla que entrega el servidor), juega,
-- y manda el registro de sus movimientos; la función `arcade-run` repite la partida con la misma lógica y guarda SU puntaje.
-- Aquí quedan las tablas y las funciones que solo esa función (llave de servicio) puede llamar, más las de lectura pública.

alter table public.arcade_players add column if not exists week_best integer not null default 0 check (week_best >= 0);
alter table public.arcade_players add column if not exists banned boolean not null default false;

-- Cada partida pedida: la semilla la pone el servidor (nadie elige una favorable), solo se puede usar una vez y se guarda el registro
-- de movimientos de las buenas partidas para que la administración pueda revisarlas y descalificar trampas.
create table if not exists public.arcade_runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  seed integer not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'open' check (status in ('open', 'verified', 'rejected')),
  score integer,
  steps integer,
  week_start date,
  reject_reason text,
  -- Registro de movimientos [paso, objetivo, dirección]*; solo de partidas con puntaje alto (se limpia a los 45 días).
  inputs jsonb
);
create index if not exists arcade_runs_player_idx on public.arcade_runs (player_id, started_at desc);
create index if not exists arcade_runs_week_idx on public.arcade_runs (week_start, score desc) where status = 'verified';
alter table public.arcade_runs enable row level security;
revoke all on public.arcade_runs from anon, authenticated;

-- El envío directo de puntaje (0026) queda eliminado: cualquiera podía mandar el número que quisiera.
drop function if exists public.arcade_submit(uuid, text, integer);

-- Pide una partida. Máx. una cada 4 s por jugador; las abiertas anteriores se cierran.
create or replace function public.arcade_run_start(p_player uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
  v_id uuid;
  v_seed integer := (floor(random() * 2147483646) + 1)::integer;
begin
  if p_player is null then raise exception 'jugador inválido' using errcode = '22023'; end if;
  select max(started_at) into v_last from public.arcade_runs where player_id = p_player;
  if v_last is not null and now() - v_last < interval '4 seconds' then raise exception 'demasiado rápido' using errcode = '54000'; end if;
  update public.arcade_runs set status = 'rejected', reject_reason = 'reemplazada' where player_id = p_player and status = 'open';
  insert into public.arcade_runs (player_id, seed) values (p_player, v_seed) returning id into v_id;
  -- limpieza oportunista: abiertas viejas y registros de movimientos antiguos
  delete from public.arcade_runs where status <> 'verified' and started_at < now() - interval '2 days';
  update public.arcade_runs set inputs = null where inputs is not null and started_at < now() - interval '45 days';
  return jsonb_build_object('run_id', v_id, 'seed', v_seed);
end;
$$;

-- Guarda una partida YA repetida por el servidor (la función de borde pasa el puntaje que ella misma calculó).
-- Reglas: la partida es de ese jugador y sigue abierta; no puede haber terminado antes de lo que dura jugarla (pasos/60 s).
create or replace function public.arcade_run_record(p_run uuid, p_player uuid, p_nickname text, p_score integer, p_steps integer, p_inputs jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nick text := btrim(regexp_replace(coalesce(p_nickname, ''), '[^[:alnum:] _.\-áéíóúüñÁÉÍÓÚÜÑ]', '', 'g'));
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_week date := date_trunc('week', now() at time zone 'America/Bogota')::date;
  run public.arcade_runs;
  r public.arcade_players;
  v_awarded integer;
begin
  if char_length(v_nick) < 2 then v_nick := 'Jugador'; end if;
  v_nick := left(v_nick, 16);
  select * into run from public.arcade_runs where id = p_run for update;
  if not found or run.player_id <> p_player then raise exception 'partida desconocida' using errcode = '22023'; end if;
  if run.status <> 'open' then raise exception 'partida ya usada' using errcode = '22023'; end if;
  if p_score < 0 or p_score > 6000 or p_steps < 0 then raise exception 'puntaje inválido' using errcode = '22023'; end if;
  -- No se puede terminar más rápido que en tiempo real (2 s de margen por relojes distintos).
  if extract(epoch from (now() - run.started_at)) < p_steps / 60.0 - 2 then
    raise exception 'partida demasiado rápida' using errcode = '54000';
  end if;

  select * into r from public.arcade_players where player_id = p_player for update;
  if not found then
    insert into public.arcade_players (player_id, nickname) values (p_player, v_nick) returning * into r;
  end if;
  if r.day <> v_today then r.day := v_today; r.earned_today := 0; end if;
  if r.week_start <> v_week then r.week_start := v_week; r.week_points := 0; r.week_best := 0; end if;
  v_awarded := greatest(0, least(least(60, p_score / 10), 240 - r.earned_today));

  update public.arcade_players set
    nickname = v_nick,
    best_score = greatest(best_score, p_score),
    week_best = greatest(r.week_best, p_score),
    total_points = total_points + v_awarded,
    plays = plays + 1,
    day = r.day, earned_today = r.earned_today + v_awarded,
    week_start = r.week_start, week_points = r.week_points + v_awarded,
    last_submit_at = now(), updated_at = now()
  where player_id = p_player
  returning * into r;

  update public.arcade_runs set status = 'verified', finished_at = now(), score = p_score, steps = p_steps, week_start = v_week,
    inputs = case when p_score >= 300 then p_inputs else null end
  where id = p_run;

  return jsonb_build_object(
    'score', p_score,
    'awarded', v_awarded,
    'best_score', r.best_score,
    'week_best', r.week_best,
    'banned', r.banned,
    'rank_week', case when r.banned then null else (select count(*) + 1 from public.arcade_players o where o.week_start = r.week_start and not o.banned and o.week_best > r.week_best) end,
    'rank_total', (select count(*) + 1 from public.arcade_players o where not o.banned and o.total_points > r.total_points)
  );
end;
$$;

-- Tabla de líderes (lectura pública, sin identificadores). p_kind:
--   'week'  → mejor puntaje de la semana en curso (el que da los premios; se reinicia cada lunes)
--   'best'  → mejor puntaje de todos los tiempos
--   'total' → puntos acumulados
create or replace function public.arcade_top(p_kind text default 'week', p_player uuid default null, p_limit integer default 20)
returns table (rank bigint, nickname text, points integer, best_score integer, plays integer, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with cur as (select date_trunc('week', now() at time zone 'America/Bogota')::date as w),
  ranked as (
    select
      case p_kind when 'total' then p.total_points when 'best' then p.best_score else p.week_best end as pts,
      p.nickname, p.best_score, p.plays, p.player_id, p.updated_at
    from public.arcade_players p, cur
    where not p.banned and (p_kind in ('total', 'best') or p.week_start = cur.w)
  )
  select
    rank() over (order by pts desc, updated_at asc) as rank,
    nickname, pts as points, best_score, plays,
    (p_player is not null and player_id = p_player) as is_me
  from ranked
  where pts > 0
  order by pts desc, updated_at asc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create or replace function public.arcade_me(p_player uuid, p_kind text default 'week')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with cur as (select date_trunc('week', now() at time zone 'America/Bogota')::date as w),
  scored as (
    select p.player_id, p.nickname, p.best_score, p.banned,
      case p_kind when 'total' then p.total_points when 'best' then p.best_score
        else (case when p.week_start = cur.w then p.week_best else 0 end) end as pts
    from public.arcade_players p, cur
  ),
  me as (select * from scored where player_id = p_player and not banned)
  select case when (select count(*) from me) = 0 then null else jsonb_build_object(
    'nickname', (select nickname from me),
    'points', (select pts from me),
    'best_score', (select best_score from me),
    'rank', (select count(*) + 1 from scored o where not o.banned and o.pts > (select pts from me))
  ) end;
$$;

-- Premios de los primeros puestos de la semana (texto editable por la administración en mall_settings, clave «arcade_prizes»:
-- {"1": "…", "2": "…", "3": "…"}). Sin configurar, estos textos.
create or replace function public.arcade_prize_text(p_place integer)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select doc ->> p_place::text from public.mall_settings where key = 'arcade_prizes'),
    case p_place
      when 1 then '30 % de descuento en el restaurante o local aliado que elijas'
      when 2 then '20 % de descuento en el restaurante o local aliado que elijas'
      else '10 % de descuento en el restaurante o local aliado que elijas'
    end
  );
$$;

-- Los tres premios vigentes (para mostrarlos antes de que haya ganadores).
create or replace function public.arcade_prizes()
returns table (place integer, prize text)
language sql
stable
security definer
set search_path = public
as $$
  select p, public.arcade_prize_text(p) from generate_series(1, 3) p;
$$;

-- Podio de una semana ya cerrada (p_week = lunes de esa semana; sin indicar, la semana pasada). Mejor partida verificada de cada
-- persona; en empate gana quien la logró primero. Las personas descalificadas no cuentan.
create or replace function public.arcade_winners(p_week date default null)
returns table (week_start date, place bigint, nickname text, score integer, prize text)
language sql
stable
security definer
set search_path = public
as $$
  with w as (select coalesce(p_week, (date_trunc('week', now() at time zone 'America/Bogota')::date - 7)) as d),
  best as (
    select distinct on (r.player_id) r.player_id, r.score, r.finished_at
    from public.arcade_runs r, w
    where r.status = 'verified' and r.week_start = w.d
    order by r.player_id, r.score desc, r.finished_at asc
  ),
  ranked as (
    select b.player_id, b.score, p.nickname, row_number() over (order by b.score desc, b.finished_at asc) as place
    from best b join public.arcade_players p on p.player_id = b.player_id
    where not p.banned and b.score > 0
  )
  select (select d from w), place, nickname, score, public.arcade_prize_text(place::integer)
  from ranked where place <= 3 order by place;
$$;

-- ¿Ganó esta persona la semana pasada? Devuelve su puesto, premio y código para mostrar en caja (null si no ganó).
-- El código sale del identificador privado del jugador, así que nadie más puede calcularlo.
create or replace function public.arcade_my_prize(p_player uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with w as (select (date_trunc('week', now() at time zone 'America/Bogota')::date - 7) as d),
  best as (
    select distinct on (r.player_id) r.player_id, r.score, r.finished_at
    from public.arcade_runs r, w
    where r.status = 'verified' and r.week_start = w.d
    order by r.player_id, r.score desc, r.finished_at asc
  ),
  ranked as (
    select b.player_id, b.score, row_number() over (order by b.score desc, b.finished_at asc) as place
    from best b join public.arcade_players p on p.player_id = b.player_id
    where not p.banned and b.score > 0
  )
  select case when r.place is null or r.place > 3 then null else jsonb_build_object(
    'week', (select d from w),
    'place', r.place,
    'score', r.score,
    'prize', public.arcade_prize_text(r.place::integer),
    'code', 'GP-' || upper(substr(md5((select d from w)::text || p_player::text || 'arcade-premio'), 1, 6))
  ) end
  from (select 1) x left join ranked r on r.player_id = p_player;
$$;

-- Administración: podio ampliado de una semana con lo necesario para revisarlo (identificador, partida y registro de movimientos).
create or replace function public.arcade_admin_week(p_week date default null)
returns table (place bigint, player_id uuid, nickname text, score integer, run_id uuid, finished_at timestamptz, steps integer, banned boolean, code text, has_replay boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_week date := coalesce(p_week, date_trunc('week', now() at time zone 'America/Bogota')::date - 7);
begin
  if not public.is_admin() then raise exception 'solo administradores' using errcode = '42501'; end if;
  return query
  with best as (
    select distinct on (r.player_id) r.player_id, r.id, r.score, r.finished_at, r.steps, r.inputs
    from public.arcade_runs r where r.status = 'verified' and r.week_start = v_week
    order by r.player_id, r.score desc, r.finished_at asc
  )
  select row_number() over (order by b.score desc, b.finished_at asc), b.player_id, p.nickname, b.score, b.id, b.finished_at, b.steps, p.banned,
    'GP-' || upper(substr(md5(v_week::text || b.player_id::text || 'arcade-premio'), 1, 6)), b.inputs is not null
  from best b join public.arcade_players p on p.player_id = b.player_id
  order by b.score desc, b.finished_at asc
  limit 10;
end;
$$;

create or replace function public.arcade_admin_ban(p_player uuid, p_banned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'solo administradores' using errcode = '42501'; end if;
  update public.arcade_players set banned = p_banned, updated_at = now() where player_id = p_player;
end;
$$;

-- Permisos. Pedir y guardar partidas: solo la función de borde (llave de servicio). Leer podio y puestos: todos.
revoke all on function public.arcade_run_start(uuid) from public, anon, authenticated;
revoke all on function public.arcade_run_record(uuid, uuid, text, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.arcade_run_start(uuid) to service_role;
grant execute on function public.arcade_run_record(uuid, uuid, text, integer, integer, jsonb) to service_role;

revoke all on function public.arcade_top(text, uuid, integer) from public;
revoke all on function public.arcade_me(uuid, text) from public;
revoke all on function public.arcade_winners(date) from public;
revoke all on function public.arcade_my_prize(uuid) from public;
revoke all on function public.arcade_prize_text(integer) from public;
revoke all on function public.arcade_prizes() from public;
grant execute on function public.arcade_prizes() to anon, authenticated;
revoke all on function public.arcade_admin_week(date) from public;
revoke all on function public.arcade_admin_ban(uuid, boolean) from public;
grant execute on function public.arcade_top(text, uuid, integer) to anon, authenticated;
grant execute on function public.arcade_me(uuid, text) to anon, authenticated;
grant execute on function public.arcade_winners(date) to anon, authenticated;
grant execute on function public.arcade_my_prize(uuid) to anon, authenticated;
grant execute on function public.arcade_admin_week(date) to authenticated;
grant execute on function public.arcade_admin_ban(uuid, boolean) to authenticated;
