import { ArrowLeft, Check, Copy, Download, Gift, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { copyText } from '../lib/clipboard'
import { useUI } from '../state/ui'
import { celebrate } from './audio'
import { useArcade, type ArcadeRedemption } from './store'
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

/** El bono dibujado en pantalla: un tiquete con el premio, las condiciones y el código. */
export function VoucherCard({ r }: { r: ArcadeRedemption }) {
  return (
    <article className="relative mx-auto w-full max-w-[340px] overflow-hidden rounded-[22px] text-[#1a1530] shadow-[0_10px_0_rgba(0,0,0,.35)]" style={{ background: 'linear-gradient(160deg,#fff7d6,#ffe9a0 45%,#ffd45c)' }} aria-label={`Bono: ${r.name}`}>
      <div className="flex items-center justify-between bg-[#1a1530] px-4 py-2.5 text-[#ffd400]">
        <span className="font-arcade text-[9px]">BONO ARCADE</span>
        <span className="font-arcade text-[9px]">MALLPLAY</span>
      </div>
      <div className="px-5 pt-4 pb-3 text-center">
        {r.storeName && <p className="text-[12px] font-extrabold tracking-[0.18em] uppercase opacity-70">{r.storeName}</p>}
        <p className="mt-1 text-[24px] leading-[1.1] font-black">{r.name}</p>
        {r.detail && <p className="mt-2 text-[12.5px] leading-snug opacity-75">{r.detail}</p>}
      </div>
      {/* línea de corte con muescas */}
      <div className="relative my-1 h-5" aria-hidden>
        <span className="absolute inset-x-6 top-1/2 border-t-2 border-dashed border-[#1a1530]/35" />
        <span className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full bg-[#06021a]" />
        <span className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full bg-[#06021a]" />
      </div>
      <div className="px-5 pt-2 pb-4 text-center">
        <p className="text-[10.5px] font-extrabold tracking-[0.2em] opacity-60">TU CÓDIGO</p>
        <p className="mt-0.5 font-mono text-[34px] leading-none font-black tracking-[0.12em]">{r.code}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-left text-[11.5px]">
          <div className="rounded-xl bg-white/55 px-2.5 py-1.5">
            <dt className="font-bold opacity-60">Canjeado</dt>
            <dd className="font-extrabold">{dateEs(r.at)}</dd>
          </div>
          <div className="rounded-xl bg-white/55 px-2.5 py-1.5">
            <dt className="font-bold opacity-60">Válido hasta</dt>
            <dd className="font-extrabold">{r.until ? untilEs(r.until) : 'Sin vencimiento'}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] font-semibold opacity-65">Muéstralo en caja. Se usa una sola vez.</p>
      </div>
      {r.used && (
        <div className="absolute inset-0 grid place-items-center bg-[#1a1530]/55" aria-label="Bono usado">
          <span className="-rotate-12 rounded-lg border-4 border-[#ff4d6d] px-4 py-1 text-[28px] font-black tracking-widest text-[#ff4d6d]">USADO</span>
        </div>
      )}
    </article>
  )
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines = 4): number {
  const words = text.split(/\s+/)
  let line = ''
  let lines = 0
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y)
      y += lineH
      line = w
      if (++lines >= maxLines) return y
    } else line = test
  }
  if (line) ctx.fillText(line, x, y)
  return y + lineH
}

