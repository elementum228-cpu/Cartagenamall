# Cartagena Mall — MVP

> Tu ciudad. Tu mall. Tu mundo.

Centro comercial virtual 3D (diorama low-poly isométrico) donde emprendedores tienen su local digital
y las personas exploran, descubren ofertas y compran a varias tiendas desde **un solo carrito**.

Proyecto independiente dentro de este repositorio: no comparte código ni base de datos con `app/`.

## Arrancar

```bash
cd cartagena-mall
npm install
npm run dev        # http://localhost:5173  ·  panel en /admin
```

```bash
npm test           # lógica de negocio (layout, precios, búsqueda, carrito, división de pedidos)
npm run build      # typecheck + build estático en dist/ (incluye 404.html para rutas SPA)
```

Para publicar en una subcarpeta: `VITE_BASE=/cartagena-mall/ npm run build`.

## Base de datos (Supabase) y despliegue

Sin variables de entorno la app corre en **modo demostración** (todo en el navegador). Con
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` guarda todo en Supabase:

| Qué | Quién lo ve / cambia |
| --- | --- |
| Tiendas, productos, promociones, locales | Lectura pública y **en vivo** (realtime). Edita el admin o el comerciante de esa tienda. |
| Logos y fotos | Supabase Storage (bucket `media`), subidas por el admin o el comerciante. |
| Pedidos (divididos por tienda) | Cualquiera los envía; los ve el admin y cada tienda solo su parte. |
| Solicitudes de locales | Cualquiera envía; solo el admin las ve y aprueba. |
| Reservas de la cancha | Cualquiera reserva un horario libre (no se puede reservar dos veces el mismo); solo el admin ve los datos. |

`/admin` y «Mi negocio» piden iniciar sesión con un enlace al correo. Las reglas viven en la base
(RLS), no en el navegador: `supabase/migrations/0001_cartagena_mall.sql`, probadas con
`PGPASSWORD=postgres ./supabase/tests/run.sh` contra un Postgres local.

### Puesta en marcha

1. **Tablas y reglas**: en Supabase → SQL Editor, pega y ejecuta `supabase/migrations/0001_cartagena_mall.sql`.
2. **Inicio de sesión**: Authentication → URL Configuration → *Site URL* = la dirección publicada
   (p. ej. `https://miguearce1999.github.io/cartagena-mall/`) y agrégala también en *Redirect URLs*
   (más `http://localhost:5173/**` para desarrollo).
3. **Primer administrador**: entra a `/admin` con tu correo (te llega un enlace). Luego, en el SQL Editor:
   `insert into public.admins select id from auth.users where email = 'tu@correo.com';`
4. **Datos iniciales**: en `/admin` → Integraciones → «Publicar datos de demostración».
5. **Comerciantes**: la persona entra una vez a «Mi negocio» con su correo; después, en `/admin` →
   Tiendas → Editar → «Dueños», el admin la vincula a su tienda.
6. **Publicar**: en el repositorio de GitHub, Settings → Pages → *Source: GitHub Actions*; y en
   Settings → Secrets and variables → Actions → **Variables**: `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` (Project Settings → API). Cada push a `main` publica con
   `.github/workflows/deploy.yml`.

Para desarrollo local: `cp .env.example .env.local`, completa la clave y `npm run dev`.

## Qué funciona hoy

