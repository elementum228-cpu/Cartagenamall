import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/**
 * La presentación privada (VITE_DEMO=1) no se puede instalar en el celular: sin manifiesto, sin
 * íconos de pantalla de inicio y sin service worker, así que ni Android ni iPhone la ofrecen como app.
 */
function noInstall(): Plugin {
  let outDir = ''
  return {
    name: 'mallplay-no-install',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir)
    },
    transformIndexHtml(html) {
      return html
        .replace(/\s*<link rel="manifest"[^>]*>/g, '')
        .replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, '')
        .replace(/\s*<meta name="apple-mobile-web-app-[^>]*>/g, '')
    },
    closeBundle() {
      for (const f of ['manifest.webmanifest', 'sw.js', 'icons']) rmSync(resolve(outDir, f), { recursive: true, force: true })
    },
  }
}

// VITE_BASE permite publicar en una subcarpeta (p. ej. /cartagena-mall/). Por defecto, raíz.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss(), ...(process.env.VITE_DEMO === '1' ? [noInstall()] : [])],
  // three + R3F viven en el chunk perezoso de WorldCanvas: Comprar y /admin no los esperan.
  build: { chunkSizeWarningLimit: 1100 },
})
