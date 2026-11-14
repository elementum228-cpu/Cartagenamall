import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { CAMERA_DISTANCE, ISO_DIR } from '../world/cameraIso'
import { Lighting } from '../world/Lighting'
import { GEO, PALETTE, mat } from '../world/materials'
import { Person } from '../world/Person'
import { VeneplastAnchorStore, veneplastFootprint } from '../world/VeneplastAnchorStore'
import { usePrefs } from '../state/ui'

// SOLO DESARROLLO: banco de pruebas para ver el edificio de Veneplast aislado, con la misma cámara isométrica y la misma luz del mapa.
// Se abre con /?veneplast-preview (parámetros: time=night|day|dusk, rot=grados, zoom, w, d, q=low|medium|high, lot=1 para ver la huella de D-05).

const q = new URLSearchParams(location.search)

export default function VeneplastPreview() {
  const mode = (q.get('time') ?? 'night') as 'night' | 'day' | 'dusk'
  const rot = (Number(q.get('rot') ?? 0) * Math.PI) / 180
  const zoom = Number(q.get('zoom') ?? 34)
  const w = Number(q.get('w') ?? 12)
  const d = Number(q.get('d') ?? 8)
  const quality = (q.get('q') ?? 'medium') as 'low' | 'medium' | 'high'
  const foot = veneplastFootprint(w, d)
  useEffect(() => {
    usePrefs.setState({ timeMode: mode, quality })
  }, [mode, quality])
  const cam = ISO_DIR.clone().multiplyScalar(CAMERA_DISTANCE)
  const target = new THREE.Vector3(0, foot.height * 0.32, 0)
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#17415c' }}>
      <Canvas orthographic flat dpr={[1, 2]} camera={{ position: cam.clone().add(target).toArray(), zoom, near: -400, far: 800 }} onCreated={({ camera }) => camera.lookAt(target)} gl={{ antialias: true }}>
        <Lighting shadows={false} quality={quality} />
        {/* suelo de baldosa del mall, solo para dar contexto de escala */}
        <mesh geometry={GEO.box} material={mat(PALETTE.floor)} position={[0, -0.1, 0]} scale={[40, 0.2, 40]} />
        {q.get('lot') === '1' && <mesh geometry={GEO.box} material={mat('#cfe3d4')} position={[0, -0.03, 0]} scale={[11, 0.04, 7]} />}
        <VeneplastAnchorStore rotation={[0, rot, 0]} width={w} depth={d} />
        {/* una persona aparte, a escala, junto al edificio */}
        <group position={[w / 2 + 2.2, 0, d / 2 - 1]}>
          <Person color="#3aa57a" skin="#c58c64" />
        </group>
      </Canvas>
    </div>
  )
}
