import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canPlace, decodeCity, encodeCity, originalCity, removeStation, updateDemand, type City } from './city.ts'
import { createSimulation, requestRoute, stats, step, trainPosition } from './engine.ts'

const courtyard = { id: 'patio', name: 'Patio de Bruma', x: 286, y: 348 }

test('round-trips a moved station and an edited route', () => {
  const city = originalCity()
  assert.equal(canPlace(city, courtyard), true)
  city.stations.push({ ...courtyard, x: 294 })
  city.routes[1].stops.push(courtyard.id)
  const configured = updateDemand(city, courtyard.id, 'faro', 16)
  assert.deepEqual(decodeCity(encodeCity(configured)), configured)
  assert.equal(decodeCity(encodeCity({ ...configured, routes: [{ id: 'L1', stops: ['unknown', 'faro'] }] })), null)
  assert.equal(decodeCity('{'), null)
})

test('deletion reconnects surviving neighbors and removes invalid lines and demand', () => {
  const city: City = originalCity()
  city.routes.push({ id: 'L3', stops: ['mercado', 'faro'] })
  const next = removeStation(city, 'mercado')
  assert.deepEqual(next.routes[0].stops, ['foro', 'central', 'talleres'])
  assert.equal(next.routes.some(route => route.id === 'L3'), false)
  assert.equal(next.arrivals.some(arrival => [arrival.origin, arrival.destination].includes('mercado')), false)
  assert.equal(city.stations.some(station => station.id === 'mercado'), true)
  assert.ok(decodeCity(encodeCity(next)))
})

test('a new station accumulates local demand before joining a train route', () => {
  const city = originalCity()
  city.stations.push(courtyard)
  const configured = updateDemand(updateDemand(city, courtyard.id, 'foro', 5), 'foro', courtyard.id, 4)
  const newDemand = configured.arrivals.filter(arrival => [arrival.origin, arrival.destination].includes(courtyard.id))
  const sim = createSimulation(newDemand, [], configured.stations)
  for (let tick = 0; tick < 24; tick++) step(sim)
  assert.equal(sim.queues[courtyard.id].length, 5)
  assert.equal(sim.queues.foro.length, 4)
  assert.equal(requestRoute(sim, { id: 'L3', stops: [courtyard.id, 'foro'] }), true)
  const { x, y } = trainPosition(sim.trains[0], sim.stationById)
  assert.deepEqual({ x, y }, { x: courtyard.x, y: courtyard.y })
  while (sim.time < 70) step(sim)
  assert.equal(stats(sim).arrived, 9)
  assert.equal(stats(sim).waiting, 0)
})
