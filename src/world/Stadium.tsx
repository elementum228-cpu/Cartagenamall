import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { STADIUM, phaseInfo, type StadiumPhase } from '../config/stadium'
import { toggleStadiumSound, useStadiumPhase, useStadiumSound } from '../state/stadium'
import { useIsNight } from '../lib/useIsNight'
import { Batch } from './Batch'
import { ScreenLabel } from './Billboard'
import { CORDON, Garita, STONE, STONE_DARK } from './Fortress'
import { getGlassPill } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO, mat } from './materials'
import { glowMat, lightPoolMat } from './night'

// Estadio en construcción (inspirado en el Jaime Morón de Cartagena): una isla de piedra al norte de la
// fortaleza con un estadio de bajo polígono a medio hacer. Las gradas del lado oeste y norte ya tienen sus
// sillas (verde y amarillo) y la cubierta blanca; el lado este sigue en concreto y estructura, con
// andamios; la cancha está a medias. Hay grúas torre moviéndose, camiones, obreros con casco y un cartel
// de «Próximamente». Todo estático va fusionado (Batch); lo que se mueve va aparte.

const SEA = -0.5
const Y = 0.12
const C = { x: STADIUM.center[0], z: STADIUM.center[1] }
/** Escala de todo el conjunto: el estadio acompaña al mall, no lo domina. */
const S = STADIUM.scale

// Isla (rectángulo muy redondeado) y estadio
const IX = 26
const IZ = 21
const IR = 9
const PX = 9 // medio largo de la cancha
const PZ = 5.6
const BOWL_X = PX + 1.6
const BOWL_Z = PZ + 1.6
const BOWL_R = 3.2
const STEPS = 7
const RUN = 0.9
const RISE = 0.66
const SEAT_END = STEPS * RUN
const FACADE_D = SEAT_END + 1
const FACADE_H = 7.4
const ROOF_OUT_H = 8.6
const ROOF_IN_H = 6.9

const STEEL = '#e8832a'
const CONCRETE = '#b9b1a2'
const CONCRETE_DARK = '#9d958a'
const SCAFF = '#d3d6da'
const PLANK = '#d9a441'
const IRON = '#2f3438'
const YELLOW = '#f5b800'

// ── geometría paramétrica: contorno de rectángulo redondeado con correspondencia entre desplazamientos ───
type Pt = { x: number; z: number; nx: number; nz: number }
function ring(hx: number, hz: number, r: number, ns = 8, nc = 6): Pt[] {
  const pts: Pt[] = []
  const sx = hx - r
  const sz = hz - r
  const side = (x0: number, z0: number, x1: number, z1: number, nx: number, nz: number) => {
    for (let i = 0; i <= ns; i++) {
      const t = i / ns
      pts.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, nx, nz })
    }
  }
  const corner = (cx: number, cz: number, a0: number, a1: number) => {
    for (let i = 0; i <= nc; i++) {
      const a = a0 + ((a1 - a0) * i) / nc
      pts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) })
    }
  }
  side(hx, -sz, hx, sz, 1, 0) // este
  corner(sx, sz, 0, Math.PI / 2) // sureste
  side(sx, hz, -sx, hz, 0, 1) // sur
  corner(-sx, sz, Math.PI / 2, Math.PI)
  side(-hx, sz, -hx, -sz, -1, 0) // oeste
  corner(-sx, -sz, Math.PI, 1.5 * Math.PI)
  side(-sx, -hz, sx, -hz, 0, -1) // norte
  corner(sx, -sz, 1.5 * Math.PI, 2 * Math.PI)
  return pts
}
const BASE = ring(BOWL_X, BOWL_Z, BOWL_R)
const N = BASE.length
const at = (i: number, d: number): [number, number] => [BASE[i].x + BASE[i].nx * d, BASE[i].z + BASE[i].nz * d]

/** ¿Está terminada esa parte del estadio? El tercio este y la esquina sureste siguen en obra. */
const built = (i: number, phase: StadiumPhase) => {
  if (phase === 'open') return true
  const { x, z } = BASE[i]
  // casi terminado: solo queda en obra un pedazo de la esquina sureste
  if (phase === 'almost') return !(x > 12 && z > 3)
  return !(x > 4.5 || (z > 5 && x > -4))
}
/** Un tramo (de i a i+1) está terminado si sus dos extremos lo están. */
const segBuilt = (i: number, phase: StadiumPhase) => built(i, phase) && built(i + 1, phase)

class Quads {
  pos: number[] = []
  col: number[] = []
  private c = new THREE.Color()
  quad(a: number[], b: number[], c: number[], d: number[], color: string) {
    this.c.set(color)
    for (const p of [a, b, c, a, c, d]) {
      this.pos.push(p[0], p[1], p[2])
      this.col.push(this.c.r, this.c.g, this.c.b)
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.computeVertexNormals()
    return g
  }
}

const VERTEX_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, flatShading: true })

const GREEN = '#22a05a'
const GREEN_DARK = '#1b7f48'
const GOLD = '#f6c619'

/** Gradas, barrera de la cancha, fachada y cubierta: tres mallas con color por vértice. */
function useBowl(phase: StadiumPhase) {
  return useMemo(() => {
    const seats = new Quads()
    const shell = new Quads()
    const roof = new Quads()
    for (let i = 0; i < N - 1; i++) {
      const ok = segBuilt(i, phase)
      for (let s = 0; s < STEPS; s++) {
        const d0 = s * RUN
        const d1 = (s + 1) * RUN
        const y0 = s * RISE
        const y1 = (s + 1) * RISE
        const kind = ok ? 'seats' : s <= 2 ? 'concrete' : 'none'
        if (kind === 'none') continue
        const aisle = i % 8 === 0
        let tread: string
        let riser: string
        if (kind === 'seats') {
          const lower = s < 3
          tread = aisle ? '#f4f4ee' : lower ? GREEN : s < 5 ? GOLD : GREEN_DARK
          riser = aisle ? '#e5e5df' : lower ? GREEN_DARK : s < 5 ? '#d9a90f' : '#166b3b'
        } else {
          tread = (i + s) % 2 ? CONCRETE : '#c2baab'
          riser = CONCRETE_DARK
        }
        const [ax, az] = at(i, d0)
        const [bx, bz] = at(i, d1)
        const [cx, cz] = at(i + 1, d1)
        const [dx, dz] = at(i + 1, d0)
        seats.quad([ax, y1, az], [bx, y1, bz], [cx, y1, cz], [dx, y1, dz], tread)
        seats.quad([ax, y0, az], [ax, y1, az], [dx, y1, dz], [dx, y0, dz], riser)
      }
      // barrera de la cancha con vallas publicitarias
      {
        const [ax, az] = at(i, -0.2)
        const [dx, dz] = at(i + 1, -0.2)
        const col = Math.floor(i / 2) % 3 === 0 ? GOLD : Math.floor(i / 2) % 3 === 1 ? '#f4f4ee' : GREEN
        shell.quad([ax, 0, az], [ax, 0.95, az], [dx, 0.95, dz], [dx, 0, dz], col)
      }
      if (ok) {
        // fachada: franja de concreto claro, banda de vidrio y remate
        const [ax, az] = at(i, FACADE_D)
        const [dx, dz] = at(i + 1, FACADE_D)
        shell.quad([ax, 0, az], [ax, 2.4, az], [dx, 2.4, dz], [dx, 0, dz], '#e8d6b0')
        shell.quad([ax, 2.4, az], [ax, 3.6, az], [dx, 3.6, dz], [dx, 2.4, dz], '#4f7384')
        shell.quad([ax, 3.6, az], [ax, 5.0, az], [dx, 5.0, dz], [dx, 3.6, dz], '#e8d6b0')
        shell.quad([ax, 5.0, az], [ax, 6.1, az], [dx, 6.1, dz], [dx, 5.0, dz], '#4f7384')
        shell.quad([ax, 6.1, az], [ax, FACADE_H, az], [dx, FACADE_H, dz], [dx, 6.1, dz], '#efe0bd')
        // cubierta: membrana blanca con borde ondulado
        const inner = (j: number) => 2.6 + (Math.floor(j / 2) % 2 ? 0.7 : 0)
        const [oax, oaz] = at(i, FACADE_D + 0.7)
        const [obx, obz] = at(i + 1, FACADE_D + 0.7)
        const [iax, iaz] = at(i, inner(i))
        const [ibx, ibz] = at(i + 1, inner(i + 1))
        roof.quad([oax, ROOF_OUT_H, oaz], [obx, ROOF_OUT_H, obz], [ibx, ROOF_IN_H, ibz], [iax, ROOF_IN_H, iaz], Math.floor(i / 2) % 2 ? '#f7f8fa' : '#e9eef3')
      }
    }
    return { seats: seats.geometry(), shell: shell.geometry(), roof: roof.geometry() }
  }, [phase])
}

/** Columnas, vigas y cerchas de acero de las gradas que aún están en obra (más andamios por fuera). */
function Skeleton({ phase }: { phase: StadiumPhase }) {
  const items = useMemo(() => {
    const cols: { x: number; z: number; h: number; c: string; w: number }[] = []
    const beams: { a: [number, number, number]; b: [number, number, number]; c: string; w: number }[] = []
    for (let i = 0; i < N; i += 2) {
      if (segBuilt(Math.min(i, N - 2), phase)) continue
      const rows: [number, number][] = [
        [FACADE_D + 0.3, 7.6],
        [FACADE_D - 2.7, 6.2],
        [2.2, 4.4],
      ]
      rows.forEach(([d, h]) => {
        const [x, z] = at(i, d)
        cols.push({ x, z, h, c: CONCRETE, w: 0.34 })
      })
      // vigas entre columnas vecinas
      if (i + 2 < N && !segBuilt(Math.min(i + 1, N - 2), phase)) {
        rows.forEach(([d, h], r) => {
          const [x0, z0] = at(i, d)
          const [x1, z1] = at(i + 2, d)
          beams.push({ a: [x0, h, z0], b: [x1, h, z1], c: r === 0 ? STEEL : CONCRETE_DARK, w: r === 0 ? 0.22 : 0.2 })
          if (r === 0) beams.push({ a: [x0, 3.9, z0], b: [x1, 3.9, z1], c: CONCRETE_DARK, w: 0.2 })
        })
      }
      // cercha de acero que une el borde exterior con el interior
      if (i % 4 === 0) {
        const [x0, z0] = at(i, FACADE_D + 0.3)
        const [x1, z1] = at(i, 2.2)
        beams.push({ a: [x0, 7.6, z0], b: [x1, 4.4, z1], c: STEEL, w: 0.26 })
        const [xm, zm] = at(i, FACADE_D - 2.7)
        beams.push({ a: [xm, 6.2, zm], b: [x1, 4.4, z1], c: STEEL, w: 0.14 })
      }
    }
    return { cols, beams }
  }, [phase])
  return (
    <group>
      {items.cols.map((c, k) => (
        <mesh key={`c${k}`} geometry={GEO.box} material={mat(c.c)} position={[c.x, c.h / 2, c.z]} scale={[c.w, c.h, c.w]} castShadow />
      ))}
      {items.beams.map((b, k) => (
        <Beam key={`b${k}`} a={b.a} b={b.b} w={b.w} color={b.c} />
      ))}
      {/* andamios por fuera de las gradas sin terminar */}
      {Array.from({ length: Math.floor((N - 2) / 2) }, (_, k) => {
        const i = k * 2
        if (segBuilt(i, phase) || segBuilt(i + 1, phase)) return null
        return <ScaffoldBay key={k} i={i} />
      })}
    </group>
  )
}

