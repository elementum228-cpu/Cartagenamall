-- Horarios de cine por ciudad: fuentes (una por cadena), caché de lo que entrega cada fuente y registro de intentos.
-- Solo la función `cinema-showtimes` (con la llave de servicio) escribe; la administración puede leer todo y cambiar `enabled`
-- y `partnership`. No se guarda ningún dato personal de los usuarios.

create table if not exists public.cinema_sources (
  id text primary key,
  name text not null,
  official_url text not null,
  -- Interruptor de la administración: apagada, la cadena sale «no disponible» sin consultar su fuente.
  enabled boolean not null default true,
  -- Reservado para futuras alianzas comerciales con la cadena (acuerdo, contacto, parámetros de afiliado, condiciones…).
  partnership jsonb not null default '{}'::jsonb,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  -- Código del último error (timeout, http_error, network, invalid_response…); null si el último intento funcionó.
  last_error_code text,
  updated_at timestamptz not null default now()
);

create table if not exists public.cinema_showtimes_cache (
  provider_id text not null references public.cinema_sources(id) on delete cascade,
  city text not null,
  date date not null,
  -- Sedes con sus películas y funciones, ya normalizadas (ver supabase/functions/_shared/cinema/types.ts).
  payload jsonb not null default '[]'::jsonb,
  dropped integer not null default 0,
  fetched_at timestamptz,
  last_attempt_at timestamptz,
  last_error_code text,
  updated_at timestamptz not null default now(),
  primary key (provider_id, city, date)
);

create table if not exists public.cinema_fetch_log (
  id bigint generated always as identity primary key,
  provider_id text not null,
  city text not null,
  date date not null,
  ok boolean not null,
  error_code text,
  -- Detalle corto sin URLs completas ni claves.
  detail text,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists cinema_fetch_log_created_idx on public.cinema_fetch_log (created_at desc);

drop trigger if exists touch on public.cinema_sources;
create trigger touch before update on public.cinema_sources for each row execute function public.touch_updated_at();

insert into public.cinema_sources (id, name, official_url) values
  ('cinecolombia', 'Cine Colombia', 'https://www.cinecolombia.com/cartagena'),
  ('procinal', 'Procinal', 'https://www.procinal.com.co/ciudad/cartagena'),
  ('royalfilms', 'Royal Films', 'https://cinemasroyal.com/cartelera/cartagena')
on conflict (id) do nothing;

alter table public.cinema_sources enable row level security;
alter table public.cinema_showtimes_cache enable row level security;
alter table public.cinema_fetch_log enable row level security;

-- Sin políticas para anon: nadie lee ni escribe estas tablas desde el navegador (la app usa la función). Administración:
drop policy if exists cinema_sources_admin_read on public.cinema_sources;
create policy cinema_sources_admin_read on public.cinema_sources for select to authenticated using (public.is_admin());
drop policy if exists cinema_sources_admin_update on public.cinema_sources;
create policy cinema_sources_admin_update on public.cinema_sources for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists cinema_cache_admin_read on public.cinema_showtimes_cache;
create policy cinema_cache_admin_read on public.cinema_showtimes_cache for select to authenticated using (public.is_admin());
drop policy if exists cinema_log_admin_read on public.cinema_fetch_log;
create policy cinema_log_admin_read on public.cinema_fetch_log for select to authenticated using (public.is_admin());

grant select, update on public.cinema_sources to authenticated;
grant select on public.cinema_showtimes_cache, public.cinema_fetch_log to authenticated;

-- Limpieza del historial de intentos (programarla, p. ej. una vez al día): borra lo anterior a `days` días.
create or replace function public.cinema_prune_fetch_log(days integer default 30) returns integer
language sql security definer set search_path = public as $$
  with gone as (delete from public.cinema_fetch_log where created_at < now() - make_interval(days => days) returning 1)
  select count(*)::integer from gone;
$$;
revoke all on function public.cinema_prune_fetch_log(integer) from public, anon, authenticated;
