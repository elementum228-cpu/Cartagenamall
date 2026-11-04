import { useFrame } from '@react-three/fiber'
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { CATEGORY_BY_ID } from '../config/mall'
import type { Product, SpaceSlot, Store, ZoneId } from '../domain/types'
import { formatCOP } from '../lib/format'
import { getGlassPill, getLabel, getStoreSign } from './labelTexture'
import { Batch } from './Batch'
import { useSpacePrice } from '../state/spacePricing'
import { isHighlighted } from '../lib/storeHighlight'
import { TECH, TechCounter, TechEmptyModule, TechScreen, type ScreenMessage } from './TechDistrict'
import { ScreenLabel } from './Billboard'
import { LABEL_PRIORITY } from './labels'
import { cameraState } from './cameraState'
import { GEO, GLASS, PALETTE, mat, shade } from './materials'
import { dimLabelMat, glowMat, lightPoolMat, nightVolumeMat, uplightMat } from './night'
import { useIsNight } from '../lib/useIsNight'

export type Detail = 'high' | 'low'

interface Props {
  space: SpaceSlot
  store: Store | null
  products: Product[]
  zoneColor: string
  selected: boolean
  pendingClaim: boolean
  detail: Detail
  /** Solo el piso activo responde a toques (los otros pueden estar ocultos o como silueta). */
  interactive: boolean
  /** Descuento relámpago vigente de la tienda: muestra una señal sobre el local. */
  flashPercent?: number
  /** Momento en que su oferta relámpago se presentó (el cartel de la oferta salta). */
  promoPopAt?: number
  onSelect: (spaceId: string) => void
}

// Materiales que se encienden de noche (compartidos por todas las tiendas).
const WARM_LIGHT = () => glowMat('#fff0c8', 2.2, { dayGlow: 0.35 })
const WARM_PANE = () => glowMat('#ffd08a', 1.5, { opacity: 0.42 })
const SIGN_STRIP = () => glowMat('#ffe2a8', 1.6, { dayGlow: 0.2 })
const SCREEN = () => glowMat('#8fd3ff', 1.4, { dayGlow: 0.55 })
const FLAME = () => glowMat('#ffb347', 2.4, { dayGlow: 0.7 })
const POOL = () => lightPoolMat('#ffc97a', 0.75)
/** Luz interior: halo cálido sobre el piso de la tienda (solo de noche). */
const INTERIOR = () => lightPoolMat('#ffc98a', 0.32)
/** Luz interior de un local abierto (≈3200 K): aclara piso, estantes y vitrinas de noche. */
const INTERIOR_LIGHT = () => nightVolumeMat('#ffcf8f', 0.15)
const COUNTER_LIGHT = () => glowMat('#ffe6b8', 1.5, { dayGlow: 0.1 })

/**
 * Un espacio comercial, generado desde configuración. El tipo (isla, local, premium) define la
 * arquitectura; la tienda asignada define fachada, colores, letreros y vitrina según su rubro.
 * Sin tienda, se dibuja como espacio disponible con su tótem de «Reclamar local».
 */
export const SpaceUnit = memo(function SpaceUnit({ space, store, products, zoneColor, selected, pendingClaim, detail, interactive, flashPercent, promoPopAt, onSelect }: Props) {
  const group = useRef<THREE.Group>(null)
  const highlight = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const bounce = useRef(0)
  const wasSelected = useRef(selected)
  if (selected && !wasSelected.current) bounce.current = 1
  wasSelected.current = selected

  const halo = useRef<THREE.Mesh>(null)
  useFrame(({ clock }, dt) => {
    const g = group.current
    if (!g) return
    // Pequeño "salto" al seleccionarla.
    if (bounce.current > 0) {
      bounce.current = Math.max(0, bounce.current - dt * 2.2)
      const b = Math.sin((1 - bounce.current) * Math.PI) * 0.08 * bounce.current
      g.scale.set(1 - b * 0.4, 1 + b, 1 - b * 0.4)
    } else if (g.scale.y !== 1) g.scale.set(1, 1, 1)
    // halo turquesa que se expande desde el local elegido (pulsación suave)
    const ring = halo.current
    if (ring) {
      ring.visible = selected
      if (selected) {
        const p = (clock.elapsedTime * 0.7) % 1
        ring.scale.setScalar(Math.max(space.size[0], space.size[1]) * 0.62 * (1 + p * 0.6))
        ;(ring.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - p)
      }
    }
    const h = highlight.current
    if (h) {
      const m = h.material as THREE.MeshBasicMaterial
      m.opacity = selected ? 0.45 + Math.sin(clock.elapsedTime * 4) * 0.15 : hovered ? 0.3 : 0
      h.visible = m.opacity > 0.01
    }
  })

  const [w, d] = space.size
  const accent = store?.brandColor ?? zoneColor
  const highlightMat = useMemo(() => new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, depthWrite: false }), [accent])
  const haloMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#13b9ad', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), [])
  const select = () => onSelect(space.id)
  const night = useIsNight()
  const price = useSpacePrice(space.id)
  const labelY = space.type === 'premium' ? 5.6 : space.type === 'local' ? 4.6 : 3.8
  // El contenido se memoiza: así el hover no reconstruye la fusión de mallas (ver Batch).
  const content = useMemo(
    () =>
      store ? (
        space.type === 'island' ? (
          <IslandShop store={store} products={products} detail={detail} />
        ) : (
          <ShopFront store={store} products={products} w={w} d={d} premium={space.type === 'premium'} detail={detail} rotation={space.rotation} />
        )
      ) : (
        <AvailableSpace space={space} zoneColor={zoneColor} pending={pendingClaim} price={price} />
      ),
    [store, products, detail, space, w, d, zoneColor, pendingClaim, price],
  )

  return (
    <group position={[space.position[0], 0.2 + (space.elevation ?? 0), space.position[1]]} rotation={[0, space.rotation, 0]} userData={{ audit: store ? `tienda-${space.type}` : 'vacio', spaceId: space.id }}>
      <mesh ref={halo} visible={false} geometry={GEO.ring} material={haloMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0.4]} userData={{ dynamic: true }} raycast={() => null} />
      <mesh ref={highlight} geometry={GEO.plane} material={highlightMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0.4]} scale={[w + 1.2, d + 1.6, 1]} />
      <group
        ref={group}
        onClick={(e) => {
          // Sin stopPropagation si no aplica: el toque sigue hacia lo que haya detrás (otro piso).
          if (!interactive || cameraState.handMode || e.delta > 8) return
          e.stopPropagation()
          select()
        }}
        onPointerOver={(e) => {
          if (!interactive) return
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = ''
        }}
      >
        <Batch version={content}>{content}</Batch>
      </group>
      {store && kindOf(store) === 'tech' && <TechStoreScreen space={space} store={store} products={products} flashPercent={flashPercent} />}
      {store && (
        <ScreenLabel
          label={getGlassPill(store.name, { dot: store.brandColor, sub: CATEGORY_BY_ID[store.categoryId]?.name, logo: store.logo, dark: night })}
          position={[0, labelY, 0]}
          pixelHeight={isHighlighted(store) ? 44 : 38}
          minZoomRatio={isHighlighted(store) || space.type === 'premium' ? 0 : 1.15}
          // De cerca ya se lee el letrero físico: el del techo (tienda destacada) o el de la fachada
          // si mira a la cámara. El rótulo flotante no se duplica.
          maxZoomRatio={space.type !== 'island' && hasRoofSign(store, space.type === 'premium', space.rotation) ? 1.9 : isHighlighted(store) ? 1.9 : facesCamera(space.rotation) ? 2.7 : Infinity}
          lit
          priority={selected ? LABEL_PRIORITY.selected : LABEL_PRIORITY.store}
          onClick={interactive ? select : undefined}
        />
      )}
      {/* mientras la oferta se presenta, la anuncia el cartel grande (PromoSpotlight) */}
      {store && flashPercent && promoPopAt === undefined && (
        <ScreenLabel
          label={getLabel(`RELÁMPAGO −${flashPercent}%`, { bg: '#f5b544', fg: '#2a1d05', radius: 30 })}
          position={[0, labelY + 1.5, 0]}
          pixelHeight={30}
          minZoomRatio={1.15}
          lit
          priority={LABEL_PRIORITY.promo}
          onClick={interactive ? select : undefined}
        />
      )}
    </group>
  )
})