function Beam({ a, b, w, color }: { a: [number, number, number]; b: [number, number, number]; w: number; color: string }) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  const len = Math.hypot(dx, dy, dz)
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(dx, dy, dz).normalize()), [dx, dy, dz])
  return <mesh geometry={GEO.box} material={mat(color)} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]} quaternion={q} scale={[w, w, len]} castShadow />
}

/** Un tramo de andamio frente a la fachada sin terminar: postes, travesaños, tablones y diagonal. */
function ScaffoldBay({ i }: { i: number }) {
  const d = FACADE_D + 1.1
  const [x0, z0] = at(i, d)
  const [x1, z1] = at(i + 2, d)
  const dx = x1 - x0
  const dz = z1 - z0
  const len = Math.hypot(dx, dz)
  const rot = Math.atan2(dx, dz)
  const H = 7.8
  return (
    <group position={[x0, 0, z0]} rotation={[0, rot, 0]}>
      {[0, len].map((z) => (
        <mesh key={z} geometry={GEO.cylinderLow} material={mat(SCAFF)} position={[0, H / 2, z]} scale={[0.09, H, 0.09]} />
      ))}
      {[2.2, 4.6, 7.0].map((h) => (
        <group key={h}>
          <mesh geometry={GEO.box} material={mat(SCAFF)} position={[0, h, len / 2]} scale={[0.07, 0.07, len]} />
          <mesh geometry={GEO.box} material={mat(PLANK)} position={[-0.25, h - 0.06, len / 2]} scale={[0.7, 0.06, len * 0.96]} />
        </group>
      ))}
      <Beam a={[0, 0.3, 0]} b={[0, 4.6, len]} w={0.05} color={SCAFF} />
      <Beam a={[0, 4.6, 0]} b={[0, 7.0, len]} w={0.05} color={SCAFF} />
    </group>
  )
}

/** Mástiles de acero de la cubierta terminada. */
function RoofMasts({ phase }: { phase: StadiumPhase }) {
  const masts = useMemo(() => {
    const out: { x: number; z: number }[] = []
    for (let i = 0; i < N - 1; i += 4) if (segBuilt(i, phase)) out.push({ x: at(i, FACADE_D + 0.7)[0], z: at(i, FACADE_D + 0.7)[1] })
    return out
  }, [phase])
  return (
    <group>
      {masts.map((m, k) => (
        <mesh key={k} geometry={GEO.cylinderLow} material={mat('#9aa3ad')} position={[m.x, ROOF_OUT_H / 2, m.z]} scale={[0.22, ROOF_OUT_H, 0.22]} castShadow />
      ))}
    </group>
  )
}

// ── cancha ───────────────────────────────────────────────────────────────────────────────────────────
function Pitch({ phase }: { phase: StadiumPhase }) {
  const stripes = 14
  const sw = (PX * 2) / stripes
  const white = mat('#f6f6f0')
  const line = (x: number, z: number, w: number, d: number) => <mesh geometry={GEO.box} material={white} position={[x, 0.052, z]} scale={[w, 0.012, d]} />
  const done = phase !== 'construction'
  const dirtFrom = done ? stripes : 11
  const lineLen = PX * 2 * (dirtFrom / stripes)
  return (
    <group position={[0, 0, 0]}>
      <mesh geometry={GEO.box} material={mat('#3f8a37')} position={[0, 0.015, 0]} scale={[PX * 2 + 1.6, 0.03, PZ * 2 + 1.6]} receiveShadow />
      {Array.from({ length: stripes }, (_, k) => {
        const dirt = k >= dirtFrom
        return (
          <mesh
            key={k}
            geometry={GEO.box}
            material={mat(dirt ? (k % 2 ? '#b58c5c' : '#c19768') : k % 2 ? '#4fa03f' : '#5db84b')}
            position={[-PX + sw * (k + 0.5), 0.04, 0]}
            scale={[sw, 0.02, PZ * 2]}
            receiveShadow
          />
        )
      })}
      {/* líneas del lado terminado */}
      {line(-PX + 0.05, 0, 0.1, PZ * 2)}
      {line(-PX + lineLen / 2, -PZ + 0.05, lineLen, 0.1)}
      {line(-PX + lineLen / 2, PZ - 0.05, lineLen, 0.1)}
      {line(0, 0, 0.1, PZ * 2)}
      <mesh geometry={GEO.ring} material={white} position={[0, 0.056, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.55, 1.55, 1]} />
      {line(-PX + 1.9, 0, 0.1, 3.8)}
      {line(-PX + 0.95, -1.9, 1.9, 0.1)}
      {line(-PX + 0.95, 1.9, 1.9, 0.1)}
      {/* arco oeste */}
      <Goal x={-PX + 0.02} />
      {done ? (
        <>
          {line(PX - 0.05, 0, 0.1, PZ * 2)}
          {line(PX - 1.9, 0, 0.1, 3.8)}
          {line(PX - 0.95, -1.9, 1.9, 0.1)}
          {line(PX - 0.95, 1.9, 1.9, 0.1)}
          <Goal x={PX - 0.02} />
        </>
      ) : (
        <>
          {/* lado en obra: huellas de maquinaria y montones de tierra */}
          {[-2.6, 0.2, 2.9].map((z, k) => (
            <mesh key={k} geometry={GEO.box} material={mat('#8a6a45')} position={[PX - 3.2 + k * 0.7, 0.06, z]} scale={[3.4, 0.014, 0.35]} />
          ))}
          {[
            [PX - 1.4, -3.6, 1.7],
            [PX - 4.2, 3.9, 1.3],
          ].map(([x, z, k], i) => (
            <mesh key={i} geometry={GEO.cone} material={mat('#a67b4c')} position={[x, 0.55, z]} scale={[k * 1.5, 1.1, k * 1.5]} castShadow />
          ))}
          {/* los arcos aún no están: palos de portería apilados */}
          <mesh geometry={GEO.box} material={white} position={[PX - 1.0, 0.18, 4.7]} scale={[0.1, 0.1, 2.6]} />
          <mesh geometry={GEO.box} material={white} position={[PX - 1.3, 0.18, 4.7]} scale={[0.1, 0.1, 2.6]} />
        </>
      )}
    </group>
  )
}

/** Arco de fútbol (dos palos, travesaño y red). */
function Goal({ x }: { x: number }) {
  const white = mat('#f6f6f0')
  return (
    <group position={[x, 0, 0]}>
      {[-0.85, 0.85].map((z) => (
        <mesh key={z} geometry={GEO.box} material={white} position={[0, 0.5, z]} scale={[0.09, 1, 0.09]} />
      ))}
      <mesh geometry={GEO.box} material={white} position={[0, 1.0, 0]} scale={[0.09, 0.09, 1.8]} />
      <mesh geometry={GEO.box} material={mat('#ffffff', { opacity: 0.35 })} position={[Math.sign(x) * -0.01 - Math.sign(x) * 0.35, 0.5, 0]} scale={[0.7, 1, 1.7]} />
    </group>
  )
}

// ── isla ─────────────────────────────────────────────────────────────────────────────────────────────
function rrShape(hx: number, hz: number, r: number) {
  const s = new THREE.Shape()
  s.moveTo(-hx + r, -hz)
  s.lineTo(hx - r, -hz)
  s.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0, false)
  s.lineTo(hx, hz - r)
  s.absarc(hx - r, hz - r, r, 0, Math.PI / 2, false)
  s.lineTo(-hx + r, hz)
  s.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-hx, -hz + r)
  s.absarc(-hx + r, -hz + r, r, Math.PI, 1.5 * Math.PI, false)
  return s
}
function slab(scale: number, depth: number, y: number) {
  const g = new THREE.ExtrudeGeometry(rrShape(IX * scale, IZ * scale, IR * scale), { depth, bevelEnabled: false, curveSegments: 10 })
  g.rotateX(Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

function Ground() {
  const geos = useMemo(
    () => ({ slope: slab(1.1, 1.8, SEA + 0.1), base: slab(1.03, Y - SEA + 0.1, Y - 0.04), floor: slab(0.99, 0.05, Y + 0.01), pad: slab(0.78, 0.05, Y + 0.06) }),
    [],
  )
  const road = useMemo(() => ring(20.5, 17.4, 6, 6, 5), [])
  return (
    <group>
      <mesh geometry={geos.slope} material={mat(STONE_DARK)} receiveShadow />
      <mesh geometry={geos.base} material={mat(STONE[0])} castShadow receiveShadow />
      <mesh geometry={geos.floor} material={mat('#d8c7a4')} receiveShadow />
      {/* explanada de obra: tierra compactada y la calle por donde circulan los camiones */}
      <mesh geometry={geos.pad} material={mat('#c9b48e')} receiveShadow />
      {road.slice(0, -1).map((p, i) => {
        const q = road[i + 1]
        const len = Math.hypot(q.x - p.x, q.z - p.z)
        return (
          <mesh
            key={i}
            geometry={GEO.box}
            material={mat('#8f8168')}
            position={[(p.x + q.x) / 2, Y + 0.11, (p.z + q.z) / 2]}
            rotation={[0, Math.atan2(q.x - p.x, q.z - p.z), 0]}
            scale={[2.4, 0.02, len + 0.1]}
            receiveShadow
          />
        )
      })}
      {/* rocas en la orilla */}
      {[0, 0.13, 0.27, 0.41, 0.55, 0.68, 0.82, 0.93].map((u, k) => {
        const a = u * Math.PI * 2
        return (
          <mesh
            key={k}
            geometry={GEO.sphere}
            material={mat(STONE_DARK)}
            position={[Math.cos(a) * (IX * 1.07), SEA + 0.1, Math.sin(a) * (IZ * 1.07)]}
            scale={[1.8 + (k % 2), 0.9, 1.4]}
          />
        )
      })}
    </group>
  )
}

// ── muros de castillo alrededor de la isla (como las otras islas de la fortaleza) ──────────────────────────
const WH = 3.4
const WALL_RING = ring(IX - 0.8, IZ - 0.8, IR - 0.8, 8, 7)
const GATE_X = -10

/** Torreón redondo de piedra con almenas y garita. */
function RoundTower({ x, z, k = 1 }: { x: number; z: number; k?: number }) {
  return (
    <group position={[x, Y, z]} scale={k}>
      <mesh geometry={GEO.cylinder} material={mat(STONE[2])} position={[0, (WH + 1.6) / 2 - 0.2, 0]} scale={[4.2, WH + 1.6, 4.2]} castShadow receiveShadow />
      <mesh geometry={GEO.cylinder} material={mat(CORDON)} position={[0, WH + 0.6, 0]} scale={[4.5, 0.18, 4.5]} />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2
        return (
          <mesh
            key={i}
            geometry={GEO.box}
            material={mat(STONE[1])}
            position={[Math.cos(a) * 1.95, WH + 1.05, Math.sin(a) * 1.95]}
            rotation={[0, -a, 0]}
            scale={[0.46, 0.6, 0.85]}
            castShadow
          />
        )
      })}
      <Garita x={0} z={0} y={WH + 0.7} />
    </group>
  )
}

