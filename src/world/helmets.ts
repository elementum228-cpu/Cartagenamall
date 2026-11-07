/** Los cascos de obra son solo de los obreros del estadio (ver Stadium.tsx); las personas del mall van normales. */
export const useHelmetsOn = () => false
export const HELMET_COLORS = ['#f6c21a', '#f4f4f0', '#ff8a1f', '#f6c21a', '#f6c21a', '#e84c3d']
export const helmetColor = (i: number) => HELMET_COLORS[i % HELMET_COLORS.length]