| Área | Estado |
| --- | --- |
| Fortaleza | El mall es una fortaleza caribeña low-poly inspirada en las murallas de Cartagena: murallas con cordón y parapeto, tres baluartes con garitas de cúpula terracota, cañones coloniales, entrada monumental (arco, puertas, torres con tejado, letrero CARTAGENA MALL y faroles), agua turquesa, playas y palmeras. Se abre en la vista general; «Entrar al centro comercial» (o tocar la puerta) lleva la cámara a la puerta y luego a la plaza. Todo sale de `FORTRESS` en `config/mall.ts` y `world/Fortress.tsx`. |
| Pisos | **Piso 1**: plaza central, 4 pasillos (Moda, Tecnología, Belleza, Lifestyle), 20 espacios (5 tiendas, 15 libres). **Piso 2**: terraza gastronómica elevada al fondo de la fortaleza (arcada, pérgola, patio de mesas), 4 restaurantes, café y postres, y 4 locales libres. Escaleras eléctricas desde la plaza (tocarlas sube o baja). Selector de pisos a la izquierda y vista «Fortaleza» con ambos pisos; al explorar, el piso 2 se oculta sobre el 1 y el 1 queda como silueta bajo el 2. |
| Calidad | Alta (todo), media (sin sombras ni barcos/aves), baja (además menos decoración); nunca quita tiendas ni funciones. Baja sola si el dispositivo va lento, salvo que se elija a mano. |
| Mundo 3D | Espacios generados desde configuración (`config/mall.ts`: un piso = datos con `layout` 'cross' o 'foodcourt'). Cámara ortográfica isométrica: arrastrar, pellizcar/rueda, límites, enfoque animado, "Volver al centro comercial". |
| Día y noche | Automático según la hora del dispositivo (anochece 18:00) o forzado con el botón de sol/luna, con transición suave. `world/lightingConfig.ts` separa `DAY_LIGHTING` y `NIGHT_LIGHTING`: de noche, base azul suave (hemisférica, ambiental azul grisácea y luna) que conserva los colores, más luz cálida: interiores de tiendas encendidos (volumen de luz aditivo, vitrinas y repisas), halos de recorrido en pasillos, plaza y terraza (`MallPathLighting` + `pathLights.ts`, configurable por posición, color, intensidad, radio, piso y estado), fuente turquesa con bombillos y reflejo simple, guirnaldas y lamparitas en la terraza, y luz ascendente puntual en puerta, garitas, baluartes y cañones. Carteles apenas atenuados. Calidad baja: solo materiales y halos; media: 2 luces locales sin sombras; alta: 7 luces locales y sombras. |
| Locales | Fachadas de toldo a rayas, arco con apliques o minimalista con LED; letrero saliente, cartel de abierto, tapete, lámparas colgantes y vitrinas según el rubro (maniquíes, dispositivos, frascos, hogar). Islas con marquesina iluminada, pantalla y banquitos. Vacíos con tótem «Reclamar local» y anillo pulsante. |
| Plano 2D | Automático si no hay WebGL o si el 3D falla; también se puede elegir. Mismas tiendas, selección y fichas. |
| Tiendas | Ficha (bottom sheet en móvil, panel lateral en escritorio): catálogo, destacados, promociones, guardar tienda, WhatsApp de demostración (copia el número). |
| Modo Comprar | Búsqueda sin acentos, filtros por zona, categoría, tienda, precio, ofertas y disponibilidad; orden por relevancia o precio. El tamaño o tipo de local **no** influye en el orden. |
| Carrito universal | Productos de varias tiendas, agrupados por tienda con subtotales, variantes/tallas, cantidades y validación de inventario mock. |
| Pedidos | Checkout de demostración (nombre, WhatsApp, recoger/domicilio, notas). Genera `ORDER-001` y lo divide en subórdenes por tienda (`ORDER-001-A`…). **No hay cobro**: todo queda "pendiente de confirmación". Estados: recibida → pendiente → confirmado → en preparación → listo → entregado / cancelado. |
| Comparador | Hasta 4 productos lado a lado: precio, tienda, promoción, variantes, tallas, disponibilidad. |
| Señalización | Letreros de tienda grandes (franja de fachada más alta, bandera y marquesina de islas más grandes). Cartel en el techo con marco, franjas de luz y reflectores para tiendas destacadas (casilla en `/admin` → Tiendas; «Insignia» viene marcada), locales premium y locales cuya fachada da la espalda a la cámara; las destacadas además tienen luz propia sobre la fachada y el piso. Menús desplegables con aspecto propio en todos los navegadores. El rótulo flotante de un pasillo solo aparece con el zoom alejado (de cerca se lee el arco) y el de una tienda se oculta muy de cerca si su fachada mira a la cámara. Carteles de piso, de pasillo, de restaurantes y tiendas, «TU NEGOCIO AQUÍ» en locales libres y señal de oferta relámpago sobre el local. Los carteles flotantes se ocultan por prioridad cuando se pisan (`world/labels.ts`). |
| Promociones | Normales, relámpago (con contador) y escondidas, en ambos pisos: una gema aparece solo al acercarse a ciertas tiendas en 3D; al guardarla, su descuento se aplica en el carrito. Contador de descubrimientos. |
| Promociones vivas | `promotions/events.ts` convierte cada promoción en un evento (piso, local, tipo, vigencia con el reloj de la app, descuento y punto frente a la vitrina). Una oferta relámpago se **presenta** una vez cuando su piso está a la vista: el local se ilumina (interior, fachada, halo y haz de luz), borde dorado, un destello, anillo en el piso, un cartel grande con el descuento y el producto (tocarlo abre la tienda; un toque sobre otro local sigue hacia ese local) y el plano 2D la marca. Hasta 15 visitantes del mismo pasillo (6 en calidad media, ninguno en baja o con movimiento reducido; cada uno con su propio punto de observación, 15 por local) acuden de prisa por waypoints a la vitrina, esperan a que llegue el grupo y se quedan unos 40 s: en locales con puerta entran por turnos a comprar (4 a la vez, `INTERIOR_SPOTS`, siempre por la puerta) mientras los demás esperan afuera; luego se dispersan escalonados y vuelven a su ruta. Cada pasillo tiene 16 visitantes en carriles ligeramente desplazados (`walking → reactingToPromotion → idle → browsing → returningToRoute`). Una presentación por piso; una oferta lanzada ahora reemplaza a la que se está presentando. El indicador «Relámpago −N % · tienda» abre la tienda con la oferta (precio original, promocional, vigencia y «Agregar»). Las secretas no se presentan ni las revelan los visitantes. |
| Vida ambiente | Escaleras eléctricas en marcha (escalones y marcas de pasamanos que suben en un carril y bajan en el otro) con personas que las usan en bucle, chorros de agua animados en la fuente, visitantes por plaza y pasillos, barcos y aves. Con «reducir movimiento» las escaleras quedan quietas y nadie acude a las ofertas. |
| Visitantes entre pisos | `world/nav.ts`: cuadrícula de navegación por piso construida con los obstáculos reales (bancas, palmeras, faroles, islas, fuente, escaleras, mesas con taburetes, terrazas de restaurantes), A* con suavizado. `world/Travelers.tsx`: 14 visitantes (6 en calidad media) recorren vitrinas, restaurantes, bancas y miradores de ambos pisos, se detienen a mirar y suben o bajan por las escaleras a la velocidad de los escalones. Se ven en el piso que se está explorando y siempre sobre la escalera. |
| Pasillo B · Tecnología | `world/TechDistrict.tsx`: mostradores con celular, portátil, audífonos y reloj en vitrinas, islas y mostrador interior; franja LED turquesa en la fachada; pantallas digitales simuladas (texturas de canvas que rotan mensajes: tienda, productos destacados, oferta relámpago) en cada tienda y en dos kioscos de doble cara a la entrada; guías turquesa en el piso y un marcador frente a cada local; locales vacíos como módulos preparados (vidrio, exhibidores vacíos, franja de luz) con el tótem para reclamar. Aplica a cualquier tienda del pasillo B. |
| Cancha sintética | Fútbol 5 en el jardín exterior derecho del piso 1 (`football/config.ts`, `world/football/`): césped a franjas, líneas, círculo, áreas, dos arcos con red, malla con acceso lateral, bancas, 4 torres de luz y cartel. `football/match.ts` es un controlador central determinístico (sin física): conducción, pases, intentos de intercepción, remates (gol, atajada o desviado), reacción del arquero, celebración y reinicio desde el centro. 10 jugadores low-poly (cabeza, pelo, torso, brazos, pantaloneta, piernas, pies) en 8 InstancedMesh con animaciones procedurales (trote, carrera, patada, arquero, festejo) y 5 espectadores que festejan los goles. LOD por zoom y calidad; se pausa en el piso 2 o con la vista inactiva. Al tocarla (o el botón «Cancha»): resalte del perímetro, cámara a la cancha y panel con descripción, ilustraciones, características, precios, horarios y **reserva de demostración** (sin pago, guardada en el navegador). |
| Promoción de prueba | «Promo de prueba» en las opciones de vista (o en `/admin` → Promociones): una oferta **ficticia** del 30 % por 5 minutos en una tienda del piso 1; «Finalizar prueba» termina el evento. Se puede repetir sin recargar. |
| Locales disponibles | "¡Tu negocio podría estar aquí!" con tipo, ubicación, precio de referencia, características y vista previa. Formulario de solicitud guardado en localStorage. El local **no** se activa sin aprobación. |
| Mi negocio (`/mi-negocio`) | Vista del comerciante: elige su tienda, crea **promociones** (relámpago, normal o escondida con código; descuento, duración; pausar, relanzar, eliminar; una relámpago nueva se presenta en el mall), sube su **logo** (aparece en el letrero 3D del local, el rótulo flotante, su ficha y Comprar), edita nombre, frase, descripción, colores, fachada y estado, crea y edita **artículos con foto**, precio, variantes, tallas e inventario, y atiende solo sus subórdenes. Las imágenes se reducen en el navegador (logo 256 px, fotos 640 px). Desde la ficha de cualquier tienda: «¿Es tu negocio?». |
| `/admin` | Espacios (asignar/liberar), solicitudes (aprobar crea la tienda y la ubica), tiendas, productos e inventario, promociones (crear, habilitar, reactivar ventana), pedidos (cambiar estado, vista por comerciante), estado de GrowDesk y reinicio de datos demo. |