function CastleWalls() {
  const n = WALL_RING.length
  const gateIdx = WALL_RING.reduce((best, p, i) => (p.nz > 0.99 && Math.abs(p.x - GATE_X) < Math.abs(WALL_RING[best].x - GATE_X) ? i : best), 0)
  const towers = [12, 28, 44, 60]
  return (
    <group>
      {WALL_RING.slice(0, n - 1).map((p, i) => {
        const q = WALL_RING[i + 1]
        // hueco de la puerta, donde llega el puente
        if (p.nz > 0.99 && Math.abs((p.x + q.x) / 2 - GATE_X) < 2.2) return null
        const len = Math.hypot(q.x - p.x, q.z - p.z)
        return (
          <group key={i} position={[(p.x + q.x) / 2, 0, (p.z + q.z) / 2]} rotation={[0, Math.atan2(q.x - p.x, q.z - p.z), 0]}>
            <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, Y + WH / 2, 0]} scale={[1.1, WH, len + 0.1]} castShadow receiveShadow />
            <mesh geometry={GEO.box} material={mat(CORDON)} position={[0, Y + WH - 0.35, 0]} scale={[1.28, 0.16, len + 0.14]} />
            {i % 2 === 0 && <mesh geometry={GEO.box} material={mat(STONE[1])} position={[0, Y + WH + 0.28, 0]} scale={[0.8, 0.56, len * 0.55]} castShadow />}
          </group>
        )
      })}
      {towers.map((i) => (
        <RoundTower key={i} x={WALL_RING[i].x} z={WALL_RING[i].z} />
      ))}
      {/* puerta: dos torreones pequeños y un dintel sobre el paso del puente */}
      {[-1, 1].map((sd) => (
        <RoundTower key={sd} x={GATE_X + sd * 3.2} z={WALL_RING[gateIdx].z} k={0.62} />
      ))}
      <mesh geometry={GEO.box} material={mat(STONE[2])} position={[GATE_X, Y + WH + 0.1, WALL_RING[gateIdx].z]} scale={[4.2, 0.7, 1.3]} castShadow />
      <mesh geometry={GEO.box} material={mat(CORDON)} position={[GATE_X, Y + WH + 0.5, WALL_RING[gateIdx].z]} scale={[4.4, 0.16, 1.45]} />
    </group>
  )
}

// ── puente (cerrado por obra) ─────────────────────────────────────────────────────────────────────────
const BRIDGE_X = GATE_X
/** Del muro norte de la fortaleza a la puerta de la isla, en coordenadas del mundo. */
function Bridge({ phase }: { phase: StadiumPhase }) {
  const x = C.x + BRIDGE_X * S
  const zWall = -(31 + 1.1)
  const zIsle = C.z + (IZ + 0.4) * S
  const len = Math.abs(zIsle - zWall)
  const zc = (zIsle + zWall) / 2
  const w = 2.6
  return (
    <group position={[x, 0, zc]}>
      <mesh geometry={GEO.box} material={mat(STONE[0])} position={[0, Y - 0.3, 0]} scale={[w, 0.9, len]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat('#c9b48e')} position={[0, Y + 0.18, 0]} scale={[w - 0.4, 0.12, len]} receiveShadow />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={GEO.box} material={mat(STONE[2])} position={[s * (w / 2 - 0.15), Y + 0.5, 0]} scale={[0.3, 0.7, len]} castShadow />
          <mesh geometry={GEO.box} material={mat(CORDON)} position={[s * (w / 2 - 0.15), Y + 0.88, 0]} scale={[0.44, 0.1, len]} />
        </group>
      ))}
      {/* barrera de obra en el extremo de la muralla: aún no se puede pasar */}
      {phase !== 'open' && (
        <group position={[0, Y + 0.2, len / 2 - 0.4]}>
          {[-0.7, 0.7].map((dx) => (
            <mesh key={dx} geometry={GEO.box} material={mat(dx < 0 ? '#f5b800' : '#2f3438')} position={[dx, 0.5, 0]} scale={[1.3, 0.5, 0.1]} />
          ))}
        </group>
      )}
    </group>
  )
}

// ── cartel de «Próximamente» ──────────────────────────────────────────────────────────────────────────
const signTex: Partial<Record<StadiumPhase, THREE.CanvasTexture>> = {}
function signTexture(phase: StadiumPhase) {
  const hit = signTex[phase]
  if (hit) return hit
  const info = phaseInfo(phase)
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#12302a'
  g.fillRect(0, 0, 1024, 512)
  g.textAlign = 'center'
  if (phase === 'open') {
    // inaugurado: bandas verde y amarillo
    g.fillStyle = '#22a05a'
    g.fillRect(0, 0, 1024, 40)
    g.fillStyle = '#f6c619'
    g.fillRect(0, 40, 1024, 22)
    g.fillRect(0, 450, 1024, 22)
    g.fillStyle = '#22a05a'
    g.fillRect(0, 472, 1024, 40)
    g.fillStyle = '#f6c619'
    g.font = '800 54px "Plus Jakarta Sans", Manrope, sans-serif'
    g.fillText('ESTADIO DE CARTAGENA', 512, 160)
    g.fillStyle = '#ffffff'
    g.font = '900 112px "Plus Jakarta Sans", Manrope, sans-serif'
    g.fillText('¡BIENVENIDOS!', 512, 290)
    g.fillStyle = 'rgba(255,255,255,0.85)'
    g.font = '700 36px Manrope, sans-serif'
    g.fillText('Fútbol · Conciertos · Eventos', 512, 372)
  } else {
    // franjas de precaución arriba y abajo
    for (const y of [0, 452]) {
      for (let x = -60; x < 1100; x += 70) {
        g.fillStyle = '#f5b800'
        g.beginPath()
        g.moveTo(x, y + 60)
        g.lineTo(x + 35, y + 60)
        g.lineTo(x + 95, y)
        g.lineTo(x + 60, y)
        g.fill()
      }
    }
    g.fillStyle = '#f6c619'
    g.font = '800 56px "Plus Jakarta Sans", Manrope, sans-serif'
    g.fillText('ESTADIO DE CARTAGENA', 512, 150)
    g.fillStyle = '#ffffff'
    g.font = `900 ${phase === 'almost' ? 92 : 118}px "Plus Jakarta Sans", Manrope, sans-serif`
    g.fillText(phase === 'almost' ? 'CASI LISTO' : 'PRÓXIMAMENTE', 512, 280)
    g.fillStyle = 'rgba(255,255,255,0.18)'
    g.fillRect(172, 340, 680, 36)
    g.fillStyle = '#22a05a'
    g.fillRect(172, 340, (680 * info.progress) / 100, 36)
    g.fillStyle = '#ffffff'
    g.font = '700 34px Manrope, sans-serif'
    g.fillText(`Avance de obra ${info.progress}%`, 512, 420)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  signTex[phase] = tex
  return tex
}

function Hoarding({ phase }: { phase: StadiumPhase }) {
  const tex = useMemo(() => signTexture(phase), [phase])
  const signMat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), [tex])
  return (
    <group position={[BRIDGE_X, Y, IZ - 3.4]}>
      {[-3.3, 3.3].map((x) => (
        <mesh key={x} geometry={GEO.box} material={mat(IRON)} position={[x, 1.7, 0]} scale={[0.22, 3.4, 0.22]} castShadow />
      ))}
      <mesh geometry={GEO.box} material={mat('#12302a')} position={[0, 2.95, -0.04]} scale={[6.9, 2.5, 0.14]} castShadow />
      <mesh geometry={GEO.plane} material={signMat} position={[0, 2.95, 0.04]} scale={[6.6, 2.2, 1]} />
      {/* vallas verdes a los lados */}
      {[-1, 1].flatMap((s) =>
        [0, 1, 2, 3].map((k) => (
          <mesh key={`${s}${k}`} geometry={GEO.box} material={mat(k % 2 ? '#2f8f4f' : '#37a05a')} position={[s * (4.6 + k * 1.4), 0.6, 0.4]} scale={[1.38, 1.2, 0.1]} castShadow />
        )),
      )}
    </group>
  )
}

