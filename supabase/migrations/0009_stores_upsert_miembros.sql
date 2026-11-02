-- Guardar el perfil de la tienda usa «upsert» (INSERT ... ON CONFLICT DO UPDATE), y Postgres revisa la
-- política de INSERT aunque la fila ya exista. Un comerciante vinculado a su tienda debe poder pasarla.
-- Solo puede tocar tiendas de las que ya es miembro (no puede crear tiendas nuevas).
drop policy if exists stores_insert on public.stores;
create policy stores_insert on public.stores for insert with check (public.is_admin() or public.is_member(id));
