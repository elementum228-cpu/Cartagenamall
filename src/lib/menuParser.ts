import type { ProductIcon } from '../domain/types'

// Lee el texto de un menú (de un PDF o pegado) y lo ordena en categorías y platos con su precio. Es una lectura por reglas, sin servicios
// externos: entiende «Nombre ..... 25.000», precios en otra línea, «12k», varios precios por tamaño, títulos en MAYÚSCULAS y descripciones.
// Lo dudoso queda marcado para que la persona lo revise antes de crear nada.

export type ItemFlag = 'sin-precio' | 'precio-dudoso' | 'varios-precios'

export interface ParsedItem {
  name: string
  /** Precio en COP (el primero, si hay varios); null si no se encontró. */
  price: number | null
  description: string
  /** Todos los precios encontrados en la línea (por tamaños, por ejemplo). */
  prices: number[]
  flag?: ItemFlag
}

export interface ParsedSection {
  name: string
  items: ParsedItem[]
}

export interface ParsedMenu {
  sections: ParsedSection[]
  items: number
}

// 12.000 · 12,000 · $12.000 · 12000 · 12k · 12 mil
const PRICE = String.raw`(?:\$\s?)?(?:\d{1,3}(?:[.,]\d{3})+|\d{4,6}|\d{1,3}\s?[kK]\b|\d{1,3}\s?mil\b)`
const PRICE_G = new RegExp(PRICE, 'g')
const TRAIL_PRICES = new RegExp(String.raw`(?:^|[\s.:\-–—·|/]+)((?:${PRICE})(?:\s*(?:/|-|–|\||·|y|o)?\s*(?:${PRICE}))*)\s*(?:COP|cop|pesos)?\s*$`)
const ONLY_PRICES = new RegExp(String.raw`^\s*(?:${PRICE})(?:\s*(?:/|-|–|\||·|y|o)?\s*(?:${PRICE}))*\s*(?:COP|cop|pesos)?\s*$`)
// precio suelto de 1 a 3 cifras al final («Limonada 8»): se entiende como miles y se marca para revisar
const SMALL_TRAIL = /^(.*[A-Za-zÁÉÍÓÚÑáéíóúñ)])\s+\$?\s?(\d{1,3})\s*$/

export function toCOP(raw: string): number | null {
  const t = raw.trim().replace(/^\$\s?/, '').toLowerCase()
  let m = t.match(/^(\d{1,3})\s?k$/) ?? t.match(/^(\d{1,3})\s?mil$/)
  if (m) return Number(m[1]) * 1000
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ''))
  m = t.match(/^\d{4,6}$/)
  if (m) return Number(t)
  return null
}

function pricesIn(s: string): number[] {
  return (s.match(PRICE_G) ?? []).map(toCOP).filter((n): n is number => n !== null && n >= 500 && n <= 2_000_000)
}

const isCaps = (s: string) => {
  const letters = s.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '')
  return letters.length >= 3 && letters === letters.toUpperCase()
}

