import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SPACE_BY_ID } from '../config/mall'
import { spaceFromCode, storeFromSlug } from '../lib/links'
import { useCatalog, useCatalogMaps } from '../state/catalog'
import { usePrefs, useUI } from '../state/ui'

/** Enlace directo a un local (/local/A-03 o /tienda/nombre): abre el mapa sobre ese local y su ficha. */
export function LocalLink({ by }: { by: 'local' | 'tienda' }) {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const stores = useCatalog((s) => s.stores)
  const { spaceByStore } = useCatalogMaps()
  const done = useRef(false)
  const t0 = useRef(Date.now())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (done.current) return
    const space = by === 'local' ? spaceFromCode(code) : (() => {
      const st = storeFromSlug(code, stores)
      return st ? SPACE_BY_ID[spaceByStore[st.id]] : undefined
    })()
    const store = by === 'tienda' ? storeFromSlug(code, stores) : undefined
    // La lista de tiendas puede tardar en llegar de la base de datos: se espera unos segundos antes de rendirse.
    if (!space && !(by === 'tienda' && store)) {
      if (Date.now() - t0.current > 6000) {
        done.current = true
        useUI.getState().toast('No encontramos ese local.', 'error')
        navigate('/', { replace: true })
        return
      }
      const t = setTimeout(() => setTick((n) => n + 1), 500)
      return () => clearTimeout(t)
    }
    done.current = true
    navigate('/', { replace: true })
    // El mapa ya está montado detrás: se espera a que la ruta cambie y se lleva la cámara al local.
    setTimeout(() => {
      const ui = useUI.getState()
      if (space) {
        if (space.floorId !== ui.activeFloor) ui.setFloor(space.floorId)
        if (window.matchMedia('(min-width: 768px)').matches) ui.selectSpace(space.id)
        else ui.peekSpace(space.id)
        ui.requestFocus({ kind: 'space', id: space.id })
        usePrefs.getState().setHintSeen()
      } else if (store) ui.openStore(store.id)
    }, 350)
  }, [by, code, stores, spaceByStore, navigate, tick])

  return <p className="p-6 text-sm text-ink-soft">Abriendo el local…</p>
}