Precios de espacios (ejemplo, sin cobro): isla $29.900, local $69.900, premium $180.000 COP/mes.

## Limitaciones conocidas (honestas)

- Sin Supabase todo vive en `localStorage` y `/admin` y «Mi negocio» no tienen cuentas (demostración). Con Supabase hay cuentas por correo y reglas RLS.
- No hay pagos: los pedidos y reservas quedan «pendientes de confirmación».
- Quien hace un pedido o reserva lo ve en su navegador; el estado que cambia la tienda no le llega en vivo (no hay cuentas de clientes).
- Cualquiera puede enviar pedidos, solicitudes y reservas (sin captcha): para producción conviene agregar límites o verificación.
- Las ofertas escondidas solo se pueden descubrir en la vista 3D.
- Imágenes de productos: ilustraciones placeholder con el color de cada tienda (`Product.image` admite URL real).
- El inventario mock se descuenta cuando la tienda confirma una suborden y se devuelve si la cancela.
- GrowDesk: solo existe el contrato (`services/integrations/growdesk`). El adaptador activo responde `not_connected`; no hay sincronización real.

## Arquitectura

```
src/
  domain/types.ts          Modelo: Store, Product, Promotion, CartItem, Order/SubOrder, SpaceClaim…
  config/mall.ts           Mall → pisos → zonas → categorías; distribución de cada piso y generador de espacios
  data/seed.ts             5 tiendas ficticias, 28 productos, promociones
  lib/                     Lógica pura: precios/promos, búsqueda, inventario, formato, WebGL
  services/
    orders.ts              validar carrito, agrupar por tienda, construir y dividir pedidos (puro, testeado)
    ports.ts               Interfaces de repositorio para reemplazar localStorage por Supabase
    integrations/growdesk  Contrato + adaptador "no conectado"
  state/                   Zustand (persistido): catálogo, carrito, pedidos, solicitudes, favoritos/descubrimientos, UI
  world/                   React Three Fiber: MallFloor (piso + transición), CrossShell / FoodCourt (estructura
                           por distribución), Escalators, SpaceUnit (tiendas y restaurantes), cámara, decoración instanciada,
                           visitantes, ofertas escondidas, rótulos (CanvasTexture)
  features/                Vista Explorar + HUD, plano 2D, fichas (tienda, espacio, producto), oferta secreta
  pages/                   Comprar, carrito, checkout, pedidos, comparador, ofertas, favoritos
  admin/                   Panel /admin
  ui/                      Sheet responsive, tarjetas, precios, toasts
```