/** Colores de producto para la vitrina: swatches de variantes o tonos de la marca. */
function displayColors(store: Store, products: Product[]) {
  const fromVariants = products.flatMap((p) => p.variants.map((v) => v.swatch).filter((x): x is string => !!x))
  const base = [store.brandColor, shade(store.brandColor, 0.4), store.accentColor, shade(store.brandColor, -0.25)]
  return [...fromVariants, ...base].slice(0, 10)
}

// ── Vitrinas según el rubro de la zona ─────────────────────────────────────────

type Kind = 'fashion' | 'tech' | 'beauty' | 'lifestyle' | 'food' | 'cafe' | 'dessert'
const ZONE_KIND: Record<ZoneId, Kind> = { A: 'fashion', B: 'tech', C: 'beauty', D: 'lifestyle', E: 'food', F: 'lifestyle', G: 'tech', I: 'lifestyle' }

/** Rubro visual de la vitrina: por zona, y en gastronomía según la categoría del negocio. */
function kindOf(store: Store): Kind {
  if (store.categoryId === 'cafe') return 'cafe'
  if (store.categoryId === 'postres') return 'dessert'
  return ZONE_KIND[store.zoneId] ?? 'lifestyle'
}

/** Un exhibidor de vitrina: maniquí, dispositivo, frascos o artículos de hogar. */
function Display({ kind, colors, seed, scale = 1 }: { kind: Kind; colors: string[]; seed: number; scale?: number }) {
  const c = (i: number) => colors[(seed + i) % colors.length]
  if (kind === 'fashion')
    return (
      <group scale={scale}>
        <mesh geometry={GEO.cylinder} material={mat(PALETTE.trim)} position={[0, 0.04, 0]} scale={[0.55, 0.08, 0.55]} />
        <mesh geometry={GEO.cylinder} material={mat(PALETTE.metal)} position={[0, 0.25, 0]} scale={[0.04, 0.4, 0.04]} />
        <mesh geometry={GEO.capsule} material={mat(c(0))} position={[0, 0.78, 0]} scale={[1.05, 1, 0.8]} />
        <mesh geometry={GEO.sphereSmooth} material={mat('#f1ebe0')} position={[0, 1.28, 0]} scale={0.26} />
      </group>
    )
  if (kind === 'tech')
    return (
      <group scale={scale}>
        <mesh geometry={GEO.rounded} material={mat(PALETTE.wall)} position={[0, 0.3, 0]} scale={[0.7, 0.6, 0.5]} />
        <mesh geometry={GEO.rounded} material={mat('#2b3440')} position={[0, 0.82, -0.05]} rotation={[-0.25, 0, 0]} scale={[0.62, 0.42, 0.05]} />
        <mesh geometry={GEO.plane} material={SCREEN()} position={[0, 0.82, -0.02]} rotation={[-0.25, 0, 0]} scale={[0.54, 0.34, 1]} />
        <mesh geometry={GEO.rounded} material={mat(c(0))} position={[0.22, 0.66, 0.14]} scale={[0.14, 0.12, 0.2]} />
      </group>
    )
  if (kind === 'beauty')
    return (
      <group scale={scale}>
        <mesh geometry={GEO.rounded} material={mat(PALETTE.wall)} position={[0, 0.25, 0]} scale={[0.75, 0.5, 0.45]} />
        {[-0.22, 0, 0.22].map((x, i) => (
          <group key={i} position={[x, 0.5, 0]}>
            <mesh geometry={GEO.cylinder} material={mat(c(i), { rough: 0.35 })} position={[0, 0.14 + i * 0.03, 0]} scale={[0.14, 0.28 + i * 0.06, 0.14]} />
            <mesh geometry={GEO.cylinder} material={mat('#d8b46a', { rough: 0.3 })} position={[0, 0.32 + i * 0.06, 0]} scale={[0.08, 0.08, 0.08]} />
          </group>
        ))}
      </group>
    )
  if (kind === 'food')
    return (
      <group scale={scale}>
        <mesh geometry={GEO.rounded} material={mat(PALETTE.wall)} position={[0, 0.25, 0]} scale={[0.8, 0.5, 0.5]} />
        {[-0.2, 0.2].map((x, i) => (
          <group key={x} position={[x, 0.53, 0]}>
            <mesh geometry={GEO.cylinder} material={mat('#fbf7f0')} scale={[0.34, 0.04, 0.34]} />
            <mesh geometry={GEO.sphere} material={mat(i ? '#e7a64a' : c(0))} position={[0, 0.07, 0]} scale={[0.22, 0.1, 0.22]} />
          </group>
        ))}
      </group>
    )
  if (kind === 'cafe')
    return (
      <group scale={scale}>
        <mesh geometry={GEO.rounded} material={mat(PALETTE.wood)} position={[0, 0.25, 0]} scale={[0.8, 0.5, 0.5]} />
        <mesh geometry={GEO.rounded} material={mat('#c9ccd1', { rough: 0.35 })} position={[-0.12, 0.72, 0]} scale={[0.42, 0.44, 0.34]} />
        <mesh geometry={GEO.box} material={mat('#2b3440')} position={[-0.12, 0.66, 0.18]} scale={[0.22, 0.08, 0.02]} />
        <mesh geometry={GEO.cylinder} material={mat('#fbf7f0')} position={[0.25, 0.58, 0.05]} scale={[0.12, 0.13, 0.12]} />
      </group>
    )
  if (kind === 'dessert')
    return (
      <group scale={scale}>
        <mesh geometry={GEO.rounded} material={mat(PALETTE.wall)} position={[0, 0.25, 0]} scale={[0.75, 0.5, 0.5]} />
        <mesh geometry={GEO.cylinder} material={mat('#fbe3ec')} position={[0, 0.58, 0]} scale={[0.42, 0.14, 0.42]} />
        <mesh geometry={GEO.cylinder} material={mat(c(0))} position={[0, 0.7, 0]} scale={[0.34, 0.1, 0.34]} />
        <mesh geometry={GEO.sphere} material={mat('#c2384f')} position={[0, 0.78, 0]} scale={0.07} />
        <mesh geometry={GEO.sphereSmooth} material={GLASS} position={[0, 0.7, 0]} scale={[0.55, 0.45, 0.55]} />
      </group>
    )
  return (
    <group scale={scale}>
      <mesh geometry={GEO.rounded} material={mat(PALETTE.wood)} position={[0, 0.25, 0]} scale={[0.75, 0.5, 0.5]} />
      <mesh geometry={GEO.cylinder} material={mat('#f6efe2')} position={[-0.2, 0.62, 0]} scale={[0.18, 0.24, 0.18]} />
      <mesh geometry={GEO.cone} material={FLAME()} position={[-0.2, 0.8, 0]} scale={[0.06, 0.12, 0.06]} />
      <mesh geometry={GEO.rounded} material={mat(c(0))} position={[0.18, 0.62, 0]} scale={[0.3, 0.24, 0.3]} />
      <mesh geometry={GEO.box} material={mat(c(1))} position={[0.18, 0.62, 0]} scale={[0.06, 0.25, 0.31]} />
    </group>
  )
}

