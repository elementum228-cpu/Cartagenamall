-- Cartagena Mall: esquema inicial para Supabase.
--
-- Diseño: cada entidad guarda su documento completo en `doc` (jsonb, la misma forma que usa la app)
-- y saca a columnas solo lo que necesitan las reglas de acceso (RLS) y las búsquedas: tienda dueña,
-- estado, día y hora. Así el modelo de la app puede crecer sin migraciones por cada campo.
--
-- Roles:
--   · anónimo: ve el catálogo (tiendas, productos, promociones, locales), envía pedidos, solicitudes
--     de locales y reservas de la cancha. No puede leer pedidos ni datos de otras personas.
--   · comerciante (store_members): edita su tienda, sus productos y promociones y ve/atiende sus
--     subpedidos.
--   · administrador (admins): todo.

-- ── Roles de la plataforma ────────────────────────────────────────────────────

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.stores (
  id text primary key,
  doc jsonb not null,
  updated_at timestamptz not null default now(),
  constraint stores_doc_id check (doc ->> 'id' = id)
);

create table if not exists public.store_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  store_id text not null references public.stores (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

create or replace function public.is_member(p_store text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.store_members where user_id = auth.uid() and store_id = p_store)
$$;

-- ── Catálogo ──────────────────────────────────────────────────────────────────

create table if not exists public.products (
  id text primary key,
  store_id text not null references public.stores (id) on delete cascade,
  doc jsonb not null,
  updated_at timestamptz not null default now(),
  constraint products_doc check (doc ->> 'id' = id and doc ->> 'storeId' = store_id)
);
create index if not exists products_store on public.products (store_id);

create table if not exists public.promotions (
  id text primary key,
  store_id text not null references public.stores (id) on delete cascade,
  doc jsonb not null,
  updated_at timestamptz not null default now(),
  constraint promotions_doc check (doc ->> 'id' = id and doc ->> 'storeId' = store_id)
);
create index if not exists promotions_store on public.promotions (store_id);

-- Local del mall (espacio) → tienda. Una tienda ocupa un solo espacio.
create table if not exists public.space_assignments (
  space_id text primary key,
  store_id text not null unique references public.stores (id) on delete cascade,
  updated_at timestamptz not null default now()
);

-- ── Pedidos (divididos por tienda) ───────────────────────────────────────────

create table if not exists public.orders (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sub_orders (
  id text primary key,
  order_id text not null references public.orders (id) on delete cascade,
  store_id text not null references public.stores (id) on delete cascade,
  status text not null default 'pending_confirmation'
    check (status in ('received', 'pending_confirmation', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
  doc jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists sub_orders_store on public.sub_orders (store_id);
create index if not exists sub_orders_order on public.sub_orders (order_id);

-- ── Solicitudes de locales y reservas de la cancha ───────────────────────────

create table if not exists public.space_claims (
  id text primary key,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  doc jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.court_reservations (
  id text primary key,
  day date not null,
  hour int not null check (hour between 0 and 23),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  doc jsonb not null,
  created_at timestamptz not null default now()
);
-- Un horario solo puede tener una reserva vigente.
create unique index if not exists court_reservations_slot on public.court_reservations (day, hour) where status <> 'cancelled';

-- ── Marcas de tiempo ──────────────────────────────────────────────────────────

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$ declare t text;
begin
  foreach t in array array['stores', 'products', 'promotions', 'space_assignments', 'sub_orders'] loop
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.admins enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.products enable row level security;
alter table public.promotions enable row level security;
alter table public.space_assignments enable row level security;
alter table public.orders enable row level security;
alter table public.sub_orders enable row level security;
alter table public.space_claims enable row level security;
alter table public.court_reservations enable row level security;

-- admins: cada quien puede saber si es admin; solo admins gestionan la lista.
drop policy if exists admins_read on public.admins;
create policy admins_read on public.admins for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists admins_write on public.admins;
create policy admins_write on public.admins for all using (public.is_admin()) with check (public.is_admin());

-- store_members: el comerciante ve sus membresías; el admin las gestiona.
drop policy if exists members_read on public.store_members;
create policy members_read on public.store_members for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists members_write on public.store_members;
create policy members_write on public.store_members for all using (public.is_admin()) with check (public.is_admin());

-- Catálogo: lectura pública; escritura del admin o del comerciante de esa tienda.
drop policy if exists stores_read on public.stores;
create policy stores_read on public.stores for select using (true);
drop policy if exists stores_insert on public.stores;
create policy stores_insert on public.stores for insert with check (public.is_admin());
drop policy if exists stores_update on public.stores;
create policy stores_update on public.stores for update using (public.is_admin() or public.is_member(id)) with check (public.is_admin() or public.is_member(id));
drop policy if exists stores_delete on public.stores;
create policy stores_delete on public.stores for delete using (public.is_admin());

drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (true);
drop policy if exists products_write on public.products;
create policy products_write on public.products for all using (public.is_admin() or public.is_member(store_id)) with check (public.is_admin() or public.is_member(store_id));

drop policy if exists promotions_read on public.promotions;
create policy promotions_read on public.promotions for select using (true);
drop policy if exists promotions_write on public.promotions;
create policy promotions_write on public.promotions for all using (public.is_admin() or public.is_member(store_id)) with check (public.is_admin() or public.is_member(store_id));

drop policy if exists assignments_read on public.space_assignments;
create policy assignments_read on public.space_assignments for select using (true);
drop policy if exists assignments_write on public.space_assignments;
create policy assignments_write on public.space_assignments for all using (public.is_admin()) with check (public.is_admin());

-- Pedidos: cualquiera puede enviar uno (sin cobro); leen el admin y las tiendas del pedido.
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert with check (true);
drop policy if exists orders_read on public.orders;
create or replace function public.can_see_order(p_order text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.sub_orders s join public.store_members m on m.store_id = s.store_id
    where s.order_id = p_order and m.user_id = auth.uid()
  )
$$;
create policy orders_read on public.orders for select using (public.can_see_order(id));

drop policy if exists sub_orders_insert on public.sub_orders;
create policy sub_orders_insert on public.sub_orders for insert with check (status = 'pending_confirmation');
drop policy if exists sub_orders_read on public.sub_orders;
create policy sub_orders_read on public.sub_orders for select using (public.is_admin() or public.is_member(store_id));
drop policy if exists sub_orders_update on public.sub_orders;
create policy sub_orders_update on public.sub_orders for update using (public.is_admin() or public.is_member(store_id)) with check (public.is_admin() or public.is_member(store_id));

-- Solicitudes de locales: cualquiera envía; solo el admin lee y decide.
drop policy if exists claims_insert on public.space_claims;
create policy claims_insert on public.space_claims for insert with check (status = 'pending');
drop policy if exists claims_admin on public.space_claims;
create policy claims_admin on public.space_claims for select using (public.is_admin());
drop policy if exists claims_update on public.space_claims;
create policy claims_update on public.space_claims for update using (public.is_admin()) with check (public.is_admin());

-- Reservas de la cancha: cualquiera reserva un horario libre; solo el admin ve los datos.
drop policy if exists court_insert on public.court_reservations;
create policy court_insert on public.court_reservations for insert with check (status = 'pending');
drop policy if exists court_admin on public.court_reservations;
create policy court_admin on public.court_reservations for select using (public.is_admin());
drop policy if exists court_update on public.court_reservations;
create policy court_update on public.court_reservations for update using (public.is_admin()) with check (public.is_admin());

-- ── Funciones públicas ────────────────────────────────────────────────────────

-- Horas ocupadas de un día (sin datos personales) para pintar la grilla de reservas.
create or replace function public.court_taken_hours(p_day date) returns setof int
language sql stable security definer set search_path = public as $$
  select hour from public.court_reservations where day = p_day and status <> 'cancelled'
$$;

-- Quién soy en el mall: si soy admin y de qué tiendas soy comerciante.
create or replace function public.my_roles() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'is_admin', public.is_admin(),
    'store_ids', coalesce((select jsonb_agg(store_id order by store_id) from public.store_members where user_id = auth.uid()), '[]'::jsonb)
  )
$$;

-- El admin vincula a un comerciante con su tienda por correo (la persona debe haber entrado una vez).
create or replace function public.add_store_member(p_store text, p_email text) returns text
language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede asignar comerciantes'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then return 'no_user'; end if;
  insert into public.store_members (user_id, store_id) values (v_user, p_store) on conflict do nothing;
  return 'ok';
end $$;

-- Correos de los comerciantes de una tienda (para mostrarlos en /admin).
create or replace function public.store_member_emails(p_store text) returns setof text
language sql stable security definer set search_path = public, auth as $$
  select u.email::text from public.store_members m join auth.users u on u.id = m.user_id
  where m.store_id = p_store and public.is_admin()
$$;

-- El dueño de un subpedido cambia su estado (y nada más).
grant execute on function public.court_taken_hours(date) to anon, authenticated;
grant execute on function public.my_roles() to anon, authenticated;
grant execute on function public.add_store_member(text, text) to authenticated;
grant execute on function public.store_member_emails(text) to authenticated;

grant select on public.stores, public.products, public.promotions, public.space_assignments to anon, authenticated;
grant insert on public.orders, public.sub_orders, public.space_claims, public.court_reservations to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ── Storage: logos y fotos de productos ──────────────────────────────────────
-- Bucket público de lectura; cada comerciante sube solo bajo la carpeta de su tienda.

insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select using (bucket_id = 'media');
drop policy if exists media_write on storage.objects;
create policy media_write on storage.objects for insert to authenticated with check (
  bucket_id = 'media' and (public.is_admin() or public.is_member(split_part(name, '/', 1)))
);
drop policy if exists media_update on storage.objects;
create policy media_update on storage.objects for update to authenticated using (
  bucket_id = 'media' and (public.is_admin() or public.is_member(split_part(name, '/', 1)))
);

-- Cambios en vivo del catálogo (una promoción nueva aparece en todos los navegadores).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.stores, public.products, public.promotions, public.space_assignments';
    exception when duplicate_object then null; end;
  end if;
end $$;
