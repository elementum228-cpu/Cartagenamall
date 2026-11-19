import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { LocalDesign, Store } from '../domain/types'
import { CAMERA_DISTANCE, ISO_DIR } from '../world/cameraIso'
import { CustomKiosk } from '../world/CustomKiosk'
import { CustomStore } from '../world/CustomStore'
import { Lighting } from '../world/Lighting'
import { GEO, PALETTE, mat } from '../world/materials'
import { Person } from '../world/Person'

// Vista previa 3D del «Arma tu local»: misma cámara isométrica y misma luz del mapa, con el local girable.

const TARGET = new THREE.Vector3(0, 3.0, 0.6)

/** Ajusta el zoom al tamaño de la vista previa para que el local siempre quepa entero (con su techo y lo que lleva encima). */
function FitZoom({ width }: { width: number }) {
  const { camera, size } = useThree()
  const small = width < 3.5
  const z = small ? Math.min(size.width / 7, size.height / 8.2) : Math.min(size.width / (width + 8.5), size.height / 11.5)
  if (camera.zoom !== z) {
    camera.zoom = z
    camera.updateProjectionMatrix()
  }
  return null
}

export default function LocalPreview({ store, design, rotation, width, depth }: { store: Pick<Store, 'name' | 'logo' | 'logoText' | 'brandColor' | 'accentColor'>; design: LocalDesign; rotation: number; width: number; depth: number }) {
  const cam = ISO_DIR.clone().multiplyScalar(CAMERA_DISTANCE)
  return (
    <Canvas
      orthographic
      flat
      dpr={[1, 2]}
      camera={{ position: cam.clone().add(TARGET).toArray(), zoom: 46, near: -400, far: 800 }}
      onCreated={({ camera }) => camera.lookAt(TARGET)}
      gl={{ antialias: true }}
    >
      <FitZoom width={width} />
      <Lighting shadows={false} quality="medium" />
      <mesh geometry={GEO.box} material={mat(PALETTE.floor)} position={[0, -0.1, 0]} scale={[40, 0.2, 40]} />
      <group rotation={[0, rotation, 0]}>
        <mesh geometry={GEO.box} material={mat('#e6d3a8')} position={[0, -0.02, 0]} scale={[width, 0.04, depth]} />
        {design.form === 'island' ? <CustomKiosk store={store} design={design} interactive={false} /> : <CustomStore store={store} design={design} width={width} depth={depth} interactive={false} />}
        <group position={[width / 2 + 1.2, 0, depth / 2 - 0.4]}>
          <Person color="#3aa57a" skin="#c58c64" />
        </group>
      </group>
    </Canvas>
  )
}