// ── grúas torre ──────────────────────────────────────────────────────────────────────────────────────
interface CraneCfg {
  x: number
  z: number
  h: number
  jib: number
  rot: number
  speed: number
  phase: number
  load: 'beams' | 'block' | 'pallet'
}
const CRANES: CraneCfg[] = [
  { x: 23, z: -5, h: 17, jib: 18, rot: 2.2, speed: 0.11, phase: 0, load: 'beams' },
  { x: -2, z: -18.3, h: 15, jib: 15, rot: 0.6, speed: -0.09, phase: 2.1, load: 'block' },
  { x: -22.5, z: 11, h: 12, jib: 12, rot: -0.9, speed: 0.13, phase: 4.2, load: 'pallet' },
]

function CraneMast({ h }: { h: number }) {
  const W = 1.05
  const seg = 1.4
  const n = Math.floor(h / seg)
  const bar = mat(YELLOW)
  return (
    <group>
      {[
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([sx, sz], k) => (
        <mesh key={k} geometry={GEO.box} material={bar} position={[(sx * W) / 2, h / 2, (sz * W) / 2]} scale={[0.1, h, 0.1]} castShadow />
      ))}
      {Array.from({ length: n }, (_, k) => {
        const y = k * seg + seg / 2
        return (
          <group key={k}>
            {[0, 1, 2, 3].map((f) => {
              const a = (f * Math.PI) / 2
              return (
                <group key={f} rotation={[0, a, 0]}>
                  <mesh geometry={GEO.box} material={bar} position={[0, y + seg / 2, W / 2]} scale={[W, 0.06, 0.06]} />
                  <Beam a={[-W / 2, y - seg / 2, W / 2]} b={[W / 2, y + seg / 2, W / 2]} w={0.055} color={YELLOW} />
                </group>
              )
            })}
          </group>
        )
      })}
    </group>
  )
}

function TowerCrane({ cfg, reduceMotion }: { cfg: CraneCfg; reduceMotion: boolean }) {
  const jib = useRef<THREE.Group>(null)
  const trolley = useRef<THREE.Group>(null)
  const rope = useRef<THREE.Mesh>(null)
  const load = useRef<THREE.Group>(null)
  const { h, jib: L } = cfg
  const yellow = mat(YELLOW)
  useFrame(({ clock }) => {
    const t = reduceMotion ? 3 : clock.elapsedTime
    if (jib.current) jib.current.rotation.y = cfg.rot + Math.sin(t * cfg.speed + cfg.phase) * 1.15
    const u = (Math.sin(t * 0.33 + cfg.phase) + 1) / 2
    const tx = 3.2 + u * (L - 5.5)
    const drop = 3.2 + (Math.sin(t * 0.47 + cfg.phase * 1.7) + 1) * 2.5
    if (trolley.current) trolley.current.position.x = tx
    if (rope.current) {
      rope.current.scale.set(0.04, drop, 0.04)
      rope.current.position.y = -drop / 2
    }
    if (load.current) {
      load.current.position.y = -drop
      load.current.rotation.y = Math.sin(t * 0.8 + cfg.phase) * 0.25
      load.current.rotation.z = Math.sin(t * 1.1 + cfg.phase) * 0.04
    }
  })
  return (
    <group position={[cfg.x, Y, cfg.z]}>
      {/* base de concreto con lastre y mástil de celosía */}
      <mesh geometry={GEO.box} material={mat('#a9a196')} position={[0, 0.3, 0]} scale={[3.0, 0.6, 3.0]} castShadow receiveShadow />
      {[
        [-1.1, -1.1],
        [1.1, -1.1],
        [1.1, 1.1],
        [-1.1, 1.1],
      ].map(([x, z], k) => (
        <mesh key={k} geometry={GEO.box} material={mat('#8e867b')} position={[x, 0.75, z]} scale={[0.7, 0.3, 0.7]} />
      ))}
      <CraneMast h={h} />
      <mesh geometry={GEO.box} material={mat('#f2f2ee')} position={[0, h + 0.55, 0]} scale={[1.25, 1.1, 1.25]} castShadow />
      {/* pluma que gira */}
      <group ref={jib} position={[0, h + 1.1, 0]} userData={{ dynamic: true }}>
        {/* cabina */}
        <mesh geometry={GEO.box} material={mat('#f2f2ee')} position={[0.9, 0.2, 0.95]} scale={[0.8, 0.9, 0.8]} castShadow />
        <mesh geometry={GEO.box} material={mat('#6f9fb5', { opacity: 0.8 })} position={[1.3, 0.28, 0.95]} scale={[0.04, 0.5, 0.6]} />
        {/* pluma: cordón superior, dos inferiores y diagonales */}
        <mesh geometry={GEO.box} material={yellow} position={[L / 2 - 1.5, 0.95, 0]} scale={[L, 0.1, 0.1]} castShadow />
        {[-0.38, 0.38].map((z) => (
          <mesh key={z} geometry={GEO.box} material={yellow} position={[L / 2 - 1.5, 0.15, z]} scale={[L, 0.09, 0.09]} castShadow />
        ))}
        {Array.from({ length: Math.floor(L / 1.5) }, (_, k) => {
          const x0 = -1.5 + k * 1.5
          return (
            <group key={k}>
              <Beam a={[x0, 0.15, -0.38]} b={[x0 + 0.75, 0.95, 0]} w={0.06} color={YELLOW} />
              <Beam a={[x0 + 0.75, 0.95, 0]} b={[x0 + 1.5, 0.15, -0.38]} w={0.06} color={YELLOW} />
              <Beam a={[x0, 0.15, 0.38]} b={[x0 + 0.75, 0.95, 0]} w={0.06} color={YELLOW} />
              <Beam a={[x0 + 0.75, 0.95, 0]} b={[x0 + 1.5, 0.15, 0.38]} w={0.06} color={YELLOW} />
            </group>
          )
        })}
        {/* contrapluma con lastres */}
        <mesh geometry={GEO.box} material={yellow} position={[-3.1, 0.15, 0]} scale={[4.2, 0.1, 0.5]} castShadow />
        <mesh geometry={GEO.box} material={mat('#6f6a64')} position={[-4.4, -0.35, 0]} scale={[1.5, 1.0, 1.0]} castShadow />
        <mesh geometry={GEO.box} material={mat('#8a847c')} position={[-3.3, -0.3, 0]} scale={[1.1, 0.9, 0.95]} castShadow />
        {/* torre de la punta y tirantes */}
        <mesh geometry={GEO.box} material={yellow} position={[0, 2.3, 0]} scale={[0.14, 2.6, 0.14]} castShadow />
        <Beam a={[0, 3.55, 0]} b={[L - 3.2, 1.0, 0]} w={0.035} color="#7b8088" />
        <Beam a={[0, 3.55, 0]} b={[-4.6, 0.3, 0]} w={0.035} color="#7b8088" />
        <mesh geometry={GEO.sphere} material={glowMat('#ff4d3d', 2.2, { dayGlow: 0.5 })} position={[0, 3.75, 0]} scale={0.2} />
        {/* carro con gancho y carga */}
        <group ref={trolley} position={[4, 0, 0]}>
          <mesh geometry={GEO.box} material={mat('#555b62')} position={[0, 0.05, 0]} scale={[0.5, 0.2, 0.9]} />
          <mesh ref={rope} geometry={GEO.box} material={mat('#3a3d42')} position={[0, -2, 0]} scale={[0.04, 4, 0.04]} />
          <group ref={load} position={[0, -4, 0]}>
            <mesh geometry={GEO.box} material={mat('#555b62')} position={[0, 0.08, 0]} scale={[0.22, 0.3, 0.22]} />
            {cfg.load === 'beams' && (
              <group position={[0, -0.28, 0]}>
                {[-0.2, 0, 0.2].map((z, k) => (
                  <mesh key={k} geometry={GEO.box} material={mat(k === 1 ? '#c8553b' : STEEL)} position={[0, 0, z]} scale={[2.6, 0.16, 0.16]} castShadow />
                ))}
              </group>
            )}
            {cfg.load === 'block' && <mesh geometry={GEO.box} material={mat('#9a9288')} position={[0, -0.55, 0]} scale={[1.2, 0.9, 1.2]} castShadow />}
            {cfg.load === 'pallet' && (
              <group position={[0, -0.5, 0]}>
                <mesh geometry={GEO.box} material={mat('#b98a5e')} position={[0, -0.25, 0]} scale={[1.4, 0.12, 1.1]} />
                <mesh geometry={GEO.box} material={mat('#c9724f')} position={[0, 0.15, 0]} scale={[1.25, 0.65, 0.95]} castShadow />
              </group>
            )}
          </group>
        </group>
      </group>
    </group>
  )
}

// ── vehículos y obreros ─────────────────────────────────────────────────────────────────────────────
const ROAD = ring(20.5, 17.4, 6, 6, 5)
function roadAt(u: number): { x: number; z: number; rot: number } {
  const f = (((u % 1) + 1) % 1) * (ROAD.length - 1)
  const i = Math.floor(f)
  const t = f - i
  const a = ROAD[i]
  const b = ROAD[i + 1]
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, rot: Math.atan2(b.x - a.x, b.z - a.z) }
}

function DumpTruck() {
  return (
    <group>
      <mesh geometry={GEO.box} material={mat('#3b3f44')} position={[0, 0.5, 0]} scale={[1.4, 0.25, 3.8]} castShadow />
      <mesh geometry={GEO.box} material={mat(YELLOW)} position={[0, 1.25, 1.35]} scale={[1.4, 1.2, 1.1]} castShadow />
      <mesh geometry={GEO.box} material={mat('#6f9fb5', { opacity: 0.8 })} position={[0, 1.4, 1.93]} scale={[1.2, 0.5, 0.05]} />
      <mesh geometry={GEO.box} material={mat('#e0a000')} position={[0, 1.15, -0.55]} scale={[1.55, 0.95, 2.2]} rotation={[0.08, 0, 0]} castShadow />
      <mesh geometry={GEO.box} material={mat('#a67b4c')} position={[0, 1.55, -0.55]} scale={[1.3, 0.2, 1.9]} />
      {[
        [-0.75, 1.3],
        [0.75, 1.3],
        [-0.75, -1.1],
        [0.75, -1.1],
        [-0.75, -1.8],
        [0.75, -1.8],
      ].map(([x, z], k) => (
        <mesh key={k} geometry={GEO.cylinder} material={mat('#23262a')} position={[x, 0.42, z]} rotation={[0, 0, Math.PI / 2]} scale={[0.84, 0.3, 0.84]} />
      ))}
    </group>
  )
}

