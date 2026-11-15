// Pases de «Wallet» para los bonos del Arcade: Google Wallet (un enlace «Guardar» con un JWT firmado) y Apple Wallet (un archivo .pkpass
// firmado). Aquí vive lo que no depende del entorno (Deno o Node): validar los datos, armar el contenido de cada pase y firmar. Las
// librerías de zip y de firma se reciben por parámetro para poder probarlo en Node con las mismas funciones que corren en Supabase.
import { PASS_IMAGES } from './assets.ts'

export interface PassInput {
  /** Código del bono (CM-XXXXXX): es el número de serie del pase y lo que lleva el QR. */
  code: string
  storeName: string
  title: string
  detail: string
  /** AAAA-MM-DD o vacío. */
  until: string
  /** Fecha del canje (ISO). */
  at: string
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '')

/** Valida y limpia lo que manda el navegador. `null` si no sirve para hacer un pase. */
export function cleanPass(raw: unknown): PassInput | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const code = str(o.code, 16).toUpperCase()
  const title = str(o.title, 80)
  if (!/^CM-[A-Z0-9]{4,10}$/.test(code) || !title) return null
  const until = typeof o.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.until) ? o.until : ''
  const at = typeof o.at === 'string' && !Number.isNaN(Date.parse(o.at)) ? new Date(o.at).toISOString() : new Date().toISOString()
  return { code, title, storeName: str(o.storeName, 60), detail: str(o.detail, 200), until, at }
}

/** Fin del día de vencimiento en hora de Colombia (UTC-5), en formato W3C que piden Apple y Google. */
export const endOfDay = (until: string) => `${until}T23:59:59-05:00`

// ── Google Wallet ──────────────────────────────────────────────────────────────────────────────────

export interface GoogleConfig {
  issuerId: string
  serviceEmail: string
  /** Llave privada de la cuenta de servicio (PEM PKCS#8). */
  privateKey: string
}

export const googleClassId = (issuerId: string) => `${issuerId}.mallplay_bono_arcade`

/** El objeto «genérico» del pase: tarjeta dorada con el premio, la tienda, las condiciones y el QR con el código. */
export function googleObject(issuerId: string, p: PassInput) {
  const modules: { id: string; header: string; body: string }[] = []
  if (p.detail) modules.push({ id: 'condiciones', header: 'Condiciones', body: p.detail })
  modules.push({ id: 'vence', header: 'Válido hasta', body: p.until ? p.until : 'Sin vencimiento' })
  modules.push({ id: 'uso', header: 'Cómo usarlo', body: 'Muestra este pase en caja. Se usa una sola vez.' })
  return {
    id: `${issuerId}.${p.code.replace(/[^A-Z0-9]/g, '_')}`,
    classId: googleClassId(issuerId),
    state: 'ACTIVE',
    hexBackgroundColor: '#ffd45c',
    cardTitle: { defaultValue: { language: 'es', value: 'Bono Arcade MallPlay' } },
    header: { defaultValue: { language: 'es', value: p.title } },
    ...(p.storeName ? { subheader: { defaultValue: { language: 'es', value: p.storeName } } } : {}),
    textModulesData: modules,
    barcode: { type: 'QR_CODE', value: p.code, alternateText: p.code },
    ...(p.until ? { validTimeInterval: { end: { date: endOfDay(p.until) } } } : {}),
  }
}

export function googleClaims(cfg: GoogleConfig, p: PassInput, origins: string[], now = Math.floor(Date.now() / 1000)) {
  return {
    iss: cfg.serviceEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: now,
    origins,
    payload: {
      genericClasses: [{ id: googleClassId(cfg.issuerId) }],
      genericObjects: [googleObject(cfg.issuerId, p)],
    },
  }
}

const b64url = (bytes: Uint8Array | string) => {
  const u8 = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
  let s = ''
  for (const b of u8) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Firma el JWT (RS256) con la llave de la cuenta de servicio y devuelve el enlace «Guardar en Google Wallet». */
export async function googleSaveUrl(cfg: GoogleConfig, p: PassInput, origins: string[]): Promise<string> {
  const pem = cfg.privateKey.replace(/\\n/g, '\n').replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(googleClaims(cfg, p, origins)))
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`)))
  return `https://pay.google.com/gp/v/save/${head}.${body}.${b64url(sig)}`
}

// ── Apple Wallet ───────────────────────────────────────────────────────────────────────────────────