// ── Locales y premium ──────────────────────────────────────────────────────────

function ShopFront({ store, products, w, d, premium, detail, rotation }: { store: Store; products: Product[]; w: number; d: number; premium: boolean; detail: Detail; rotation: number }) {
  const H = premium ? 3.4 : 2.6
  const T = 0.22
  const wall = mat(PALETTE.wall)
  const brand = mat(store.brandColor)
  const sign = getStoreSign(store.logoText, store.brandColor, undefined, store.logo)
  const open = getLabel(store.status === 'open' ? 'ABIERTO' : 'CERRADO', { bg: store.status === 'open' ? '#1f9d6b' : '#b7791f', fg: '#fff', radius: 30 })
  const colors = displayColors(store, products)
  const kind = kindOf(store)
  // Abierto: luces encendidas de noche. Cerrado: el interior queda a oscuras (se nota a simple vista).
  const lit = store.status === 'open'
  // franja del letrero más alta: el nombre del negocio se lee de lejos
  const fascia = premium ? 1.05 : 0.85
  const signH = Math.min(fascia * 0.92, (w - 0.3) / sign.aspect)
  const glassW = premium ? w * 0.34 : w * 0.3
  const doorW = w - 2 * T - 2 * glassW
  const front = d / 2 - 0.2
  const high = detail === 'high'

  return (
    <group>
      {/* interior: piso y panel del fondo se iluminan de noche */}
      <mesh geometry={GEO.box} material={lit ? glowMat(store.accentColor, 0.6) : mat(shade(store.accentColor, -0.3))} position={[0, 0.05, 0]} scale={[w - 0.1, 0.1, d - 0.1]} receiveShadow />
      <mesh geometry={GEO.box} material={lit ? glowMat(shade(store.accentColor, -0.06), 0.75) : mat(shade(store.accentColor, -0.4))} position={[0, H / 2, -d / 2 + T + 0.02]} scale={[w - 2 * T, H - 0.1, 0.03]} />
      {lit && <mesh geometry={GEO.plane} material={INTERIOR()} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} scale={[w * 1.25, d * 1.35, 1]} />}
      {lit && <mesh geometry={GEO.box} material={INTERIOR_LIGHT()} position={[0, H / 2, 0.05]} scale={[w - 0.5, H - 0.25, d - 0.5]} />}
      {/* muros */}
      <mesh geometry={GEO.box} material={wall} position={[0, H / 2, -d / 2 + T / 2]} scale={[w, H, T]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={wall} position={[-w / 2 + T / 2, H / 2, 0]} scale={[T, H, d]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={wall} position={[w / 2 - T / 2, H / 2, 0]} scale={[T, H, d]} castShadow receiveShadow />
      <mesh geometry={GEO.box} material={brand} position={[0, H - 0.5, -d / 2 + T + 0.05]} scale={[w - 2 * T, 0.22, 0.03]} />

      {/* dintel con letrero retroiluminado */}
      <mesh geometry={GEO.rounded} material={brand} position={[0, H - fascia / 2, d / 2 - 0.15]} scale={[w + 0.1, fascia, 0.34]} castShadow />
      <mesh geometry={GEO.plane} position={[0, H - fascia / 2, d / 2 + 0.03]} scale={[signH * sign.aspect, signH, 1]}>
        <meshBasicMaterial map={sign.texture} transparent toneMapped={false} />
      </mesh>
      <mesh geometry={GEO.box} material={!lit ? mat('#7d7566') : kind === 'tech' ? glowMat(TECH.turquoise, 1.4, { dayGlow: 0.35 }) : SIGN_STRIP()} position={[0, H - fascia - 0.03, d / 2 - 0.02]} scale={[w - 0.3, 0.05, 0.08]} />

      {/* fachada diferenciada */}
      {store.facade === 'awning' && <StripedAwning w={w} y={H - fascia - 0.1} z={d / 2} color={store.brandColor} />}
      {store.facade === 'arch' && (
        <>
          <mesh geometry={GEO.halfDisc} material={brand} position={[0, H, d / 2 - 0.15]} rotation={[Math.PI / 2, 0, 0]} scale={[w * 0.22, 0.3, w * 0.22]} castShadow />
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (doorW / 2 + 0.12), 0, front + 0.05]}>
              <mesh geometry={GEO.box} material={mat(PALETTE.trim)} position={[0, (H - fascia) / 2, 0]} scale={[0.22, H - fascia, 0.22]} castShadow />
              <mesh geometry={GEO.sphere} material={lit ? WARM_LIGHT() : mat('#8d877a')} position={[0, H - fascia - 0.45, 0.16]} scale={0.16} />
            </group>
          ))}
        </>
      )}
      {store.facade === 'minimal' && (
        <>
          <mesh geometry={GEO.box} material={lit ? glowMat(store.brandColor, 1.3, { dayGlow: 0.25 }) : brand} position={[-w / 2 + 0.12, H / 2, d / 2 - 0.05]} scale={[0.1, H, 0.1]} />
          <mesh geometry={GEO.box} material={lit ? glowMat(store.brandColor, 1.3, { dayGlow: 0.25 }) : brand} position={[w / 2 - 0.12, H / 2, d / 2 - 0.05]} scale={[0.1, H, 0.1]} />
        </>
      )}

      {/* cartel en el techo: tiendas destacadas, locales premium y los que dan la espalda a la cámara */}
      {hasRoofSign(store, premium, rotation) && (
        <RooftopSign store={store} y={H} z={d / 2 - 0.6} width={w - 0.4} big={premium} wash={isHighlighted(store) ? { w, H, front: d / 2 + 0.09 } : undefined} />
      )}
      {/* letrero saliente (bandera), legible desde el pasillo */}
      <group position={[w / 2 + 0.05, H - fascia - 0.35, d / 2 + 0.05]}>
        <mesh geometry={GEO.box} material={mat(PALETTE.metal)} position={[0.3, 0.45, 0]} scale={[0.6, 0.04, 0.04]} />
        <mesh geometry={GEO.rounded} material={brand} position={[0.55, 0, 0]} scale={[0.08, 0.75, 0.95]} castShadow />
        {[1, -1].map((s) => (
          <mesh key={s} geometry={GEO.plane} position={[0.55 + s * 0.045, 0, 0]} rotation={[0, (s * Math.PI) / 2, 0]} scale={[0.85, 0.85 / sign.aspect, 1]}>
            <meshBasicMaterial map={sign.texture} transparent toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* vitrinas: vidrio, zócalo, luz cálida detrás y productos del rubro */}
      {[-1, 1].map((s) => {
        const x = s * (w / 2 - T - glassW / 2)
        return (
          <group key={s}>
            <mesh geometry={GEO.box} material={GLASS} position={[x, (H - fascia) / 2 + 0.05, front]} scale={[glassW, H - fascia - 0.1, 0.06]} />
            <mesh geometry={GEO.box} material={lit ? WARM_PANE() : mat('#2c3440')} position={[x, (H - fascia) / 2 + 0.05, front - 0.08]} scale={[glassW - 0.1, H - fascia - 0.2, 0.02]} />
            <mesh geometry={GEO.box} material={mat(PALETTE.trim)} position={[x, 0.15, front]} scale={[glassW, 0.3, 0.2]} />
            {kind === 'tech' ? (
              // tecnología: mostrador con celular, portátil, audífonos y reloj detrás del vidrio
              <group position={[x, 0, front - 0.6]}>
                <TechCounter width={glassW * 0.92} accent={store.brandColor} />
              </group>
            ) : (
              (premium ? [-0.28, 0.28] : [0]).map((dx, i) => (
                <group key={i} position={[x + dx * glassW, 0.1, front - 0.65]}>
                  <Display kind={kind} colors={colors} seed={i + (s > 0 ? 2 : 0)} />
                </group>
              ))
            )}
          </group>
        )
      })}
      {/* cartel de abierto en el vidrio y tapete de entrada */}
      <mesh geometry={GEO.plane} position={[-(w / 2 - T - glassW / 2), 0.75, front + 0.04]} scale={[0.22 * open.aspect, 0.22, 1]}>
        <meshBasicMaterial map={open.texture} transparent toneMapped={false} />
      </mesh>
      <mesh geometry={GEO.box} material={mat(shade(store.brandColor, -0.15))} position={[0, 0.11, d / 2 + 0.35]} scale={[doorW * 0.7, 0.02, 0.6]} />
      {/* halo de luz frente a la tienda (solo de noche) */}
      {lit && <mesh geometry={GEO.plane} material={POOL()} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, d / 2 + 1.1]} scale={[w + 2.5, 3.2, 1]} />}

      {/* interior: estantería, mostrador y lámparas colgantes */}
      <mesh geometry={GEO.box} material={mat(PALETTE.wood)} position={[0, 0.9, -d / 2 + 0.55]} scale={[w * 0.75, 1.6, 0.5]} castShadow />
      {/* luz bajo la repisa superior: el estante se lee iluminado */}
      {lit && <mesh geometry={GEO.box} material={COUNTER_LIGHT()} position={[0, 1.66, -d / 2 + 0.83]} scale={[w * 0.73, 0.05, 0.05]} />}
      <ShelfItems
        colors={colors}
        items={[0.55, 1.15].flatMap((y, row) =>
          Array.from({ length: premium ? 7 : 5 }, (_, i) => {
            const span = w * 0.65
            return { x: -span / 2 + (span / ((premium ? 7 : 5) - 1)) * i, y: y + 0.27, z: -d / 2 + 0.95, c: i + row * 3 }
          }),
        )}
      />
      <mesh geometry={GEO.rounded} material={brand} position={[w / 2 - 1.3, 0.5, -0.2]} scale={[1.6, 0.9, 0.7]} castShadow />
      <mesh geometry={GEO.box} material={mat(PALETTE.wall)} position={[w / 2 - 1.3, 0.97, -0.2]} scale={[1.7, 0.06, 0.8]} />
      {kind === 'tech' ? (
        // tecnología: productos también sobre el mostrador interior (se ven desde arriba aunque la
        // fachada no mire a la cámara)
        <group position={[w / 2 - 1.3, 1.0, -0.2]}>
          <TechCounter width={1.55} accent={store.brandColor} bare />
        </group>
      ) : (
        high && <mesh geometry={GEO.rounded} material={lit ? SCREEN() : mat('#26303a')} position={[w / 2 - 1.6, 1.15, -0.25]} rotation={[-0.3, 0, 0]} scale={[0.35, 0.25, 0.04]} />
      )}
      {high &&
        (premium ? [-w / 4, 0, w / 4] : [-w / 5, w / 5]).map((x) => (
          <group key={x} position={[x, H - 0.25, -0.2]}>
            <mesh geometry={GEO.cylinder} material={mat(PALETTE.metal)} position={[0, 0.15, 0]} scale={[0.02, 0.3, 0.02]} />
            <mesh geometry={GEO.halfDisc} material={mat('#2f3a44')} rotation={[Math.PI, 0, Math.PI / 2]} scale={[0.22, 0.12, 0.22]} />
            <mesh geometry={GEO.sphere} material={lit ? WARM_LIGHT() : mat('#8d877a')} position={[0, -0.08, 0]} scale={0.14} />
          </group>
        ))}

      {kind === 'food' && <RestaurantExtras store={store} w={w} d={d} H={H} detail={detail} lit={lit} />}
      {premium && (
        <>
          {/* plantas en la entrada y mesa central con productos */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (w / 2 + 0.2), 0, d / 2 + 0.6]}>
              <mesh geometry={GEO.cylinder} material={mat(PALETTE.pot)} position={[0, 0.3, 0]} scale={[0.6, 0.6, 0.6]} castShadow />
              <mesh geometry={GEO.sphere} material={mat(PALETTE.leaf)} position={[0, 0.95, 0]} scale={[0.95, 1.1, 0.95]} castShadow />
            </group>
          ))}
          <mesh geometry={GEO.rounded} material={mat(PALETTE.wall)} position={[-1, 0.4, 0.3]} scale={[2.2, 0.7, 1.2]} castShadow />
          {[0, 1, 2].map((i) => (
            <group key={i} position={[-1.7 + i * 0.7, 0.75, 0.3]}>
              <Display kind={kind} colors={colors} seed={i + 4} scale={0.55} />
            </group>
          ))}
        </>
      )}
    </group>
  )
}