Decisiones clave:

- **Espacios desde configuración.** `generateSpaces()` aplica una plantilla de 5 espacios a cada zona
  rotándola alrededor de la plaza. Agregar una zona o un piso es agregar datos en `config/mall.ts`.
- **Un solo catálogo, dos modos.** Explorar y Comprar leen los mismos stores; el mundo 3D permanece
  montado (con `frameloop="never"` cuando no se ve) para que el cambio de modo sea inmediato.
- **Rendimiento móvil.** Geometrías y materiales compartidos, InstancedMesh para decoración,
  contornos y estanterías, y `world/Batch.tsx`, que fusiona por material las piezas estáticas de cada
  local (las originales quedan en una capa solo para toques). ~330 draw calls con sombras y todo el
  detalle. Rótulos como texturas cacheadas, three.js en un chunk diferido (Comprar y `/admin` no lo
  cargan) y `PerformanceMonitor` que baja a modo ligero salvo que la persona haya elegido la calidad.
- **Precios honestos.** Una sola promoción por producto (la de mayor descuento), redondeo a la centena;
  el total es "estimado" hasta que cada comercio confirma.

### Datos guardados

`cm:catalog:v1` usa versión 2: al abrir con datos de la versión anterior se agregan los negocios,
productos, promociones y espacios del piso 2 sin tocar ediciones del admin, tiendas aprobadas ni
inventario (`mergeSeed` en `state/catalog.ts`, con prueba).

