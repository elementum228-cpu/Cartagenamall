-- Arcade: partidas sin fin (oleadas y jefes). El juego ya no termina a los 90 s: sigue mientras la nave aguante, así que los puntajes
-- pueden superar los 6000 de antes. Se sube el tope de seguridad de arcade_run_record a 5.000.000 (solo evita basura: el puntaje
-- verdadero lo calcula el servidor al repetir la partida). Los movimientos de la partida (que ahora pueden ser largos) solo se guardan a
-- partir de 3000 puntos, que es lo que revisa la administración con los ganadores. El resto de la función es idéntico al de 0027.
-- Requiere 0027 aplicada. Es seguro ejecutarla más de una vez.

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
  if p_score < 0 or p_score > 5000000 or p_steps < 0 then raise exception 'puntaje inválido' using errcode = '22023'; end if;
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
    inputs = case when p_score >= 3000 then p_inputs else null end
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

revoke all on function public.arcade_run_record(uuid, uuid, text, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.arcade_run_record(uuid, uuid, text, integer, integer, jsonb) to service_role;
