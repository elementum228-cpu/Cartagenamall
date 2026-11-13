import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readdirSync, rmSync } from 'node:fs'
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

/**
 * Precarga la tipografía principal (Manrope, latín) desde el index.html: el navegador empieza a bajarla junto con el CSS en vez de
 * esperar a que el CSS se analice y el texto se pinte. Solo en el build (necesita el nombre con hash del archivo).
 */
function preloadMainFont(): Plugin {
  return {
    name: 'mallplay-preload-main-font',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const file = Object.keys(ctx.bundle ?? {}).find((f) => /manrope-latin-wght-normal-.*\.woff2$/.test(f))
        if (!file) return html
        const base = process.env.VITE_BASE ?? '/'
        return html.replace('</head>', `    <link rel="preload" href="${base}${file}" as="font" type="font/woff2" crossorigin />\n  </head>`)
      },
    },
  }
}

/** onnxruntime-web deja una copia del motor (15 MB) en assets/ que nunca se usa: el recorte de fotos lo carga de ort/. */
function dropUnusedWasm(): Plugin {
  let outDir = ''
  return {
    name: 'mallplay-drop-unused-wasm',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir)
    },
    closeBundle() {
      try {
        for (const f of readdirSync(resolve(outDir, 'assets'))) if (/^ort-wasm.*\.wasm$/.test(f)) rmSync(resolve(outDir, 'assets', f), { force: true })
      } catch {
        /* sin carpeta assets: nada que limpiar */
      }
    },
  }
}

// VITE_BASE permite publicar en una subcarpeta (p. ej. /cartagena-mall/). Por defecto, raíz.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss(), preloadMainFont(), dropUnusedWasm(), ...(process.env.VITE_DEMO === '1' ? [noInstall()] : [])],
  // three + R3F viven en el chunk perezoso de WorldCanvas: Comprar y /admin no los esperan.
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        // Las librerías cambian poco y la app cambia en cada publicación: en archivos aparte, quien ya visitó solo
        // descarga el código nuevo y reutiliza three, React y el resto desde su caché.
        //
        // `vendor` (React y lo que usa TODA la app) debe poder cargarse sin `three`. Con `manualChunks`, este empaquetador
        // (rolldown) dejaba react, scheduler y use-sync-external-store dentro de `three` y `vendor` terminaba importando los
        // 905 KB de three en cada visita, incluso en 2D. Con grupos y prioridad explícita, el núcleo de React gana siempre.
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|scheduler|zustand|use-sync-external-store|motion|framer-motion|motion-dom|motion-utils)[\\/]/, priority: 30 },
            { name: 'three', test: /node_modules[\\/](three|@react-three|three-stdlib|meshline|camera-controls|maath|detect-gpu|troika|its-fine|suspend-react|react-use-measure|react-reconciler|@babel[\\/]runtime)/, priority: 20 },
            { name: 'supabase', test: /node_modules[\\/](@supabase|supabase)/, priority: 10 },
          ],
        },
      },
    },
  },
})
