-- Barco de los descuentos compartido: los dueños suben sus ofertas y pueden habilitar el barco para todos.

create table if not exists public.ship_offers (
  store_id text primary key references public.stores (id) on delete cascade,
  doc jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.ship_offers enable row level security;
drop policy if exists ship_offers_read on public.ship_offers;
create policy ship_offers_read on public.ship_offers for select using (true);
drop policy if exists ship_offers_write on public.ship_offers;
create policy ship_offers_write on public.ship_offers for all
  using (public.is_admin() or public.is_member(store_id)) with check (public.is_admin() or public.is_member(store_id));
grant select on public.ship_offers to anon, authenticated;
grant insert, update, delete on public.ship_offers to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.ship_offers';
    exception when duplicate_object then null; end;
  end if;
end $$;

-- Habilita el barco: atraca 30 minutos para todos. Lo puede pedir el dueño de un local que ya subió su oferta
-- (con 2 horas de espera entre viajes) o un administrador.
create or replace function public.ship_launch(p_store text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cur jsonb;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  stay bigint := 30 * 60 * 1000;
  cool bigint := 2 * 60 * 60 * 1000;
begin
  if not (public.is_admin() or public.is_member(p_store)) then
    raise exception 'Solo el dueño del local puede habilitar el barco';
  end if;
  if not public.is_admin() and not exists (select 1 from public.ship_offers where store_id = p_store) then
    raise exception 'Sube primero tu oferta al barco';
  end if;
  select doc into cur from public.mall_settings where key = 'ship';
  if cur is not null and cur -> 'arrival' is not null and (cur -> 'arrival' ->> 'until')::bigint > now_ms then
    return cur; -- ya está atracado
  end if;
  if not public.is_admin() and cur is not null and cur -> 'arrival' is not null and (cur -> 'arrival' ->> 'at')::bigint + cool > now_ms then
    raise exception 'El barco acaba de zarpar; podrá volver en un rato';
  end if;
  cur := jsonb_build_object('arrival', jsonb_build_object('at', now_ms, 'until', now_ms + stay, 'by', p_store));
  insert into public.mall_settings (key, doc) values ('ship', cur) on conflict (key) do update set doc = excluded.doc;
  return cur;
end $$;
grant execute on function public.ship_launch(text) to authenticated;