function MixerTruck({ spin }: { spin: React.RefObject<THREE.Mesh | null> }) {
  return (
    <group>
      <mesh geometry={GEO.box} material={mat('#3b3f44')} position={[0, 0.5, 0]} scale={[1.4, 0.25, 3.8]} castShadow />
      <mesh geometry={GEO.box} material={mat('#f2f2ee')} position={[0, 1.25, 1.35]} scale={[1.4, 1.2, 1.1]} castShadow />
      <mesh geometry={GEO.box} material={mat('#6f9fb5', { opacity: 0.8 })} position={[0, 1.4, 1.93]} scale={[1.2, 0.5, 0.05]} />
      <mesh ref={spin} geometry={GEO.cone} material={mat('#e8832a')} position={[0, 1.55, -0.6]} rotation={[Math.PI / 2 + 0.2, 0, 0]} scale={[1.7, 2.6, 1.7]} castShadow />
      {[
        [-0.75, 1.3],
        [0.75, 1.3],
        [-0.75, -1.1],
        [0.75, -1.1],
        [-0.75, -1.8],
        [0.75, -1.8],
      ].map(([x, z], k) => (
        <mesh key={k} geometry={GEO.cylinder} material={mat('#23262a')} position={[x, 0.42, z]} rotation={[0, 0, Math.PI / 2]} scale={[0.84, 0.3, 0.84]} />
      ))}
    </group>
  )
}

function Trucks({ reduceMotion, phase }: { reduceMotion: boolean; phase: StadiumPhase }) {
  const dump = useRef<THREE.Group>(null)
  const mixer = useRef<THREE.Group>(null)
  const drum = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.elapsedTime
    const move = (g: THREE.Group | null, u: number) => {
      if (!g) return
      const p = roadAt(u)
      g.position.set(p.x, Y + 0.1, p.z)
      g.rotation.y = p.rot
    }
    move(dump.current, t * 0.012)
    move(mixer.current, 0.5 - t * 0.009)
    if (dump.current) dump.current.visible = phase !== 'open'
    if (mixer.current) mixer.current.visible = phase === 'construction'
    if (drum.current) drum.current.rotation.y = t * 1.6
  })
  return (
    <group userData={{ dynamic: true }}>
      <group ref={dump} scale={0.8}>
        <DumpTruck />
      </group>
      <group ref={mixer} scale={0.8}>
        <MixerTruck spin={drum} />
      </group>
    </group>
  )
}

const HELMETS = ['#f6c21a', '#f4f4f0', '#ff8a1f', '#f6c21a']
const VESTS = ['#ff8a1f', '#f4d03f', '#ff7a45', '#f4d03f']
const SKIN = ['#8d5a3b', '#c58c64', '#e5b48f', '#a56b45']

/** Rutas (x, z) de los obreros dentro de la isla: caminan de punto a punto y vuelven. */
const WORK_ROUTES: { pts: [number, number][]; speed: number; phase: number }[] = [
  {
    pts: [
      [-14, 17.5],
      [14, 17.5],
    ],
    speed: 0.9,
    phase: 0,
  },
  {
    pts: [
      [-14, 17.5],
      [14, 17.5],
    ],
    speed: 0.8,
    phase: 0.55,
  },
  {
    pts: [
      [20, -12],
      [20, 12],
    ],
    speed: 0.85,
    phase: 0.2,
  },
  {
    pts: [
      [-20, -12],
      [-20, 12],
    ],
    speed: 0.7,
    phase: 0.7,
  },
  {
    pts: [
      [-6, -17.4],
      [10, -17.4],
    ],
    speed: 0.8,
    phase: 0.1,
  },
  {
    pts: [
      [3, 0],
      [14, -3],
      [14, 3],
    ],
    speed: 0.9,
    phase: 0.4,
  },
  {
    pts: [
      [8, 4],
      [4, -4],
    ],
    speed: 0.6,
    phase: 0.9,
  },
  {
    pts: [
      [16, 15.5],
      [22, 8],
    ],
    speed: 0.7,
    phase: 0.3,
  },
  {
    pts: [
      [-12, -15.8],
      [-2, -15.8],
    ],
    speed: 0.75,
    phase: 0.6,
  },
  {
    pts: [
      [21, 13],
      [21, 2],
    ],
    speed: 0.8,
    phase: 0.45,
  },
]
const WELDERS: [number, number, number][] = [
  [17.4, -6.2, -1.6],
  [11.5, 12.3, 3.1],
  [-13.5, 13.6, 0.5],
]

const CIVIL = ['#22a05a', '#f6c619', '#f4f4f0', '#2f3e4e', '#c8553b', '#3f78a0']

function Workers({ reduceMotion, phase }: { reduceMotion: boolean; phase: StadiumPhase }) {
  const civil = phase === 'open'
  const nRoutes = phase === 'almost' ? 5 : WORK_ROUTES.length
  const nWelders = phase === 'construction' ? WELDERS.length : phase === 'almost' ? 1 : 0
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const hats = useRef<THREE.InstancedMesh>(null)
  const total = WORK_ROUTES.length + WELDERS.length
  const o = useMemo(() => new THREE.Object3D(), [])
  const sparks = useRef<(THREE.Mesh | null)[]>([])
  const routeLen = useMemo(() => WORK_ROUTES.map((r) => r.pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - r.pts[i][0], p[1] - r.pts[i][1]), 0)), [])

  useLayoutEffect(() => {
    const c = new THREE.Color()
    for (let i = 0; i < total; i++) {
      bodies.current?.setColorAt(i, c.set(civil ? CIVIL[i % CIVIL.length] : VESTS[i % VESTS.length]))
      heads.current?.setColorAt(i, c.set(SKIN[i % SKIN.length]))
      hats.current?.setColorAt(i, c.set(HELMETS[i % HELMETS.length]))
    }
    for (const m of [bodies.current, heads.current, hats.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [total, civil])

  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.elapsedTime
    const place = (i: number, x: number, z: number, heading: number, bob: number, vis = true) => {
      const k = vis ? 1 : 0
      o.position.set(x, Y + 0.43 + bob, z)
      o.rotation.set(0, heading, 0)
      o.scale.setScalar(k)
      o.updateMatrix()
      bodies.current?.setMatrixAt(i, o.matrix)
      o.position.y += 0.52
      o.scale.setScalar(0.36 * k)
      o.updateMatrix()
      heads.current?.setMatrixAt(i, o.matrix)
      o.position.y += 0.02
      o.scale.setScalar(0.4 * k)
      o.updateMatrix()
      hats.current?.setMatrixAt(i, o.matrix)
    }
    WORK_ROUTES.forEach((r, i) => {
      // ida y vuelta por la ruta (ping-pong), a velocidad constante
      const L = routeLen[i]
      const s = (((t * r.speed * 0.5 + r.phase * L) % (2 * L)) + 2 * L) % (2 * L)
      const dist = s < L ? s : 2 * L - s
      const fwd = s < L
      let acc = 0
      let x = r.pts[0][0]
      let z = r.pts[0][1]
      let hd = 0
      for (let k = 1; k < r.pts.length; k++) {
        const a = r.pts[k - 1]
        const b = r.pts[k]
        const seg = Math.hypot(b[0] - a[0], b[1] - a[1])
        if (dist <= acc + seg || k === r.pts.length - 1) {
          const f = Math.min(1, Math.max(0, (dist - acc) / seg))
          x = a[0] + (b[0] - a[0]) * f
          z = a[1] + (b[1] - a[1]) * f
          hd = Math.atan2(b[0] - a[0], b[1] - a[1]) + (fwd ? 0 : Math.PI)
          break
        }
        acc += seg
      }
      place(i, x, z, hd, Math.abs(Math.sin(t * 6 + i)) * 0.05, i < nRoutes)
    })
    WELDERS.forEach(([x, z, hd], k) => {
      place(WORK_ROUTES.length + k, x, z, hd + Math.sin(t * 0.4 + k) * 0.3, 0, k < nWelders)
      const sp = sparks.current[k]
      if (sp) {
        const on = k < nWelders && Math.sin(t * 17 + k * 3) > 0.1 && Math.sin(t * 2.3 + k) > -0.3
        sp.visible = on
        sp.scale.setScalar(on ? 0.16 + Math.abs(Math.sin(t * 40 + k)) * 0.12 : 0.01)
      }
    })
    for (const m of [bodies.current, heads.current, hats.current]) if (m) m.instanceMatrix.needsUpdate = true
  })

  return (
    <group userData={{ dynamic: true }}>
      <instancedMesh ref={bodies} args={[GEO.capsule, mat('#ffffff'), total]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={heads} args={[GEO.sphereSmooth, mat('#ffffff'), total]} frustumCulled={false} raycast={() => null} />
      {!civil && <instancedMesh ref={hats} args={[GEO.helmet, mat('#ffffff'), total]} frustumCulled={false} raycast={() => null} />}
      {WELDERS.map(([x, z], k) => (
        <mesh key={k} ref={(m) => void (sparks.current[k] = m)} geometry={GEO.sphere} material={glowMat('#fff3b0', 3, { dayGlow: 1 })} position={[x + 0.35, Y + 0.7, z + 0.2]} />
      ))}
    </group>
  )
}

// ── utilería de obra ────────────────────────────────────────────────────────────────────────────────
function Cone({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, Y, z]}>
      <mesh geometry={GEO.cone} material={mat('#ff7a1a')} position={[0, 0.3, 0]} scale={[0.34, 0.6, 0.34]} castShadow />
      <mesh geometry={GEO.box} material={mat('#f6f6f0')} position={[0, 0.3, 0]} scale={[0.22, 0.1, 0.22]} />
      <mesh geometry={GEO.box} material={mat('#e5651a')} position={[0, 0.02, 0]} scale={[0.46, 0.04, 0.46]} />
    </group>
  )
}

function Container({ x, z, rot, color }: { x: number; z: number; rot: number; color: string }) {
  return (
    <group position={[x, Y, z]} rotation={[0, rot, 0]}>
      <mesh geometry={GEO.box} material={mat(color)} position={[0, 0.7, 0]} scale={[1.5, 1.4, 3.6]} castShadow receiveShadow />
      {Array.from({ length: 6 }, (_, k) => (
        <mesh key={k} geometry={GEO.box} material={mat(shadeHex(color))} position={[0, 0.7, -1.5 + k * 0.6]} scale={[1.54, 1.3, 0.05]} />
      ))}
    </group>
  )
}
const shadeHex = (hex: string) => new THREE.Color(hex).multiplyScalar(0.8).getStyle()

