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

## Siguiente paso sugerido

1. Adaptadores Supabase para `services/ports.ts` (tablas: stores, products, inventory, promotions, orders, sub_orders, space_claims) con RLS por comercio.
2. Autenticación para `/admin` y un portal por comerciante que solo vea sus subórdenes.
3. Fotos reales de producto y personalización de fachada desde el portal del comerciante.
4. Implementar `GrowDeskConnector` cuando exista la API.
