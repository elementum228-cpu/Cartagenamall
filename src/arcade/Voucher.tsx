import { ArrowLeft, Check, Copy, Download, Gift, Send, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import markWhite from '../assets/mallplay-mark-white.png'
import type { Store } from '../domain/types'
import { copyText } from '../lib/clipboard'
import { openWhatsApp, whatsappDigits, whatsappLink } from '../lib/restaurant'
import { useCatalog } from '../state/catalog'
import { MallLogoWhite } from '../ui/MallMark'
import { StoreLogo } from '../ui/bits'
import { useUI } from '../state/ui'
import { celebrate } from './audio'
import { useArcade, type ArcadeRedemption } from './store'
import { rawRewardId, syncVoucher, voucherUsed } from './vouchers'
import { walletKinds, walletLink, walletSupport, type WalletKind } from './wallet'
import './arcade.css'

// El bono del premio: al canjear, una pantalla de felicitaciones con confeti y, después, el bono (un tiquete con la tienda, el premio,
// las condiciones y el código) listo para mostrar en caja, guardar como imagen o enviarle al negocio por WhatsApp u otra app.

const CONFETTI = ['#ffd400', '#ff2bd6', '#00f0ff', '#7dffa6', '#ff8a3d', '#ffffff']

/** Lluvia de confeti por toda la pantalla (unos 3 segundos). Solo decoración. */
export function Confetti({ n = 54 }: { n?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const r = (k: number) => {
          const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453
          return x - Math.floor(x)
        }
        return { left: r(1) * 100, delay: r(2) * 0.9, dur: 1.9 + r(3) * 1.5, size: 6 + r(4) * 7, color: CONFETTI[i % CONFETTI.length], spin: (r(5) - 0.5) * 900, drift: (r(6) - 0.5) * 120, round: i % 4 === 0 }
      }),
    [n],
  )
  return (
    <div className="pointer-events-none fixed inset-0 z-[95] overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti-bit"
          style={{ left: `${b.left}%`, width: b.size, height: b.round ? b.size : b.size * 1.6, background: b.color, borderRadius: b.round ? '50%' : 2, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, ['--spin' as string]: `${b.spin}deg`, ['--drift' as string]: `${b.drift}px` }}
        />
      ))}
    </div>
  )
}

const dateEs = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
const untilEs = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