### Agregar un piso 3

Sumar un `FloorConfig` en `config/mall.ts` (nivel, elevación, distribución, zonas) y su estructura en
`world/` si la distribución es nueva. El selector de pisos, la cámara y las fichas lo toman solos.

## Horarios de cine (API de cartelera)

Integración para consultar la cartelera de cine **por ciudad** (hoy, solo Cartagena). Es una arquitectura de proveedores: cada cadena
tiene su adaptador y la app solo habla con un endpoint propio. Los horarios salen de **lo que cada cadena publica ese día en su página
pública** (se vuelve a leer cada ~20 min para seguir los cambios de la cartelera durante el día) o, si existe, de un **feed autorizado**.
**No hay datos inventados**: si una cadena no tiene lector, o su página no deja leerla, sale «Horarios no disponibles temporalmente»
con el enlace oficial a su cartelera. Pantalla de la app: pestaña **«Salas en Cartagena»** dentro del cine (`src/cinema/LiveShowtimes.tsx`).

> El sitio es estático (GitHub Pages), así que no hay `/api` propio: el endpoint es una **función de Supabase** (`cinema-showtimes`).

### Endpoint

```
GET {VITE_SUPABASE_URL}/functions/v1/cinema-showtimes?city=cartagena&date=AAAA-MM-DD
Headers: apikey y Authorization: Bearer <VITE_SUPABASE_ANON_KEY>   (llave pública; nunca la de servicio)
```

`city` por defecto `cartagena`; `date` por defecto hoy (hora de Colombia) y admite hoy + 7 días. Error de parámetros: `400 { error: { code, message } }`;
si todo falla: `503` con un mensaje genérico (el detalle técnico queda solo en los registros del servidor).

```jsonc
{
  "city": "Cartagena", "date": "2026-11-13", "updatedAt": "2026-11-13T15:00:00.000Z",
  "providers": [{
    "id": "cinecolombia", "name": "Cine Colombia",
    "status": "available | partial | unavailable",
    "officialUrl": "https://www.cinecolombia.com/cartagena",
    "lastUpdatedAt": "…", "message": "(solo si no está «available»)",
    "cinemas": [{ "id": "…", "name": "…", "address": "…",
      "movies": [{ "title": "…", "posterUrl": "…", "durationMinutes": 118, "rating": "12+",
        "showtimes": [{ "time": "19:30", "format": "2D", "language": "Doblada", "bookingUrl": "https://… (siempre oficial)" }] }] }]
  }]
}
```

- `available`: datos recientes · `partial`: se muestran los **últimos datos buenos** porque la última consulta falló (o hubo funciones descartadas por inválidas) · `unavailable`: sin datos.
- `bookingUrl` siempre es https de un dominio oficial de la cadena; si la fuente no trae uno válido, se usa la cartelera oficial. La compra debe abrirse en una pestaña nueva (`target="_blank" rel="noopener noreferrer"`).
- Cliente de la app: `src/cinema/api.ts` (consulta y validación), `src/cinema/filters.ts` (filtros por cadena/formato/idioma y agrupación por película y sede).

### Alternativa rápida: enlaces al sitio oficial (la que se usa mientras no haya lectores)

