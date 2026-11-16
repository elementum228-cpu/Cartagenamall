import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Capa donde quedan las mallas originales ya fusionadas: la cámara no la dibuja, pero el raycaster
 * de R3F sí la prueba (ver WorldCanvas), así que los toques siguen llegando a sus handlers.
 */
export const PICK_LAYER = 1

const ATTRS = ['position', 'normal', 'uv', 'color'] as const

function prepare(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) {
  const g = geometry.clone()
  for (const name of Object.keys(g.attributes)) if (!(ATTRS as readonly string[]).includes(name)) g.deleteAttribute(name)
  g.clearGroups()
  g.applyMatrix4(matrix)
  return g
}

const bakedCache = new Map<number, THREE.MeshStandardMaterial>()
/** Material compartido con colores por vértice: sustituye a decenas de materiales que solo cambian de color. */
function bakedMaterial(roughness: number) {
  const k = Math.round(roughness * 100)
  let m = bakedCache.get(k)
  if (!m) bakedCache.set(k, (m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: k / 100, metalness: 0, vertexColors: true })))
  return m
}

interface Bucket {
  material: THREE.Material
  cast: boolean
  receive: boolean
  geos: THREE.BufferGeometry[]
  order: number
}

/** Recorre `src` y reúne sus mallas estáticas por material (relativas a `inv`). Devuelve las originales que quedan ocultas. */
function collect(src: THREE.Object3D, inv: THREE.Matrix4, buckets: Map<string, Bucket>, hidden: THREE.Mesh[]) {
  const visit = (o: THREE.Object3D) => {
    if (o.userData.dynamic || !o.visible) return
    const mesh = o as THREE.Mesh
    if (mesh.isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(mesh.material)) {
      let material = mesh.material as THREE.Material
      // Materiales opacos de la paleta (mat()): el color pasa a los vértices y todos comparten un material por rugosidad.
      const baked = !!material.userData.bake && !mesh.geometry.attributes.color
      const color = baked ? (material as THREE.MeshStandardMaterial).color : null
      if (baked) material = bakedMaterial((material as THREE.MeshStandardMaterial).roughness)
      const key = `${material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}|${mesh.renderOrder}`
      let b = buckets.get(key)
      if (!b) buckets.set(key, (b = { material, cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [], order: mesh.renderOrder }))
      const g = prepare(mesh.geometry, new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld))
      if (color) {
        const n = g.attributes.position.count
        const arr = new Float32Array(n * 3)
        for (let i = 0; i < n; i++) {
          arr[i * 3] = color.r
          arr[i * 3 + 1] = color.g
          arr[i * 3 + 2] = color.b
        }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
      }
      b.geos.push(g)
      hidden.push(mesh)
    }
    for (const c of o.children) visit(c)
  }
  visit(src)
}

/** Une cada cubeta en una sola malla. Si todas las piezas llevan índice se conserva (un tercio menos de vértices). */
function build(buckets: Map<string, Bucket>) {
  const out: THREE.Mesh[] = []
  for (const b of buckets.values()) {
    if (b.geos.length > 1 && !b.geos.every((g) => g.index) && b.geos.some((g) => g.index)) b.geos = b.geos.map((g) => (g.index ? g.toNonIndexed() : g))
    const geometry = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false)
    if (b.geos.length > 1) b.geos.forEach((g) => g !== geometry && g.dispose())
    if (!geometry) continue
    const m = new THREE.Mesh(geometry, b.material)
    m.castShadow = b.cast
    m.receiveShadow = b.receive
    m.renderOrder = b.order
    m.raycast = () => {} // los toques los atienden las originales
    out.push(m)
  }
  return out
}

interface ScopeApi {
  add: (g: THREE.Group) => void
  remove: (g: THREE.Group) => void
  invalidate: () => void
}
const ScopeCtx = createContext<ScopeApi | null>(null)

/**
 * Agrupa todos los <Batch> de su interior: en vez de unas pocas mallas por cada Batch, hace una sola por material en
 * todo el grupo. Cientos de llamadas de dibujo se vuelven decenas. Debe ir dentro de un grupo que se mueve o se
 * oculta como un todo (un piso, por ejemplo), nunca por encima de uno que se anime por dentro.
 */
export function BatchScope({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null)
  const api = useMemo(() => {
    const sources = new Set<THREE.Group>()
    let hidden: THREE.Mesh[] = []
    let merged: THREE.Mesh[] = []
    let queued = false
    let alive = true
    const clear = () => {
      const r = root.current
      for (const m of merged) {
        r?.remove(m)
        m.geometry.dispose()
      }
      merged = []
      for (const m of hidden) m.layers.set(0)
      hidden = []
    }
    const rebuild = () => {
      queued = false
      const r = root.current
      if (!alive) return
      if (!r) return void requestAnimationFrame(rebuild)
      clear()
      r.updateWorldMatrix(true, true)
      const inv = new THREE.Matrix4().copy(r.matrixWorld).invert()
      const buckets = new Map<string, Bucket>()
      for (const s of sources) collect(s, inv, buckets, hidden)
      merged = build(buckets)
      for (const m of merged) r.add(m)
      for (const m of hidden) m.layers.set(PICK_LAYER)
    }
    return {
      add: (g: THREE.Group) => void sources.add(g),
      remove: (g: THREE.Group) => void sources.delete(g),
      invalidate: () => {
        if (queued) return
        queued = true
        queueMicrotask(rebuild)
      },
      dispose: () => {
        alive = false
        clear()
      },
    }
  }, [])
  useLayoutEffect(() => () => api.dispose(), [api])
  return (
    <group ref={root}>
      <ScopeCtx.Provider value={api}>{children}</ScopeCtx.Provider>
    </group>
  )
}

/**
 * Fusiona las mallas estáticas de `children` por material: decenas de piezas de una tienda pasan
 * a ser unas pocas llamadas de dibujo. Se excluyen InstancedMesh y todo subárbol marcado con
 * `userData.dynamic` (cosas que se animan). `version` debe cambiar cuando cambia el contenido.
 * Dentro de un <BatchScope> se fusiona con los demás Batch del grupo.
 */
export function Batch({ children, version }: { children: ReactNode; version: unknown }) {
  const scope = useContext(ScopeCtx)
  const root = useRef<THREE.Group>(null)
  const source = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    const src = source.current
    if (!src) return
    if (scope) {
      scope.add(src)
      scope.invalidate()
      return () => {
        scope.remove(src)
        scope.invalidate()
      }
    }
    const r = root.current
    if (!r) return
    r.updateWorldMatrix(true, true)
    const inv = new THREE.Matrix4().copy(r.matrixWorld).invert()
    const buckets = new Map<string, Bucket>()
    const hidden: THREE.Mesh[] = []
    collect(src, inv, buckets, hidden)
    const merged = build(buckets)
    for (const m of merged) r.add(m)
    for (const m of hidden) m.layers.set(PICK_LAYER)
    return () => {
      for (const m of merged) {
        r.remove(m)
        m.geometry.dispose()
      }
      for (const m of hidden) m.layers.set(0)
    }
  }, [version, scope])

  return (
    <group ref={root}>
      <group ref={source}>{children}</group>
    </group>
  )
}