export interface AppleConfig {
  passTypeId: string
  teamId: string
  /** Certificado del pase, su llave privada y el certificado intermedio de Apple (WWDR), los tres en PEM. */
  certPem: string
  keyPem: string
  wwdrPem: string
}

/** El pase de tipo «cupón»: premio al centro, tienda y vencimiento, QR con el código y condiciones al reverso. */
export function applePassJson(cfg: Pick<AppleConfig, 'passTypeId' | 'teamId'>, p: PassInput) {
  const barcode = { format: 'PKBarcodeFormatQR', message: p.code, messageEncoding: 'iso-8859-1', altText: p.code }
  return {
    formatVersion: 1,
    passTypeIdentifier: cfg.passTypeId,
    teamIdentifier: cfg.teamId,
    organizationName: 'MallPlay',
    serialNumber: p.code,
    description: 'Bono Arcade MallPlay',
    logoText: 'MallPlay',
    foregroundColor: 'rgb(26, 21, 48)',
    backgroundColor: 'rgb(255, 212, 92)',
    labelColor: 'rgb(90, 70, 20)',
    ...(p.until ? { expirationDate: endOfDay(p.until) } : {}),
    relevantDate: p.at,
    barcodes: [barcode],
    barcode,
    coupon: {
      primaryFields: [{ key: 'premio', label: (p.storeName || 'Premio').toUpperCase(), value: p.title }],
      secondaryFields: [
        { key: 'vence', label: 'VÁLIDO HASTA', value: p.until || 'Sin vencimiento' },
        { key: 'codigo', label: 'CÓDIGO', value: p.code, textAlignment: 'PKTextAlignmentRight' },
      ],
      backFields: [
        ...(p.detail ? [{ key: 'condiciones', label: 'Condiciones', value: p.detail }] : []),
        { key: 'uso', label: 'Cómo usarlo', value: 'Muestra este pase en caja o dile el código al encargado. Se usa una sola vez.' },
        { key: 'emite', label: 'Emitido por', value: 'MallPlay · Arcade' },
      ],
    },
  }
}

export interface PkpassDeps {
  zipSync: (files: Record<string, Uint8Array>, opts?: { level?: number }) => Uint8Array
  /** Firma el manifiesto (PKCS#7 separado) y devuelve la firma en DER. */
  sign: (manifest: Uint8Array) => Uint8Array
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const png = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

/** Arma el .pkpass: pass.json + imágenes + manifest.json (SHA-1 de cada archivo) + signature. */
export async function buildPkpass(cfg: Pick<AppleConfig, 'passTypeId' | 'teamId'>, p: PassInput, deps: PkpassDeps): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const files: Record<string, Uint8Array> = { 'pass.json': enc.encode(JSON.stringify(applePassJson(cfg, p))) }
  for (const [name, b64] of Object.entries(PASS_IMAGES)) files[name] = png(b64)
  const manifest: Record<string, string> = {}
  for (const [name, data] of Object.entries(files)) manifest[name] = hex(await crypto.subtle.digest('SHA-1', data))
  const manifestBytes = enc.encode(JSON.stringify(manifest))
  files['manifest.json'] = manifestBytes
  files['signature'] = deps.sign(manifestBytes)
  return deps.zipSync(files, { level: 6 })
}

// deno-lint-ignore no-explicit-any
type Forge = any

/** Firma el manifiesto con node-forge: PKCS#7 separado, con el certificado del pase y el intermedio de Apple (WWDR). */
export function signManifest(forge: Forge, manifest: Uint8Array, cfg: Pick<AppleConfig, 'certPem' | 'keyPem' | 'wwdrPem'>): Uint8Array {
  const cert = forge.pki.certificateFromPem(cfg.certPem)
  const wwdr = forge.pki.certificateFromPem(cfg.wwdrPem)
  const key = forge.pki.privateKeyFromPem(cfg.keyPem)
  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(String.fromCharCode(...manifest))
  p7.addCertificate(cert)
  p7.addCertificate(wwdr)
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  })
  p7.sign({ detached: true })
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes()
  return Uint8Array.from(der, (c: string) => c.charCodeAt(0))
}

/** Los datos del pase viajan en el enlace de descarga (el iPhone abre el .pkpass al seguir un enlace, no al recibir un POST). */
export const encodePass = (p: PassInput) => b64url(JSON.stringify(p))
export function decodePass(d: string): PassInput | null {
  try {
    const s = d.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(s + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0))
    return cleanPass(JSON.parse(new TextDecoder().decode(bytes)))
  } catch {
    return null
  }
}