No hace falta leer horarios para que los usuarios los vean rápido: la app los lleva al sitio oficial de cada cine.
- **Cartelera manual:** en Administración → Cine se cargan las películas con su cartel (y se marcan «Estreno» o «Próximamente»). Sin horarios cargados, la película está en cartelera.
- **Botón por cadena en cada película:** «Ver horarios en [cadena]» abre en pestaña nueva el enlace oficial de esa película si la administración lo pegó (campo «Enlaces oficiales de esta película», solo https de los dominios de la cadena) o, si no, la cartelera de la cadena en Cartagena.
- **Pestaña «Salas en Cartagena»:** por cadena, el botón a su cartelera y, donde se pudo verificar en su sitio oficial, cada sala con su dirección y enlace (hoy: las tres salas de Cine Colombia; datos en `src/cinema/venues.ts`, verificados el 13-nov-2026). Si algún día la API trae horarios reales, aparecen arriba de la guía.
- Si Cine Colombia, Royal Films o Procinal piden otros enlaces o salas nuevas, se cambian en `src/cinema/venues.ts` y `src/state/cine.ts` (`OFFICIAL_HOSTS`).

### Qué usa cada cadena

| Cadena | Adaptador | Fuente prevista | Hoy | Cartelera oficial (Cartagena) |
|---|---|---|---|---|
| Cine Colombia | `providers/cinecolombia` | Su página pública (`providers/page.ts`) o un feed autorizado (`CINEMA_CINECOLOMBIA_*`) | **Falta escribir el lector de su página**: «no disponible» | https://www.cinecolombia.com/cartagena |
| Procinal | `providers/procinal` | Su página pública o un feed autorizado (`CINEMA_PROCINAL_*`) | **Falta el lector**: «no disponible» | https://www.procinal.com.co/ciudad/cartagena |
| Royal Films | `providers/royalfilms` | Su página pública o un feed autorizado (`CINEMA_ROYALFILMS_*`) | **Falta el lector**: «no disponible» | https://cinemasroyal.com/cartelera/cartagena |

Ninguna de las tres publica (que se haya podido verificar) una API pública documentada de horarios. Hay dos fuentes posibles por cadena:
**(1) su página pública** (`providers/page.ts`: `createPublicPageProvider`), que es la prevista; y **(2) un feed autorizado** (`providers/feed.ts`: un acuerdo con la cadena
o una licencia con un agregador que entregue un JSON con el contrato de abajo), más estable si se consigue. Todo está en `supabase/functions/_shared/cinema/`
(`types.ts`, `normalizer.ts`, `service.ts`, `cache.ts`, `providers/`) y la función en `supabase/functions/cinema-showtimes/`.

### Qué hace falta para activar cada cadena

**Con su página pública:** solo escribir el `parse` de esa cadena (convierte lo que publica su página, HTML o JSON, en el contrato de abajo). Para eso hay que ver la página real de la cadena (hasta hoy no se ha podido leer desde el entorno de desarrollo) y guardar un ejemplo en `tests/` para probarlo. Todo lo demás ya está hecho: `robots.txt`, espaciado, bloqueos, normalización, caché y estados.

**Con un feed autorizado** (alternativa más estable): escribe al área comercial / de alianzas de cada cadena pidiendo **acceso autorizado a su programación de Cartagena para mostrarla en MallPlay**. Lo que necesitas de ellos:
1. La **URL** del feed o API de programación (y su documentación del formato).
2. El **token o llave** de acceso (si lo usan).
3. Confirmación por escrito de que puedes mostrar horarios y enlazar la compra a su sitio.

Con eso se llenan las variables de la tabla siguiente. Si la cadena entrega otro formato distinto al contrato, se pasa `parse` a `createFeedProvider` en su adaptador para convertirlo (el resto no cambia).
Alternativa: un agregador comercial de horarios con licencia (no verifiqué que alguno cubra Colombia).

**Contrato del feed** (`GET <FEED_URL>?city=cartagena&date=AAAA-MM-DD`, con `Authorization: Bearer <FEED_TOKEN>` si hay token):

```jsonc
{ "cinemas": [ { "id": "…", "name": "…", "address": "…",
    "movies": [ { "title": "…", "posterUrl": "https://…", "durationMinutes": 118, "rating": "12+",
      "showtimes": [ { "time": "19:30" /* o "7:30 PM" */, "format": "2D", "language": "Doblada", "bookingUrl": "https://…" } ] } ] } ] }
```

