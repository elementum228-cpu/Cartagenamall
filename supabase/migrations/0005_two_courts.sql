-- Zona de deportes con dos canchas (A y B): cada reserva indica su cancha y el mismo horario se
-- puede reservar una vez por cancha. Las reservas anteriores quedan en la cancha A.

alter table public.court_reservations add column if not exists court text not null default 'A';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'court_reservations_court_check') then
    alter table public.court_reservations add constraint court_reservations_court_check check (court in ('A', 'B'));
  end if;
end $$;

drop index if exists public.court_reservations_slot;
create unique index if not exists court_reservations_slot_court on public.court_reservations (day, hour, court) where status <> 'cancelled';

-- Horas ocupadas de un día en una cancha (sin datos personales).
create or replace function public.court_taken_hours(p_day date, p_court text) returns setof int
language sql stable security definer set search_path = public as $$
  select hour from public.court_reservations where day = p_day and court = p_court and status <> 'cancelled'
$$;
grant execute on function public.court_taken_hours(date, text) to anon, authenticated;
