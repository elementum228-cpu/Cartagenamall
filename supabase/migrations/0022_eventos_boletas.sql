-- Eventos del estadio (partidos y conciertos) y venta de boletas.
-- El administrador, o el negocio que opera el estadio (features.stadiumOperator), crea los eventos y gestiona las
-- boletas. Cualquiera puede ver los eventos publicados y reservar boletas (quedan «pendientes» hasta que el
-- organizador las confirma). El cupo de cada tipo de boleta lo controla la propia base de datos.

-- ¿Quien consulta es miembro del negocio que opera el estadio?
create or replace function public.is_stadium_operator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.store_members m
    join public.mall_settings s on s.key = 'features'
    where m.user_id = auth.uid() and m.store_id = (s.doc ->> 'stadiumOperator')
  )
$$;

create table if not exists public.stadium_events (
  id text primary key,
  starts_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  doc jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.stadium_tickets (
  id text primary key,
  event_id text not null references public.stadium_events (id) on delete cascade,
  tier_id text not null,
  qty int not null check (qty between 1 and 10),
  code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'used')),
  doc jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists stadium_tickets_event on public.stadium_tickets (event_id, tier_id);

-- Cupo: no se pueden reservar más boletas que la capacidad del tipo de boleta (sin contar las canceladas).
create or replace function public.stadium_check_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cap int;
  taken int;
  ev jsonb;
begin
  select doc into ev from public.stadium_events where id = new.event_id for update;
  if ev is null then raise exception 'event_not_found' using errcode = 'P0002'; end if;
  if (select status from public.stadium_events where id = new.event_id) <> 'published' then
    raise exception 'event_not_on_sale' using errcode = 'P0001';
  end if;
  select (t ->> 'capacity')::int into cap from jsonb_array_elements(ev -> 'tiers') t where t ->> 'id' = new.tier_id limit 1;
  if cap is null then raise exception 'tier_not_found' using errcode = 'P0002'; end if;
  select coalesce(sum(qty), 0) into taken from public.stadium_tickets
    where event_id = new.event_id and tier_id = new.tier_id and status <> 'cancelled' and id <> new.id;
  if taken + new.qty > cap then raise exception 'sold_out' using errcode = '23505'; end if;
  return new;
end
$$;
drop trigger if exists stadium_capacity on public.stadium_tickets;
create trigger stadium_capacity before insert on public.stadium_tickets for each row execute function public.stadium_check_capacity();

-- Boletas vendidas por tipo (sin datos de compradores): para mostrar cuántas quedan.
create or replace function public.stadium_sold() returns table (event_id text, tier_id text, sold bigint)
language sql stable security definer set search_path = public as $$
  select event_id, tier_id, coalesce(sum(qty), 0)::bigint from public.stadium_tickets where status <> 'cancelled' group by event_id, tier_id
$$;

-- Quien reservó consulta su boleta con el código (que solo él conoce).
create or replace function public.stadium_ticket_by_code(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_set(doc, '{status}', to_jsonb(status)) from public.stadium_tickets where code = upper(trim(p_code))
$$;

alter table public.stadium_events enable row level security;
alter table public.stadium_tickets enable row level security;

drop policy if exists stadium_events_read on public.stadium_events;
create policy stadium_events_read on public.stadium_events for select using (status = 'published' or public.is_admin() or public.is_stadium_operator());
drop policy if exists stadium_events_write on public.stadium_events;
create policy stadium_events_write on public.stadium_events for all
  using (public.is_admin() or public.is_stadium_operator()) with check (public.is_admin() or public.is_stadium_operator());

drop policy if exists stadium_tickets_insert on public.stadium_tickets;
create policy stadium_tickets_insert on public.stadium_tickets for insert with check (status = 'pending');
drop policy if exists stadium_tickets_read on public.stadium_tickets;
create policy stadium_tickets_read on public.stadium_tickets for select using (public.is_admin() or public.is_stadium_operator());
drop policy if exists stadium_tickets_update on public.stadium_tickets;
create policy stadium_tickets_update on public.stadium_tickets for update
  using (public.is_admin() or public.is_stadium_operator()) with check (public.is_admin() or public.is_stadium_operator());

grant select on public.stadium_events to anon, authenticated;
grant insert on public.stadium_tickets to anon, authenticated;
grant select, insert, update, delete on public.stadium_events, public.stadium_tickets to authenticated;
grant execute on function public.stadium_sold(), public.stadium_ticket_by_code(text) to anon, authenticated;

-- Las canciones de los eventos también las puede subir el negocio que opera el estadio.
drop policy if exists stadium_audio_insert on storage.objects;
create policy stadium_audio_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'stadium-audio' and (public.is_admin() or public.is_stadium_operator()));
drop policy if exists stadium_audio_update on storage.objects;
create policy stadium_audio_update on storage.objects for update to authenticated
  using (bucket_id = 'stadium-audio' and (public.is_admin() or public.is_stadium_operator()))
  with check (bucket_id = 'stadium-audio' and (public.is_admin() or public.is_stadium_operator()));
drop policy if exists stadium_audio_delete on storage.objects;
create policy stadium_audio_delete on storage.objects for delete to authenticated
  using (bucket_id = 'stadium-audio' and (public.is_admin() or public.is_stadium_operator()));

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.stadium_events'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.stadium_tickets'; exception when duplicate_object then null; end;
  end if;
end $$;
