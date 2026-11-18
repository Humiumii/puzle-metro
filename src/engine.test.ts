import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSimulation, requestRoute, SEATS, stats, step } from './engine.ts'
import type { Route } from './scenario.ts'

const routes: Route[] = [
  { id: 'L1', stops: ['foro', 'central'] },
  { id: 'L2', stops: ['central', 'faro'] },
]

test('reaches the destination with a transfer between two trains', () => {
  const sim = createSimulation([{ time: 1, origin: 'foro', destination: 'faro', count: 1 }], routes)
  while (sim.time < 80) step(sim)
  assert.equal(stats(sim).arrived, 1)
  assert.equal(sim.completed[0].rides, 2)
  assert.equal(sim.completed[0].transfers, 1)
})

test('a full train leaves people in the station queue', () => {
  const sim = createSimulation([{ time: 1, origin: 'foro', destination: 'central', count: SEATS + 3 }], routes)
  step(sim)
  assert.equal(sim.trains[0].riders.length, SEATS)
  assert.deepEqual(sim.queues.foro.map(person => person.id), [13, 14, 15])
  while (sim.time < 50) step(sim)
  assert.equal(stats(sim).arrived, SEATS + 3)
})

test('editing a moving train preserves each passenger exactly once', () => {
  const sim = createSimulation([{ time: 1, origin: 'foro', destination: 'faro', count: 5 }], routes)
  for (let tick = 0; tick < 3; tick++) step(sim)
  assert.equal(sim.trains[0].riders.length, 5)
  assert.equal(sim.trains[0].elapsed, 1)
  assert.equal(requestRoute(sim, { id: 'L1', stops: ['foro', 'faro'] }), true)
  assert.equal(sim.trains[0].route.stops[1], 'central')
  while (sim.time < 80) {
    step(sim)
    const people = [...sim.completed, ...Object.values(sim.queues).flat(),
      ...sim.trains.flatMap(train => train.riders.map(rider => rider.passenger))]
    assert.deepEqual(people.map(person => person.id).sort(), [1, 2, 3, 4, 5])
  }
  assert.equal(sim.trains[0].route.stops[1], 'faro')
  assert.equal(stats(sim).arrived, 5)
})

test('an unreachable destination stays in queue until connected', () => {
  const sim = createSimulation([{ time: 1, origin: 'foro', destination: 'faro', count: 1 }], [routes[0]])
  for (let tick = 0; tick < 12; tick++) step(sim)
  assert.equal(stats(sim).waiting, 1)
  requestRoute(sim, routes[1])
  while (sim.time < 60) step(sim)
  assert.equal(stats(sim).arrived, 1)
})
