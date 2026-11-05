import { SPACES } from '../config/mall'
import type { SpaceSlot, Store } from '../domain/types'
import { normalizeText } from './format'

// Enlaces directos a un local: /local/A-03 (por la etiqueta del espacio) o /tienda/coral-belleza (por el nombre).
// Al abrirlos, el mall se abre con la cámara sobre ese local y su ficha.

export const storeSlug = (name: string) =>
  normalizeText(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Ruta corta del enlace de una tienda: por su local si tiene uno, si no por su nombre. */
export function localPath(store: Pick<Store, 'name'>, space?: Pick<SpaceSlot, 'label'> | null) {
  return space ? `/local/${space.label}` : `/tienda/${storeSlug(store.name)}`
}

/** Dirección completa (con el dominio y la carpeta del sitio). */
export function absoluteUrl(path: string) {
  return `${location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`
}

/** Espacio al que apunta `/local/<código>`: la etiqueta (A-03, a03) o el id interno (P1-A3). */
export function spaceFromCode(code: string): SpaceSlot | undefined {
  const k = code.trim().toUpperCase().replace(/\s+/g, '')
  const flat = k.replace(/[^A-Z0-9]/g, '')
  return SPACES.find((s) => s.id.toUpperCase() === k || s.label.toUpperCase() === k || s.label.toUpperCase().replace(/[^A-Z0-9]/g, '') === flat || s.label.toUpperCase().replace(/-0+(\d)/, '-$1').replace(/[^A-Z0-9]/g, '') === flat)
}

/** Tienda a la que apunta `/tienda/<nombre>`: el nombre sin tildes ni espacios, o su id. */
export function storeFromSlug(slug: string, stores: Store[]): Store | undefined {
  const k = storeSlug(slug)
  return stores.find((s) => storeSlug(s.name) === k || s.id.toLowerCase() === slug.toLowerCase())
}
