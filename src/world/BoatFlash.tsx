import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { usePromoEvents } from '../promotions/store'
import { ScreenLabel } from './Billboard'
import { getLabel } from './labelTexture'
import { LABEL_PRIORITY } from './labels'
import { GEO } from './materials'
import { lightPoolMat } from './night'

const GLOW = '#ffb02e'

/**
 * Oferta relámpago de un barco: mientras dura, el barco se ilumina (halo dorado sobre el agua y un haz de luz que
 * se ve de lejos) y un cartel con el descuento, que se puede tocar, flota encima. Solo materiales básicos.
 * Va dentro del grupo del barco (sigue su posición, y en el barco pirata, su recorrido).
 */
export function BoatFlash({ storeId, width, length, height, onOpen, reduceMotion }: { storeId: string; width: number; length: number; height: number; onOpen: () => void; reduceMotion: boolean }) {
  const discount = usePromoEvents((s) => s.events.find((e) => e.storeId === storeId && e.type === 'flash' && e.status === 'active')?.discount)
  const pool = useMemo(() => lightPoolMat(GLOW, 2.4, 0.9), [])
  const beam = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Mesh>(null)
  const mats = useMemo(
    () => ({
      beam: new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0.24, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
      ring: new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    }),
    [],
  )

  useFrame(({ clock }) => {
    if (reduceMotion) return
    const t = clock.elapsedTime
    mats.beam.opacity = 0.2 + Math.sin(t * 1.6) * 0.05
    mats.ring.opacity = 0.6 + Math.sin(t * 2.2) * 0.2
    if (halo.current) halo.current.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04)
  })

  if (!discount) return null
  const label = getLabel(`RELÁMPAGO −${discount}%`, { bg: '#f5b544', fg: '#2a1d05', radius: 30 })
  return (
    <group>
      {/* halo sobre el agua y aro dorado alrededor del casco */}
      <mesh ref={halo} geometry={GEO.plane} material={pool} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} scale={[width * 3.6, length * 2.2, 1]} />
      <mesh geometry={GEO.ring} material={mats.ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]} scale={[width * 1.05, length * 0.62, 1]} />
      {/* haz de luz hacia arriba */}
      <mesh ref={beam} material={mats.beam} position={[0, height * 1.1, 0]}>
        <cylinderGeometry args={[width * 0.7, width * 1.1, height * 2.6, 24, 1, true]} />
      </mesh>
      <ScreenLabel label={label} position={[0, height + 1.4, 0]} pixelHeight={30} minZoomRatio={0} lit priority={LABEL_PRIORITY.promo} onClick={onOpen} />
    </group>
  )
}
