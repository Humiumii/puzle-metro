import type { Arrival } from './engine.ts'

export const CONCERT_END = 18
export const DURATION = 160

export const demand: Arrival[] = [
  { time: 3, origin: 'muelle', destination: 'mirador', count: 4 },
  { time: 6, origin: 'mercado', destination: 'talleres', count: 5 },
  { time: 9, origin: 'jardin', destination: 'muelle', count: 4 },
  ...Array.from({ length: 6 }, (_, index): Arrival[] => [
    { time: CONCERT_END + index * 4, origin: 'foro', destination: 'faro', count: 7 },
    { time: CONCERT_END + index * 4, origin: 'foro', destination: 'mirador', count: 3 },
    { time: CONCERT_END + index * 4, origin: 'foro', destination: 'talleres', count: 2 },
  ]).flat(),
  { time: 46, origin: 'central', destination: 'jardin', count: 4 },
  { time: 64, origin: 'faro', destination: 'central', count: 3 },
  { time: 78, origin: 'talleres', destination: 'mercado', count: 3 },
]

export function clock(seconds: number) {
  return '0' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0')
}
