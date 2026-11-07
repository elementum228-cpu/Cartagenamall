-- Cartel del estadio: escudos de los equipos y afiche del concierto.
-- Bucket de lectura pública (todos lo ven); suben la administración y el negocio que opera el estadio.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stadium-images', 'stadium-images', true, 4194304, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 4194304, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists stadium_images_insert on storage.objects;
create policy stadium_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'stadium-images' and (public.is_admin() or public.is_stadium_operator()));

drop policy if exists stadium_images_update on storage.objects;
create policy stadium_images_update on storage.objects for update to authenticated
  using (bucket_id = 'stadium-images' and (public.is_admin() or public.is_stadium_operator()))
  with check (bucket_id = 'stadium-images' and (public.is_admin() or public.is_stadium_operator()));

drop policy if exists stadium_images_delete on storage.objects;
create policy stadium_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'stadium-images' and (public.is_admin() or public.is_stadium_operator()));
