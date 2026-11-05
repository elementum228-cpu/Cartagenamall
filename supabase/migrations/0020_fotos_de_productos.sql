-- Fotos de productos en Supabase Storage (en vez de guardarlas dentro de los datos de la tienda).
-- Bucket público de lectura; solo la administración y los miembros de cada tienda pueden subir, cambiar o borrar
-- archivos dentro de la carpeta de su tienda: <id de la tienda>/<archivo>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-photos', 'store-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists store_photos_insert on storage.objects;
create policy store_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'store-photos' and (public.is_admin() or public.is_member((storage.foldername(name))[1])));

drop policy if exists store_photos_update on storage.objects;
create policy store_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'store-photos' and (public.is_admin() or public.is_member((storage.foldername(name))[1])))
  with check (bucket_id = 'store-photos' and (public.is_admin() or public.is_member((storage.foldername(name))[1])));

drop policy if exists store_photos_delete on storage.objects;
create policy store_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'store-photos' and (public.is_admin() or public.is_member((storage.foldername(name))[1])));
