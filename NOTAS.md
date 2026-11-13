# MallPlay Cartagena — notas de traspaso

App: Vite + React 19 + TypeScript, Tailwind v4, three/R3F (mapa 3D), zustand, motion/react, Supabase.
Repo: elementum228-cpu/cartagenamall. Lo que llega a `main` se despliega solo en GitHub Pages (workflow "Publicar Cartagena Mall").
Antes de publicar: `npm run build` (usa `tsc -b`, más estricto que `tsc --noEmit`) y `npx vitest run`.

## Cómo trabajamos
- Usuario habla español y itera con capturas. Cada cambio: rama → capturas de día y de noche → el usuario aprueba → "despliega" → merge fast-forward a `main`.
- Capturas: Playwright + `--use-gl=swiftshader` contra `npx vite --port 5252` (hook de cámara `window.__cmControls` solo en dev).
- Rendimiento: en dev, `window.__cmGl`, `__cmScene`, `__cmCam` permiten contar llamadas de dibujo.

## Lo que existe (en `main`)
- Zona de servicios sobre la joyería (`src/world/JewelryZone.tsx`): puerta al fondo de la alfombra, escalera larga, terraza con muralla, patio hundido con escalinata, escaparates 3D en los muros, locales `P1-S*` reclamables. Interruptor en Administración → «Zonas de servicio» (`src/state/servicesFeature.ts`, se sincroniza en mall_settings «features»).
- Rendimiento 3D: `src/world/Batch.tsx` (`BatchScope` une Batches por piso/entorno, colores horneados en vértices), sombras a 12 Hz (`Lighting.tsx`), chunks `three`/`vendor` (vite.config.ts).
- Mi negocio: campo «¿Cuánto te cuesta?» con semáforo de ganancia en vivo (`src/lib/margin.ts`, `MarginMeter` en `MerchantPage.tsx`) y «Lo que realmente te quedó» en el resumen de ventas.
- MallPlay Hoy (periódico digital), estadio, muelle, entretenimiento, aeropuerto/isla, etc.

## En curso: el CINE (rama `cine-exterior`, NO está en main)
Etapa 1 = exterior; etapa 2 = interior (pendiente); además debe poder reclamarse como negocio.
- `src/world/Cinema.tsx`: isla al norte del piso de comida, edificio art déco (sala alta, torreones con cúpula, torre con aguja, marquesina), cartelera frontal de 3 pantallas, 2 afiches en la fachada, escalinata (`GrandStair`) que baja del piso de comida (rincón noroeste) a la plaza del cine, puente al estadio. La isla está desplazada `DX=-9` para que la escalera caiga en el hueco libre del piso 2.
- `src/world/FoodCourt.tsx`: el muro norte del piso 2 tiene un hueco en x local −17.2…−12.8 para la escalera.
- `src/state/cine.ts` + `src/admin/CineAdmin.tsx` (pestaña «Cine»): interruptor y 5 imágenes editables (3 pantallas de la cartelera + 2 afiches). Se sincroniza en mall_settings «features» (`sync.ts`).
- Falta: revisar con capturas la última versión (escalera y cartelera de frente, rot 0 en `CART`), probar subir imágenes reales, hacerlo reclamable (espacios `P1-C*` + categoría), el interior, y desplegar.
- Ojo: puede que la escalera cruce algo del piso 2 (locales E1–E3 al norte); verificar visualmente.

## Ramas sin publicar (propuestas descartadas, solo por si acaso)
`vitrinas-fachada` (escaparates en la fachada del piso 2, el usuario dijo que se veía feo), `servicios-terraza`.

## Pendientes conocidos
- Zona de servicios: escalera que baja a la plaza, paso a la zona de comida, gente caminando hacia los locales de la terraza.
- Calidad «baja» del 3D casi no reduce trabajo (≈1.430 llamadas vs 1.440 en alta).
- Personas: las multitudes ya son instancias; quedan ~40 figuras sueltas (puerto, barcos, isla).

## Cine: programación automática (función `cine-sync`)
- Cada cadena (Cine Colombia, Royal Films, Procinal) tiene modo **Manual** (lo carga la administración) o **Automático** (se lee de su sitio, solo Cartagena). Por defecto, manual. Interruptor en Administración → Cine → Cadenas.
- Lógica compartida (app y función): `supabase/functions/_shared/cine/` (tipos, normalización de títulos/horas/formatos, `mergeFeed` que une la misma película entre cadenas). En la app: `src/state/cineFeed.ts` (`effectiveCine` mezcla manual + automático; `useEffectiveCine`).
- La función `supabase/functions/cine-sync/` lee cada cadena por separado y guarda en `mall_settings` «cine_feed». Si una cadena falla o devuelve cero funciones, conserva sus últimos datos buenos y lo avisa. **Los lectores por cadena van en `cine-sync/providers.ts` (hoy vacío: faltan, hay que escribirlos contra las respuestas reales de cada sitio).** Sin lector, la cadena sale como «lector aún no disponible» y sigue en manual.
- Despliegue (una vez): `supabase functions deploy cine-sync` y `supabase secrets set CINE_SYNC_SECRET=<secreto largo>`. Para que se actualice sola, programar la llamada (pg_cron + pg_net o el programador de Supabase) cada ~30 min con el encabezado `x-cron-secret`. El botón «Sincronizar ahora» la llama con la sesión del administrador.
- Los sitios son de terceros: leer con pocas consultas (`politeFetch`), respetar sus condiciones de uso y preferir una API oficial si la ofrecen.

## Horarios de cine por ciudad (API `cinema-showtimes`)
- Endpoint = función de Supabase `supabase/functions/cinema-showtimes` (el sitio es estático, no hay `/api`): `GET ...?city=cartagena&date=AAAA-MM-DD`. Núcleo en `supabase/functions/_shared/cinema/` (tipos, normalizador, servicio con caché, proveedores). Cliente en `src/cinema/`. Guía completa (fuentes, variables, cómo añadir una cadena) en el README, sección «Horarios de cine».
- **Sin feed autorizado una cadena sale «Horarios no disponibles temporalmente» con su enlace oficial**; no hay scraping ni datos de ejemplo en esta API. Falta conseguir los accesos autorizados de cada cadena (ver README).
- Independiente del modo «Automático» (`cine-sync`) de arriba; queda como base para reemplazarlo. Aún no hay pantalla que consuma `src/cinema/api.ts`.
- Pruebas: `npx vitest run tests/cinema-*.test.ts` y `PGPASSWORD=postgres supabase/tests/cinema.sh` (reglas de acceso de la migración 0025). OJO: `supabase/tests/run.sh` falla desde antes en la migración 0020 (el stub no trae `storage.foldername`).
