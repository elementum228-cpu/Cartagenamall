import { UNDER_CONSTRUCTION } from '../config/stadium'

/** Mientras el estadio esté en obra, todas las personitas del mundo llevan casco. */
export const HELMETS_ON = UNDER_CONSTRUCTION
export const HELMET_COLORS = ['#f6c21a', '#f4f4f0', '#ff8a1f', '#f6c21a', '#f6c21a', '#e84c3d']
export const helmetColor = (i: number) => HELMET_COLORS[i % HELMET_COLORS.length]
