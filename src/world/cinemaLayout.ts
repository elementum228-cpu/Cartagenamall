// Medidas del cine compartidas por el edificio (Cinema.tsx) y la navegación de los visitantes (nav.ts).
// Coordenadas «de la isla»: el grupo del cine se corre DX al oeste (mundo = x + DX).
export const CX = -27
export const CZ = -66
export const HALF = 13
export const DECK = 2.2 // altura de la plataforma sobre el mar
export const BX = -28.5 // centro del edificio
export const BZ = -72
export const FZ = BZ + 4.5 // cara de la fachada (mira al sur)
/** Cartelera del frente: tres pantallas en abanico, de cara a la plaza. */
export const CART = { x: -26, z: -57.4, rot: 0 }
/** La isla se corre al oeste para que su escalera caiga justo en el rincón libre del piso de comida. */
export const DX = -9
/** Escalera: de la plaza del cine (nivel de la isla) al borde norte del piso de comida. */
export const STAIR = { x: -34.75, w: 3.6, zTop: -47.6, zBot: -56.4, yTop: 7.4 }
/** Factor de altura del edificio (más bajo que el estadio). */
export const BUILD_H = 0.74
