\set ON_ERROR_STOP off
select 'A1 nuevo jugador 250 pts->25', arcade_submit('00000000-0000-0000-0000-000000000001','Ana Luz',250)->>'awarded';
select 'A2 muy rápido (debe fallar)';
select arcade_submit('00000000-0000-0000-0000-000000000001','Ana Luz',100);
update arcade_players set last_submit_at = now() - interval '100 seconds' where player_id='00000000-0000-0000-0000-000000000001';
select 'A3 tras espera, 9000 inválido';
select arcade_submit('00000000-0000-0000-0000-000000000001','Ana Luz',9000);
select 'A4 score improbable 3000 tras 100s', arcade_submit('00000000-0000-0000-0000-000000000001','Ana',3000)->>'awarded';
select 'A5 tope por partida 1500->60', arcade_submit('00000000-0000-0000-0000-000000000001','Ana Luz',1500)->>'awarded';
update arcade_players set last_submit_at = now() - interval '100 seconds';
select 'A6 total: ', total_points, week_points, best_score, plays, earned_today from arcade_players;
-- tope diario: 4 partidas de 60 = 240 con 25+60 ya ganados -> solo faltan 155
do $$ declare i int; r jsonb; begin
 for i in 1..5 loop
  update arcade_players set last_submit_at = now() - interval '100 seconds';
  r := arcade_submit('00000000-0000-0000-0000-000000000001','Ana Luz',1500);
  raise notice 'ronda % -> %', i, r->>'awarded';
 end loop; end $$;
select 'A7 earned_today <= 240', earned_today from arcade_players;
select arcade_submit('00000000-0000-0000-0000-000000000002','<script>Bob</script>',700)->>'awarded';
select 'A8 nick limpio', nickname from arcade_players where player_id='00000000-0000-0000-0000-000000000002';
select 'TOP semana';
select * from arcade_top('week','00000000-0000-0000-0000-000000000002',20);
select 'ME total', arcade_me('00000000-0000-0000-0000-000000000002','total');
select 'rank desconocido', arcade_me('00000000-0000-0000-0000-0000000000ff','week');
set role anon;
select 'anon lee tabla directa (debe fallar)';
select * from arcade_players;
select 'anon usa funciones', count(*) from arcade_top();