/** El bono como imagen (PNG vertical, lista para guardar o mandar por WhatsApp). */
export async function voucherImage(r: ArcadeRedemption): Promise<Blob> {
  const W = 1080
  const H = 1500
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
  const bg = g.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#1a0f55')
  bg.addColorStop(1, '#06021a')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  // tarjeta
  const x0 = 90
  const w = W - 180
  const y0 = 150
  const h = 1200
  const card = g.createLinearGradient(0, y0, 0, y0 + h)
  card.addColorStop(0, '#fff7d6')
  card.addColorStop(0.5, '#ffe9a0')
  card.addColorStop(1, '#ffd45c')
  g.fillStyle = card
  g.beginPath()
  g.roundRect(x0, y0, w, h, 48)
  g.fill()
  g.fillStyle = '#1a1530'
  g.beginPath()
  g.roundRect(x0, y0, w, 120, [48, 48, 0, 0])
  g.fill()
  g.textBaseline = 'middle'
  g.fillStyle = '#ffd400'
  g.font = `900 40px ${sans}`
  g.textAlign = 'left'
  g.fillText('BONO ARCADE', x0 + 48, y0 + 60)
  g.textAlign = 'right'
  g.fillText('MALLPLAY', x0 + w - 48, y0 + 60)
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.fillStyle = 'rgba(26,21,48,.7)'
  g.font = `800 40px ${sans}`
  if (r.storeName) g.fillText(r.storeName.toUpperCase(), W / 2, y0 + 230)
  g.fillStyle = '#1a1530'
  g.font = `900 84px ${sans}`
  let y = wrap(g, r.name, W / 2, y0 + 340, w - 120, 96, 3)
  if (r.detail) {
    g.fillStyle = 'rgba(26,21,48,.75)'
    g.font = `500 38px ${sans}`
    y = wrap(g, r.detail, W / 2, y + 10, w - 140, 52, 4)
  }
  // línea de corte
  const cy = y0 + 800
  g.fillStyle = '#06021a'
  g.beginPath()
  g.arc(x0, cy, 38, 0, Math.PI * 2)
  g.arc(x0 + w, cy, 38, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(26,21,48,.4)'
  g.lineWidth = 5
  g.setLineDash([22, 16])
  g.beginPath()
  g.moveTo(x0 + 70, cy)
  g.lineTo(x0 + w - 70, cy)
  g.stroke()
  g.setLineDash([])
  g.fillStyle = 'rgba(26,21,48,.6)'
  g.font = `800 34px ${sans}`
  g.fillText('TU CÓDIGO', W / 2, cy + 100)
  g.fillStyle = '#1a1530'
  g.font = `900 120px ui-monospace, Menlo, Consolas, monospace`
  g.fillText(r.code, W / 2, cy + 230)
  g.font = `700 36px ${sans}`
  g.fillStyle = 'rgba(26,21,48,.8)'
  g.fillText(`Canjeado: ${dateEs(r.at)}`, W / 2, cy + 310)
  g.fillText(`Válido hasta: ${r.until ? untilEs(r.until) : 'sin vencimiento'}`, W / 2, cy + 362)
  g.fillStyle = 'rgba(255,255,255,.75)'
  g.font = `600 36px ${sans}`
  g.fillText('Muéstralo en caja · se usa una sola vez', W / 2, y0 + h + 90)
  if (r.used) {
    g.save()
    g.translate(W / 2, y0 + 500)
    g.rotate(-0.2)
    g.strokeStyle = '#ff4d6d'
    g.fillStyle = '#ff4d6d'
    g.lineWidth = 14
    g.strokeRect(-230, -80, 460, 160)
    g.font = `900 110px ${sans}`
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
  const toast = useUI((s) => s.toast)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!r) return null
  const save = async () => {
    setBusy(true)
    try {
      download(await voucherImage(r), `bono-${r.code}.png`)
      toast('Imagen guardada. Puedes enviarla al negocio.', 'success')
    } catch {
      toast('No se pudo crear la imagen. Haz una captura de pantalla.', 'error')
    }
    setBusy(false)
  }
  const send = async () => {
    setBusy(true)
    try {
      const blob = await voucherImage(r)
      const file = new File([blob], `bono-${r.code}.png`, { type: 'image/png' })
      const text = `Mi bono de MallPlay: ${r.name}${r.storeName ? ` en ${r.storeName}` : ''}. Código ${r.code}.`
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Mi bono de MallPlay', text })
      else {
        download(blob, `bono-${r.code}.png`)
        toast('Imagen guardada: envíala por WhatsApp al negocio.', 'success')
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast('No se pudo compartir. Haz una captura de pantalla.', 'error')
    }
    setBusy(false)
  }
  return (
    <div className="flex min-h-0 flex-col gap-3 pb-2 text-white">
      <button onClick={onBack} className="font-arcade flex min-h-11 items-center gap-2 self-start px-1 text-[10px] text-[#9fb3ff]">
        <ArrowLeft className="size-4" /> MIS PREMIOS
      </button>
      <VoucherCard r={r} />
      <div className="mx-auto flex w-full max-w-[340px] flex-col gap-2">
        <button disabled={busy} onClick={send} className="arcade-btn font-arcade flex min-h-12 items-center justify-center gap-2 px-4 text-[10.5px]">
          <Send className="size-4" /> ENVIAR AL NEGOCIO
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
