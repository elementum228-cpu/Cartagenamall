-- Música de fondo de cada local: el dueño sube su pista y suena al entrar al local.
-- Bucket de lectura pública; solo la administración y los miembros de cada tienda suben, cambian o borran archivos
-- dentro de la carpeta de su tienda: <id de la tienda>/<archivo>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-music', 'store-music', true, 8388608, array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'video/mp4'])
on conflict (id) do update
  set public = true, file_size_limit = 8388608,
      allowed_mime_types = array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'video/mp4'];

drop policy if exists store_music_insert on storage.objects;
create policy store_music_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'store-music' and (public.is_admin() or public.is_member((storage.foldername(name))[1])));

drop policy if exists store_music_update on storage.objects;
create policy store_music_update on storage.objects for update to authenticated
  using (bucket_id = 'store-music' and (public.is_admin() or public.is_member((storage.foldername(name))[1])))
  with check (bucket_id = 'store-music' and (public.is_admin() or public.is_member((storage.foldername(name))[1])));

drop policy if exists store_music_delete on storage.objects;
create policy store_music_delete on storage.objects for delete to authenticated
  using (bucket_id = 'store-music' and (public.is_admin() or public.is_member((storage.foldername(name))[1])));