/** «BANDEJA PAISA» → «Bandeja paisa». */
export function sentence(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (!isCaps(t)) return t
  const lower = t.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

const JUNK = [/^\s*(?:tel|teléfono|telefono|cel|whatsapp|wpp|dirección|direccion|cra|calle|carrera|cll)\b/i, /@\w+/, /\bwww\.|https?:\/\//i, /^\s*\+?\d[\d\s()-]{8,}\s*$/, /^\s*(?:página|pagina|pág)\s*\d+/i, /^\s*\d{1,2}\s*$/, /^\s*[-–—_=*·.]{3,}\s*$/]
const NOISE_HEAD = /^\s*(?:men[uú]|carta|nuestra carta|nuestro men[uú]|restaurante|precios?|iva|propina|incluye|todos los precios)\b/i

function clean(line: string): string {
  return line
    .replace(/[ \t]+/g, ' ')
    .replace(/[.·…_]{3,}/g, ' ') // puntos guía entre el nombre y el precio
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Separa «Nombre, ingredientes…» o «Nombre - ingredientes…» en nombre y descripción. */
function splitNameDesc(text: string): { name: string; description: string } {
  const t = text.replace(/[\s.:\-–—·|/]+$/, '').trim()
  const m = t.match(/^(.{3,48}?)(?:\s[-–—]\s|:\s|,\s|\s\(|\s\|\s)(.+)$/)
  if (m) return { name: sentence(m[1]), description: m[2].replace(/\)\s*$/, '').trim() }
  return { name: sentence(t.length > 70 ? t.slice(0, 70) : t), description: t.length > 70 ? t.slice(70).trim() : '' }
}

export function parseMenuText(input: string | string[]): ParsedMenu {
  const rawLines = (Array.isArray(input) ? input : input.split(/\r?\n/)).map(clean)
  const lines = rawLines.filter((l) => l && !JUNK.some((re) => re.test(l)))
  const sections: ParsedSection[] = []
  let current = null as ParsedSection | null
  let last = null as ParsedItem | null
  let pendingName: string | null = null

  const section = (name: string) => {
    const n = sentence(name.replace(/[:\s]+$/, ''))
    if (!n) return
    const found = sections.find((s) => s.name.toLowerCase() === n.toLowerCase())
    current = found ?? { name: n, items: [] }
    if (!found) sections.push(current)
    last = null
  }
  const push = (item: ParsedItem) => {
    if (!current) section('Menú')
    current!.items.push(item)
    last = item
  }
  const itemFrom = (text: string, prices: number[], dubious = false): ParsedItem => {
    const { name, description } = splitNameDesc(text)
    return { name, description, price: prices[0] ?? null, prices, flag: prices.length === 0 ? 'sin-precio' : dubious ? 'precio-dudoso' : prices.length > 1 ? 'varios-precios' : undefined }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (NOISE_HEAD.test(line) && !pricesIn(line).length && line.length < 40) continue

    // 1) solo precios: pertenecen al nombre de la línea anterior
    if (ONLY_PRICES.test(line)) {
      const prices = pricesIn(line)
      if (pendingName) {
        push(itemFrom(pendingName, prices))
        pendingName = null
      } else if (last && last.price === null && prices.length) {
        last.price = prices[0]
        last.prices = prices
        last.flag = prices.length > 1 ? 'varios-precios' : undefined
      }
      continue
    }

    // 2) nombre + precio(s) al final
    const tp = line.match(TRAIL_PRICES)
    if (tp && tp.index !== undefined) {
      PRICE_G.lastIndex = 0
      const first = PRICE_G.exec(line)
      const cut = first ? first.index : tp.index
      const prices = pricesIn(line.slice(cut))
      const text = line.slice(0, cut).trim()
      if (prices.length && text.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '').length >= 2) {
        if (pendingName) {
          // el nombre de arriba se queda sin precio: se guarda tal cual
          push(itemFrom(pendingName, []))
          pendingName = null
        }
        push(itemFrom(text, prices))
        continue
      }
    }
    // 2b) «Limonada 8»: precio corto, se lee como miles y se marca
    const sm = line.match(SMALL_TRAIL)
    if (sm && sm[1].length <= 60 && !/\d/.test(sm[1])) {
      const p = Number(sm[2]) * 1000
      if (p >= 1000 && p <= 99000 && sections.length + (current ? 1 : 0) > 0) {
        if (pendingName) {
          push(itemFrom(pendingName, []))
          pendingName = null
        }
        push(itemFrom(sm[1], [p], true))
        continue
      }
    }

    // 3) línea sin precio: ¿título, nombre con precio en la línea siguiente o descripción?
    const next = lines[i + 1]
    const nextIsPrice = !!next && ONLY_PRICES.test(next)
    if (nextIsPrice) {
      // un plato sin precio justo arriba: esta línea es su descripción y el precio de abajo es de ese plato
      if (last && last.price === null && !pendingName) {
        last.description = last.description ? `${last.description} ${line}` : line
        continue
      }
      // nombre cuyo precio viene en la línea de abajo
      pendingName = pendingName ? `${pendingName}, ${line}` : line
      continue
    }
    const nextHasPrice = !!next && pricesIn(next).length > 0
    const strongHeading = isCaps(line) || /:$/.test(line)
    const titleLike =
      last !== null && last.price !== null && line.length <= 28 && line.split(' ').length <= 3 && /^[A-ZÁÉÍÓÚÑ]/.test(line) && !/[.,;]$/.test(line) && !/^(con|sin|en|de|del|y|acompa|incluye|servid)/i.test(line) && nextHasPrice
    if ((strongHeading || titleLike) && line.length <= 48) {
      if (pendingName) {
        push(itemFrom(pendingName, []))
        pendingName = null
      }
      section(line)
      continue
    }
    if (pendingName) {
      pendingName = `${pendingName}, ${line}`
      continue
    }
    if (last) {
      last.description = last.description ? `${last.description} ${line}` : line
      continue
    }
    // línea suelta sin plato anterior: un título (si aún no hay sección) o un plato sin precio
    if (!current && line.length <= 28 && nextHasPrice) section(line)
    else if (line.length <= 70 && /^[A-ZÁÉÍÓÚÑ]/.test(line)) push(itemFrom(line, []))
  }
  if (pendingName) push(itemFrom(pendingName, []))

  const out = sections.filter((s) => s.items.length)
  return { sections: out, items: out.reduce((n, s) => n + s.items.length, 0) }
}

const ICONS: [RegExp, ProductIcon][] = [
  [/\b(caf[eé]|capuch|latte|mocca|moka|espresso|tinto|chocolate caliente)/i, 'coffee'],
  [/\b(jugo|limonada|gaseosa|cerveza|agua|t[eé]\b|batido|malteada|smoothie|soda|coctel|c[oó]ctel|vino|michelada|bebida)/i, 'drink'],
  [/\b(postre|torta|helado|brownie|cheesecake|flan|gelato|waffle|crepe|dona|galleta|tres leches)/i, 'dessert'],
  [/\b(pescado|ceviche|camar[oó]n|mariscos?|langostino|mojarra|sierra|pulpo|calamar|salm[oó]n|cazuela de)/i, 'fish'],
  [/\b(carne|res\b|cerdo|pollo|costilla|churrasco|parrilla|bistec|picanha|lomo|chuleta|hamburguesa|alitas|bbq)/i, 'meat'],
  [/\b(pasta|espagueti|spaghetti|ramen|fideos|lasa[ñn]a|noodles|tallar[ií]n|fettuccine)/i, 'noodles'],
  [/\b(croissant|pan\b|panader|s[aá]ndwich|sandwich|empanada|arepa|pastel)/i, 'croissant'],
]
export function iconFor(name: string, section = ''): ProductIcon {
  const t = `${name} ${section}`
  return ICONS.find(([re]) => re.test(t))?.[1] ?? 'plate'
}
