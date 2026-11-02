import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Component, Suspense, useEffect, useState, type ReactNode } from 'react'
import { usePrefs } from '../state/ui'
import { CAMERA_DISTANCE, ISO_DIR, cameraState } from './cameraState'
import { PICK_LAYER } from './Batch'
import { Scene } from './Scene'

class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error('[Cartagena Mall] El mundo 3D falló; se muestra el mapa 2D.', error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Espera la tipografía para que los rótulos del canvas no salgan con la fuente de respaldo. */
function useFontsReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let done = false
    const finish = () => !done && ((done = true), setReady(true))
    const t = setTimeout(finish, 1500)
    document.fonts?.ready.then(finish).catch(finish)
    if (!document.fonts) finish()
    return () => clearTimeout(t)
  }, [])
  return ready
}

export default function WorldCanvas({ active, fallback, night }: { active: boolean; fallback: ReactNode; night: boolean }) {
  const quality = usePrefs((s) => s.quality)
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, 2))
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
        // Si la vista no está activa (modo Comprar, carrito…) el render se detiene: cero batería.
        frameloop={active ? 'always' : 'never'}
        camera={{ position: ISO_DIR.clone().multiplyScalar(CAMERA_DISTANCE).toArray(), zoom: 1, near: -400, far: 800 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl, raycaster }) => {
          gl.setClearColor(0x000000, 0)
          // Las mallas fusionadas por <Batch> dejan sus originales en PICK_LAYER solo para los toques.
          raycaster.layers.enable(PICK_LAYER)
        }}
        style={{ touchAction: 'none' }}
        aria-label="Mapa 3D de Cartagena Mall"
      >
        <PerformanceMonitor
          onDecline={() => {
            // Nunca por debajo de 1,5× en pantallas densas: a 1× textos y letreros se ven borrosos.
            setDpr(Math.min(window.devicePixelRatio || 1, 1.5))
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
