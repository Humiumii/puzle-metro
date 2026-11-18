import { createRoot } from 'react-dom/client'
import { useEffect, useReducer, useState } from 'react'
import { MetroMap } from './Map.tsx'
import { lines, stations, stationById, validStops, type Route, type StationId } from './scenario.ts'
import { createSimulation, requestRoute, SEATS, stats, step, trainPosition, type Simulation } from './engine.ts'
import { clock, CONCERT_END, demand, DURATION } from './concert.ts'
import './style.css'

type GameAction = { type: 'step' | 'reset' } | { type: 'route'; route: Route }

function gameReducer(state: Simulation, action: GameAction) {
  if (action.type === 'reset') return createSimulation(demand)
  if (state.time >= DURATION) return state
  const next = structuredClone(state)
  if (action.type === 'route') requestRoute(next, action.route)
  else step(next)
  return next
}

const formatWait = (seconds: number | null) =>
  seconds === null ? '—' : seconds.toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' s'

function App() {
  const [sim, dispatch] = useReducer(gameReducer, demand, createSimulation)
  const [draft, setDraft] = useState<Route | null>(null)
  const [selected, setSelected] = useState<StationId>('foro')
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(3)
  const [panelOpen, setPanelOpen] = useState(false)
  const [previous, setPrevious] = useState<ReturnType<typeof stats> | null>(null)
  const result = stats(sim)
  const finished = sim.time === DURATION
  const routes = sim.trains.map(train => train.pending ?? train.route)
  const pending = sim.trains.flatMap(train => train.pending ?? [])
  const activeRoutes = sim.trains.map(train => train.route)
  const serving = activeRoutes.filter(route => route.stops.includes(selected))
  const available = lines.find(line => !routes.some(route => route.id === line.id))
  const canApply = draft !== null && validStops(draft.stops)
  const waiting = Object.fromEntries(stations.map(({ id }) => [id, sim.queues[id].length]))
  const hotspots = stations.filter(({ id }) => waiting[id] > 0)
    .sort((a, b) => waiting[b.id] - waiting[a.id]).slice(0, 3)
  const destinations = stations.flatMap(station => {
    const count = sim.queues[selected].filter(person => person.destination === station.id).length
    return count ? [{ ...station, count }] : []
  }).sort((a, b) => b.count - a.count)
  const phase = finished ? 'Servicio finalizado' : sim.time >= CONCERT_END ? 'Terminó el concierto' : 'Concierto en curso'

  useEffect(() => {
    if (!playing || finished) return
    const timer = window.setInterval(() => dispatch({ type: 'step' }), 1000 / speed)
    return () => window.clearInterval(timer)
  }, [playing, finished, speed])

  function chooseStation(id: StationId) {
    setSelected(id)
    if (!draft || finished) return
    const stops = draft.stops.includes(id) ? draft.stops.filter(stop => stop !== id) : [...draft.stops, id]
    setDraft({ ...draft, stops })
  }

  function apply() {
    if (!draft || !canApply || finished) return
    dispatch({ type: 'route', route: draft })
    setDraft(null)
  }

  function restart() {
    if (finished) setPrevious(result)
    setPlaying(false)
    setDraft(null)
    setSelected('foro')
    setPanelOpen(false)
    dispatch({ type: 'reset' })
  }

  return <>
    <header className="mast">
      <div className="wrap brand">
        <span className="symbol" aria-hidden="true">PN</span>
        <div><p>Metro Puerto Niebla</p><h1>Último bis</h1></div>
      </div>
    </header>
    <main className="wrap game">
      <div className="service">
        <div className="service-time">
          <span>Tiempo de servicio</span>
          <strong className="clock">{clock(sim.time)} <small>/ {clock(DURATION)}</small></strong>
        </div>
        <div className="transport">
          <button className="primary" disabled={finished} onClick={() => setPlaying(!playing)}>
            {playing && !finished ? 'Pausar' : sim.time > 0 ? 'Reanudar' : 'Iniciar partida'}
          </button>
          <button onClick={restart}>Reiniciar</button>
          <label className="speed">Velocidad <select value={speed} onChange={event => setSpeed(Number(event.target.value))}>
            <option value={1}>1×</option><option value={3}>3×</option><option value={6}>6×</option>
          </select></label>
        </div>
        <progress className="timeline" aria-label="Tiempo de servicio" value={sim.time} max={DURATION} />
      </div>
      <div className="layout">
        <section className="board">
          <div className="bar"><h2>Plano de la red</h2><span>{stations.length} estaciones · {routes.length} líneas</span></div>
          <MetroMap routes={activeRoutes} pending={pending} draft={draft} waiting={waiting}
            markers={sim.trains.map(trainPosition)} moving={playing && !finished} selected={selected} onStation={chooseStation} />
          <div className="legend">
            <span><i className="key stop" /> Estación</span>
            <span><i className="key picked" /> Selección</span>
            <span><i className="key transfer" /> Transbordo</span>
            <span><i className="key congestion" aria-hidden="true">!</i> 12+ en espera</span>
            <span><i className="key train" /> Tren</span>
            {(draft || pending.length > 0) && <span><i className="key projected" /> Ruta propuesta</span>}
          </div>
          <section className="station-info" aria-labelledby="station-title">
            <div className="station-readout">
              <h3 id="station-title">{stationById[selected].name}</h3>
              {serving.map(route => <span key={route.id} className="line-id"
                style={{ background: lines.find(line => line.id === route.id)?.color }}>{route.id}</span>)}
              <strong className="station-wait">{waiting[selected]} en espera</strong>
            </div>
            {destinations.length > 0 && <ul className="destinations">{destinations.map(station =>
              <li key={station.id}><span>{station.name}</span><b>{station.count}</b></li>)}</ul>}
          </section>
          <div className={`mission ${sim.time >= CONCERT_END && !finished ? 'surge' : ''}`}>
            <div role="status"><strong>{phase}</strong>
              <p>{finished ? 'Reinicia para comparar con otra red y las mismas llegadas.'
                : sim.time >= CONCERT_END ? 'Revisa los destinos de la cola y ajusta la red para aliviar el Foro.'
                : `El público empezará a salir a los ${CONCERT_END} segundos de servicio.`}</p>
            </div>
            {hotspots.length > 0 && <div className="hotspots">
              <strong>Más espera</strong>
              <ul>{hotspots.map(station => <li key={station.id}>{station.name} <b>{waiting[station.id]}</b></li>)}</ul>
            </div>}
          </div>
        </section>
        <section className="results" aria-labelledby="results-title">
            <h2 id="results-title">{finished ? 'Resumen de la partida' : 'Pasajeros'}</h2>
            <dl>
              <div><dt>Llegaron</dt><dd>{result.arrived}</dd></div>
              <div><dt>En espera</dt><dd>{result.waiting}</dd></div>
              <div><dt>A bordo</dt><dd>{result.aboard}</dd></div>
              <div><dt>Espera media al llegar</dt><dd>{formatWait(result.averageWait)}</dd></div>
            </dl>
            {finished && previous && <p className="comparison">Partida anterior: {previous.arrived} llegaron, {previous.waiting} en espera,
              {' '}{previous.aboard} a bordo y {formatWait(previous.averageWait)} de espera media.</p>}
        </section>
        <aside className="console">
          <div className="bar">
            <h2>Líneas <small>{routes.length}/3</small></h2>
            <button className="panel-toggle" aria-controls="line-panel" aria-expanded={panelOpen || !!draft}
              disabled={!!draft} onClick={() => setPanelOpen(!panelOpen)}>
              {panelOpen || draft ? 'Ocultar líneas' : 'Gestionar líneas'}
            </button>
          </div>
          <div id="line-panel" className={`panel ${panelOpen || draft ? 'panel-open' : ''}`}>
            {routes.map(route => {
              const line = lines.find(item => item.id === route.id)!
              const train = sim.trains.find(item => item.route.id === route.id)!
              return <div className="line" key={route.id}>
                <div className="line-top"><span className="line-id" style={{ background: line.color }}>{line.id}</span><strong>{line.name}</strong>
                  <button aria-label={`Editar ${line.id}`} disabled={!!draft || finished} onClick={() => setDraft(route)}>Editar</button>
                </div>
                <p>{stationById[route.stops[0]].name} ↔ {stationById[route.stops[route.stops.length - 1]].name}</p>
                <p className="load">{route.stops.length} paradas · {train.riders.length}/{SEATS} a bordo{train.pending ? ' · Cambio en próxima parada' : ''}</p>
              </div>
            })}
            {(!draft || finished) && <button className="wide" disabled={!available || finished} onClick={() => available && setDraft({ id: available.id, stops: [] })}>+ Nueva línea</button>}
            {draft && !finished && <div className="editor">
              <h3>Recorrido de {draft.id}</h3>
              <p>Elige estaciones en orden. Pulsa una parada marcada para quitarla.</p>
              {draft.stops.length > 0 && <ol>{draft.stops.map(stop => <li key={stop}>{stationById[stop].name}</li>)}</ol>}
              <div className="actions">
                <button disabled={!draft.stops.length} onClick={() => setDraft({ ...draft, stops: [] })}>Vaciar</button>
                <button onClick={() => setDraft(null)}>Cancelar</button>
                <button className="primary" disabled={!canApply} onClick={apply}>Aplicar ruta</button>
              </div>
            </div>}
          </div>
        </aside>
      </div>
    </main>
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