/** Toldo a rayas: franjas alternas color de marca / blanco. */
function StripedAwning({ w, y, z, color }: { w: number; y: number; z: number; color: string }) {
  const n = 7
  const sw = (w - 0.4) / n
  return (
    <group position={[0, y, z + 0.35]} rotation={[0.45, 0, 0]}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} geometry={GEO.box} material={mat(i % 2 ? '#fbf7f0' : color)} position={[-(w - 0.4) / 2 + sw * (i + 0.5), 0, 0]} scale={[sw + 0.005, 0.06, 0.95]} castShadow={i === 0} />
      ))}
      <mesh geometry={GEO.box} material={mat(shade(color, -0.15))} position={[0, -0.06, 0.47]} scale={[w - 0.4, 0.12, 0.03]} />
    </group>
  )
}

// ── Islas comerciales ──────────────────────────────────────────────────────────

function IslandShop({ store, products, detail }: { store: Store; products: Product[]; detail: Detail }) {
  const brand = mat(store.brandColor)
  const sign = getStoreSign(store.logoText, store.brandColor, undefined, store.logo)
  const colors = displayColors(store, products)
  const kind = kindOf(store)
  const high = detail === 'high'
  return (
    <group>
      <mesh geometry={GEO.rounded} material={glowMat(store.accentColor, 0.8)} position={[0, 0.06, 0]} scale={[2.6, 0.12, 2.6]} receiveShadow />
      <mesh geometry={GEO.plane} material={POOL()} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} scale={[5.2, 5.2, 1]} />
      <mesh geometry={GEO.box} material={INTERIOR_LIGHT()} position={[0, 0.85, 0.2]} scale={[2.3, 1.5, 2.3]} />
      {/* mostrador en U con frente de marca */}
      <mesh geometry={GEO.rounded} material={mat(PALETTE.wall)} position={[0, 0.5, 0.95]} scale={[2.3, 0.9, 0.45]} castShadow />
      <mesh geometry={GEO.rounded} material={mat(PALETTE.wall)} position={[-0.95, 0.5, 0]} scale={[0.45, 0.9, 2.3]} castShadow />
      <mesh geometry={GEO.rounded} material={mat(PALETTE.wall)} position={[0.95, 0.5, 0]} scale={[0.45, 0.9, 2.3]} castShadow />
      <mesh geometry={GEO.box} material={brand} position={[0, 0.5, 1.19]} scale={[1.6, 0.35, 0.02]} />
      <mesh geometry={GEO.box} material={SIGN_STRIP()} position={[0, 0.08, 1.2]} scale={[2.2, 0.04, 0.04]} />
      {/* vitrina sobre el mostrador */}
      <mesh geometry={GEO.box} material={GLASS} position={[0, 1.2, 0.95]} scale={[1.6, 0.5, 0.35]} />
      <mesh geometry={GEO.box} material={WARM_PANE()} position={[0, 1.2, 0.85]} scale={[1.5, 0.42, 0.02]} />
      {kind === 'tech' ? (
        <group position={[0, 0.95, 0.95]}>
          <TechCounter width={1.5} accent={store.brandColor} bare />
        </group>
      ) : (
        [-0.5, 0.5].map((x, i) => (
          <group key={x} position={[x, 0.95, 0.95]}>
            <Display kind={kind} colors={colors} seed={i} scale={0.42} />
          </group>
        ))
      )}
      {isHighlighted(store) && <RooftopSign store={store} y={3.3} z={-0.3} width={2.6} big={false} />}
      {/* columna, marquesina con logo en sus cuatro caras y bombillos */}
      <mesh geometry={GEO.cylinder} material={mat(PALETTE.wall)} position={[0, 1.4, -0.3]} scale={[0.22, 2.8, 0.22]} castShadow />
      <group position={[0, 2.85, -0.3]}>
        <mesh geometry={GEO.rounded} material={brand} scale={[1.95, 0.8, 1.95]} castShadow />
        {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
          <mesh key={r} geometry={GEO.plane} rotation={[0, r, 0]} position={[Math.sin(r) * 0.985, 0, Math.cos(r) * 0.985]} scale={[Math.min(0.68, 1.82 / sign.aspect) * sign.aspect, Math.min(0.68, 1.82 / sign.aspect), 1]}>
            <meshBasicMaterial map={sign.texture} transparent toneMapped={false} />
          </mesh>
        ))}
        {high &&
          Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2
            return <mesh key={i} geometry={GEO.sphereSmooth} material={WARM_LIGHT()} position={[Math.sin(a) * 1.12, -0.46, Math.cos(a) * 1.12]} scale={0.09} />
          })}
      </group>
      <mesh geometry={GEO.box} material={mat(PALETTE.wood)} position={[0, 0.55, -0.6]} scale={[1.2, 1, 0.3]} castShadow />
      {high && (
        <>
          {/* pantalla de precios y dos banquitos */}
          <mesh geometry={GEO.rounded} material={SCREEN()} position={[0, 1.35, -0.43]} scale={[0.8, 0.45, 0.05]} />
          {[-0.6, 0.6].map((x) => (
            <group key={x} position={[x, 0, 1.65]}>
              <mesh geometry={GEO.cylinder} material={mat(PALETTE.metal)} position={[0, 0.3, 0]} scale={[0.06, 0.6, 0.06]} />
              <mesh geometry={GEO.cylinder} material={mat(shade(store.brandColor, 0.3))} position={[0, 0.63, 0]} scale={[0.36, 0.08, 0.36]} />
            </group>
          ))}
        </>
      )}
    </group>
  )
}

