import * as THREE from 'three'
import type { Pose } from './people'

// La persona del mall (cuerpo en cápsula y cabeza) con las poses de la cancha: rebote al correr,
// inclinación al patear, salto al celebrar y asiento en la banca. Mismo tamaño que los visitantes.

const base = new THREE.Matrix4()
const tilt = new THREE.Matrix4()
const part = new THREE.Matrix4()
const out = new THREE.Matrix4()
const tiltQ = new THREE.Quaternion()
const noRot = new THREE.Quaternion()
const euler = new THREE.Euler()
const pos = new THREE.Vector3()
const scl = new THREE.Vector3()

export interface FolkMeshes {
  bodies: THREE.InstancedMesh | null
  heads: THREE.InstancedMesh | null
}

/** Escribe a la persona `k`. `root` = posición y giro en el mundo (pies en el piso). */
export function writeFolk(m: FolkMeshes, k: number, root: THREE.Matrix4, p: Pose) {
  const seatDrop = p.seated ? 0.2 : 0
  // balanceo lateral al correr: la cápsula se mece como los visitantes del mall
  const roll = (p.legL - p.legR) * 0.08
  base.copy(root).multiply(part.makeTranslation(0, p.y - p.crouch - seatDrop, 0))
  // el cuerpo se inclina desde los pies
  tiltQ.setFromEuler(euler.set(p.lean, 0, roll))
  tilt.copy(base).multiply(part.compose(pos.set(0, 0, 0), tiltQ, scl.set(1, 1, 1)))
  // cuerpo (cápsula) y cabeza encima, como los visitantes del mall
  out.copy(tilt).multiply(part.compose(pos.set(0, 0.43, 0), noRot, scl.set(1, p.seated ? 0.82 : 1, 1)))
  m.bodies?.setMatrixAt(k, out)
  out.copy(tilt).multiply(part.compose(pos.set(0, p.seated ? 0.86 : 0.95, 0), noRot, scl.set(0.36, 0.36, 0.36)))
  m.heads?.setMatrixAt(k, out)
}
