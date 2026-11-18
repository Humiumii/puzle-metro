import { demand, DURATION } from './concert.ts'
import type { Arrival } from './engine.ts'
import { initialRoutes, lines, stations, stationIndex, validStops, type Route, type Station, type StationId } from './scenario.ts'

export type City = { stations: Station[]; routes: Route[]; arrivals: Arrival[] }
export type CityPoint = Pick<Station, 'x' | 'y'>
export const CITY_KEY = 'puerto-niebla.city.v1'
export const CUSTOM_ARRIVAL = 24
export const CITY_LIMIT = 24

export function originalCity(): City {
  return structuredClone({ stations: [...stations], routes: initialRoutes, arrivals: demand })
}

export function initialStation(city: City): StationId {
  return city.stations.find(station => station.id === 'foro')?.id ?? city.stations[0].id
}

function withinCity({ x, y }: CityPoint) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 52 && x <= 798 && y >= 43 && y <= 440
}

export function canPlace(city: City, point: CityPoint, ignore?: StationId) {
  return withinCity(point) && city.stations.every(station => station.id === ignore ||
    Math.hypot(station.x - point.x, station.y - point.y) >= 43)
}

export function removeStation(city: City, id: StationId): City {
  if (city.stations.length <= 2) return city
  return {
    stations: city.stations.filter(station => station.id !== id),
    routes: city.routes.map(route => ({ ...route, stops: route.stops.filter(stop => stop !== id) }))
      .filter(route => route.stops.length >= 2),
    arrivals: city.arrivals.filter(arrival => arrival.origin !== id && arrival.destination !== id),
  }
}

export function updateDemand(city: City, origin: StationId, destination: StationId, count: number): City {
  const index = stationIndex(city.stations)
  if (!Object.hasOwn(index, origin) || !Object.hasOwn(index, destination) || origin === destination ||
      !Number.isSafeInteger(count) || count < 0 || count > 72) return city
  const arrivals = city.arrivals.filter(arrival =>
    arrival.time !== CUSTOM_ARRIVAL || arrival.origin !== origin || arrival.destination !== destination)
  if (count > 0) arrivals.push({ time: CUSTOM_ARRIVAL, origin, destination, count })
  return { ...city, arrivals }
}

export function encodeCity(city: City) {
  return JSON.stringify({ version: 1, ...city })
}

export function decodeCity(raw: string | null): City | null {
  if (!raw) return null
  try {
    const city = JSON.parse(raw) as Partial<City> & { version?: number }
    if (city.version !== 1 || !Array.isArray(city.stations) || !Array.isArray(city.routes) || !Array.isArray(city.arrivals)) return null
    const { stations, routes, arrivals } = city
    if (stations.length < 2 || stations.length > CITY_LIMIT ||
        !stations.every(station => station && typeof station.id === 'string' && /^[a-zA-Z0-9-]{1,60}$/.test(station.id) &&
          typeof station.name === 'string' && station.name.trim().length > 0 && station.name.length <= 28 && withinCity(station))) return null
    const index = stationIndex(stations)
    if (Object.keys(index).length !== stations.length) return null
    if (routes.length > lines.length || !routes.every(route => route && lines.some(line => line.id === route.id) &&
          Array.isArray(route.stops) && validStops(route.stops, index)) ||
        new Set(routes.map(route => route.id)).size !== routes.length) return null
    if (arrivals.length > 576 || !arrivals.every(arrival => arrival && Object.hasOwn(index, arrival.origin) &&
          Object.hasOwn(index, arrival.destination) && arrival.origin !== arrival.destination &&
          Number.isSafeInteger(arrival.time) && arrival.time >= 1 && arrival.time <= DURATION &&
          Number.isSafeInteger(arrival.count) && arrival.count > 0 && arrival.count <= 72)) return null
    return { stations, routes, arrivals }
  } catch {
    return null
  }
}

export function readSavedCity() {
  try {
    return decodeCity(localStorage.getItem(CITY_KEY))
  } catch {
    return null
  }
}
