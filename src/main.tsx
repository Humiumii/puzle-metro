import { createRoot } from 'react-dom/client'
import { useEffect, useReducer, useRef, useState } from 'react'
import { MetroMap } from './Map.tsx'
import { Results } from './Results.tsx'
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

function App() {
  const [sim, dispatch] = useReducer(gameReducer, demand, createSimulation)
  const [routeDraft, setDraft] = useState<Route | null>(null)
  const [selected, setSelected] = useState<StationId>('foro')
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(3)
  const [panelOpen, setPanelOpen] = useState(false)
  const [previous, setPrevious] = useState<ReturnType<typeof stats> | null>(null)
  const resultHeading = useRef<HTMLHeadingElement>(null)
  const startButton = useRef<HTMLButtonElement>(null)
  const linePanel = useRef<HTMLDivElement>(null)
  const mapBoard = useRef<HTMLElement>(null)
  const replaying = useRef(false)
  const result = stats(sim)
  const finished = sim.time === DURATION
  const draft = finished ? null : routeDraft
  const routes = sim.trains.map(train => train.pending ?? train.route)
  const pending = sim.trains.flatMap(train => train.pending ?? [])
  const activeRoutes = sim.trains.map(train => train.route)
  const serving = activeRoutes.filter(route => route.stops.includes(selected))
  const concertLines = activeRoutes.filter(route => route.stops.includes('foro'))
  const available = lines.find(line => !routes.some(route => route.id === line.id))
  const canApply = draft !== null && validStops(draft.stops)
  const waiting = Object.fromEntries(stations.map(({ id }) => [id, sim.queues[id].length]))
  const hotspots = stations.filter(({ id }) => waiting[id] > 0)
    .sort((a, b) => waiting[b.id] - waiting[a.id]).slice(0, 3)
  const destinations = stations.flatMap(station => {
    const count = sim.queues[selected].filter(person => person.destination === station.id).length
    return count ? [{ ...station, count }] : []
  }).sort((a, b) => b.count - a.count)
  const concertEnded = sim.time >= CONCERT_END

  useEffect(() => {
    if (!playing || finished) return
    const timer = window.setInterval(() => dispatch({ type: 'step' }), 1000 / speed)
    return () => window.clearInterval(timer)
  }, [playing, finished, speed])

  useEffect(() => {
    if (finished) resultHeading.current?.focus()
    if (!finished && replaying.current) {
      startButton.current?.focus()
      replaying.current = false
    }
  }, [finished])

  function edit(route: Route) {
    setDraft(route)
    mapBoard.current?.querySelector<HTMLElement>('.station.selected')?.focus()
  }

  function manageLines() {
    setPanelOpen(true)
    // The content must be visible before its first Edit button can receive focus.
    requestAnimationFrame(() => linePanel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus())
  }

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

  function restart(replay = false) {
    if (finished) setPrevious(result)
    replaying.current = replay
    setPlaying(replay)
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
        {finished ? <span className="service-ended">Servicio finalizado</span> : <div className="transport">
          <button ref={startButton} className="primary" onClick={() => setPlaying(!playing)}>
            {playing ? 'Pausar' : sim.time > 0 ? 'Reanudar' : 'Iniciar partida'}
          </button>
          <button onClick={() => restart()}>Reiniciar</button>
          <label className="speed">Velocidad <select value={speed} onChange={event => setSpeed(Number(event.target.value))}>
            <option value={1}>1×</option><option value={3}>3×</option><option value={6}>6×</option>
          </select></label>
        </div>}
        <progress className="timeline" aria-label="Tiempo de servicio" value={sim.time} max={DURATION} />
      </div>
      <div className={`layout ${finished ? 'has-result' : ''}`}>
        <Results result={result} previous={previous} finished={finished} headingRef={resultHeading} onReplay={() => restart(true)} />
        <section className="board" ref={mapBoard}>
          <div className="bar"><h2>Plano de la red</h2><span>{stations.length} estaciones · {routes.length} líneas</span></div>
          {!finished && <div className={`mission ${concertEnded ? 'surge' : ''}`}>
            <div role="status" className="mission-message">
              {concertEnded
                ? <strong>Terminó el concierto en Foro del Río</strong>
                : <><strong>Concierto en curso</strong><p>El público saldrá del Foro del Río en 00:{CONCERT_END}.</p></>}
            </div>
            {concertEnded && <div className="surge-data">
              <strong className="surge-count"><span aria-hidden="true">!</span> {waiting.foro} en espera</strong>
              {concertLines.map(route => <span key={route.id} className="line-id"
                style={{ background: lines.find(line => line.id === route.id)?.color }}>{route.id}</span>)}
              {concertLines.length === 0 && <small>Sin servicio</small>}
              {!draft && <button onClick={manageLines}>Ajustar líneas</button>}
            </div>}
          </div>}
          <MetroMap routes={activeRoutes} pending={pending} draft={draft} waiting={waiting}
            markers={sim.trains.map(trainPosition)} moving={playing && !finished} selected={selected} onStation={chooseStation} />
          <div className="legend">
            <span><i className="key stop" /> Estación</span>
            <span><i className="key picked" /> Selección</span>
            <span><i className="key transfer" /> Transbordo</span>
            <span><i className="key congestion" aria-hidden="true">!</i> 12+ en espera</span>
            <span><i className="key train" /> Tren</span>
            {draft && <>
              {activeRoutes.some(route => route.id === draft.id) && <span><i className="key current" /> {draft.id} actual</span>}
              <span><i className="key projected" /> {draft.id} propuesta</span>
            </>}
            {pending.length > 0 && <span><i className="key queued" /> Cambio pendiente</span>}
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
          {hotspots.length > 0 && <div className="hotspots">
              <strong>Más espera</strong>
              <ul>{hotspots.map(station => <li key={station.id}>{station.name} <b>{waiting[station.id]}</b></li>)}</ul>
          </div>}
        </section>
        <aside className="console">
          <div className="bar">
            <h2>Líneas <small>{routes.length}/3</small></h2>
            <button className="panel-toggle" aria-controls="line-panel" aria-expanded={panelOpen || !!draft}
              disabled={!!draft} onClick={() => setPanelOpen(!panelOpen)}>
              {panelOpen || draft ? 'Ocultar líneas' : 'Gestionar líneas'}
            </button>
          </div>
          <div id="line-panel" ref={linePanel} className={`panel ${panelOpen || draft ? 'panel-open' : ''}`}>
            {routes.map(route => {
              const line = lines.find(item => item.id === route.id)!
              const train = sim.trains.find(item => item.route.id === route.id)!
              return <div className="line" key={route.id}>
                <div className="line-top"><span className="line-id" style={{ background: line.color }}>{line.id}</span><strong>{line.name}</strong>
                  <button aria-label={`Editar ${line.id}`} disabled={!!draft || finished} onClick={() => edit(route)}>Editar</button>
                </div>
                <p>{stationById[route.stops[0]].name} ↔ {stationById[route.stops[route.stops.length - 1]].name}</p>
                <p className="load">{route.stops.length} paradas · {train.riders.length}/{SEATS} a bordo{train.pending ? ' · Cambio en próxima parada' : ''}</p>
              </div>
            })}
            {!draft && !finished && <button className="wide" disabled={!available} onClick={() => available && edit({ id: available.id, stops: [] })}>+ Nueva línea</button>}
            {draft && <section className="editor" aria-labelledby="editor-title">
              <h3 id="editor-title">Propuesta {draft.id}</h3>
              <p>Selecciona estaciones en el plano para añadirlas o quitarlas. Se necesitan al menos dos.</p>
              {draft.stops.length > 0 && <ol role="list" className="stop-list">{draft.stops.map((stop, index) =>
                <li key={stop}><b aria-hidden="true">{index + 1}</b>{stationById[stop].name}</li>)}</ol>}
              <button className="clear-route" disabled={!draft.stops.length} onClick={() => setDraft({ ...draft, stops: [] })}>Vaciar recorrido</button>
              <div className="actions editor-actions">
                <strong>{draft.id} <small>{draft.stops.length} paradas</small></strong>
                <button onClick={() => setDraft(null)}>Cancelar</button>
                <button className="primary" disabled={!canApply} onClick={apply}>Aplicar ruta</button>
              </div>
            </section>}
          </div>
        </aside>
      </div>
    </main>
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
