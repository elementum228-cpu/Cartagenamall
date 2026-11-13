import { usePrefs } from '../state/ui'

/**
 * Refleja el nivel de calidad en `<html data-quality="…">`: el CSS lo usa para quitar desenfoques de vidrio (muy caros en
 * celulares básicos) en calidad baja. Se aplica antes del primer pintado de la app y sigue los cambios.
 */
export function watchQualityAttr() {
  const apply = (q: string) => document.documentElement.setAttribute('data-quality', q)
  apply(usePrefs.getState().quality)
  usePrefs.subscribe((s, prev) => {
    if (s.quality !== prev.quality) apply(s.quality)
  })
}
