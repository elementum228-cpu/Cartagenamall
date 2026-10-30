import * as THREE from 'three'
import type { Anim } from '../../football/match'

// Personas low-poly de la cancha (jugadores y espectadores): cabeza, pelo, torso, brazos,
// pantaloneta, piernas y pies. Cada parte es una InstancedMesh compartida por todas las personas,
// así diez jugadores y sus espectadores cuestan ocho llamadas de dibujo. Las animaciones son
// rotaciones de extremidades calculadas en un solo lugar (`FootballPlayer.pose`).

export interface Pose {
  /** Altura extra del cuerpo (saltos, rebote al correr) y agachado (arquero). */
  y: number
  crouch: number
  /** Inclinación del torso hacia adelante. */
  lean: number
  legL: number
  legR: number
  armL: number
  armR: number
  /** Brazos abiertos o arriba (rotación lateral). */
  raiseL: number
  raiseR: number
  /** Sentado (espectadores en banca). */
  seated: boolean
}

const IDLE: Pose = { y: 0, crouch: 0, lean: 0, legL: 0, legR: 0, armL: 0, armR: 0, raiseL: 0.12, raiseR: 0.12, seated: false }

/** Detalle de la animación según la distancia de la cámara y la calidad. */
export type Lod = 'high' | 'medium' | 'low'

export const FootballPlayer = {
  /** Pose de un jugador según su animación. `t` = reloj; `phase` = fase propia del ciclo de carrera. */
  pose(anim: Anim, t: number, phase: number, kickU: number, lod: Lod): Pose {
    if (lod === 'low') return IDLE
    const amp = lod === 'medium' ? 0.6 : 1
    const s = Math.sin(phase)
    switch (anim) {
      case 'jog':
        return { ...IDLE, y: Math.abs(s) * 0.04 * amp, lean: 0.06, legL: s * 0.55 * amp, legR: -s * 0.55 * amp, armL: -s * 0.5 * amp, armR: s * 0.5 * amp }
      case 'run':
        return { ...IDLE, y: Math.abs(s) * 0.07 * amp, lean: 0.18, legL: s * 0.95 * amp, legR: -s * 0.95 * amp, armL: -s * 0.85 * amp, armR: s * 0.85 * amp }
      case 'kick': {
        // pierna derecha atrás y luego adelante con fuerza; brazos abiertos para equilibrar
        const k = kickU < 0.5 ? -0.9 * (kickU / 0.5) : -0.9 + 2.2 * ((kickU - 0.5) / 0.5)
        return { ...IDLE, lean: 0.1, legR: k * amp, legL: -0.15, raiseL: 0.7 * amp, raiseR: 0.5 * amp, armL: 0.3 }
      }
      case 'keeper':
        // desplazamiento lateral agachado, brazos abiertos
        return { ...IDLE, crouch: 0.08, lean: 0.12, legL: s * 0.3 * amp, legR: -s * 0.3 * amp, raiseL: 0.95, raiseR: 0.95, y: Math.abs(s) * 0.03 }
      case 'celebrate': {
        const j = Math.abs(Math.sin(t * 7 + phase))
        return { ...IDLE, y: j * 0.22 * amp, raiseL: 2.6 + Math.sin(t * 9 + phase) * 0.25, raiseR: 2.6 - Math.sin(t * 9 + phase) * 0.25, legL: j * 0.3, legR: j * 0.3 }
      }
      default:
        return { ...IDLE, y: Math.sin(t * 2 + phase) * 0.008 }
    }
  },
}

export interface PersonLook {
  shirt: string
  shorts: string
  skin: string
  hair: string | null
  /** Escala (los espectadores son un poco más altos que los jugadores en miniatura). */
  scale?: number
}

