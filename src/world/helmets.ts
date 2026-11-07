import { useStadiumPhase } from '../state/stadium'

/** Mientras el estadio no esté inaugurado, todas las personitas del mundo llevan casco de obra. */
export const useHelmetsOn = () => useStadiumPhase((s) => s.phase !== 'open')
export const HELMET_COLORS = ['#f6c21a', '#f4f4f0', '#ff8a1f', '#f6c21a', '#f6c21a', '#e84c3d']
export const helmetColor = (i: number) => HELMET_COLORS[i % HELMET_COLORS.length]
