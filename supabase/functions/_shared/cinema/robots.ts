/** Reglas de robots.txt que aplican a un lector. Solo se usan `User-agent`, `Allow` y `Disallow` (con `*` y `$`). */
export interface RobotsRules {
  allow: string[]
  disallow: string[]
}

/** Reglas del grupo propio si existe (por nombre del lector); si no, las del grupo `*`. */
export function parseRobots(text: string, agent: string): RobotsRules {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = []
  let cur: (typeof groups)[number] | null = null
  let lastWasAgent = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line)
    if (!m) continue
    const key = m[1].toLowerCase()
    const val = m[2].trim()
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], allow: [], disallow: [] }))
      cur.agents.push(val.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!cur) continue
    if (key === 'allow' && val) cur.allow.push(val)
    if (key === 'disallow') cur.disallow.push(val)
  }
  const a = agent.toLowerCase()
  const own = groups.filter((g) => g.agents.some((x) => x !== '*' && a.includes(x)))
  const chosen = own.length ? own : groups.filter((g) => g.agents.includes('*'))
  return { allow: chosen.flatMap((g) => g.allow), disallow: chosen.flatMap((g) => g.disallow.filter(Boolean)) }
}

const matcher = (pattern: string) => new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'))

/** ¿Se puede leer esta ruta? Gana la regla más específica (la más larga); si empatan, gana Allow. */
export function robotsAllows(rules: RobotsRules, pathAndQuery: string): boolean {
  let best = { len: -1, allow: true }
  for (const p of rules.disallow) if (matcher(p).test(pathAndQuery) && p.length > best.len) best = { len: p.length, allow: false }
  for (const p of rules.allow) if (matcher(p).test(pathAndQuery) && p.length >= best.len) best = { len: p.length, allow: true }
  return best.allow
}
