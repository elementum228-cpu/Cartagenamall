-- El administrador puede eliminar solicitudes de local (desaparecen también de «Mi cuenta» del cliente).
drop policy if exists sr_delete_admin on public.store_requests;
create policy sr_delete_admin on public.store_requests for delete using (public.is_site_admin());
grant delete on public.store_requests to authenticated;
