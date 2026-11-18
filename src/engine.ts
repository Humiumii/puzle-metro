import { initialRoutes, lines, stations, stationById, validStops, type LineId, type Route, type StationId } from './scenario.ts'

export const STEP_SECONDS = 1
export const SEATS = 12

export type Arrival = { time: number; origin: StationId; destination: StationId; count: number }
type Passenger = { id: number; destination: StationId; wait: number; transfers: number; rides: number }
type Rider = { passenger: Passenger; exit: StationId }
type Train = {
  route: Route
  pending: Route | null
  stop: number
  direction: 1 | -1
  elapsed: number
  dwell: number
  riders: Rider[]
}
export type Simulation = {
  time: number
  queues: Record<StationId, Passenger[]>
  trains: Train[]
  completed: Passenger[]
  arrivals: Arrival[]
  cursor: number
  generated: number
}

function makeTrain(route: Route, stop = 0): Train {
  return { route, pending: null, stop, direction: stop === route.stops.length - 1 ? -1 : 1,
    elapsed: 0, dwell: 2, riders: [] }
}

export function createSimulation(arrivals: Arrival[], routes = initialRoutes): Simulation {
  const queues = Object.fromEntries(stations.map(({ id }): [StationId, Passenger[]] => [id, []])) as Simulation['queues']
  return {
    time: 0, queues, trains: routes.map(route => makeTrain({ ...route, stops: [...route.stops] })),
    completed: [], arrivals: [...arrivals].sort((a, b) => a.time - b.time), cursor: 0, generated: 0,
  }
}

export function requestRoute(sim: Simulation, route: Route) {
  if (!lines.some(line => line.id === route.id) || !validStops(route.stops)) return false
  const train = sim.trains.find(item => item.route.id === route.id)
  const next = { id: route.id, stops: [...route.stops] }
  if (!train) {
    sim.trains.push(makeTrain(next))
  } else {
    train.pending = train.route.stops.join() === next.stops.join() ? null : next
  }
  return true
}

function travelTime(from: StationId, to: StationId) {
  const a = stationById[from]
  const b = stationById[to]
  return Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 24)
}

type Leg = { line: LineId; exit: StationId; direction: number; cost: number }

function leg(route: Route, from: StationId, to: StationId): Leg | undefined {
  const start = route.stops.indexOf(from)
  const end = route.stops.indexOf(to)
  if (start < 0 || end < 0 || start === end) return
  let cost = 0
  for (let index = Math.min(start, end); index < Math.max(start, end); index++) {
    cost += travelTime(route.stops[index], route.stops[index + 1]) + 2
  }
  return { line: route.id, exit: to, direction: Math.sign(end - start), cost }
}

function firstLeg(routes: Route[], from: StationId, to: StationId, transfers: number) {
  const direct = routes.flatMap(route => leg(route, from, to) ?? []).sort((a, b) => a.cost - b.cost)
  if (direct.length || transfers >= 1) return direct
  const connecting: Leg[] = []
  for (const route of routes) {
    for (const interchange of route.stops) {
      const first = leg(route, from, interchange)
      if (!first) continue
      for (const other of routes) {
        if (route.id === other.id) continue
        const second = leg(other, interchange, to)
        if (second) connecting.push({ ...first, cost: first.cost + second.cost })
      }
    }
  }
  connecting.sort((a, b) => a.cost - b.cost)
  return connecting.slice(0, 1)
}

export function trainPosition(train: Train) {
  const from = stationById[train.route.stops[train.stop]]
  const to = stationById[train.route.stops[train.stop + train.direction]]
  const progress = train.elapsed / travelTime(from.id, to.id)
  return {
    id: train.route.id,
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    angle: Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI,
  }
}

function unload(sim: Simulation, train: Train, force: boolean) {
  const station = train.route.stops[train.stop]
  train.riders = train.riders.filter(({ passenger, exit }) => {
    if (passenger.destination === station) sim.completed.push(passenger)
    else if (force || exit === station) {
      // A service change is an interruption, not a planned transfer.
      if (!force) passenger.transfers++
      sim.queues[station].push(passenger)
    } else return true
    return false
  })
}

export function step(sim: Simulation) {
  sim.time += STEP_SECONDS
  for (const queue of Object.values(sim.queues)) {
    for (const passenger of queue) passenger.wait += STEP_SECONDS
  }

  while (sim.cursor < sim.arrivals.length && sim.arrivals[sim.cursor].time <= sim.time) {
    const arrival = sim.arrivals[sim.cursor++]
    for (let index = 0; index < arrival.count; index++) {
      const passenger: Passenger = { id: ++sim.generated, destination: arrival.destination, wait: 0, transfers: 0, rides: 0 }
      if (arrival.origin === arrival.destination) sim.completed.push(passenger)
      else sim.queues[arrival.origin].push(passenger)
    }
  }

  for (const [index, train] of sim.trains.entries()) {
    if (train.dwell === 0) {
      train.elapsed++
      const duration = travelTime(train.route.stops[train.stop], train.route.stops[train.stop + train.direction])
      if (train.elapsed < duration) continue
      train.stop += train.direction
      if (train.stop === 0 || train.stop === train.route.stops.length - 1) train.direction *= -1
      train.elapsed = 0
      train.dwell = 2
    }

    if (train.pending) {
      const station = train.route.stops[train.stop]
      unload(sim, train, true)
      sim.trains[index] = makeTrain(train.pending, Math.max(0, train.pending.stops.indexOf(station)))
    } else {
      unload(sim, train, false)
    }
  }

  const routes = sim.trains.filter(train => !train.pending).map(train => train.route)
  for (const train of sim.trains) {
    if (train.dwell === 0) continue
    const station = train.route.stops[train.stop]
    sim.queues[station] = sim.queues[station].filter(passenger => {
      if (train.riders.length >= SEATS) return true
      const option = firstLeg(routes, station, passenger.destination, passenger.transfers)
        .find(candidate => candidate.line === train.route.id && candidate.direction === train.direction)
      if (!option) return true
      passenger.rides++
      train.riders.push({ passenger, exit: option.exit })
      return false
    })
    train.dwell--
  }
}

export function stats(sim: Simulation) {
  const arrived = sim.completed.length
  return {
    arrived,
    waiting: Object.values(sim.queues).reduce((sum, queue) => sum + queue.length, 0),
    aboard: sim.trains.reduce((sum, train) => sum + train.riders.length, 0),
    averageWait: arrived ? sim.completed.reduce((sum, passenger) => sum + passenger.wait, 0) / arrived : null,
  }
}
