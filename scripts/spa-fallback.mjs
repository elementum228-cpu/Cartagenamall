// Hosting estático (GitHub Pages, Hostinger): rutas como /admin no existen como archivo.
// Copiar index.html a 404.html hace que el servidor entregue la SPA y el router resuelva la ruta.
import { copyFileSync } from 'node:fs'
copyFileSync('dist/index.html', 'dist/404.html')