// ── Espacio disponible ─────────────────────────────────────────────────────────

function AvailableSpace({ space, zoneColor, pending, price }: { space: SpaceSlot; zoneColor: string; pending: boolean; price: number }) {
  const [w, d] = space.size
  const ring = useRef<THREE.Mesh>(null)
  const totem = useRef<THREE.Group>(null)
  const label = pending
    ? getLabel('EN REVISIÓN', { bg: '#f5b544', fg: '#3b2a05', sub: 'Solicitud enviada' })
    : getLabel('TU NEGOCIO AQUÍ', { bg: zoneColor, fg: '#fff', sub: `Reclámalo · ${formatCOP(price)}/mes` })
  const ghost = mat(PALETTE.wall, { opacity: 0.55 })
  const isIsland = space.type === 'island'
  const H = space.type === 'premium' ? 2.2 : 1.6
  // Tótem al frente y al centro del espacio. Cartel grande (se lee desde la vista general), sin
  // salirse del ancho del local.
  const tz = isIsland ? 0 : d / 2 - 0.4
  const tx = 0
  const S = Math.min(1.75, (Math.max(w, isIsland ? 3.4 : 0) * 0.92) / (0.2 + 0.62 * label.aspect))
  const signY = 1.55 + 0.82 * (S - 1) * 0.5 + 0.7 * (S - 1)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + space.position[0]
    if (ring.current) {
      const p = (t * 0.6) % 1
      ring.current.scale.setScalar(0.6 + p * 0.9)
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - p)
    }
    if (totem.current) totem.current.rotation.y = Math.sin(t * 0.8) * 0.08
  })

  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: pending ? '#f5b544' : zoneColor, transparent: true, depthWrite: false, toneMapped: false }), [zoneColor, pending])

  return (
    <group>
      <mesh geometry={GEO.box} material={mat(shade(zoneColor, 0.85))} position={[0, 0.04, 0]} scale={[w, 0.08, d]} receiveShadow />
      {!isIsland && space.zoneId === 'B' && <TechEmptyModule w={w} d={d} H={H} />}
      {!isIsland && (
        <>
          <mesh geometry={GEO.box} material={ghost} position={[0, H / 2, -d / 2 + 0.1]} scale={[w, H, 0.2]} />
          <mesh geometry={GEO.box} material={ghost} position={[-w / 2 + 0.1, H / 2, 0]} scale={[0.2, H, d]} />
          <mesh geometry={GEO.box} material={ghost} position={[w / 2 - 0.1, H / 2, 0]} scale={[0.2, H, d]} />
        </>
      )}
      {/* anillo pulsante: invita a tocar */}
      <mesh ref={ring} userData={{ dynamic: true }} geometry={GEO.ring} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} position={[tx, 0.12, tz]} />
      {/* tótem «Reclamar local» */}
      <group ref={totem} userData={{ dynamic: true }} position={[tx, 0, tz]}>
        <mesh geometry={GEO.cylinder} material={mat(PALETTE.metal)} position={[0, signY / 2, 0]} scale={[0.07 * S, signY, 0.07 * S]} />
        <mesh geometry={GEO.cylinder} material={mat(PALETTE.trim)} position={[0, 0.06, 0]} scale={[0.6 * S, 0.12, 0.6 * S]} />
        <mesh geometry={GEO.rounded} material={glowMat(zoneColor, 0.18, { dayGlow: 0.1 })} position={[0, signY, 0]} scale={[(0.2 + 0.62 * label.aspect) * S, 0.82 * S, 0.1]} />
        {[1, -1].map((s) => (
          <mesh key={s} geometry={GEO.plane} material={dimLabelMat(label.texture)} position={[0, signY, s * 0.056]} rotation={[0, s > 0 ? 0 : Math.PI, 0]} scale={[0.62 * label.aspect * S, 0.62 * S, 1]} />
        ))}
      </group>
    </group>
  )
}

