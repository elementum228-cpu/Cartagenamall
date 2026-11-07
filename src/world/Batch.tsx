import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Capa donde quedan las mallas originales ya fusionadas: la cámara no la dibuja, pero el raycaster
 * de R3F sí la prueba (ver WorldCanvas), así que los toques siguen llegando a sus handlers.
 */
export const PICK_LAYER = 1

const ATTRS = ['position', 'normal', 'uv', 'color'] as const

function prepare(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) {
  const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone()) as THREE.BufferGeometry
  for (const name of Object.keys(g.attributes)) if (!(ATTRS as readonly string[]).includes(name)) g.deleteAttribute(name)
  g.clearGroups()
  g.applyMatrix4(matrix)
  return g
}

/**
 * Fusiona las mallas estáticas de `children` por material: decenas de piezas de una tienda pasan
 * a ser unas pocas llamadas de dibujo. Se excluyen InstancedMesh y todo subárbol marcado con
 * `userData.dynamic` (cosas que se animan). `version` debe cambiar cuando cambia el contenido.
 */
export function Batch({ children, version }: { children: ReactNode; version: unknown }) {
  const root = useRef<THREE.Group>(null)
  const source = useRef<THREE.Group>(null)

  useLayoutEffect(() => {
    const r = root.current
    const src = source.current
    if (!r || !src) return
    r.updateWorldMatrix(true, true)
    const inv = new THREE.Matrix4().copy(r.matrixWorld).invert()
    const buckets = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; geos: THREE.BufferGeometry[]; order: number }>()
    const hidden: THREE.Mesh[] = []

    const visit = (o: THREE.Object3D) => {
      if (o.userData.dynamic) return
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(mesh.material)) {
        const material = mesh.material as THREE.Material
        const key = `${material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}`
        let b = buckets.get(key)
        if (!b) buckets.set(key, (b = { material, cast: mesh.castShadow, receive: mesh.receiveShadow, geos: [], order: mesh.renderOrder }))
        b.geos.push(prepare(mesh.geometry, new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld)))
        hidden.push(mesh)
      }
      for (const c of o.children) visit(c)
    }
    visit(src)

    const merged: THREE.Mesh[] = []
    for (const b of buckets.values()) {
      const geometry = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false)
      if (b.geos.length > 1) b.geos.forEach((g) => g.dispose())
      if (!geometry) continue
      const m = new THREE.Mesh(geometry, b.material)
      m.castShadow = b.cast
      m.receiveShadow = b.receive
      m.renderOrder = b.order
      m.raycast = () => {} // los toques los atienden las originales
      merged.push(m)
      r.add(m)
    }
    for (const m of hidden) m.layers.set(PICK_LAYER)

    return () => {
      for (const m of merged) {
        r.remove(m)
        m.geometry.dispose()
      }
      for (const m of hidden) m.layers.set(0)
    }
  }, [version])

  return (
    <group ref={root}>
      <group ref={source}>{children}</group>
    </group>
  )
}