/** Pantalla de felicitaciones: el regalo salta, el título aparece con rebote y llueve confeti. */
export function Celebration({ r, onContinue }: { r: ArcadeRedemption; onContinue: () => void }) {
  const [confetti, setConfetti] = useState(true)
  useEffect(() => {
    celebrate()
    const a = window.setTimeout(() => setConfetti(false), 3600)
    const b = window.setTimeout(onContinue, 3200)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [onContinue])
  return (
    <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-white" role="status">
      {confetti && <Confetti />}
      <div className="celebrate-gift grid size-24 place-items-center rounded-3xl bg-gradient-to-br from-[#ffe56b] to-[#ff8a3d] shadow-[0_0_0_4px_#07031a,0_0_40px_rgba(255,212,0,.6)]">
        <Gift className="size-14 text-[#3a1a00]" strokeWidth={1.8} />
      </div>
      <p className="font-arcade celebrate-title text-[18px] leading-snug text-[#ffd400]" style={{ textShadow: '3px 3px 0 #ff2bd6' }}>
        ¡FELICITACIONES!
      </p>
      <p className="text-[13px] font-semibold text-[#c8d3ff]">Ganaste un premio{r.storeName ? ` de ${r.storeName}` : ''}</p>
      <p className="max-w-[26ch] text-[18px] leading-tight font-extrabold">{r.name}</p>
      <button onClick={onContinue} className="arcade-btn font-arcade mt-3 flex min-h-12 items-center gap-2 px-6 text-[11px]">
        VER MI BONO
      </button>
    </div>
  )
}

type StoreLook = Pick<Store, 'logoText' | 'brandColor' | 'logo' | 'arcadeRewards'>

/** Foto del premio de este bono (la que el negocio tiene ahora en ese premio). */
const rewardPhoto = (r: ArcadeRedemption, store: StoreLook | null) => store?.arcadeRewards?.find((x) => x.id === rawRewardId(r))?.image

/** La tienda del bono (para su logo y su color): por su identificador o, en bonos viejos, por su nombre. */
function useStoreOf(r: ArcadeRedemption): Store | null {
  const stores = useCatalog((s) => s.stores)
  return useMemo(() => stores.find((s) => (r.storeId ? s.id === r.storeId : !!r.storeName && s.name === r.storeName)) ?? null, [stores, r.storeId, r.storeName])
}

/** El bono dibujado en pantalla: arriba el logo de MallPlay, al centro la tienda con su logo y el premio, abajo (más discreto) el código. */
export function VoucherCard({ r }: { r: ArcadeRedemption }) {
  const store = useStoreOf(r)
  const photo = rewardPhoto(r, store)
  return (
    <article className="relative mx-auto w-full max-w-[340px] shrink-0 overflow-hidden rounded-[24px] text-[#1a1530] shadow-[0_10px_0_rgba(0,0,0,.35)]" style={{ background: 'linear-gradient(165deg,#fffaf0,#fff0c4 55%,#ffe39a)' }} aria-label={`Bono: ${r.name}`}>
      <div className="flex items-center justify-between bg-[#171233] px-5 py-3.5">
        <MallLogoWhite height={26} />
        <span className="text-[10.5px] font-bold tracking-[0.22em] text-[#ffd45c] uppercase">Bono Arcade</span>
      </div>
      <div className="flex flex-col items-center px-6 pt-6 pb-5 text-center">
        {photo && <img src={photo} alt={r.name} className="mb-4 aspect-[16/9] w-full rounded-2xl object-cover shadow-md" />}
        {store ? <StoreLogo store={store} size={68} round /> : <span className="grid size-[68px] place-items-center rounded-full bg-[#171233] text-[26px] font-black text-[#ffd45c]">{(r.storeName || 'M').charAt(0)}</span>}
        {r.storeName && <p className="mt-3 text-[12.5px] font-bold tracking-[0.16em] text-[#1a1530]/60 uppercase">{r.storeName}</p>}
        <p className="mt-2 text-[27px] leading-[1.08] font-extrabold tracking-[-0.02em]">{r.name}</p>
        {r.detail && <p className="mt-2.5 text-[13px] leading-snug font-medium text-[#1a1530]/65">{r.detail}</p>}
      </div>
      {/* línea de corte con muescas */}
      <div className="relative h-5" aria-hidden>
        <span className="absolute inset-x-6 top-1/2 border-t-2 border-dashed border-[#1a1530]/25" />
        <span className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full bg-[#06021a]" />
        <span className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full bg-[#06021a]" />
      </div>
      {/* talón: letra más chica y discreta que el premio */}
      <div className="px-6 pt-3 pb-4 text-center">
        <p className="text-[9.5px] font-bold tracking-[0.24em] text-[#1a1530]/50">CÓDIGO</p>
        <p className="mt-0.5 font-mono text-[22px] leading-none font-bold tracking-[0.14em] text-[#1a1530]/90">{r.code}</p>
        <p className="mt-2.5 text-[10.5px] leading-snug font-medium text-[#1a1530]/55">
          Canjeado el {dateEs(r.at)}
          <br />
          {r.until ? `Válido hasta el ${untilEs(r.until)}` : 'Sin vencimiento'}
        </p>
        <p className="mt-0.5 text-[10.5px] font-medium text-[#1a1530]/45">Muéstralo en caja · se usa una sola vez</p>
      </div>
      {r.used && (
        <div className="absolute inset-0 grid place-items-center bg-[#1a1530]/55" aria-label="Bono usado">
          <span className="-rotate-12 rounded-lg border-4 border-[#ff4d6d] px-4 py-1 text-[28px] font-black tracking-widest text-[#ff4d6d]">USADO</span>
        </div>
      )}
    </article>
  )
}

/** Rectángulo con esquinas redondeadas (sin `roundRect`, que no existe en iPhones con iOS < 16). */
function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tl: number, tr: number, br: number, bl: number) {
  g.moveTo(x + tl, y)
  g.lineTo(x + w - tr, y)
  g.arcTo(x + w, y, x + w, y + tr, tr)
  g.lineTo(x + w, y + h - br)
  g.arcTo(x + w, y + h, x + w - br, y + h, br)
  g.lineTo(x + bl, y + h)
  g.arcTo(x, y + h, x, y + h - bl, bl)
  g.lineTo(x, y + tl)
  g.arcTo(x, y, x + tl, y, tl)
  g.closePath()
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement | null>((res) => {
    const im = new Image()
    // fotos en la nube: con CORS para poder dibujarlas y exportar el PNG; si el servidor no lo permite, sale sin foto
    if (/^https?:/.test(src)) im.crossOrigin = 'anonymous'
    im.onload = () => res(im)
    im.onerror = () => res(null)
    im.src = src
  })

/** Parte un texto en líneas que caben en `maxW` con la letra que esté puesta en el lienzo. */
function lines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const out: string[] = []
  let line = ''
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      out.push(line)
      line = w
      if (out.length >= maxLines) return out
    } else line = test
  }
  if (line && out.length < maxLines) out.push(line)
  return out
}

