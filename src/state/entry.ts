import { create } from 'zustand'
import { detectProfile, type Tier } from '../lib/deviceProfile'

const SEEN_KEY = 'cm:door-seen'

/** ¿Ya cruzó el portón en esta sesión del navegador? */
function doorSeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/** ¿Es la portada? (el portón solo sale ahí; `base` es la carpeta donde está publicada la app). */
export const isHomePath = (path: string, base: string) => path === base || path + '/' === base || path === base + 'index.html'

/** ¿Va a aparecer el portón de bienvenida en esta carga? (portada, una vez por sesión). */
export function doorWillShow(path = typeof location === 'undefined' ? '/' : location.pathname, base = import.meta.env.BASE_URL ?? '/', seen = doorSeen()) {
  return isHomePath(path, base) && !seen
}

/**
 * ¿Se aplaza el mundo 3D hasta que la persona toque la puerta? Construir el mundo completo detrás del portón deja el teléfono sin
 * poder responder a los toques (en gama baja, segundos). Así que, salvo en equipos potentes, el 3D empieza a construirse al tercer toque
 * y el portón espera a que esté listo para dejarlo pasar. Sin portón (ya entró, otra página), nada se aplaza.
 */
export const shouldDeferWorld = (tier: Tier, doorShows: boolean) => doorShows && tier !== 'high'

/**
 * Estado de la entrada: `doorDone` es verdadero cuando el portón de bienvenida ya terminó (o no hay portón porque la persona
 * ya entró en esta sesión). Los avisos que no deben tapar el onboarding (como el periódico «MallPlay Hoy») esperan a esto.
 * `worldGo`: ya se puede montar el mundo 3D. `worldReady`: el mundo ya dibujó sus primeros cuadros (el portón lo espera).
 */
export const useEntry = create<{ doorDone: boolean; setDoorDone: (v: boolean) => void; worldGo: boolean; setWorldGo: (v: boolean) => void; worldReady: boolean; setWorldReady: (v: boolean) => void }>()((set) => ({
  doorDone: false,
  setDoorDone: (doorDone) => set({ doorDone }),
  worldGo: !shouldDeferWorld(detectProfile().tier, doorWillShow()),
  setWorldGo: (worldGo) => set({ worldGo }),
  worldReady: false,
  setWorldReady: (worldReady) => set({ worldReady }),
}))