function Office({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, Y, z]} rotation={[0, rot, 0]}>
      <mesh geometry={GEO.box} material={mat('#e8eef2')} position={[0, 0.8, 0]} scale={[2.6, 1.6, 1.6]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={mat('#3f78a0')} position={[0, 1.65, 0]} scale={[2.7, 0.14, 1.7]} />
      {[-0.7, 0.7].map((dx) => (
        <mesh key={dx} geometry={GEO.box} material={mat('#6f9fb5')} position={[dx, 0.95, 0.82]} scale={[0.7, 0.5, 0.04]} />
      ))}
    </group>
  )
}

function Pile({ x, z, color, s = 1 }: { x: number; z: number; color: string; s?: number }) {
  return <mesh geometry={GEO.cone} material={mat(color)} position={[x, Y + 0.7 * s, z]} scale={[2.6 * s, 1.4 * s, 2.6 * s]} castShadow />
}

function Pipes({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, Y, z]} rotation={[0, rot, 0]}>
      {[0, 1, 2].map((r) =>
        Array.from({ length: 3 - r }, (_, k) => (
          <mesh
            key={`${r}${k}`}
            geometry={GEO.cylinder}
            material={mat(r % 2 ? '#d2d4d8' : '#7e8794')}
            position={[k * 0.42 + r * 0.21 - 0.4, 0.22 + r * 0.36, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[0.4, 3, 0.4]}
            castShadow
          />
        )),
      )}
    </group>
  )
}

function Steel({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, Y, z]} rotation={[0, rot, 0]}>
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((k) => (
          <mesh
            key={`${r}${k}`}
            geometry={GEO.box}
            material={mat(r === 1 ? '#c8553b' : STEEL)}
            position={[k * 0.3 - 0.45, 0.12 + r * 0.2, 0]}
            scale={[0.22, 0.17, 3.4]}
            castShadow
          />
        )),
      )}
      <mesh geometry={GEO.box} material={mat('#8a6340')} position={[0, 0.02, 0.9]} scale={[1.4, 0.06, 0.2]} />
      <mesh geometry={GEO.box} material={mat('#8a6340')} position={[0, 0.02, -0.9]} scale={[1.4, 0.06, 0.2]} />
    </group>
  )
}

const TOWERS: [number, number][] = [
  [-22.5, -17.5],
  [22.5, -17.5],
  [22.5, 17.5],
  [-22.5, 17.5],
]
const LAMP_OFF = new THREE.Color('#4b535b')
const LAMP_ON = new THREE.Color('#fffbe0')

/** ¿Están encendidas las luces? Casi terminado: sí. Inaugurado: mientras el estadio está «encendido» (suena). */
function useLit(phase: StadiumPhase) {
  const on = useStadiumSound((s) => s.playing)
  return phase === 'almost' || (phase === 'open' && on)
}

const LAMP_BASE_OFF = new THREE.Color('#5a554d')
const LAMP_BASE_ON = new THREE.Color('#ffd08a')
const SEAT_GLOW = new THREE.Color('#fff1d0')

/**
 * Torres de iluminación, borde de luz de la cubierta y luces en la base del estadio. Los focos miran hacia
 * adentro (a la cancha); encendidos lanzan un haz de luz, iluminan el piso y las gradas. Se prenden y apagan
 * con suavidad y solo cuestan materiales básicos (sin luces dinámicas).
 */
function Lights({ phase, night }: { phase: StadiumPhase; night: boolean }) {
  const lit = useLit(phase)
  const lamp = useMemo(() => new THREE.MeshBasicMaterial({ color: LAMP_OFF, toneMapped: false }), [])
  const baseLamp = useMemo(() => new THREE.MeshBasicMaterial({ color: LAMP_BASE_OFF, toneMapped: false }), [])
  const beam = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#fff4d2',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  const pools = useRef<THREE.Group>(null)
  const beams = useRef<THREE.Group>(null)
  const level = useRef(0)
  const roofPts = useMemo(() => {
    const out: [number, number][] = []
    if (phase === 'construction') return out
    for (let i = 0; i < N - 1; i += 2) if (segBuilt(i, phase)) out.push(at(i, 3.0))
    return out
  }, [phase])
  /** Luces del pie de la fachada: una tira continua que baña el muro y el piso. */
  const basePts = useMemo(() => {
    const out: { x: number; z: number; rot: number; len: number }[] = []
    if (phase === 'construction') return out
    for (let i = 0; i < N - 1; i += 2) {
      if (!segBuilt(i, phase) || !segBuilt(i + 1, phase)) continue
      const [x0, z0] = at(i, FACADE_D + 0.55)
      const [x1, z1] = at(Math.min(i + 2, N - 1), FACADE_D + 0.55)
      out.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, rot: Math.atan2(x1 - x0, z1 - z0), len: Math.hypot(x1 - x0, z1 - z0) })
    }
    return out
  }, [phase])
  const glow = night ? 1 : 0.45
  useFrame((_, dt) => {
    level.current += ((lit ? 1 : 0) - level.current) * Math.min(1, dt * 3)
    const l = level.current
    lamp.color.copy(LAMP_OFF).lerp(LAMP_ON, l)
    baseLamp.color.copy(LAMP_BASE_OFF).lerp(LAMP_BASE_ON, l)
    beam.opacity = l * (night ? 0.035 : 0.015)
    // las gradas se ven iluminadas de noche cuando el estadio está encendido
    VERTEX_MAT.emissive.copy(SEAT_GLOW)
    VERTEX_MAT.emissiveIntensity = l * (night ? 0.12 : 0.03)
    if (pools.current) pools.current.visible = l > 0.4
    if (beams.current) beams.current.visible = l > 0.05
  })
  useLayoutEffect(
    () => () => {
      VERTEX_MAT.emissiveIntensity = 0
    },
    [],
  )
  return (
    <group userData={{ dynamic: true }}>
      {TOWERS.map(([x, z], i) => {
        // el panel de focos mira hacia el centro del estadio, con una leve inclinación hacia abajo
        const yaw = Math.atan2(-x, -z)
        return (
          <group key={i} position={[x, Y, z]}>
            <mesh geometry={GEO.cylinderLow} material={mat('#8f979f')} position={[0, 5.5, 0]} scale={[0.26, 11, 0.26]} castShadow />
            <group position={[0, 11.1, 0]} rotation={[0.42, yaw, 0, 'YXZ']}>
              <mesh geometry={GEO.box} material={mat('#41484f')} scale={[2.6, 1.7, 0.3]} castShadow />
              {[0, 1, 2].flatMap((r) =>
                [0, 1, 2, 3].map((k) => <mesh key={`${r}${k}`} geometry={GEO.sphere} material={lamp} position={[-0.9 + k * 0.6, -0.42 + r * 0.42, 0.22]} scale={0.34} />),
              )}
            </group>
          </group>
        )
      })}
      {/* haces de luz de cada torre hacia la cancha */}
      <group ref={beams}>
        {TOWERS.map(([x, z], i) => {
          const from = new THREE.Vector3(x, Y + 10.9, z)
          const to = new THREE.Vector3(0, Y + 0.6, 0)
          const dir = to.clone().sub(from)
          const len = dir.length()
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize().negate())
          const mid = from.clone().add(to).multiplyScalar(0.5)
          return <mesh key={i} geometry={GEO.cone} material={beam} position={mid} quaternion={q} scale={[9, len, 9]} />
        })}
      </group>
      {/* luz en el piso bajo cada torre, en la cancha y sobre las gradas: solo con las luces encendidas */}
      <group ref={pools}>
        {TOWERS.map(([x, z], i) => (
          <mesh
            key={i}
            geometry={GEO.plane}
            material={lightPoolMat('#fff3c8', night ? 0.5 : 0.2, 0.1)}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[x, Y + 0.06, z]}
            scale={[9, 9, 1]}
          />
        ))}
        <mesh geometry={GEO.plane} material={lightPoolMat('#f0ffd8', night ? 0.22 : 0.1, 0.04)} rotation={[-Math.PI / 2, 0, 0]} position={[0, Y + 0.34, 0]} scale={[32, 22, 1]} />
        <mesh geometry={GEO.plane} material={lightPoolMat('#ffe9b8', night ? 0.2 : 0.06, 0.03)} rotation={[-Math.PI / 2, 0, 0]} position={[0, Y + 0.08, 0]} scale={[46, 36, 1]} />
        {basePts.map((b, i) => (
          <mesh
            key={i}
            geometry={GEO.plane}
            material={lightPoolMat('#ffcf8a', night ? 0.55 : 0.2, 0.06)}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[b.x, Y + 0.09, b.z]}
            scale={[4.6 * glow + 1.6, 4.6 * glow + 1.6, 1]}
          />
        ))}
      </group>
      {/* tira de luz bajo el borde interior de la cubierta */}
      {roofPts.map(([x, z], i) => (
        <mesh key={i} geometry={GEO.sphere} material={lamp} position={[x, Y + 0.12 + ROOF_IN_H - 0.25, z]} scale={[0.34, 0.2, 0.34]} />
      ))}
      {/* luces en la base del estadio, a lo largo de toda la fachada terminada */}
      {basePts.map((b, i) => (
        <group key={i} position={[b.x, Y + 0.28, b.z]} rotation={[0, b.rot, 0]}>
          <mesh geometry={GEO.box} material={baseLamp} scale={[0.24, 0.2, b.len * 0.72]} />
          <mesh geometry={GEO.box} material={mat('#6c747c')} position={[0, -0.16, 0]} scale={[0.34, 0.12, b.len * 0.78]} />
        </group>
      ))}
    </group>
  )
}

// ── hinchada y partido (estadio inaugurado) ─────────────────────────────────────────────────────────
const FAN_SHIRTS = ['#22a05a', '#f6c619', '#f4f4f0', '#22a05a', '#f6c619', '#1d2a33', '#c8553b']
const FAN_SKIN = ['#8d5a3b', '#c58c64', '#e5b48f', '#a56b45']

