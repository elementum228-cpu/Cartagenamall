import * as THREE from 'three'
import type { Pose } from './people'

// La persona del mall (cuerpo en cápsula y cabeza) con las poses de la cancha: rebote al correr,
// inclinación al patear, salto al celebrar y asiento en la banca. Mismo tamaño que los visitantes.

const a = new THREE.Matrix4()
const b = new THREE.Matrix4()
const q = new THREE.Quaternion()
const e = new THREE.Euler()
const v = new THREE.Vector3()
const one = new THREE.Vector3(1, 1, 1)

export interface FolkMeshes {
  bodies: THREE.InstancedMesh | null
  heads: THREE.InstancedMesh | null
}

/** Escribe a la persona `k`. `root` = posición y giro en el mundo (pies en el piso). */
export function writeFolk(m: FolkMeshes, k: number, root: THREE.Matrix4, p: Pose) {
  const seatDrop = p.seated ? 0.2 : 0
  // balanceo lateral al correr: la cápsula se mece como los visitantes del mall
  const roll = (p.legL - p.legR) * 0.08
  const base = a.copy(root).multiply(b.makeTranslation(0, p.y - p.crouch - seatDrop, 0))
  // el cuerpo se inclina desde los pies
  e.set(p.lean, 0, roll)
  q.setFromEuler(e)
  const tilt = new THREE.Matrix4().copy(base).multiply(b.compose(v.set(0, 0, 0), q, one))
  m.bodies?.setMatrixAt(k, new THREE.Matrix4().copy(tilt).multiply(b.compose(v.set(0, 0.43, 0), q.identity(), one.set(1, p.seated ? 0.82 : 1, 1))))
  one.set(1, 1, 1)
  m.heads?.setMatrixAt(k, new THREE.Matrix4().copy(tilt).multiply(b.compose(v.set(0, p.seated ? 0.86 : 0.95, 0), q.identity(), v.set(0.36, 0.36, 0.36))))
}
