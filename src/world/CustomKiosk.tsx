import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { LocalDesign } from '../domain/types'
import { Bx, LogoMark, TopperModel, nameTexture, sideTexture, strawTexture, useLogoTexture, type CustomStoreProps } from './CustomStore'
import { GEO, mat } from './materials'
import { glowMat, lightPoolMat } from './night'
import { readableOn } from './localDesign'

// «Arma tu local» para las islas: el quiosco de 2,6 × 2,6 m. Mostrador, postes, techo (plano, en punta, inclinado o sombrilla), letrero,
// logo, objeto en lo alto, banquitos y luces. Misma receta de datos que el local grande; la fachada mira a +z.

export function CustomKiosk({ store, design: d, interactive = true, onOpen }: Omit<CustomStoreProps, 'width' | 'depth'>) {
  const wall = mat(d.wall)
  const trim = mat(d.trim)
  const roofM = mat(d.roofColor)
  const awnM = mat(d.awningColor)
  const white = mat('#fbf6ea')
  const frame = mat('#1d1713')
  const glass = glowMat(d.lights ? '#ffd9a0' : '#a7c7d8', d.lights ? 2.0 : 1.2, { dayGlow: d.lights ? 0.25 : 0.1 })
  const logoTex = useLogoTexture(store, d.trim)
  const nameTex = useMemo(() => nameTexture(store.name, readableOn(d.trim)), [store.name, d.trim])
  const sideTex = useMemo(() => (d.side === 'plain' ? null : sideTexture(d.side, d.wall, d.trim)), [d.side, d.wall, d.trim])
  useEffect(() => () => nameTex.dispose(), [nameTex])
  useEffect(() => () => sideTex?.dispose(), [sideTex])
  useEffect(() => {
    if (sideTex) sideTex.repeat.set(2, 1)
  }, [sideTex])
  const straw = useMemo(() => strawTexture(d.roofColor), [d.roofColor])
  useEffect(() => () => straw.dispose(), [straw])
  const topper = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (topper.current) topper.current.rotation.y = Math.sin(clock.elapsedTime * 0.8) * 0.12
  })

  const umbrella = d.roof === 'cornice'
  const CY = 2.5 // altura del techo
  const thatch = d.roof === 'thatch' || d.roof === 'thatchfin'
  const topY = CY + (d.roof === 'gable' ? 0.95 : thatch ? 1.25 : umbrella ? 0.7 : 0.15)
  const items = ['#d9432f', '#ffd23f', '#58b04a']

  return (
    <group
      userData={{ storeId: 'custom-island' }}
      onClick={
        interactive && onOpen
          ? (e) => {
              if (e.delta > 8) return
              e.stopPropagation()
              onOpen()
            }
          : undefined
      }
      onPointerOver={interactive ? (e) => (e.stopPropagation(), (document.body.style.cursor = 'pointer')) : undefined}
      onPointerOut={interactive ? () => (document.body.style.cursor = '') : undefined}
    >
      {interactive && (
        <mesh position={[0, 1.6, 0]} visible={false}>
          <boxGeometry args={[2.8, 3.2, 2.8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* base y mostrador */}
      <Bx p={[0, 0.05, 0]} s={[2.6, 0.1, 2.6]} m={mat('#d8c9a8')} />
      <Bx p={[0, 0.62, 0.35]} s={[2.0, 1.0, 0.9]} m={wall} cast />
      {sideTex && (
        <mesh position={[0, 0.62, 0.805]}>
          <planeGeometry args={[2.0, 1.0]} />
          <meshStandardMaterial map={sideTex} roughness={0.9} />
        </mesh>
      )}
      <Bx p={[0, 1.15, 0.38]} s={[2.15, 0.1, 1.05]} m={trim} cast />
      <Bx p={[0, 0.2, 0.84]} s={[2.04, 0.2, 0.05]} m={trim} />

      {/* fondo y postes */}
      <Bx p={[0, 1.3, -0.8]} s={[2.0, 2.4, 0.14]} m={wall} cast />
      {!umbrella &&
        [-1, 1].map((sg) => (
          <Bx key={sg} p={[sg * 1.0, 1.35, 0.75]} s={[0.11, 2.3, 0.11]} m={trim} />
        ))}
      {umbrella && <Bx p={[0, 1.3, 0.1]} s={[0.11, 2.4, 0.11]} m={trim} />}
      {d.windows === 'arched' && (
        <>
          <mesh geometry={GEO.cylinder} material={trim} position={[0, 1.95, -0.71]} rotation={[Math.PI / 2, 0, 0]} scale={[1.5, 0.06, 1.5]} />
          <mesh geometry={GEO.cylinder} material={glass} position={[0, 1.95, -0.68]} rotation={[Math.PI / 2, 0, 0]} scale={[1.3, 0.05, 1.3]} />
        </>
      )}

      {/* lo que se exhibe sobre el mostrador */}
      {d.windows === 'wide' && (
        <>
          <Bx p={[0, 1.5, 0.4]} s={[1.5, 0.6, 0.7]} m={glass} />
          <Bx p={[0, 1.82, 0.4]} s={[1.56, 0.05, 0.76]} m={frame} />
        </>
      )}
      {d.windows === 'panes' &&
        items.map((c, i) => (
          <mesh key={i} geometry={GEO.sphere} material={mat(c)} position={[-0.6 + i * 0.6, 1.4, 0.45]} scale={[0.38, 0.34, 0.38]} castShadow />
        ))}

      {/* techo */}
      {d.roof === 'flat' && <Bx p={[0, CY + 0.06, 0.05]} s={[2.5, 0.12, 2.0]} m={roofM} cast />}
      {d.roof === 'gable' && (
        <mesh material={roofM} position={[0, CY + 0.5, 0.05]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[1.85, 1.0, 4]} />
        </mesh>
      )}
      {thatch && (
        <>
          <mesh position={[0, CY + 0.6, 0.05]} rotation={[0, Math.PI / 8, 0]} castShadow>
            <coneGeometry args={[2.05, 1.3, 8]} />
            <meshStandardMaterial map={straw} roughness={1} />
          </mesh>
          <mesh position={[0, CY - 0.02, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.0, 0.09, 5, 22]} />
            <meshStandardMaterial color={d.roofColor} roughness={1} />
          </mesh>
        </>
      )}
      {d.roof === 'shed' && <Bx p={[0, CY + 0.1, 0.0]} s={[2.5, 0.12, 2.2]} m={roofM} r={[0.16, 0, 0]} cast />}
      {umbrella && (
        <>
          <mesh material={roofM} position={[0, CY + 0.3, 0.1]} castShadow>
            <coneGeometry args={[1.75, 0.6, 14]} />
          </mesh>
          <mesh material={awnM} position={[0, CY + 0.05, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.62, 0.06, 5, 20]} />
          </mesh>
        </>
      )}

      {/* borde del toldo: rayas, volados o marquesina */}
      {d.awning !== 'none' && !umbrella && (
        <group position={[0, CY - 0.02, d.roof === 'shed' ? 1.18 : 1.04]}>
          {d.awning === 'flat' ? (
            <Bx p={[0, -0.12, 0]} s={[2.5, 0.22, 0.06]} m={awnM} />
          ) : (
            Array.from({ length: 8 }, (_, i) => (
              <group key={i}>
                <Bx p={[-1.1 + i * 0.3 + 0.15 - 0.15, -0.14, 0]} s={[0.3, 0.26, 0.05]} m={i % 2 ? white : awnM} />
                {d.awning === 'scalloped' && (
                  <mesh geometry={GEO.cylinder} material={i % 2 ? white : awnM} position={[-1.1 + i * 0.3, -0.27, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.3, 0.05, 0.3]} />
                )}
              </group>
            ))
          )}
        </group>
      )}
      {umbrella && d.awning !== 'none' &&
        Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2
          return <mesh key={i} geometry={GEO.sphere} material={i % 2 ? white : awnM} position={[Math.cos(a) * 1.62, CY - 0.02, 0.1 + Math.sin(a) * 1.62]} scale={0.22} />
        })}

      {/* letrero */}
      {d.sign === 'band' && (
        <group position={[0, 0, 1.12]}>
          <Bx p={[0, 1.85, 0]} s={[1.9, 0.42, 0.06]} m={trim} />
          <mesh position={[0, 1.85, 0.04]}>
            <planeGeometry args={[1.75, 0.34]} />
            <meshBasicMaterial map={nameTex} transparent toneMapped={false} />
          </mesh>
        </group>
      )}
      {d.sign === 'board' && (
        <group position={[0, topY, 0.9]}>
          <Bx p={[-0.7, 0.2, 0]} s={[0.06, 0.4, 0.06]} m={frame} />
          <Bx p={[0.7, 0.2, 0]} s={[0.06, 0.4, 0.06]} m={frame} />
          <Bx p={[0, 0.62, 0]} s={[1.9, 0.5, 0.08]} m={trim} cast />
          <mesh position={[0, 0.62, 0.05]}>
            <planeGeometry args={[1.75, 0.4]} />
            <meshBasicMaterial map={nameTex} transparent toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* logo en un costado */}
      {d.logoSide !== 'none' && (
        <group position={[d.logoSide === 'left' ? -1.0 : 1.0, 0, 0.75]}>
          {d.logoShape === 'hanging' ? (
            <>
              <Bx p={[d.logoSide === 'left' ? -0.35 : 0.35, 2.15, 0]} s={[0.7, 0.06, 0.06]} m={frame} />
              <group position={[d.logoSide === 'left' ? -0.6 : 0.6, 1.8, 0]}>
                <LogoMark shape="square" r={0.3} tex={logoTex} rim={trim} />
                <group rotation={[0, Math.PI, 0]}>
                  <LogoMark shape="square" r={0.3} tex={logoTex} rim={trim} />
                </group>
              </group>
            </>
          ) : (
            <group position={[0, CY + 0.55, 0]}>
              <Bx p={[0, -0.28, 0]} s={[0.08, 0.5, 0.08]} m={frame} />
              <LogoMark shape={d.logoShape} r={0.5} tex={logoTex} rim={trim} />
            </group>
          )}
        </group>
      )}

      {/* objeto en lo alto */}
      {d.topper !== 'none' && (
        <group position={[0, topY, -0.1]}>
          <group ref={topper} scale={0.85}>
            <TopperModel kind={d.topper} tex={logoTex} rim={trim} accent={d.awningColor} shape={d.logoShape} />
          </group>
        </group>
      )}

      {/* banquitos al frente y macetas */}
      {Array.from({ length: d.tables }, (_, i) => {
        const x = d.tables === 1 ? 0 : -0.75 + (1.5 / (d.tables - 1)) * i
        return (
          <group key={i} position={[x, 0.1, 1.6]}>
            <mesh geometry={GEO.cylinder} material={awnM} position={[0, 0.52, 0]} scale={[0.42, 0.08, 0.42]} castShadow />
            <mesh geometry={GEO.cylinderLow} material={frame} position={[0, 0.26, 0]} scale={[0.07, 0.52, 0.07]} />
          </group>
        )
      })}
      {d.planters &&
        [-1, 1].map((sg) => (
          <group key={sg} position={[sg * 1.1, 0.1, 1.15]}>
            <Bx p={[0, 0.16, 0]} s={[0.4, 0.32, 0.4]} m={trim} />
            <mesh geometry={GEO.sphere} material={mat('#4f9a5e')} position={[0, 0.55, 0]} scale={[0.6, 0.5, 0.6]} castShadow />
          </group>
        ))}
      {d.lights && (
        <>
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} geometry={GEO.sphere} material={glowMat('#fff0c8', 2.6, { dayGlow: 0.4 })} position={[-0.9 + i * 0.45, CY - 0.32 - Math.sin((i / 4) * Math.PI) * -0.0, 1.1]} scale={0.1} />
          ))}
          <mesh geometry={GEO.plane} material={lightPoolMat('#ffc97a', 1.0)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 1.1]} scale={[3.6, 3.2, 1]} />
        </>
      )}
    </group>
  )
}

export type { LocalDesign }