/** Pulso de la hinchada: dos saltos por segundo, como al ritmo de la canción. */
const BEAT_HZ = 1.9
const beatOf = (t: number, off = 0) => Math.abs(Math.sin(Math.PI * BEAT_HZ * t + off))
const smooth01 = (x: number) => x * x * (3 - 2 * x)

/** Hinchas en las gradas: con el estadio encendido saltan al ritmo, con los brazos arriba y una ola que recorre la gradería. */
function FanCrowd({ reduceMotion }: { reduceMotion: boolean }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const armsL = useRef<THREE.InstancedMesh>(null)
  const armsR = useRef<THREE.InstancedMesh>(null)
  const spots = useMemo(() => {
    const out: { x: number; z: number; y: number; face: number; ph: number; i: number }[] = []
    for (let i = 0; i < N - 1; i++) {
      if (i % 8 === 0) continue
      for (let st = 0; st < STEPS; st++) {
        if ((i * 7 + st * 13 + (i >> 2)) % 9 > 4) continue
        const d = (st + 0.55) * RUN
        const [ax, az] = at(i, d)
        const [bx, bz] = at(i + 1, d)
        const nx = BASE[i].nx
        const nz = BASE[i].nz
        out.push({ x: (ax + bx) / 2, z: (az + bz) / 2, y: (st + 1) * RISE, face: Math.atan2(-nx, -nz), ph: i * 0.33 + st * 0.07, i: out.length })
      }
    }
    return out
  }, [])
  const o = useMemo(() => new THREE.Object3D(), [])
  const energy = useRef(0)
  useLayoutEffect(() => {
    const c = new THREE.Color()
    spots.forEach((f, k) => {
      const shirt = FAN_SHIRTS[(f.i * 5) % FAN_SHIRTS.length]
      const skin = FAN_SKIN[f.i % FAN_SKIN.length]
      bodies.current?.setColorAt(k, c.set(shirt))
      heads.current?.setColorAt(k, c.set(skin))
      armsL.current?.setColorAt(k, c.set(skin))
      armsR.current?.setColorAt(k, c.set(skin))
    })
    for (const m of [bodies.current, heads.current, armsL.current, armsR.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [spots])
  const F = 0.62
  const ARM = 0.34 * F
  useFrame(({ clock }, dt) => {
    const on = useStadiumSound.getState().playing && !reduceMotion
    // la energía sube y baja con suavidad al encender o apagar
    energy.current += ((on ? 1 : 0) - energy.current) * Math.min(1, dt * 4)
    const e = energy.current
    const t = clock.elapsedTime
    // «ola»: un pulso extra que recorre la gradería cada pocos segundos
    spots.forEach((f, k) => {
      const wave = Math.max(0, Math.sin(t * 2.0 - f.ph * 2.4))
      const eager = f.i % 4 === 0 ? 1.25 : 1
      const hop = e * smooth01(beatOf(t, (f.i % 5) * 0.22)) * (0.2 + 0.2 * wave) * eager
      const base = Y + 0.12 + f.y + 0.43 * F + hop
      o.rotation.order = 'YXZ'
      o.position.set(f.x, base, f.z)
      o.rotation.set(0, f.face, 0)
      o.scale.setScalar(F)
      o.updateMatrix()
      bodies.current?.setMatrixAt(k, o.matrix)
      o.position.y += 0.52 * F
      o.scale.setScalar(0.36 * F)
      o.updateMatrix()
      heads.current?.setMatrixAt(k, o.matrix)
      // brazos: arriba y abiertos al alentar (con un vaivén), caídos junto al cuerpo en calma
      const cheer = e * (0.55 + 0.35 * wave)
      const th = (1 - cheer) * (Math.PI - 0.12) + cheer * (0.38 + 0.22 * Math.sin(t * 11 + f.i))
      const sy = base + 0.3 * F
      for (const side of [-1, 1] as const) {
        const lx = side * (0.2 * F + Math.sin(th) * (ARM / 2))
        const ly = Math.cos(th) * (ARM / 2)
        o.position.set(f.x + lx * Math.cos(f.face), sy + ly, f.z - lx * Math.sin(f.face))
        o.rotation.set(0, f.face, -side * th)
        o.scale.set(0.1 * F, ARM, 0.1 * F)
        o.updateMatrix()
        ;(side < 0 ? armsL : armsR).current?.setMatrixAt(k, o.matrix)
      }
    })
    for (const m of [bodies.current, heads.current, armsL.current, armsR.current]) if (m) m.instanceMatrix.needsUpdate = true
  })
  return (
    <group userData={{ dynamic: true }}>
      <instancedMesh ref={bodies} args={[GEO.capsule, mat('#ffffff'), spots.length]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={heads} args={[GEO.sphereSmooth, mat('#ffffff'), spots.length]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={armsL} args={[GEO.box, mat('#ffffff'), spots.length]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={armsR} args={[GEO.box, mat('#ffffff'), spots.length]} frustumCulled={false} raycast={() => null} />
    </group>
  )
}

/** Confeti verde y amarillo que cae sobre las gradas mientras el estadio está encendido. */
const CONFETTI = 90
function Confetti({ reduceMotion }: { reduceMotion: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(
    () =>
      Array.from({ length: CONFETTI }, (_, k) => {
        const i = Math.floor((k * 37) % (N - 1))
        const [x, z] = at(i, 1 + ((k * 13) % 50) / 10)
        return { x, z, ph: (k * 0.6180339) % 1, spin: 2 + (k % 5), speed: 0.18 + (k % 4) * 0.04 }
      }),
    [],
  )
  const level = useRef(0)
  useLayoutEffect(() => {
    const c = new THREE.Color()
    seeds.forEach((_, k) => mesh.current?.setColorAt(k, c.set(['#22a05a', '#f6c619', '#ffffff', '#f6c619'][k % 4])))
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }, [seeds])
  useFrame(({ clock }, dt) => {
    const on = useStadiumSound.getState().playing && !reduceMotion
    level.current += ((on ? 1 : 0) - level.current) * Math.min(1, dt * 3)
    const t = clock.elapsedTime
    seeds.forEach((c, k) => {
      const u = (t * c.speed + c.ph) % 1
      o.position.set(c.x + Math.sin(t * 1.3 + k) * 0.5, Y + 0.12 + 10 - u * 9.5, c.z + Math.cos(t * 1.1 + k) * 0.5)
      o.rotation.set(t * c.spin, t * c.spin * 0.7, 0)
      o.scale.set(0.2, 0.03, 0.14).multiplyScalar(level.current)
      o.updateMatrix()
      mesh.current?.setMatrixAt(k, o.matrix)
    })
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group userData={{ dynamic: true }}>
      <instancedMesh ref={mesh} args={[GEO.box, mat('#ffffff'), CONFETTI]} frustumCulled={false} raycast={() => null} />
    </group>
  )
}

/** Las personitas del mall juegan un partido en la cancha mientras el estadio está encendido. */
const HOME: [number, number][] = [
  [-7.6, 0],
  [-4.6, -3],
  [-4.6, 3],
  [-1.6, -4.2],
  [-1.6, 0],
  [-1.6, 4.2],
  [1.4, -2],
  [1.4, 2],
  [7.6, 0],
  [4.6, -3],
  [4.6, 3],
  [1.8, -4.2],
  [1.4, 0],
  [1.8, 4.2],
  [-1.4, -2],
  [-1.4, 2],
]
function MatchPlayers({ reduceMotion }: { reduceMotion: boolean }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const ball = useRef<THREE.Mesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  useLayoutEffect(() => {
    const c = new THREE.Color()
    HOME.forEach((_, k) => {
      bodies.current?.setColorAt(k, c.set(k < 8 ? '#f6c619' : '#2f6fd0'))
      heads.current?.setColorAt(k, c.set(FAN_SKIN[k % FAN_SKIN.length]))
    })
    for (const m of [bodies.current, heads.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [])
  const pos = (k: number, t: number) => {
    const [hx, hz] = HOME[k]
    const ax = k === 0 || k === 8 ? 0.6 : 2.6
    const az = k === 0 || k === 8 ? 1.2 : 2.0
    const x = hx + Math.sin(t * 0.55 + k * 1.7) * ax + Math.sin(t * 0.21 + k) * 1.2
    const z = hz + Math.cos(t * 0.47 + k * 2.3) * az
    return [Math.max(-PX + 0.6, Math.min(PX - 0.6, x)), Math.max(-PZ + 0.6, Math.min(PZ - 0.6, z))] as const
  }
  useFrame(({ clock }) => {
    const on = useStadiumSound.getState().playing
    const t = reduceMotion ? 0 : clock.elapsedTime
    HOME.forEach((_, k) => {
      const [x, z] = pos(k, t)
      const [x2, z2] = pos(k, t + 0.1)
      const run = Math.hypot(x2 - x, z2 - z)
      const vis = on ? 1 : 0
      o.position.set(x, Y + 0.12 + 0.2 + 0.43 * 0.62 + Math.abs(Math.sin(t * 9 + k)) * 0.06 * Math.min(1, run * 8), z)
      o.rotation.set(0, Math.atan2(x2 - x, z2 - z), 0)
      o.scale.setScalar(0.62 * vis)
      o.updateMatrix()
      bodies.current?.setMatrixAt(k, o.matrix)
      o.position.y += 0.52 * 0.62
      o.scale.setScalar(0.36 * 0.62 * vis)
      o.updateMatrix()
      heads.current?.setMatrixAt(k, o.matrix)
    })
    // el balón pasa de un jugador a otro
    if (ball.current) {
      const cur = Math.floor(t / 2.4) % HOME.length
      const nxt = (cur + 3) % HOME.length
      const f = (t % 2.4) / 2.4
      const [ax, az] = pos(cur, t)
      const [bx, bz] = pos(nxt, t)
      ball.current.position.set(ax + (bx - ax) * f, Y + 0.12 + 0.2 + 0.1 + Math.sin(f * Math.PI) * 0.5, az + (bz - az) * f)
      ball.current.visible = on
    }
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group userData={{ dynamic: true }}>
      <instancedMesh ref={bodies} args={[GEO.capsule, mat('#ffffff'), HOME.length]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={heads} args={[GEO.sphereSmooth, mat('#ffffff'), HOME.length]} frustumCulled={false} raycast={() => null} />
      <mesh ref={ball} geometry={GEO.sphereSmooth} material={mat('#ffffff')} scale={0.26} />
    </group>
  )
}

/** Marcador bajo la cubierta del lado norte. */
let scoreTex: THREE.CanvasTexture | null = null
function Scoreboard() {
  const tex = useMemo(() => {
    if (scoreTex) return scoreTex
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 320
    const g = c.getContext('2d')!
    g.fillStyle = '#0d1a17'
    g.fillRect(0, 0, 1024, 320)
    g.fillStyle = '#22a05a'
    g.fillRect(0, 0, 1024, 14)
    g.textAlign = 'center'
    g.fillStyle = '#f6c619'
    g.font = '800 64px "Plus Jakarta Sans", Manrope, sans-serif'
    g.fillText('CARTAGENA   2  :  1   VISITANTE', 512, 150)
    g.fillStyle = '#ffffff'
    g.font = '700 46px Manrope, sans-serif'
    g.fillText("78'   ·   ESTADIO DE CARTAGENA", 512, 250)
    scoreTex = new THREE.CanvasTexture(c)
    scoreTex.colorSpace = THREE.SRGBColorSpace
    return scoreTex
  }, [])
  const m = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), [tex])
  return (
    <group position={[0, Y + 0.12 + 5.5, -(BOWL_Z + 3.4)]}>
      <mesh geometry={GEO.box} material={mat('#1d2a33')} position={[0, 0, -0.08]} scale={[7.4, 2.4, 0.16]} castShadow />
      <mesh geometry={GEO.plane} material={m} position={[0, 0, 0.02]} scale={[7.1, 2.1, 1]} />
      {[-3, 3].map((x) => (
        <mesh key={x} geometry={GEO.box} material={mat('#6c747c')} position={[x, 1.5, -0.08]} scale={[0.06, 1.2, 0.06]} />
      ))}
    </group>
  )
}

/** Banderines verde y amarillo en la cubierta, ondeando. */
function Pennants({ phase }: { phase: StadiumPhase }) {
  const flags = useRef<(THREE.Mesh | null)[]>([])
  const pts = useMemo(() => {
    const out: { x: number; z: number; c: string }[] = []
    let k = 0
    for (let i = 0; i < N - 1; i += 4)
      if (segBuilt(i, phase)) {
        const [x, z] = at(i, FACADE_D + 0.7)
        out.push({ x, z, c: k++ % 2 ? '#f6c619' : '#22a05a' })
      }
    return out
  }, [phase])
  useFrame(({ clock }) => {
    flags.current.forEach((m, k) => {
      if (m) m.rotation.y = Math.sin(clock.elapsedTime * 2.4 + k) * 0.35
    })
  })
  return (
    <group userData={{ dynamic: true }}>
      {pts.map((f, k) => (
        <group key={k} position={[f.x, Y + 0.12 + ROOF_OUT_H + 0.7, f.z]}>
          <mesh ref={(m) => void (flags.current[k] = m)} geometry={GEO.cone} material={mat(f.c)} position={[0.4, 0, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[0.5, 1.0, 0.04]} />
        </group>
      ))}
    </group>
  )
}

function Palm({ x, z, h = 4.2 }: { x: number; z: number; h?: number }) {
  return (
    <group position={[x, Y, z]}>
      <mesh geometry={GEO.cylinderLow} material={mat('#a07a55')} position={[0, h / 2, 0]} scale={[0.26, h, 0.26]} castShadow />
      {Array.from({ length: 7 }, (_, k) => {
        const a = (k / 7) * Math.PI * 2
        return (
          <mesh
            key={k}
            geometry={GEO.box}
            material={mat('#4f8a55')}
            position={[Math.cos(a) * 0.9, h + 0.05, Math.sin(a) * 0.9]}
            rotation={[0.35 * Math.cos(a), -a, -0.35 * Math.sin(a)]}
            scale={[1.9, 0.06, 0.5]}
            castShadow
          />
        )
      })}
    </group>
  )
}

/** Detalles del estadio inaugurado: palmeras, banderas en la puerta y taquillas. */
function OpenDecor() {
  return (
    <group>
      {[
        [-21, 17.5],
        [21, 17.5],
        [-21, -17.5],
        [21, -17.5],
        [-5, 18],
        [4, 18],
      ].map(([x, z], i) => (
        <Palm key={i} x={x} z={z} h={3.8 + (i % 2) * 0.8} />
      ))}
      {/* banderas junto a la puerta */}
      {[-14.5, -5.5].map((x, i) => (
        <group key={x} position={[x, Y, 17.6]}>
          <mesh geometry={GEO.cylinderLow} material={mat('#e8e8e4')} position={[0, 3, 0]} scale={[0.1, 6, 0.1]} />
          <mesh geometry={GEO.box} material={mat(i ? '#f6c619' : '#22a05a')} position={[0.7, 5.4, 0]} scale={[1.4, 0.9, 0.05]} />
        </group>
      ))}
      {/* taquillas */}
      {[-17.5, -2.5].map((x) => (
        <group key={x} position={[x, Y, 14]}>
          <mesh geometry={GEO.box} material={mat('#f4f1e8')} position={[0, 0.9, 0]} scale={[2.2, 1.8, 1.6]} castShadow />
          <mesh geometry={GEO.box} material={mat('#22a05a')} position={[0, 1.95, 0]} scale={[2.5, 0.22, 1.9]} />
          <mesh geometry={GEO.box} material={mat('#6f9fb5')} position={[0, 1.1, 0.82]} scale={[1.3, 0.6, 0.04]} />
        </group>
      ))}
    </group>
  )
}

const CONES: [number, number][] = [
  [-7.4, 19.5],
  [-12.6, 19.5],
  [-9.2, 14.2],
  [-10.8, 14.2],
  [18.8, 14.8],
  [19.8, 12.8],
  [20.8, 10.8],
  [15.5, 17.2],
  [-18.4, 11.8],
  [-18.4, 9.4],
]

export function Stadium({ reduceMotion }: { reduceMotion: boolean }) {
  const night = useIsNight()
  const phase = useStadiumPhase((s) => s.phase)
  const bowl = useBowl(phase)
  const open = phase === 'open'
  const playing = useStadiumSound((s) => s.playing)
  const sub = phase === 'open' ? (playing ? 'Apagar el estadio' : 'Escuchar el estadio') : phase === 'almost' ? 'Casi listo' : 'Próximamente'
  const label = useMemo(() => getGlassPill('Estadio', { dot: GOLD, sub, dark: night }), [night, sub])
  const cranes = phase === 'construction' ? CRANES : phase === 'almost' ? CRANES.slice(0, 1) : []
  // el estadio «late» un poquito con el ambiente cuando está encendido: sube y se estira apenas, al ritmo de la hinchada
  const bounce = useRef<THREE.Group>(null)
  const bounceLevel = useRef(0)
  useFrame(({ clock }, dt) => {
    const g = bounce.current
    if (!g) return
    const on = phase === 'open' && useStadiumSound.getState().playing && !reduceMotion
    bounceLevel.current += ((on ? 1 : 0) - bounceLevel.current) * Math.min(1, dt * 4)
    const b = smooth01(beatOf(clock.elapsedTime)) * bounceLevel.current
    g.scale.y = 1 + 0.011 * b
    g.position.y = 0.025 * b
  })
  return (
    <group>
      <Batch version={`estadio-puente-${phase}`}>
        <Bridge phase={phase} />
      </Batch>
      <group ref={bounce}>
        <Batch version={`estadio-${phase}`}>
          <group position={[C.x, 0, C.z]} scale={S}>
            <Ground />
            <CastleWalls />
            <Hoarding phase={phase} />
            <group position={[0, Y + 0.12, 0]}>
              <mesh geometry={bowl.seats} material={VERTEX_MAT} castShadow receiveShadow />
              <mesh geometry={bowl.shell} material={VERTEX_MAT} castShadow receiveShadow />
              <mesh geometry={bowl.roof} material={VERTEX_MAT} castShadow />
              <RoofMasts phase={phase} />
              <Skeleton phase={phase} />
              <Pitch phase={phase} />
            </group>
            {phase === 'construction' && (
              <>
                <Container x={-19.6} z={-14.5} rot={Math.PI / 2} color="#3f78a0" />
                <Container x={-19.6} z={-10} rot={Math.PI / 2} color="#c8553b" />
                <Container x={-19.6} z={-5.5} rot={Math.PI / 2} color="#2f8f4f" />
                <Pipes x={17.5} z={16.6} rot={0.4} />
                <Steel x={21.8} z={9.3} rot={Math.PI / 2} />
                <Steel x={-22} z={3} rot={Math.PI / 2} />
                <Pile x={13.5} z={-17.7} color="#d6c08f" s={1.1} />
                <Pile x={16.5} z={-17.2} color="#9d9388" s={0.9} />
                <Pile x={-14} z={-18} color="#d6c08f" s={0.8} />
              </>
            )}
            {phase !== 'open' && (
              <>
                <Office x={-16.5} z={18.4} rot={0} />
                <Office x={-13} z={18.4} rot={0} />
                {(phase === 'construction' ? CONES : CONES.slice(0, 4)).map(([x, z], i) => (
                  <Cone key={i} x={x} z={z} />
                ))}
                {phase === 'almost' && <Container x={-19.6} z={-14.5} rot={Math.PI / 2} color="#3f78a0" />}
              </>
            )}
            {open && <OpenDecor />}
            {open && <Scoreboard />}
          </group>
        </Batch>
        <group position={[C.x, 0, C.z]} scale={S}>
          <Lights phase={phase} night={night} />
          {cranes.map((c, i) => (
            <TowerCrane key={i} cfg={c} reduceMotion={reduceMotion} />
          ))}
          <Trucks reduceMotion={reduceMotion} phase={phase} />
          <Workers reduceMotion={reduceMotion} phase={phase} />
          {phase !== 'construction' && <Pennants phase={phase} />}
          {open && <FanCrowd reduceMotion={reduceMotion} />}
          {open && <Confetti reduceMotion={reduceMotion} />}
          {open && <MatchPlayers reduceMotion={reduceMotion} />}
        </group>
      </group>
      <ScreenLabel
        label={label}
        position={[C.x, 9, C.z]}
        pixelHeight={30}
        maxZoomRatio={1.6}
        priority={LABEL_PRIORITY.corridor + 5}
        onClick={open ? () => void toggleStadiumSound() : undefined}
      />
    </group>
  )
}
