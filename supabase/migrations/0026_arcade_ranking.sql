-- Ranking del Arcade («Nave Caribe»): tabla de líderes compartida por todos los visitantes.
-- Los jugadores no inician sesión: cada dispositivo tiene un identificador aleatorio (player_id) que NUNCA se publica.
-- La tabla no tiene políticas de lectura ni escritura directas (RLS activa, sin políticas): todo pasa por las funciones de
-- abajo, que validan el puntaje, limitan la frecuencia y el tope diario y solo devuelven apodo y cifras.
-- No se guarda ningún dato personal: solo el apodo que la persona elige.

create table if not exists public.arcade_players (
  player_id uuid primary key,
  nickname text not null check (char_length(nickname) between 2 and 16),
  best_score integer not null default 0 check (best_score >= 0),
  total_points integer not null default 0 check (total_points >= 0),
  plays integer not null default 0,
  -- Puntos del día (para el tope diario) y de la semana en curso (el ranking semanal se reinicia solo cada lunes).
  day date not null default ((now() at time zone 'America/Bogota')::date),
  earned_today integer not null default 0,
  week_start date not null default (date_trunc('week', now() at time zone 'America/Bogota')::date),
  week_points integer not null default 0,
  last_submit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists arcade_players_total_idx on public.arcade_players (total_points desc, updated_at);
create index if not exists arcade_players_week_idx on public.arcade_players (week_start, week_points desc, updated_at);

alter table public.arcade_players enable row level security;
-- Sin políticas a propósito: ni anon ni authenticated leen o escriben la tabla directamente.
revoke all on public.arcade_players from anon, authenticated;

-- Reglas del juego (deben coincidir con src/arcade/store.ts).
--   1 punto por cada 10 de puntaje · máx. 60 por partida · 240 por día.
--   Un puntaje no puede superar lo que se alcanza en la ronda de 90 s ni lo que cabe en el tiempo desde la partida anterior.

create or replace function public.arcade_submit(p_player uuid, p_nickname text, p_score integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nick text := btrim(regexp_replace(coalesce(p_nickname, ''), '[^[:alnum:] _.\-áéíóúüñÁÉÍÓÚÜÑ]', '', 'g'));
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_week date := date_trunc('week', now() at time zone 'America/Bogota')::date;
  r public.arcade_players;
  v_elapsed numeric;
  v_awarded integer;
  v_wanted integer;
begin
  if p_player is null then raise exception 'jugador inválido' using errcode = '22023'; end if;
  if p_score is null or p_score < 0 or p_score > 6000 then raise exception 'puntaje inválido' using errcode = '22023'; end if;
  if char_length(v_nick) < 2 then v_nick := 'Jugador'; end if;
  v_nick := left(v_nick, 16);

  select * into r from public.arcade_players where player_id = p_player for update;
  if not found then
    insert into public.arcade_players (player_id, nickname) values (p_player, v_nick) returning * into r;
  else
    v_elapsed := extract(epoch from (now() - coalesce(r.last_submit_at, now() - interval '1 day')));
    -- Una partida no puede enviarse con menos de 8 s de diferencia ni con más puntaje del que cabe en ese tiempo.
    if v_elapsed < 8 then raise exception 'demasiado rápido' using errcode = '54000'; end if;
    if p_score > 150 + 70 * least(v_elapsed, 90) then raise exception 'puntaje improbable' using errcode = '22023'; end if;
  end if;

  if r.day <> v_today then r.day := v_today; r.earned_today := 0; end if;
  if r.week_start <> v_week then r.week_start := v_week; r.week_points := 0; end if;

  v_wanted := least(60, p_score / 10);
  v_awarded := greatest(0, least(v_wanted, 240 - r.earned_today));

  update public.arcade_players set
    nickname = v_nick,
    best_score = greatest(best_score, p_score),
    total_points = total_points + v_awarded,
    plays = plays + 1,
    day = r.day,
    earned_today = r.earned_today + v_awarded,
    week_start = r.week_start,
    week_points = r.week_points + v_awarded,
    last_submit_at = now(),
    updated_at = now()
  where player_id = p_player
  returning * into r;

  return jsonb_build_object(
    'awarded', v_awarded,
    'best_score', r.best_score,
    'total_points', r.total_points,
    'week_points', r.week_points,
    'rank_week', (select count(*) + 1 from public.arcade_players o where o.week_start = r.week_start and o.week_points > r.week_points),
    'rank_total', (select count(*) + 1 from public.arcade_players o where o.total_points > r.total_points)
  );
end;
$$;

-- Tabla de líderes. p_kind: 'week' (puntos de la semana), 'total' (puntos acumulados) o 'best' (mejor puntaje de una partida: premia la
-- habilidad, porque los puntos tienen tope diario). Con p_player, marca la fila propia.
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
      case p_kind when 'total' then p.total_points when 'best' then p.best_score else p.week_points end as pts,
      p.nickname, p.best_score, p.plays, p.player_id, p.updated_at
    from public.arcade_players p, cur
    where p_kind in ('total', 'best') or p.week_start = cur.w
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

-- Puesto de una persona aunque no esté entre los primeros.
create or replace function public.arcade_me(p_player uuid, p_kind text default 'week')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with cur as (select date_trunc('week', now() at time zone 'America/Bogota')::date as w),
  me as (
    select p.*, case p_kind when 'total' then p.total_points when 'best' then p.best_score else (case when p.week_start = cur.w then p.week_points else 0 end) end as pts
    from public.arcade_players p, cur where p.player_id = p_player
  )
  select case when (select count(*) from me) = 0 then null else jsonb_build_object(
    'nickname', (select nickname from me),
    'points', (select pts from me),
    'best_score', (select best_score from me),
    'rank', (select count(*) + 1 from public.arcade_players o, cur
              where (case p_kind when 'total' then o.total_points when 'best' then o.best_score else (case when o.week_start = cur.w then o.week_points else 0 end) end) > (select pts from me))
  ) end;
$$;

revoke all on function public.arcade_submit(uuid, text, integer) from public;
revoke all on function public.arcade_top(text, uuid, integer) from public;
revoke all on function public.arcade_me(uuid, text) from public;
grant execute on function public.arcade_submit(uuid, text, integer) to anon, authenticated;
grant execute on function public.arcade_top(text, uuid, integer) to anon, authenticated;
grant execute on function public.arcade_me(uuid, text) to anon, authenticated;
