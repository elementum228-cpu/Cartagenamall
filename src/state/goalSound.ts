// Sonido de gol: el local suena con fuegos artificiales y, a los pocos segundos, el grito de gol; el del visitante,
// solo el grito. Los archivos están en public/audio (no pasan por la caché del service worker).

const URLS = {
  home: `${import.meta.env.BASE_URL}audio/gol-local.mp3`,
  away: `${import.meta.env.BASE_URL}audio/gol-visitante.mp3`,
}

let current: HTMLAudioElement | null = null

/** Detiene el sonido de gol que esté sonando. */
export function stopGoalSound() {
  current?.pause()
  current = null
}

/** Suena el gol. Si el navegador no deja reproducir sin que la persona haya tocado la página, simplemente no suena. */
export function playGoalSound(side: 'home' | 'away') {
  if (typeof document === 'undefined' || document.hidden) return
  stopGoalSound()
  try {
    const a = new Audio(URLS[side])
    a.volume = 0.9
    current = a
    void a.play().catch(() => {
      if (current === a) current = null
    })
  } catch {
    current = null
  }
}
