// Saca el texto de un PDF, página por página, en el orden en que se lee: líneas de arriba hacia abajo y, si la página tiene dos columnas,
// primero la izquierda y luego la derecha. Si el PDF es una imagen (escaneado), no hay texto que leer y se avisa.
// pdf.js se carga solo al usarlo: no pesa en el resto de la aplicación.

interface Item {
  str: string
  x: number
  y: number
  w: number
  h: number
}

const PRICEISH = /^[\s$.,\d]+$/

/** Agrupa fragmentos de texto en líneas (misma altura) y los ordena de izquierda a derecha. */
function toLines(items: Item[]): string[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: Item[][] = []
  for (const it of sorted) {
    const row = rows.find((r) => Math.abs(r[0].y - it.y) <= Math.max(2.5, it.h * 0.45))
    if (row) row.push(it)
    else rows.push([it])
  }
  rows.sort((a, b) => b[0].y - a[0].y)
  return rows.map((r) => {
    r.sort((a, b) => a.x - b.x)
    let out = ''
    let prevEnd = 0
    for (const it of r) {
      const gap = it.x - prevEnd
      if (out && gap > it.h * 0.2 && !out.endsWith(' ') && !it.str.startsWith(' ')) out += ' '
      out += it.str
      prevEnd = it.x + it.w
    }
    return out.trim()
  })
}

/** ¿La página tiene dos columnas de platos? Hay texto (no solo precios) a ambos lados y casi nada cruza el centro. */
function twoColumns(items: Item[], width: number): boolean {
  const c = width / 2
  const text = items.filter((i) => i.str.trim().length > 3 && !PRICEISH.test(i.str))
  const left = text.filter((i) => i.x + i.w / 2 < c)
  const right = text.filter((i) => i.x > c * 1.02)
  if (left.length < 6 || right.length < left.length * 0.35) return false
  const crossing = items.filter((i) => i.x < c - width * 0.02 && i.x + i.w > c + width * 0.02).length
  return crossing <= items.length * 0.06
}

export interface PdfRead {
  lines: string[]
  pages: number
  /** No se encontró texto: probablemente es una imagen escaneada. */
  scanned: boolean
}

export async function pdfToLines(file: File | ArrayBuffer): Promise<PdfRead> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer()
  const task = pdfjs.getDocument({ data })
  const doc = await task.promise
  const lines: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const view = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const items: Item[] = []
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue
      const [, , , d, e, f] = it.transform as number[]
      items.push({ str: it.str, x: e, y: f, w: it.width, h: Math.abs(it.height || d) || 10 })
    }
    if (twoColumns(items, view.width)) {
      const c = view.width / 2
      lines.push(...toLines(items.filter((i) => i.x + i.w / 2 < c)), ...toLines(items.filter((i) => i.x + i.w / 2 >= c)))
    } else lines.push(...toLines(items))
    page.cleanup()
  }
  const pages = doc.numPages
  await task.destroy().catch(() => undefined)
  return { lines, pages, scanned: lines.join('').replace(/\s/g, '').length < 20 }
}
