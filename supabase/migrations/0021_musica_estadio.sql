-- Canciones del estadio: la administración sube el audio del concierto y suena dentro del estadio.
-- Bucket de lectura pública (todos lo oyen); solo la administración puede subir, cambiar o borrar.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stadium-audio', 'stadium-audio', true, 10485760, array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'video/mp4'])
on conflict (id) do update
  set public = true, file_size_limit = 10485760,
      allowed_mime_types = array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'video/mp4'];

drop policy if exists stadium_audio_insert on storage.objects;
create policy stadium_audio_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'stadium-audio' and public.is_admin());

drop policy if exists stadium_audio_update on storage.objects;
create policy stadium_audio_update on storage.objects for update to authenticated
  using (bucket_id = 'stadium-audio' and public.is_admin())
  with check (bucket_id = 'stadium-audio' and public.is_admin());

drop policy if exists stadium_audio_delete on storage.objects;
create policy stadium_audio_delete on storage.objects for delete to authenticated
  using (bucket_id = 'stadium-audio' and public.is_admin());
