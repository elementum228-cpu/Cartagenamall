/** Esqueleto mínimo mientras llega una página secundaria: sin spinner a pantalla completa, sin saltos de diseño. */
export function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-4" role="status" aria-label="Cargando">
      <div className="h-7 w-1/2 animate-pulse rounded-lg bg-ink/10" />
      <div className="h-24 animate-pulse rounded-2xl bg-ink/[0.06]" />
      <div className="h-24 animate-pulse rounded-2xl bg-ink/[0.06]" />
      <span className="sr-only">Cargando…</span>
    </div>
  )
}