/** Contorno punteado de todos los espacios disponibles de una zona en una sola InstancedMesh. */
export function AvailableOutlines({ spaces, color }: { spaces: SpaceSlot[]; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const dashes = useMemo(() => {
    const out: { x: number; z: number; rot: number; horizontal: boolean }[] = []
    for (const sp of spaces) {
      const [w, d] = sp.size
      const n = Math.ceil((w + d) * 1.2)
      const perim = 2 * (w + d)
      const c = Math.cos(sp.rotation)
      const s = Math.sin(sp.rotation)
      for (let i = 0; i < n; i++) {
        const t = (i / n) * perim
        let x: number, z: number, horizontal: boolean
        if (t < w) [x, z, horizontal] = [-w / 2 + t, d / 2, true]
        else if (t < w + d) [x, z, horizontal] = [w / 2, d / 2 - (t - w), false]
        else if (t < 2 * w + d) [x, z, horizontal] = [w / 2 - (t - w - d), -d / 2, true]
        else [x, z, horizontal] = [-w / 2, -d / 2 + (t - 2 * w - d), false]
        out.push({ x: sp.position[0] + x * c + z * s, z: sp.position[1] - x * s + z * c, rot: sp.rotation, horizontal })
      }
    }
    return out
  }, [spaces])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    dashes.forEach((d, i) => {
      o.position.set(d.x, 0.3, d.z)
      o.rotation.set(0, d.rot, 0)
      o.scale.set(d.horizontal ? 0.35 : 0.1, 0.05, d.horizontal ? 0.1 : 0.35)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.count = dashes.length
    m.instanceMatrix.needsUpdate = true
  }, [dashes])
  // Capacidad fija (todos los espacios libres posibles) para no recrear la malla al ocupar/liberar.
  return <instancedMesh ref={ref} args={[GEO.box, mat(shade(color, 0.35)), 400]} frustumCulled={false} />
}

const WHITE = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 })