### Variables de entorno (secretos de Supabase, nunca en el repositorio ni en `VITE_*`)

`supabase secrets set NOMBRE=valor` (ejemplo sin valores en `supabase/functions/cinema-showtimes/.env.example`).

| Variable | Para qué | Obligatoria |
|---|---|---|
| `CINEMA_<CADENA>_FEED_URL` | URL https del feed autorizado (`<CADENA>` = `CINECOLOMBIA`, `PROCINAL`, `ROYALFILMS`) | Sí, para que la cadena tenga horarios |
| `CINEMA_<CADENA>_FEED_TOKEN` | Token Bearer del feed | Si la fuente lo exige |
| `CINEMA_<CADENA>_OFFICIAL_URL` | Cambia la cartelera oficial a la que se redirige | No |
| `CINEMA_<CADENA>_HOSTS` | Dominios oficiales extra de compra, separados por comas (p. ej. si Royal Films compra en otro dominio) | No |
| `CINEMA_CACHE_TTL_MINUTES` | Vigencia de una lectura buena (1–1440) | No (20) |
| `CINEMA_ERROR_BACKOFF_MINUTES` | Espera tras un fallo antes de reintentar (no se martilla una fuente caída) | No (5) |
| `CINEMA_BLOCKED_BACKOFF_MINUTES` | Espera antes de volver a mirar una página que bloqueó la lectura (robots.txt, verificación anti-bots, 403/429) (5–1440) | No (60) |
| `CINEMA_<CADENA>_PUBLIC_PAGE` | `off` apaga la lectura de la página pública de esa cadena (interruptor de emergencia; también se apaga con `cinema_sources.enabled`) | No |
| `CINEMA_PROVIDER_TIMEOUT_SECONDS` | Tiempo máximo por cadena (3–60) | No (20) |

### Caché y fallos

La app **nunca** consulta a las cadenas: solo al endpoint. Cada cadena y día se guarda en memoria del servidor y en Supabase (`cinema_showtimes_cache`).
Si la fuente falla se devuelve el último resultado bueno (estado `partial`); si nunca hubo, `unavailable`. Los errores se registran en el servidor y en
`cinema_fetch_log` solo con un código (`timeout`, `http_error`, `network`, `invalid_response`, `blocked`) y un detalle corto sin URLs ni claves; el usuario solo ve mensajes genéricos.
Consultas simultáneas a una misma fuente se juntan en una. Si una página bloquea la lectura, **no se insiste**: se conserva lo último y se espera `CINEMA_BLOCKED_BACKOFF_MINUTES` antes de volver a mirar.

### Arcade «Nave Caribe»: ranking semanal y premios (migraciones `0026` y `0027`, función `arcade-run`)

Minijuego en la isla de Entretenimiento (se ve cuando el administrador activa la isla). Los puntos de premio se guardan en el dispositivo; el
**ranking semanal** (mejor puntaje de la semana, se reinicia cada lunes) es compartido y el **top 3 gana premios** (descuentos en restaurantes o
locales aliados) que la administración define.

**Cómo se evita la trampa.** El navegador nunca manda un puntaje. Pide una partida (`start`: el servidor entrega la semilla), juega y manda el
registro de sus movimientos (`finish`); la función `arcade-run` **repite la partida** con la misma lógica (`supabase/functions/_shared/arcade/sim.ts`,
la misma que corre en el navegador, determinista) y guarda el puntaje que ELLA calcula. Una partida es de un solo uso, no puede terminar antes de lo que
dura jugarla y tiene topes (60 puntos por partida, 240 por día). Límite que queda: un programa que juegue de verdad, en tiempo real, no se distingue de
una persona. Por eso **los premios se entregan después de que la administración revise el podio** (pestaña *Arcade* de `/admin`: puntaje, duración,
código del ganador y botón para descalificar).

Puesta en marcha (una vez):
1. `supabase db push` (aplica `0026`, `0027` y `0028`) o pega los tres SQL, en orden, en el SQL Editor. (`0028` agrega el historial de partidas y «Tu semana».)
2. `supabase functions deploy arcade-run` (usa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, que ya existen en las funciones).
3. En `/admin` → *Arcade*: escribe los premios de los puestos 1 a 3 (se guardan en `mall_settings`, clave `arcade_prizes`).

