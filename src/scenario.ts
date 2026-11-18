export type StationId = string
export type Station = { id: StationId; name: string; x: number; y: number }
export type StationIndex = Record<StationId, Station>

export const stations: readonly Station[] = [
  { id: 'muelle', name: 'Muelle Norte', x: 151, y: 131 },
  { id: 'foro', name: 'Foro del Río', x: 335, y: 154 },
  { id: 'mercado', name: 'Mercado', x: 216, y: 264 },
  { id: 'central', name: 'Central', x: 411, y: 282 },
  { id: 'jardin', name: 'Jardín Alto', x: 650, y: 126 },
  { id: 'talleres', name: 'Talleres', x: 113, y: 399 },
  { id: 'mirador', name: 'Mirador', x: 583, y: 376 },
  { id: 'faro', name: 'El Faro', x: 739, y: 300 },
]

export function stationIndex(stations: readonly Station[]): StationIndex {
  return Object.fromEntries(stations.map(station => [station.id, station]))
}

export const stationById = stationIndex(stations)
export const lines = [
  { id: 'L1', name: 'Ribera', color: '#e18a3a' },
  { id: 'L2', name: 'Altura', color: '#148677' },
  { id: 'L3', name: 'Bahía', color: '#8160a9' },
] as const
export type LineId = typeof lines[number]['id']
export type Route = { id: LineId; stops: StationId[] }

export const initialRoutes: Route[] = [
  { id: 'L1', stops: ['foro', 'mercado', 'central', 'talleres'] },
  { id: 'L2', stops: ['muelle', 'jardin', 'central', 'mirador', 'faro'] },
]

export function validStops(stops: StationId[], index = stationById) {
  return stops.length >= 2 && new Set(stops).size === stops.length &&
    stops.every(stop => Object.hasOwn(index, stop))
}