/** El bono como imagen (PNG vertical, lista para guardar o mandar por WhatsApp): mismo diseño que en pantalla. */
export async function voucherImage(r: ArcadeRedemption, store: StoreLook | null): Promise<Blob> {
  const W = 1080
  const F = 'Manrope, "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
  try {
    await Promise.all([document.fonts.load('800 60px Manrope'), document.fonts.load('600 30px Manrope'), document.fonts.load('700 30px Manrope')])
  } catch {
    /* sin la letra de la app se usa la del sistema */
  }
  const photoSrc = rewardPhoto(r, store)
  const [mark, logo, photo] = await Promise.all([loadImg(markWhite), store?.logo ? loadImg(store.logo) : Promise.resolve(null), photoSrc ? loadImg(photoSrc) : Promise.resolve(null)])
  const photoH = photo ? Math.round(((W - 160 - 120) * 9) / 16) + 44 : 0
  const c = document.createElement('canvas')
  c.width = W
  c.height = 2200
  const g = c.getContext('2d')!
  const x0 = 80
  const w = W - 160
  const mid = w - 150

  // medidas del texto (la altura de la tarjeta depende de cuántas líneas ocupa el premio y las condiciones)
  g.font = `800 84px ${F}`
  const prize = lines(g, r.name, mid, 4)
  g.font = `500 37px ${F}`
  const detail = r.detail ? lines(g, r.detail, mid, 4) : []
  const headH = 150
  const bodyH = photoH + 70 + 170 + (r.storeName ? 76 : 20) + prize.length * 92 + (detail.length ? 24 + detail.length * 52 : 0) + 60
  const stubH = 350
  const y0 = 110
  const cardH = headH + bodyH + stubH
  const H = y0 + cardH + 170
  c.height = H
  const bg = g.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#1a0f55')
  bg.addColorStop(1, '#06021a')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)

  // tarjeta
  const card = g.createLinearGradient(0, y0, 0, y0 + cardH)
  card.addColorStop(0, '#fffaf0')
  card.addColorStop(0.55, '#fff0c4')
  card.addColorStop(1, '#ffe39a')
  g.fillStyle = card
  g.beginPath()
  rrect(g, x0, y0, w, cardH, 56, 56, 56, 56)
  g.fill()
  g.fillStyle = '#171233'
  g.beginPath()
  rrect(g, x0, y0, w, headH, 56, 56, 0, 0)
  g.fill()
  // cabecera: logo de MallPlay y «BONO ARCADE»
  g.textBaseline = 'middle'
  let lx = x0 + 56
  if (mark) {
    const mh = 72
    const mw = (mark.width / mark.height) * mh
    g.drawImage(mark, lx, y0 + headH / 2 - mh / 2, mw, mh)
    lx += mw + 18
  }
  g.fillStyle = '#ffffff'
  g.textAlign = 'left'
  g.font = `800 50px ${F}`
  g.fillText('MallPlay', lx, y0 + headH / 2 + 2)
  g.fillStyle = '#ffd45c'
  g.textAlign = 'right'
  g.font = `700 28px ${F}`
  g.fillText('BONO ARCADE', x0 + w - 56, y0 + headH / 2 + 2)

  // cuerpo: logo de la tienda, su nombre y el premio
  let y = y0 + headH + 70
  const cx = W / 2
  if (photo) {
    const pw = w - 120
    const ph = Math.round((pw * 9) / 16)
    const px = x0 + 60
    g.save()
    g.beginPath()
    rrect(g, px, y - 10, pw, ph, 36, 36, 36, 36)
    g.clip()
    const sc = Math.max(pw / photo.width, ph / photo.height)
    g.drawImage(photo, px + pw / 2 - (photo.width * sc) / 2, y - 10 + ph / 2 - (photo.height * sc) / 2, photo.width * sc, photo.height * sc)
    g.restore()
    y += ph + 34
  }
  const lr = 85
  g.save()
  g.beginPath()
  g.arc(cx, y + lr, lr, 0, Math.PI * 2)
  g.clip()
  if (logo) {
    g.fillStyle = '#ffffff'
    g.fillRect(cx - lr, y, lr * 2, lr * 2)
    const s = Math.max((lr * 2) / logo.width, (lr * 2) / logo.height)
    g.drawImage(logo, cx - (logo.width * s) / 2, y + lr - (logo.height * s) / 2, logo.width * s, logo.height * s)
  } else {
    g.fillStyle = store?.brandColor || '#171233'
    g.fillRect(cx - lr, y, lr * 2, lr * 2)
    g.fillStyle = '#ffffff'
    g.textAlign = 'center'
    g.font = `800 ${store?.logoText && store.logoText.length > 3 ? 40 : 60}px ${F}`
    g.fillText((store?.logoText || (r.storeName || 'M').charAt(0)).toUpperCase(), cx, y + lr + 3)
  }
  g.restore()
  g.strokeStyle = 'rgba(26,21,48,.12)'
  g.lineWidth = 4
  g.beginPath()
  g.arc(cx, y + lr, lr, 0, Math.PI * 2)
  g.stroke()
  y += lr * 2
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  if (r.storeName) {
    y += 62
    g.fillStyle = 'rgba(26,21,48,.6)'
    g.font = `700 34px ${F}`
    g.fillText(r.storeName.toUpperCase().split('').join(' '), cx, y)
    y += 14
  } else y += 20
  g.fillStyle = '#1a1530'
  g.font = `800 84px ${F}`
  y += 86
  for (const l of prize) {
    g.fillText(l, cx, y)
    y += 92
  }
  y -= 92
  if (detail.length) {
    g.fillStyle = 'rgba(26,21,48,.65)'
    g.font = `500 37px ${F}`
    y += 24
    for (const l of detail) {
      y += 52
      g.fillText(l, cx, y)
    }
  }

  // línea de corte con muescas
  const cy = y0 + headH + bodyH
  g.fillStyle = '#06021a'
  g.beginPath()
  g.arc(x0, cy, 40, 0, Math.PI * 2)
  g.arc(x0 + w, cy, 40, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(26,21,48,.25)'
  g.lineWidth = 5
  g.setLineDash([22, 16])
  g.beginPath()
  g.moveTo(x0 + 72, cy)
  g.lineTo(x0 + w - 72, cy)
  g.stroke()
  g.setLineDash([])

  // talón: más discreto que el premio
  g.fillStyle = 'rgba(26,21,48,.5)'
  g.font = `700 26px ${F}`
  g.fillText('C Ó D I G O', cx, cy + 86)
  g.fillStyle = 'rgba(26,21,48,.9)'
  g.font = `700 62px ui-monospace, "SF Mono", Menlo, Consolas, monospace`
  g.fillText(r.code.split('').join(' '), cx, cy + 160)
  g.fillStyle = 'rgba(26,21,48,.55)'
  g.font = `500 28px ${F}`
  g.fillText(`Canjeado el ${dateEs(r.at)}`, cx, cy + 222)
  g.fillText(r.until ? `Válido hasta el ${untilEs(r.until)}` : 'Sin vencimiento', cx, cy + 262)
  g.fillStyle = 'rgba(26,21,48,.45)'
  g.font = `500 26px ${F}`
  g.fillText('Muéstralo en caja · se usa una sola vez', cx, cy + 308)
  g.fillStyle = 'rgba(255,255,255,.6)'
  g.font = `600 30px ${F}`
  g.fillText('mallplay · Cartagena', cx, y0 + cardH + 90)

  if (r.used) {
    g.save()
    g.translate(cx, y0 + headH + bodyH / 2)
    g.rotate(-0.2)
    g.strokeStyle = '#ff4d6d'
    g.fillStyle = '#ff4d6d'
    g.lineWidth = 14
    g.strokeRect(-230, -80, 460, 160)
    g.font = `900 110px ${F}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('USADO', 0, 4)
    g.restore()
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('sin imagen'))), 'image/png'))
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Pantalla del bono con sus acciones: guardar la imagen, mandarla al negocio, copiar el código y marcarlo como usado. */
export function VoucherView({ code, onBack }: { code: string; onBack: () => void }) {
  const r = useArcade((s) => s.redemptions.find((x) => x.code === code))
  const store = useStoreOf(r ?? { code: '', rewardId: '', name: '', cost: 0, at: '' })
  const toast = useUI((s) => s.toast)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [wallets, setWallets] = useState<WalletKind[]>([])
  useEffect(() => {
    let on = true
    void walletSupport().then((s) => on && setWallets(walletKinds(s)))
    return () => {
      on = false
    }
  }, [])
  // al abrir: registra el bono en el servidor si quedó pendiente; mientras está abierto, avisa en cuanto el negocio lo valide
  const markUsed = useArcade((s) => s.markUsed)
  const wasUsed = !!r?.used
  useEffect(() => {
    if (!r || wasUsed) return
    void syncVoucher(r)
    let on = true
    const check = () =>
      void voucherUsed(r.code).then((u) => {
        if (!on || !u) return
        markUsed(r.code, true)
        toast('El negocio validó tu bono: ya fue usado.', 'success')
      })
    check()
    const t = window.setInterval(check, 8000)
    return () => {
      on = false
      window.clearInterval(t)
    }
    // solo al abrir cada bono
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.code, wasUsed])
  if (!r) return null
  const toWallet = async (kind: WalletKind) => {
    setBusy(true)
    const url = await walletLink(kind, r)
    setBusy(false)
    if (!url) return toast('No se pudo preparar el pase. Guarda la imagen e inténtalo más tarde.', 'error')
    // Apple abre el .pkpass al seguir el enlace; Google abre su pantalla «Guardar»
    if (kind === 'google') window.open(url, '_blank', 'noopener')
    else window.location.href = url
  }
  const save = async () => {
    setBusy(true)
    try {
      const blob = await voucherImage(r, store)
      const file = new File([blob], `bono-${r.code}.png`, { type: 'image/png' })
      // en el celular el menú de compartir trae «Guardar imagen» (y WhatsApp); en computador se descarga
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Mi bono de MallPlay' })
      else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) setPreview(URL.createObjectURL(blob))
      else {
        download(blob, `bono-${r.code}.png`)
        toast('Imagen guardada.', 'success')
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast('No se pudo crear la imagen. Haz una captura de pantalla.', 'error')
    }
    setBusy(false)
  }
  /** Abre WhatsApp con el número del negocio y el mensaje listo (el código va en el texto; la imagen se adjunta desde WhatsApp si se quiere). */
  const send = () => {
    const text = `Hola${r.storeName ? ` ${r.storeName}` : ''}, gané este bono en el Arcade de MallPlay: ${r.name}.\nCódigo: ${r.code}${r.until ? `\nVálido hasta el ${untilEs(r.until)}` : ''}\n¿Me lo pueden validar?`
    const number = store?.whatsapp && whatsappDigits(store.whatsapp).length >= 10 ? store.whatsapp : ''
    const url = number ? whatsappLink(number, text) : `https://wa.me/?text=${encodeURIComponent(text)}`
    if (!number) toast('Este negocio aún no tiene WhatsApp: elige el contacto.')
    openWhatsApp(url)
  }
  return (
    <div className="flex min-h-0 flex-col gap-3 pb-2 text-white">
      <button onClick={onBack} className="font-arcade flex min-h-11 items-center gap-2 self-start px-1 text-[10px] text-[#9fb3ff]">
        <ArrowLeft className="size-4" /> MIS PREMIOS
      </button>
      {preview && (
        <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-3 bg-black/90 p-4" onClick={() => setPreview(null)}>
          <img src={preview} alt={`Bono ${r.code}`} className="max-h-[78dvh] max-w-full rounded-2xl" />
          <p className="max-w-[30ch] text-center text-[13px] text-white">Mantén presionada la imagen y elige «Guardar en Fotos».</p>
          <button className="rounded-full bg-white/15 px-5 py-2 text-[13px] font-bold text-white">Cerrar</button>
        </div>
      )}
      <VoucherCard r={r} />
      <div className="mx-auto flex w-full max-w-[340px] flex-col gap-2">
        {wallets.map((k) => (
          <button key={k} disabled={busy} onClick={() => void toWallet(k)} className={`flex min-h-12 items-center justify-center gap-2.5 rounded-xl px-4 text-[14px] font-extrabold active:scale-[0.98] ${k === 'apple' ? 'bg-black text-white ring-1 ring-white/40' : 'bg-white text-[#1f1f1f]'}`}>
            <Wallet className="size-5" /> {k === 'apple' ? 'Añadir a Apple Wallet' : 'Guardar en Google Wallet'}
          </button>
        ))}
        <button disabled={busy} onClick={send} className={`${wallets.length ? 'bg-white/12 text-white' : 'arcade-btn'} font-arcade flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-[10.5px]`}>
          <Send className="size-4" /> ENVIAR POR WHATSAPP
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button disabled={busy} onClick={save} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/12 text-[13px] font-bold active:scale-[0.98]">
            <Download className="size-4" /> Guardar imagen
          </button>
          <button
            onClick={async () => {
              setCopied(await copyText(r.code))
              setTimeout(() => setCopied(false), 1500)
            }}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/12 text-[13px] font-bold active:scale-[0.98]"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copiado' : 'Copiar código'}
          </button>
        </div>
        <button onClick={() => useArcade.getState().markUsed(r.code, !r.used)} className="min-h-11 text-[12.5px] font-bold text-[#9fb3ff] underline underline-offset-4">
          {r.used ? 'Devolver a disponible' : 'Ya lo usé en la tienda'}
        </button>
      </div>
    </div>
  )
}
