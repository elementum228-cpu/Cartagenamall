import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { CAMERA_DISTANCE, ISO_DIR } from '../world/cameraIso'
import { GeorgesCafe } from '../world/GeorgesCafe'
import { Lighting } from '../world/Lighting'
import { GEO, PALETTE, mat } from '../world/materials'
import { Person } from '../world/Person'
import { usePrefs } from '../state/ui'

// SOLO DESARROLLO: banco de pruebas de George's aislado (misma cámara isométrica y misma luz del mapa).
// Se abre con /?georges-preview (parámetros: time=night|day|dusk, rot=grados, zoom, q=low|medium|high).

const q = new URLSearchParams(location.search)

export default function GeorgesPreview() {
  const mode = (q.get('time') ?? 'day') as 'night' | 'day' | 'dusk'
  const rot = (Number(q.get('rot') ?? 0) * Math.PI) / 180
  const zoom = Number(q.get('zoom') ?? 70)
  const quality = (q.get('q') ?? 'medium') as 'low' | 'medium' | 'high'
  useEffect(() => {
    usePrefs.setState({ timeMode: mode, quality })
  }, [mode, quality])
  const cam = ISO_DIR.clone().multiplyScalar(CAMERA_DISTANCE)
  const target = new THREE.Vector3(0, 1.3, 0.6)
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#e9d9bd' }}>
      <Canvas orthographic flat dpr={[1, 2]} camera={{ position: cam.clone().add(target).toArray(), zoom, near: -400, far: 800 }} onCreated={({ camera }) => camera.lookAt(target)} gl={{ antialias: true }}>
        <Lighting shadows={false} quality={quality} />
        <mesh geometry={GEO.box} material={mat(PALETTE.floor)} position={[0, -0.1, 0]} scale={[40, 0.2, 40]} />
        {/* huella del local E-02 (6 × 5) y un local vecino para dar escala */}
        <mesh geometry={GEO.box} material={mat('#e6d3a8')} position={[0, -0.02, 0]} scale={[6, 0.04, 5]} />
        <GeorgesCafe rotation={[0, rot, 0]} />
        <group position={[4.8, 0, 2.6]}>
          <Person color="#3aa57a" skin="#c58c64" />
        </group>
      </Canvas>
    </div>
  )
}