/** Productos en estantería: una InstancedMesh por tienda, coloreada por instancia. */
function ShelfItems({ items, colors }: { items: { x: number; y: number; z: number; c: number }[]; colors: string[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    items.forEach((it, i) => {
      o.position.set(it.x, it.y, it.z)
      o.scale.set(0.38, 0.4, 0.3)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, col.set(colors[it.c % colors.length]))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items, colors])
  return <instancedMesh ref={ref} args={[GEO.rounded, WHITE, items.length]} />
}

/**
 * Lo que distingue a un restaurante de una tienda: tablero de menú iluminado, campana de cocina y
 * un par de mesitas en la entrada.
 */
function RestaurantExtras({ store, w, d, H, detail, lit }: { store: Store; w: number; d: number; H: number; detail: Detail; lit: boolean }) {
  const menu = getLabel('MENÚ', { bg: '#2b3440', fg: '#ffe2a8', radius: 14 })
  return (
    <group>
      <mesh geometry={GEO.box} material={mat('#2b3440')} position={[-w / 4, H - 0.75, -d / 2 + 0.26]} scale={[w * 0.32, 0.7, 0.04]} />
      <mesh geometry={GEO.plane} material={dimLabelMat(menu.texture)} position={[-w / 4, H - 0.6, -d / 2 + 0.29]} scale={[0.32 * menu.aspect, 0.32, 1]} />
      <mesh geometry={GEO.box} material={lit ? glowMat('#ffe2a8', 1.2, { dayGlow: 0.3 }) : mat('#4a4338')} position={[-w / 4, H - 0.95, -d / 2 + 0.29]} scale={[w * 0.28, 0.12, 0.01]} />
      <mesh geometry={GEO.box} material={mat('#c9ccd1', { rough: 0.4 })} position={[w / 4, H - 0.45, -d / 2 + 0.6]} scale={[w * 0.3, 0.35, 0.8]} />
      {detail === 'high' &&
        [-1, 1].map((s) => (
          <group key={s} position={[s * (w / 2 - 0.9), 0, d / 2 + 1.4]}>
            <mesh geometry={GEO.cylinder} material={mat('#e9dcc4')} position={[0, 0.9, 0]} scale={[0.9, 0.07, 0.9]} />
            <mesh geometry={GEO.cylinderLow} material={mat(PALETTE.metal)} position={[0, 0.5, 0]} scale={[0.1, 0.8, 0.1]} />
            {[-0.65, 0.65].map((x) => (
              <mesh key={x} geometry={GEO.cylinderLow} material={mat(shade(store.brandColor, 0.35))} position={[x, 0.42, 0]} scale={[0.36, 0.45, 0.36]} />
            ))}
          </group>
        ))}
    </group>
  )
}

/**
 * Pantalla digital de una tienda de tecnología (fuera del Batch: cambia de mensaje). En locales va
 * en la parte alta de la vitrina izquierda; en islas, en la columna sobre el mostrador.
 */
function TechStoreScreen({ space, store, products, flashPercent }: { space: SpaceSlot; store: Store; products: Product[]; flashPercent?: number }) {
  const messages = useMemo<ScreenMessage[]>(() => {
    const out: ScreenMessage[] = []
    if (flashPercent) out.push({ title: `−${flashPercent}% HOY`, sub: 'Oferta relámpago' })
    out.push({ title: store.name, sub: store.tagline.slice(0, 30) })
    for (const p of products.filter((x) => x.active && x.featured).slice(0, 2)) out.push({ title: p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name, sub: formatCOP(p.price) })
    return out
  }, [store, products, flashPercent])
  const [w, d] = space.size
  if (space.type === 'island')
    return (
      <group position={[0, 1.98, -0.12]}>
        <TechScreen messages={messages} width={0.85} accent={store.brandColor} />
      </group>
    )
  const premium = space.type === 'premium'
  const H = premium ? 3.4 : 2.6
  // franja del letrero más alta: el nombre del negocio se lee de lejos
  const fascia = premium ? 1.05 : 0.85
  const glassW = premium ? w * 0.34 : w * 0.3
  const sw = Math.min(glassW * 0.8, 1.4)
  return (
    <group position={[-(w / 2 - 0.22 - glassW / 2), H - fascia - 0.15 - (sw * 0.5625) / 2, d / 2 - 0.2 + 0.08]}>
      <TechScreen messages={messages} width={sw} accent={store.brandColor} />
    </group>
  )
}

/**
 * Tienda destacada: cartel grande sobre el techo (doble cara, con marco de marca y franjas de luz),
 * dos reflectores que lo iluminan y, en locales, luz propia sobre la fachada y el piso de enfrente.
 * Las franjas y reflectores brillan de día; de noche se suma la luz ascendente de la fachada.
 */
function RooftopSign({ store, y, z, width, big, wash }: { store: Store; y: number; z: number; width: number; big: boolean; wash?: { w: number; H: number; front: number } }) {
  const sign = getStoreSign(store.name, store.brandColor, undefined, store.logo)
  let h = big ? 2.1 : 1.5
  let w = h * sign.aspect
  if (w > width) {
    w = width
    h = w / sign.aspect
  }
  const top = y + 0.55 + h / 2
  const led = glowMat('#ffe9b8', 1.8, { dayGlow: 0.55 })
  const brand = mat(store.brandColor)
  const signMat = litSign(sign.texture)
  return (
    <group position={[0, 0, z]}>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={mat(PALETTE.metal)} position={[s * (w / 2 - 0.25), y + 0.3, 0]} scale={[0.08, 0.6, 0.08]} />
      ))}
      <mesh geometry={GEO.rounded} material={brand} position={[0, top, 0]} scale={[w + 0.24, h + 0.24, 0.14]} castShadow />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={GEO.plane} material={signMat} position={[0, top, s * 0.075]} rotation={[0, s > 0 ? 0 : Math.PI, 0]} scale={[w, h, 1]} />
      ))}
      {/* franjas de luz arriba y abajo del cartel */}
      {[1, -1].map((s) => (
        <mesh key={s} geometry={GEO.box} material={led} position={[0, top + s * (h / 2 + 0.14), 0]} scale={[w + 0.28, 0.06, 0.18]} />
      ))}
      {/* reflectores que apuntan al cartel */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 - 0.25), y + 0.12, 0.45]} rotation={[-0.9, 0, 0]}>
          <mesh geometry={GEO.cylinder} material={mat('#2b3440')} scale={[0.16, 0.22, 0.16]} />
          <mesh geometry={GEO.cylinder} material={led} position={[0, 0.115, 0]} scale={[0.13, 0.02, 0.13]} />
        </group>
      ))}
      {wash && (
        <>
          <mesh geometry={GEO.plane} material={uplightMat('plane', '#ffd9a0', 0.75)} position={[0, wash.H / 2 + 0.2, wash.front - z]} scale={[wash.w + 0.6, wash.H + 0.8, 1]} />
          <mesh geometry={GEO.plane} material={lightPoolMat('#ffe0a8', 0.95, 0.12)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, wash.front - z + 1.4]} scale={[wash.w + 3, 3.4, 1]} />
        </>
      )}
    </group>
  )
}

/** Cartel con luz propia: no se atenúa de noche ni depende de la iluminación de la escena. */
const litSignCache = new Map<THREE.Texture, THREE.MeshBasicMaterial>()
function litSign(texture: THREE.Texture) {
  let m = litSignCache.get(texture)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false })
    litSignCache.set(texture, m)
  }
  return m
}

/** ¿La fachada mira hacia la cámara isométrica (que mira desde +x +z)? */
const facesCamera = (rotation: number) => Math.sin(rotation) + Math.cos(rotation) > 0.3

/** Locales con cartel en el techo: destacados, premium (locales grandes) o de espaldas a la cámara. */
function hasRoofSign(store: Store, premium: boolean, rotation: number) {
  return isHighlighted(store) || premium || !facesCamera(rotation)
}
