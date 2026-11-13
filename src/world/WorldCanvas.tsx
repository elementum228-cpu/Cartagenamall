import './fonts3d.css'
import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Component, Suspense, useEffect, useState, type ReactNode } from 'react'
import { DPR_CAP } from '../lib/deviceProfile'
import { usePrefs } from '../state/ui'
import { createFrameGate } from './frameGate'
import { cameraState } from './cameraState'
import { CAMERA_DISTANCE, ISO_DIR } from './cameraIso'
import { PICK_LAYER } from './Batch'
import { Scene } from './Scene'

class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error('[MallPlay] El mundo 3D falló; se muestra el mapa 2D.', error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/**
 * Bucle de dibujo propio (el Canvas va en `frameloop="never"`): dibuja como mucho `maxFps` cuadros por segundo y no hace
 * nada con la vista pausada (modo Comprar, etc.) ni con la pestaña oculta. Un solo bucle, que se cancela al desmontar.
 */
function FrameDriver({ run, maxFps }: { run: boolean; maxFps: number }) {
  const advance = useThree((s) => s.advance)
  const clock = useThree((s) => s.clock)
  useEffect(() => {
    if (!run) return
    const gate = createFrameGate(maxFps)
    gate.start(clock.elapsedTime)
    let raf = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (document.hidden) {
        gate.reset()
        return
      }
      if (!gate.shouldRender(now)) return
      advance(gate.step(now), true)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run, maxFps, advance, clock])
  return null
}

/** Espera la tipografía para que los rótulos del canvas no salgan con la fuente de respaldo. */
function useFontsReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let done = false
    const finish = () => !done && ((done = true), setReady(true))
    const t = setTimeout(finish, 1500)
    // Los rótulos del canvas se dibujan una sola vez: se espera a que estén las dos tipografías (con tope de 1,5 s).
    if (document.fonts) {
      Promise.all([document.fonts.load('800 24px "Plus Jakarta Sans"'), document.fonts.load('700 24px Manrope'), document.fonts.ready]).then(finish).catch(finish)
    } else finish()
    return () => clearTimeout(t)
  }, [])
  return ready
}

export default function WorldCanvas({ active, fallback, night }: { active: boolean; fallback: ReactNode; night: boolean }) {
  const quality = usePrefs((s) => s.quality)
  // La resolución sigue a la calidad: es lo que más cuesta en pantallas densas. Nunca baja de 1,5× hasta el modo bajo.
  const native = window.devicePixelRatio || 1
  const dpr = Math.min(native, DPR_CAP[quality])
  // Tope de cuadros: 60 (en pantallas de 90/120 Hz se dibujaría el doble sin que se note); 30 en calidad baja.
  const maxFps = quality === 'low' ? 30 : 60
  const fontsReady = useFontsReady()
  useEffect(() => {
    cameraState.active = active
    if (!active) cameraState.handMode = false
  }, [active])

  if (!fontsReady) return <WorldLoading />

  return (
    <WebGLBoundary fallback={fallback}>
      <Canvas
        orthographic
        flat
        shadows={quality === 'high'}
        dpr={dpr}
        // El dibujo lo maneja <FrameDriver>: se detiene con la vista inactiva (modo Comprar, carrito…) y con la pestaña oculta.
        frameloop="never"
        camera={{ position: ISO_DIR.clone().multiplyScalar(CAMERA_DISTANCE).toArray(), zoom: 1, near: -400, far: 800 }}
        // En pantallas densas (2× o más) el suavizado de bordes casi no se nota y cuesta mucho relleno: se omite.
        gl={{ antialias: (window.devicePixelRatio || 1) < 2, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, raycaster, scene, camera, invalidate }) => {
          gl.setClearColor(0x000000, 0)
          // Si el navegador reclama la memoria gráfica (iPhone con muchas pestañas, volver de otra app), el mundo se
          // recupera solo en vez de quedar en blanco: se evita el aborto por defecto y se redibuja al volver.
          const canvas = gl.domElement
          canvas.addEventListener('webglcontextlost', (e) => e.preventDefault())
          canvas.addEventListener('webglcontextrestored', () => {
            gl.shadowMap.needsUpdate = true
            invalidate()
          })
          if (import.meta.env.DEV) Object.assign(window, { __cmGl: gl, __cmScene: scene, __cmCam: camera })
          // Las mallas fusionadas por <Batch> dejan sus originales en PICK_LAYER solo para los toques.
          raycaster.layers.enable(PICK_LAYER)
        }}
        style={{ touchAction: 'none' }}
        aria-label="Mapa 3D de MallPlay"
      >
        <FrameDriver run={active} maxFps={maxFps} />
        <PerformanceMonitor
          onDecline={() => {
            usePrefs.getState().stepDownQuality()
          }}
          flipflops={2}
        >
          <Suspense fallback={null}>
            <Scene quality={quality} night={night} />
          </Suspense>
        </PerformanceMonitor>
      </Canvas>
    </WebGLBoundary>
  )
}

export function WorldLoading() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="flex flex-col items-center gap-3 text-ink-soft">
        <div className="size-10 animate-spin rounded-full border-4 border-teal-600/20 border-t-teal-600" />
        <p className="text-sm font-medium">Construyendo el centro comercial…</p>
      </div>
    </div>
  )
}
