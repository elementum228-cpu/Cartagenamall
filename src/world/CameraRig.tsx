import { MapControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { COURT, FENCE_X as COURT_FENCE_X } from '../football/config'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import { FLOOR_BY_ID, FLOOR_OF_ZONE, GATE, SPACE_BY_ID, ZONE_BY_ID } from '../config/mall'
import { floorOrigin, liveOrigins, overviewCenter } from './floors'
import { useUI } from '../state/ui'
import { HARBOR_FOCUS } from '../tourism/config'
import { SHOWROOMS } from '../district/showrooms'
import { CAMERA_DISTANCE, ELEVATION_SIN, ISO_DIR, cameraState } from './cameraState'

interface Goal {
  target: THREE.Vector3
  zoom: number
  /** Segundos de pausa al llegar, antes del siguiente tramo. */
  hold?: number
  /** Siguiente tramo de una animación encadenada (p. ej. puerta → plaza). */
  next?: Goal
}

const DESKTOP_PANEL = 420
/** Zoom de la vista general (ambos pisos) y su límite de desplazamiento. */
const OVERVIEW_ZOOM = 0.6
/** En pantallas verticales la fortaleza se encuadra más cerca (se recortan apenas las puntas de los baluartes). */
const overviewZoomFor = (w: number, h: number) => (w < h ? 0.74 : OVERVIEW_ZOOM)
const OVERVIEW_BOUNDS = 40
/** Alcance de la cámara con el muelle turístico abierto. */
const HARBOR_BOUNDS = 70
const TOWARD_CAMERA = new THREE.Vector3(1, 0, 1).normalize()
const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize()

/** Zoom que encuadra la planta en cruz. En vertical se recortan apenas las puntas de los pasillos. */
function fitZoomFor(w: number, h: number) {
  return Math.min(w / (w < h ? 60 : 64), h / 44)
}

/** Parte de la pantalla (desde arriba) que deja libre el panel inferior en celulares. */
const MOBILE_SHEET_FREE = 0.26
/** Con la ficha breve: queda libre más de la mitad de arriba. */
const MOBILE_PEEK_FREE = 0.62

export function CameraRig() {
  const controls = useRef<MapControlsImpl>(null)
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const goal = useRef<Goal | null>(null)
  const prevOverview = useRef(false)
  const dragging = useRef(false)
  // Callbacks estables: drei reconecta los controles si cambian, y eso cortaba los arrastres.
  const onStart = useCallback(() => {
    goal.current = null // si la persona toma el control, se cancela la animación en curso
    dragging.current = true
  }, [])
  const onEnd = useCallback(() => {
    dragging.current = false
  }, [])

  // Teclado (escritorio): flechas/WASD mueven, +/- acercan, Espacio = modo mano.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
    }
    const down = (e: KeyboardEvent) => {
      if (typing(e) || !cameraState.active) return
      const c = controls.current
      if (!c) return
      if (e.code === 'Space') {
        cameraState.handMode = true
        e.preventDefault()
        return
      }
      const step = (size.height * 0.18) / camera.zoom
      const up = new THREE.Vector3(-1, 0, -1).normalize() // "arriba" en pantalla, sobre el piso
      const right = SCREEN_RIGHT
      const move = new THREE.Vector3()
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') move.addScaledVector(up, step / ELEVATION_SIN)
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') move.addScaledVector(up, -step / ELEVATION_SIN)
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') move.addScaledVector(right, -step)
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') move.addScaledVector(right, step)
      else if (e.key === '+' || e.key === '=') {
        goal.current = { target: (goal.current?.target ?? c.target).clone(), zoom: THREE.MathUtils.clamp(camera.zoom * 1.3, c.minZoom, c.maxZoom) }
        return
      } else if (e.key === '-' || e.key === '_') {
        goal.current = { target: (goal.current?.target ?? c.target).clone(), zoom: THREE.MathUtils.clamp(camera.zoom / 1.3, c.minZoom, c.maxZoom) }
        return
      } else return
      e.preventDefault()
      const base = goal.current?.target ?? c.target
      goal.current = { target: base.clone().add(move), zoom: goal.current?.zoom ?? camera.zoom }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') cameraState.handMode = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [camera, gl, size.height])
  const focus = useUI((s) => s.focus)
  const hasSelection = useUI((s) => s.selectedSpaceId !== null)

  // Sin panel abierto no hay corrimiento.
  useEffect(() => {
    if (!hasSelection) cameraState.viewOffset.set(0, 0, 0)
  }, [hasSelection])
  const fit = fitZoomFor(size.width, size.height)
  const overviewOn = useUI((s) => s.overview)
  const minZoom = fit * (overviewOn ? 0.5 : 0.85)
  const maxZoom = Math.max(fit * 7, 40)

  // Encuadre inicial y al cambiar el tamaño de la ventana.
  useEffect(() => {
    cameraState.fitZoom = fit
    cameraState.uiScale = THREE.MathUtils.clamp(size.width / 1000, 0.72, 1)
    const c = controls.current
    if (!c) return
    if (!goal.current && camera.zoom === 1) {
      // Primer cuadro: vista general de la fortaleza (o el piso activo si ya se entró).
      const { overview, activeFloor } = useUI.getState()
      const start = overview ? overviewCenter() : floorOrigin(FLOOR_BY_ID[activeFloor])
      c.target.copy(start)
      cameraState.groundY = start.y
      camera.zoom = overview ? fit * overviewZoomFor(size.width, size.height) : fit * FLOOR_BY_ID[activeFloor].homeZoom
      camera.position.copy(c.target).addScaledVector(ISO_DIR, CAMERA_DISTANCE)
      camera.updateProjectionMatrix()
    }
    // Solo el máximo: al salir de la vista general la animación lleva el zoom, sin saltos.
    camera.zoom = Math.min(camera.zoom, maxZoom)
    camera.updateProjectionMatrix()
    invalidate()
  }, [fit, minZoom, maxZoom, camera, invalidate, size.width])

  // Solo en desarrollo: permite a las pruebas E2E tocar espacios reales del mundo 3D.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as Record<string, unknown>
    w.__cmProject = (spaceId: string, y = 0.8) => {
      const sp = SPACE_BY_ID[spaceId]
      const o = liveOrigins[sp.floorId]
      const v = new THREE.Vector3(o.x + sp.position[0], o.y + y, o.z + sp.position[1]).project(camera)
      const r = gl.domElement.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    }
    w.__cmRenderInfo = () => ({ ...gl.info.render, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures })
    // Mallas visibles agrupadas por espacio comercial (para auditar el costo de dibujo).
    w.__cmMeshAudit = () => {
      const out: Record<string, number> = {}
      scene.traverseVisible((o) => {
        if (!(o as THREE.Mesh).isMesh) return
        let p: THREE.Object3D | null = o
        let key = 'otros'
        while (p) {
          if (p.userData.audit) {
            key = p.userData.audit
            break
          }
          p = p.parent
        }
        out[key] = (out[key] ?? 0) + 1
      })
      return out
    }
    w.__cmControls = () => controls.current
    w.__cmCamera = () => ({ zoom: camera.zoom, target: controls.current?.target.toArray(), pos: camera.position.toArray(), enabled: controls.current?.enabled, el: controls.current?.domElement?.tagName })
    w.__cmProjectPoint = (x: number, y: number, z: number) => {
      const v = new THREE.Vector3(x, y, z).project(camera)
      const r = gl.domElement.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    }
  }, [camera, gl, scene])

  // Peticiones de enfoque desde la UI (seleccionar tienda, zona, volver al centro, +/-).
  useEffect(() => {
    if (!focus) return
    const desktop = size.width >= 768
    if (focus.kind !== 'zoom') cameraState.viewOffset.set(0, 0, 0)
    const { activeFloor, overview } = useUI.getState()
    const floor = FLOOR_BY_ID[activeFloor]
    const origin = floorOrigin(floor, overview)
    cameraState.groundY = overview ? overviewCenter().y : origin.y
    if (focus.kind === 'home') {
      goal.current = overview ? { target: overviewCenter(), zoom: fit * overviewZoomFor(size.width, size.height) } : { target: origin, zoom: fit * floor.homeZoom }
    } else if (focus.kind === 'enter') {
      // Estado 2 (puerta) → estado 3 (plaza del piso 1).
      const gate = new THREE.Vector3(GATE.x - 4, 0, GATE.z - 4)
      cameraState.groundY = 0
      goal.current = {
        target: gate,
        zoom: THREE.MathUtils.clamp(fit * 2.4, minZoom, maxZoom),
        hold: 0.35,
        next: { target: origin, zoom: fit * floor.homeZoom * 1.15 },
      }
    } else if (focus.kind === 'overview') {
      goal.current = { target: overviewCenter(), zoom: fit * overviewZoomFor(size.width, size.height) }
    } else if (focus.kind === 'floor') {
      // Cambio de piso: al centro del piso nuevo (cada piso tiene su posición en la fortaleza),
      // conservando el zoom si ya se estaba explorando de cerca.
      const fromOverview = prevOverview.current
      const zoom = fromOverview ? fit * floor.homeZoom : Math.max(goal.current?.zoom ?? camera.zoom, fit * floor.homeZoom)
      goal.current = { target: origin, zoom }
    } else if (focus.kind === 'zoom') {
      goal.current = {
        target: (goal.current?.target ?? controls.current?.target ?? new THREE.Vector3()).clone(),
        zoom: THREE.MathUtils.clamp(camera.zoom * focus.factor, minZoom, maxZoom),
      }
    } else if (focus.kind === 'zone') {
      const zone = ZONE_BY_ID[focus.id]
      const zo = floorOrigin(FLOOR_BY_ID[FLOOR_OF_ZONE[zone.id]], overview)
      cameraState.groundY = zo.y
      goal.current = { target: new THREE.Vector3(zo.x + zone.focus[0], zo.y, zo.z + zone.focus[1]), zoom: THREE.MathUtils.clamp(fit * 2.1, minZoom, maxZoom) }
    } else if (focus.kind === 'showcase') {
      const space = SPACE_BY_ID[focus.id]
      if (!space) return
      const so = floorOrigin(FLOOR_BY_ID[space.floorId], overview)
      cameraState.groundY = so.y
      const zoom = fit * (desktop ? 1.9 : 2.1)
      // Un poco hacia la cámara: el cartel de la oferta, arriba del local, queda dentro del encuadre.
      const target = new THREE.Vector3(so.x + space.position[0], so.y, so.z + space.position[1]).addScaledVector(TOWARD_CAMERA, -2.5)
      cameraState.viewOffset.set(0, 0, 0)
      goal.current = { target, zoom }
    } else if (focus.kind === 'court') {
      // como un local: se encuadra la cancha completa dejando lugar al panel (lateral o inferior)
      const usable = desktop ? size.width - DESKTOP_PANEL : size.width
      const zoom = THREE.MathUtils.clamp((usable * 0.85) / (2 * (COURT_FENCE_X + 1.5) * 1.15), fit * 1.2, fit * 2.4)
      const so = floorOrigin(FLOOR_BY_ID.P1, overview)
      cameraState.groundY = so.y
      const target = new THREE.Vector3(so.x + COURT.center[0], so.y, so.z + COURT.center[1])
      if (desktop) target.addScaledVector(SCREEN_RIGHT, DESKTOP_PANEL / 2 / zoom)
      else {
        const canvasTop = gl.domElement.getBoundingClientRect().top
        const visible = Math.max(120, window.innerHeight * MOBILE_SHEET_FREE - canvasTop)
        target.addScaledVector(TOWARD_CAMERA, (size.height / 2 - visible / 2) / (zoom * ELEVATION_SIN))
      }
      cameraState.viewOffset.set(0, 0, 0)
      goal.current = { target, zoom }
    } else if (focus.kind === 'harbor') {
      // El muelle al centro de la parte visible (al lado del panel o arriba de la ficha), con un
      // acercamiento leve: se ve el muelle sin perder el mall de vista.
      const zoom = THREE.MathUtils.clamp(camera.zoom * 1.15, fit * 0.9, fit * 1.8)
      const target = new THREE.Vector3(HARBOR_FOCUS[0], 0, HARBOR_FOCUS[1])
      cameraState.groundY = 0
      if (desktop) target.addScaledVector(SCREEN_RIGHT, DESKTOP_PANEL / 2 / zoom)
      else {
        const canvasTop = gl.domElement.getBoundingClientRect().top
        // la ficha del muelle ocupa como mucho el 70 %; su tarjeta inicial, cerca de la mitad
        const visible = Math.max(120, window.innerHeight * 0.48 - canvasTop)
        target.addScaledVector(TOWARD_CAMERA, (size.height / 2 - visible / 2) / (zoom * ELEVATION_SIN))
      }
      goal.current = { target, zoom }
    } else if (focus.kind === 'showroom') {
      // como un local grande: el edificio completo a la vista, con lugar para su ficha
      const room = SHOWROOMS[focus.id]
      const usable = desktop ? size.width - DESKTOP_PANEL : size.width
      const zoom = THREE.MathUtils.clamp((usable * 0.55) / (Math.max(...room.size) * 1.6), fit * 1.6, fit * 3)
      const so = floorOrigin(FLOOR_BY_ID.P1, overview)
      cameraState.groundY = so.y
      const target = new THREE.Vector3(so.x + room.position[0], so.y, so.z + room.position[1])
      if (desktop) target.addScaledVector(SCREEN_RIGHT, DESKTOP_PANEL / 2 / zoom)
      else {
        const canvasTop = gl.domElement.getBoundingClientRect().top
        const visible = Math.max(120, window.innerHeight * MOBILE_SHEET_FREE - canvasTop)
        target.addScaledVector(TOWARD_CAMERA, (size.height / 2 - visible / 2) / (zoom * ELEVATION_SIN))
      }
      cameraState.viewOffset.set(0, 0, 0)
      goal.current = { target, zoom }
    } else if (focus.kind === 'space') {
      const space = SPACE_BY_ID[focus.id]
      if (!space) return
      const usable = desktop ? size.width - DESKTOP_PANEL : size.width
      // Se encuadra el espacio con su entorno (mínimo 7 unidades) para ver vitrina, pasillo y ofertas cercanas.
      const zoom = THREE.MathUtils.clamp((usable * 0.3) / (Math.max(space.size[0], 7) * 1.25), desktop ? fit * 2 : fit * 2.6, fit * 3.2)
      const so = floorOrigin(FLOOR_BY_ID[space.floorId], overview)
      cameraState.groundY = so.y
      const target = new THREE.Vector3(so.x + space.position[0], so.y, so.z + space.position[1])
      // El panel tapa parte del lienzo: se corre el objetivo para que la tienda quede visible.
      if (desktop) target.addScaledVector(SCREEN_RIGHT, DESKTOP_PANEL / 2 / zoom)
      else {
        // Ficha breve (peek) sobre el mapa o bottom sheet de ~76 % de alto (ver ui/Sheet): la tienda se
        // centra en la franja visible de arriba.
        const canvasTop = gl.domElement.getBoundingClientRect().top
        const visible = Math.max(120, window.innerHeight * (useUI.getState().peek ? MOBILE_PEEK_FREE : MOBILE_SHEET_FREE) - canvasTop)
        target.addScaledVector(TOWARD_CAMERA, (size.height / 2 - visible / 2) / (zoom * ELEVATION_SIN))
      }
      cameraState.viewOffset.set(target.x - so.x - space.position[0], 0, target.z - so.z - space.position[1])
      // Efecto «zoom y vuelta»: la cámara se acerca de más al local y luego se echa hacia atrás
      // hasta encuadrarlo completo.
      goal.current = { target, zoom: Math.min(zoom * 1.75, maxZoom * 1.15), hold: 0.12, next: { target, zoom } }
    }
    prevOverview.current = overview
    invalidate()
  }, [focus, fit, minZoom, maxZoom, size.width, size.height, camera, invalidate, gl])

  useFrame((_, dt) => {
    const c = controls.current
    if (!c) return
    const g = goal.current
    if (g) {
      const k = 1 - Math.exp(-dt * 5.5)
      const offset = camera.position.clone().sub(c.target)
      c.target.lerp(g.target, k)
      camera.position.copy(c.target).add(offset)
      camera.zoom += (g.zoom - camera.zoom) * k
      camera.updateProjectionMatrix()
      if (c.target.distanceTo(g.target) < 0.05 && Math.abs(camera.zoom - g.zoom) < 0.05) {
        if (g.hold && g.hold > 0) g.hold -= dt
        else goal.current = g.next ?? null
      }
      c.update()
    }
    // El arrastre es en el plano de la pantalla (el mall sigue al dedo 1:1, también en vertical).
    // Luego el objetivo se proyecta de vuelta al piso a lo largo de la mirada: la vista no cambia.
    const t = c.target
    const gy = cameraState.groundY
    if (!goal.current && Math.abs(t.y - gy) > 1e-6) {
      const back = ISO_DIR.clone().multiplyScalar((t.y - gy) / ISO_DIR.y)
      t.sub(back)
      camera.position.sub(back)
    }
    // Límites del piso activo (o de la vista general): no se puede "salir" del mall arrastrando.
    const { activeFloor, overview, harbor } = useUI.getState()
    const center = overview ? overviewCenter() : floorOrigin(FLOOR_BY_ID[activeFloor], false)
    // con el muelle abierto se puede ir hasta él (queda por fuera de la muralla)
    const bound = Math.max(overview ? OVERVIEW_BOUNDS : FLOOR_BY_ID[activeFloor].bounds, harbor ? HARBOR_BOUNDS : 0)
    const cx = THREE.MathUtils.clamp(t.x, center.x - bound, center.x + bound)
    const cz = THREE.MathUtils.clamp(t.z, center.z - bound, center.z + bound)
    if (cx !== t.x || cz !== t.z) {
      camera.position.x += cx - t.x
      camera.position.z += cz - t.z
      t.x = cx
      t.z = cz
    }
    // Cursor: mano abierta para arrastrar, mano cerrada al arrastrar, dedo sobre algo tocable.
    const el = gl.domElement
    const cursor = dragging.current ? 'grabbing' : document.body.style.cursor === 'pointer' && !cameraState.handMode ? 'pointer' : 'grab'
    if (el.style.cursor !== cursor) el.style.cursor = cursor
    cameraState.zoom = camera.zoom
    cameraState.target.copy(t)
  })

  return (
    <MapControls
      ref={controls}
      makeDefault
      enableRotate={false}
      enableDamping
      dampingFactor={0.2}
      screenSpacePanning
      zoomToCursor={size.width >= 768}
      minZoom={minZoom}
      maxZoom={maxZoom}
      zoomSpeed={1.1}
      onStart={onStart}
      onEnd={onEnd}
    />
  )
}
