# Leer menús con IA (fotos y PDFs difíciles)

En **Mi negocio → Menú → Importar menú** se puede subir un PDF **o fotos** del menú (hasta 6 imágenes del mismo menú).
- Un **PDF con texto** se lee al instante en el navegador, sin IA y sin costo.
- Una **foto**, un **PDF escaneado** o un menú con mucho diseño se lee con **IA (Claude)**: ve la imagen, entiende las secciones, los platos, las descripciones y los precios, y los muestra para revisar antes de crear.
- Siempre aparece la pantalla de revisión: nada se crea sin confirmar.

## Una sola vez: activar la IA en Supabase
La lectura con IA corre en una función de Supabase (`leer-menu`) para que la llave **nunca** llegue al navegador.

1. Crea una llave en <https://console.anthropic.com> (API keys).
2. Desde la carpeta del proyecto, con la CLI de Supabase iniciada (`supabase login` y `supabase link`):
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy leer-menu
   ```
3. Listo. Prueba subiendo la foto de un menú desde Mi negocio.

Opcional: `supabase secrets set MENU_MODEL=claude-sonnet-5-5` para usar un modelo más económico (por defecto usa `claude-opus-5-5`).

## Quién puede usarla
Solo una persona con sesión iniciada que sea **administradora** o **miembro de esa tienda**. Así nadie ajeno gasta la cuenta de IA.

## Costo aproximado
Cada lectura son 1 a 4 imágenes de entrada y una respuesta corta con los platos. Con el modelo por defecto cuesta del orden de **centavos de dólar por menú** (varía con el tamaño y la cantidad de imágenes); con `claude-sonnet-5-5` cuesta aproximadamente la mitad. Revisa el gasto real en la consola de Anthropic.

## Límites
- Hasta 6 imágenes por lectura; el navegador las reduce a 1.800 px y las manda en JPEG.
- Un PDF largo solo usa sus primeras 4 páginas.
- La IA puede equivocarse con letras muy decorativas o precios borrosos: por eso los precios dudosos y los platos sin precio salen marcados en la revisión.
- En la versión de demostración (sin base de datos conectada) no está disponible.
