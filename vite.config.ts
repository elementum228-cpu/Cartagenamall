import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// VITE_BASE permite publicar en una subcarpeta (p. ej. /cartagena-mall/). Por defecto, raíz.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  // three + R3F viven en el chunk perezoso de WorldCanvas: Comprar y /admin no los esperan.
  build: { chunkSizeWarningLimit: 1100 },
})
