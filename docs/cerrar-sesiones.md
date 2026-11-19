# Cerrar todas las sesiones (cierre de emergencia)

Cierra la sesión de **todas las cuentas** (clientes, negocios y administradores) en **todos los dispositivos**.
No borra ni bloquea cuentas: cada persona vuelve a entrar con su correo y contraseña.

## Una sola vez: aplicar la migración
Pega `supabase/migrations/0032_cerrar_todas_las_sesiones.sql` en Supabase → SQL Editor y ejecútala.

## Tres formas de usarlo
1. **Botón** (administrador): Administración → Gestión → «Cerrar todas las sesiones». Pide escribir `CERRAR`. También cierra tu propia sesión.
2. **Comando** (terminal, con la llave de servicio):
   ```bash
   export SUPABASE_URL="https://TU-PROYECTO.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="la llave service_role (secreta)"
   npm run cerrar-sesiones -- --confirmar
   ```
   Sin `--confirmar` solo explica qué haría. Nunca guardes la llave en el repositorio.
3. **SQL** (Supabase → SQL Editor): `select public.cerrar_todas_las_sesiones();`

## Qué pasa en los dispositivos
- Se borran las sesiones y los tokens de renovación: nadie puede renovar su acceso.
- La app, al volver a primer plano (y cada 5 minutos con la app abierta), comprueba si hubo un cierre general y sale sola.
- Un acceso ya emitido puede seguir válido hasta que venza (por defecto **1 hora**) si la persona no vuelve a abrir la app. Para acortarlo: Supabase → Authentication → Settings → «JWT expiry».