/** Partes del cuerpo: geometría, tamaño y color de qué prenda. */
export const PART_NAMES = ['head', 'hair', 'torso', 'arm', 'shorts', 'leg', 'foot'] as const
export type PartName = (typeof PART_NAMES)[number]
/** Cuántas instancias de cada parte por persona. */
export const PART_COUNT: Record<PartName, number> = { head: 1, hair: 1, torso: 1, arm: 2, shorts: 1, leg: 2, foot: 2 }

const m4 = new THREE.Matrix4()
const tmp = new THREE.Matrix4()
const q = new THREE.Quaternion()
const e = new THREE.Euler()
const v = new THREE.Vector3()
const sc = new THREE.Vector3()

function local(pos: [number, number, number], rx: number, rz: number, out: THREE.Matrix4) {
  e.set(rx, 0, rz)
  q.setFromEuler(e)
  return out.compose(v.set(...pos), q, sc.set(1, 1, 1))
}

/**
 * Escribe las matrices de una persona en las InstancedMesh de cada parte. `root` es la matriz de la
 * persona (posición y orientación en el mundo). Índice `k` = número de persona.
 */
export function writePerson(meshes: Record<PartName, THREE.InstancedMesh | null>, k: number, root: THREE.Matrix4, p: Pose, hasHair: boolean) {
  const set = (name: PartName, i: number, m: THREE.Matrix4) => meshes[name]?.setMatrixAt(k * PART_COUNT[name] + i, m)
  const body = tmp.copy(root).multiply(m4.makeTranslation(0, p.y - p.crouch, 0))
  const hipY = p.seated ? 0.48 : 0.5
  // piernas (pivote en la cadera) y pies al final de cada pierna
  ;[-1, 1].forEach((side, i) => {
    const swing = p.seated ? -1.45 : side < 0 ? p.legL : p.legR
    const hip = new THREE.Matrix4().copy(body).multiply(local([side * 0.075, hipY, 0], swing, 0, new THREE.Matrix4()))
    set('leg', i, new THREE.Matrix4().copy(hip).multiply(new THREE.Matrix4().compose(v.set(0, -0.21, 0), q.identity(), sc.set(0.11, 0.42, 0.12))))
    set('foot', i, new THREE.Matrix4().copy(hip).multiply(new THREE.Matrix4().compose(v.set(0, -0.41, 0.045), q.identity(), sc.set(0.12, 0.06, 0.21))))
  })
  // tronco: inclinado desde la cadera
  const trunk = new THREE.Matrix4().copy(body).multiply(local([0, hipY, 0], p.lean, 0, new THREE.Matrix4()))
  set('shorts', 0, new THREE.Matrix4().copy(trunk).multiply(new THREE.Matrix4().compose(v.set(0, 0.04, 0), q.identity(), sc.set(0.3, 0.17, 0.2))))
  set('torso', 0, new THREE.Matrix4().copy(trunk).multiply(new THREE.Matrix4().compose(v.set(0, 0.29, 0), q.identity(), sc.set(0.32, 0.38, 0.2))))
  set('head', 0, new THREE.Matrix4().copy(trunk).multiply(new THREE.Matrix4().compose(v.set(0, 0.62, 0), q.identity(), sc.set(0.25, 0.25, 0.25))))
  set('hair', 0, hasHair ? new THREE.Matrix4().copy(trunk).multiply(new THREE.Matrix4().compose(v.set(0, 0.72, -0.02), q.identity(), sc.set(0.25, 0.08, 0.24))) : new THREE.Matrix4().makeScale(0, 0, 0))
  // brazos: pivote en el hombro; balanceo (x) y apertura (z)
  ;[-1, 1].forEach((side, i) => {
    const sw = side < 0 ? p.armL : p.armR
    const raise = side < 0 ? p.raiseL : p.raiseR
    const sh = new THREE.Matrix4().copy(trunk).multiply(local([side * 0.2, 0.45, 0], sw, side * -raise, new THREE.Matrix4()))
    set('arm', i, sh.multiply(new THREE.Matrix4().compose(v.set(0, -0.16, 0), q.identity(), sc.set(0.085, 0.34, 0.09))))
  })
}
