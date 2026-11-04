-- Reservas de la pista de karts: usan la misma tabla que las canchas, con la clave 'KARTS'.
-- Cada horario se puede reservar una vez por pista/cancha (el índice único ya incluye la columna).
alter table public.court_reservations drop constraint if exists court_reservations_court_check;
alter table public.court_reservations add constraint court_reservations_court_check check (court in ('A', 'B', 'KARTS'));
