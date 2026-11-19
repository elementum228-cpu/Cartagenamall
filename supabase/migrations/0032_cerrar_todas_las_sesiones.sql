-- Cierre de emergencia: cierra TODAS las sesiones de TODAS las cuentas, en todos los dispositivos.
-- Lo puede llamar un administrador (botón en Administración) o la llave de servicio (npm run cerrar-sesiones).
-- 1) Borra las sesiones y los tokens de renovación de Supabase Auth: nadie puede renovar su acceso.
-- 2) Anota la hora en mall_settings «session_epoch»: la app, al abrirse o volver a primer plano, sale sola si su inicio de sesión es anterior.
-- Las personas pueden volver a entrar con su correo y contraseña (las cuentas NO se borran ni se bloquean).
-- Un acceso ya emitido puede seguir válido hasta que venza (por defecto 1 hora) si la persona no vuelve a abrir la app.

create or replace function public.cerrar_todas_las_sesiones() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_sessions bigint := 0;
  v_tokens bigint := 0;
  v_now timestamptz := now();
begin
  if not (coalesce(auth.role(), '') = 'service_role' or public.is_admin()) then
    raise exception 'Solo un administrador puede cerrar todas las sesiones' using errcode = '42501';
  end if;

  if to_regclass('auth.refresh_tokens') is not null then
    execute 'select count(*) from auth.refresh_tokens' into v_tokens;
    execute 'delete from auth.refresh_tokens';
  end if;
  if to_regclass('auth.sessions') is not null then
    execute 'select count(*) from auth.sessions' into v_sessions;
    execute 'delete from auth.sessions';
  end if;

  insert into public.mall_settings (key, doc) values ('session_epoch', jsonb_build_object('at', v_now))
  on conflict (key) do update set doc = excluded.doc;

  return jsonb_build_object('sessions', v_sessions, 'tokens', v_tokens, 'at', v_now);
end $$;

revoke all on function public.cerrar_todas_las_sesiones() from public, anon;
grant execute on function public.cerrar_todas_las_sesiones() to authenticated, service_role;
