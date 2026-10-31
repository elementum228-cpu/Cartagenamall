/**
 * Versión de prueba (build con VITE_DEMO=1): solo el mall 3D y las fichas de tiendas de ejemplo,
 * con entrada por invitación. Sin compras, precios de locales, administración ni panel de negocio.
 * Es una constante de compilación: en la versión de prueba el código que no aplica ni se incluye.
 */
export const DEMO = import.meta.env.VITE_DEMO === '1'
