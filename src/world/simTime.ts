/**
 * Tope del tiempo por cuadro para mover a los visitantes. Si fuera bajo (0,1 s), en un celular que dibuja a menos
 * de 10 cuadros por segundo toda la gente caminaría en cámara lenta; con 0,25 s siguen el reloj real y, al volver
 * de otra pestaña, igual no hay saltos grandes.
 */
export const MAX_DT = 0.25