Cada lunes: abre *Arcade* → «Semana pasada», revisa el podio, descalifica lo sospechoso y entrega los premios contra el código `GP-XXXXXX` que muestra
el ganador en su pantalla. **Sobre el juego:** pantalla completa al jugar; música y efectos sintetizados en el navegador (sin archivos) que se apagan con el botón del altavoz (se recuerda); los círculos sueltan premios (verde: arma de hasta 4 niveles, naranja: disparo rápido) y un golpe cuesta una vida y un nivel de arma. Cada partida se guarda en el dispositivo (últimas 60) y en el servidor (partidas verificadas), y la pestaña *Ranking* muestra «Tu semana» frente al líder.

Pruebas: `npx vitest run tests/arcade.test.ts` y `PGPASSWORD=postgres supabase/tests/arcade.sh` (reglas SQL).

### Base de datos (migración `0025_cinema_showtimes.sql`)

`cinema_sources` (una fila por cadena: `enabled`, estado del último intento y **`partnership` jsonb reservado para futuras alianzas comerciales**), `cinema_showtimes_cache`
y `cinema_fetch_log`. RLS activa y sin acceso para anónimos; solo la función (llave de servicio) escribe y los administradores leen. No se guardan datos personales.
`select public.cinema_prune_fetch_log(30)` borra el historial viejo (programarlo una vez al día).

### Puesta en marcha

1. `supabase db push` (aplica la migración 0025).
2. `supabase functions deploy cinema-showtimes`.
3. `supabase secrets set CINEMA_PROCINAL_FEED_URL=… CINEMA_PROCINAL_FEED_TOKEN=…` (y las demás cadenas cuando tengan su acceso).
4. Probar: `curl -H "apikey: $ANON" -H "Authorization: Bearer $ANON" "$URL/functions/v1/cinema-showtimes?city=cartagena"`.

### Cómo añadir una cadena nueva

1. Confirma en fuentes oficiales que opera en Cartagena y consigue su acceso autorizado (ver arriba).
2. Crea `supabase/functions/_shared/cinema/providers/<cadena>/index.ts` con `createPublicPageProvider({ id, name, officialUrls, hosts, envPrefix, pageUrl, parse })` (su página pública) o `createFeedProvider({ ... })` (feed autorizado), o un adaptador propio que cumpla `Provider`.
3. Suma su `id` a `ProviderId` en `types.ts`, a `IDS` en `src/cinema/api.ts` y agrégala a `providers/registry.ts`.
4. Inserta su fila en `cinema_sources` (nueva migración) y define sus variables `CINEMA_<CADENA>_*`.
5. Añade una prueba en `tests/cinema-service.test.ts` y corre `npx vitest run tests/cinema-*.test.ts`.

### Límites legales y de actualización

- Solo se leen páginas públicas de la cadena, respetando su `robots.txt`, con pocas consultas y presentándose como `MallPlayCine`. **Nunca** se sortean CAPTCHAs, verificaciones anti-bots, logins ni bloqueos: si la página bloquea, el lector se detiene. No se automatiza compra, reserva ni pago: la compra ocurre siempre en el sitio oficial.
- Leer la página pública de una cadena sin un acuerdo depende de sus términos de uso (no se han podido revisar desde el entorno de desarrollo) y se rompe si cambia su diseño: es una decisión del dueño del producto. Si una cadena lo pide, se apaga con `cinema_sources.enabled` o `CINEMA_<CADENA>_PUBLIC_PAGE=off`. Un feed autorizado o un acuerdo es la opción más segura y estable.
- Los horarios pueden cambiar: la app los muestra «sujetos a cambios» y la lectura tiene hasta `CINEMA_CACHE_TTL_MINUTES` de antigüedad.
- Esta API es independiente del modo «Automático» del cine (`cine-sync`, ver `NOTAS.md`); queda como base para reemplazarlo.

## Siguiente paso sugerido

1. Adaptadores Supabase para `services/ports.ts` (tablas: stores, products, inventory, promotions, orders, sub_orders, space_claims) con RLS por comercio.
2. Autenticación para `/admin` y un portal por comerciante que solo vea sus subórdenes.
3. Fotos reales de producto y personalización de fachada desde el portal del comerciante.
4. Implementar `GrowDeskConnector` cuando exista la API.
