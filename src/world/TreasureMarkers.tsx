import { HUNT_LENGTH, huntFor, huntWeek } from '../promotions/hunt'
import { huntProgress, usePassport } from '../state/passport'
import { useUI } from '../state/ui'
import { HiddenMarker } from './SecretMarkers'

/** Búsqueda del tesoro: solo la pista que toca encontrar está escondida en el mundo (turquesa). */
export function TreasureMarkers({ floorId, interactive, now }: { floorId: string; interactive: boolean; now: number }) {
  const week = huntWeek(now)
  const found = usePassport((s) => huntProgress(s.hunt, week))
  if (found >= HUNT_LENGTH) return null
  const spot = huntFor(week)[found]
  if (!spot || spot.floorId !== floorId) return null
  return (
    <HiddenMarker
      key={`${week}-${found}`}
      id={spot.id}
      tone="treasure"
      spot={{ floorId: spot.floorId, at: [spot.x, spot.z], hintAt: [spot.x, spot.z], hintY: 2.8, extent: 0.5 }}
      interactive={interactive}
      onOpen={() => useUI.getState().openClue({ week, index: found })}
    />
  )
}
