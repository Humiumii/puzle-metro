import { createRoot } from 'react-dom/client'
import { lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { MetroMap, type MapProps } from './Map.tsx'
import { Results } from './Results.tsx'
import { CityTools, StationEditor, type Placement } from './CityEditor.tsx'
import { canPlace, CITY_KEY, encodeCity, initialStation, originalCity, readSavedCity, type City, type CityPoint } from './city.ts'
import { lines, stationIndex, validStops, type LineId, type Route, type StationId } from './scenario.ts'
import { createSimulation, requestRoute, SEATS, stats, step, trainPosition, type Simulation } from './engine.ts'
import { clock, CONCERT_END, DURATION } from './concert.ts'
import './style.css'

const Maquette = lazy(() => import('./Maquette.tsx').catch(() => ({
  default: ({ onFailure }: { onFailure: () => void }) => {
    useEffect(onFailure, [onFailure])
    return <></>
  },
})))

type GameAction = { type: 'step' } | { type: 'reset'; city: City } | { type: 'route'; route: Route }
const simulationFor = (city: City) => createSimulation(city.arrivals, city.routes, city.stations)

function gameReducer(state: Simulation, action: GameAction) {
  if (action.type === 'reset') return simulationFor(action.city)
  if (state.time >= DURATION) return state
  const next = structuredClone(state)
  if (action.type === 'route') requestRoute(next, action.route)
  else step(next)
  return next
}

function App() {
  const [savedCity, setSavedCity] = useState(readSavedCity)
  const [activeCity, setActiveCity] = useState(() => savedCity ?? originalCity())
  const [custom, setCustom] = useState(!!savedCity)
  const [cityDraft, setCityDraft] = useState<City | null>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [cityMessage, setCityMessage] = useState('')
  const [sim, dispatch] = useReducer(gameReducer, activeCity, simulationFor)
  const [routeDraft, setDraft] = useState<Route | null>(null)
  const [selected, setSelected] = useState<StationId>(() => initialStation(activeCity))
  const [following, setFollowing] = useState<LineId | null>(null)
  const [view, setView] = useState<'2d' | '3d'>('2d')
  const [sceneFailed, setSceneFailed] = useState(false)
  const onSceneFailure = useCallback(() => { setSceneFailed(true); setView('2d') }, [])
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
  const city = cityDraft ?? activeCity
  const stations = city.stations
  const stationById = stationIndex(stations)
  const trackedTrain = cityDraft ? undefined : sim.trains.find(train => train.route.id === following)
  const finished = !cityDraft && sim.time === DURATION
  const draft = finished ? null : routeDraft
  const routes = cityDraft?.routes ?? sim.trains.map(train => train.pending ?? train.route)
  const pending = cityDraft ? [] : sim.trains.flatMap(train => train.pending ?? [])
  const activeRoutes = cityDraft?.routes ?? sim.trains.map(train => train.route)
  const serving = activeRoutes.filter(route => route.stops.includes(selected))
  const concertLines = activeRoutes.filter(route => route.stops.includes('foro'))
  const available = lines.find(line => !routes.some(route => route.id === line.id))
  const canApply = draft !== null && validStops(draft.stops, stationById)
  const waiting = Object.fromEntries(stations.map(({ id }) => [id, cityDraft ? 0 : sim.queues[id].length]))
  const hotspots = stations.filter(({ id }) => waiting[id] > 0)
    .sort((a, b) => waiting[b.id] - waiting[a.id]).slice(0, 3)
  const destinations = stations.flatMap(station => {
    const count = cityDraft ? 0 : sim.queues[selected].filter(person => person.destination === station.id).length
    return count ? [{ ...station, count }] : []
  }).sort((a, b) => b.count - a.count)
  const concertEnded = sim.time >= CONCERT_END
  const hasConcert = city.arrivals.some(arrival => arrival.origin === 'foro' && arrival.time === CONCERT_END)

  useEffect(() => {
    if (!playing || finished || cityDraft) return
    const timer = window.setInterval(() => dispatch({ type: 'step' }), 1000 / speed)
    return () => window.clearInterval(timer)
  }, [playing, finished, speed, cityDraft])

  useEffect(() => {
    if (finished) resultHeading.current?.focus()
    if (!finished && replaying.current) {
      startButton.current?.focus()
      replaying.current = false
    }
  }, [finished])

  function edit(route: Route) {
    setPlacement(null)
    setCityMessage('')
    setDraft(route)
    mapBoard.current?.querySelector<HTMLElement>('.station.selected')?.focus()
  }

  function manageLines() {
    setPanelOpen(true)
    // The content must be visible before its first Edit button can receive focus.
    requestAnimationFrame(() => linePanel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus())
  }

  function chooseStation(id: StationId) {
    if (placement) return
    setSelected(id)
    if (!draft || finished) return
    const stops = draft.stops.includes(id) ? draft.stops.filter(stop => stop !== id) : [...draft.stops, id]
    setDraft({ ...draft, stops })
  }

  function apply() {
    if (!draft || !canApply || finished) return
    if (cityDraft) setCityDraft({ ...cityDraft, routes: [...cityDraft.routes.filter(route => route.id !== draft.id), draft]
      .sort((a, b) => a.id.localeCompare(b.id)) })
    else dispatch({ type: 'route', route: draft })
    setDraft(null)
  }

  function restart(replay = false) {
    if (finished) setPrevious(result)
    replaying.current = replay
    setPlaying(replay)
    setDraft(null)
    setSelected(initialStation(activeCity))
    setFollowing(null)
    setPanelOpen(false)
    dispatch({ type: 'reset', city: activeCity })
  }

  function editCity() {
    setPlaying(false)
    setDraft(null)
    setFollowing(null)
    setCityMessage('')
    setCityDraft(structuredClone(activeCity))
  }

  function exitCity() {
    setCityDraft(null)
    setPlacement(null)
    setDraft(null)
    setSelected(initialStation(activeCity))
  }

  function activateCity(next: City, isCustom: boolean, play = false) {
    exitCity()
    setActiveCity(next)
    setCustom(isCustom)
    setSelected(initialStation(next))
    setFollowing(null)
    setPrevious(null)
    setPlaying(play)
    dispatch({ type: 'reset', city: next })
  }

  function saveCity() {
    if (!cityDraft) return
    try {
      localStorage.setItem(CITY_KEY, encodeCity(cityDraft))
      setSavedCity(cityDraft)
      setCityMessage('Ciudad guardada en este navegador.')
    } catch {
      setCityMessage('No se pudo guardar en este navegador. Puedes jugar la ciudad de esta sesión.')
    }
  }

  function placePoint(point: CityPoint) {
    if (!cityDraft || !placement) return
    const next = { x: Math.round(point.x), y: Math.round(point.y) }
    if (!canPlace(cityDraft, next, placement.mode === 'move' ? selected : undefined)) {
      setCityMessage('Elige un punto dentro del plano y separado de otras estaciones.')
      return
    }
    setCityMessage('')
    setPlacement({ ...placement, point: next })
  }

  const map: MapProps = {
    stations, routes: activeRoutes, pending, draft, waiting, selected, following,
    markers: cityDraft ? [] : sim.trains.map(train => trainPosition(train, sim.stationById)),
    moving: playing && !finished && !cityDraft, onStation: chooseStation,
    onGround: placement ? placePoint : undefined, previewPoint: placement?.point ?? undefined,
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
        {cityDraft ? <span className="service-ended">Editando ciudad</span>
          : finished ? <span className="service-ended">Servicio finalizado</span> : <div className="transport">
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
      <div className={`layout ${finished ? 'has-result' : ''} ${cityDraft ? 'city-layout' : ''}`}>
        {!cityDraft && <Results result={result} previous={previous} finished={finished} headingRef={resultHeading} onReplay={() => restart(true)} />}
        <section className="board" ref={mapBoard}>
          <div className="bar exhibit-bar">
            <h2>Red de Puerto Niebla</h2>
            <div className="view-picker" aria-label="Vista de la red">
              <button aria-pressed={view === '2d'} onClick={() => setView('2d')}>Mapa 2D</button>
              <button aria-pressed={view === '3d'} onClick={() => { setSceneFailed(false); setView('3d') }}>Maqueta 3D</button>
            </div>
          </div>
          {sceneFailed && <p className="scene-message" role="status">No se pudo abrir WebGL. Puedes seguir en el mapa 2D.</p>}
          {cityDraft
            ? <CityTools city={cityDraft} placement={placement} editingRoute={!!draft} saved={!!savedCity} message={cityMessage}
              onPlace={value => { setCityMessage(''); setPlacement(value) }} onSave={saveCity}
              onPlay={() => activateCity(cityDraft, true, true)} onCancel={exitCity} />
            : <div className="city-launch">
              <span>{custom ? 'Ciudad editada' : 'Escenario del concierto'}</span>
              <button onClick={editCity}>Editar ciudad</button>
              {custom && <button onClick={() => activateCity(originalCity(), false)}>Escenario original</button>}
              {!custom && savedCity && <button onClick={() => activateCity(savedCity, true)}>Abrir ciudad guardada</button>}
            </div>}
          {!cityDraft && !finished && hasConcert && <div className={`mission ${concertEnded ? 'surge' : ''}`}>
            <div role="status" className="mission-message">
              {concertEnded
                ? <strong>Salida del concierto · Foro del Río</strong>
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
          {view === '3d' ? <Suspense fallback={<div className="scene-loading" role="status">Abriendo maqueta…</div>}>
            <Maquette map={map} onFailure={onSceneFailure} stopFollowing={() => setFollowing(null)} />
          </Suspense> : <MetroMap {...map} />}
          <div className="train-deck" aria-label="Seguimiento de trenes">
            {map.markers.length > 0 && <strong>Seguir tren</strong>}
            {map.markers.map(({id}) => <button key={id} aria-label={`Seguir tren ${id}`}
              aria-pressed={following === id} onClick={() => setFollowing(following === id ? null : id)}>{id}</button>)}
            {trackedTrain && <span>{trackedTrain.riders.length}/{SEATS} a bordo · Próxima parada:
              {' '}{stationById[trackedTrain.route.stops[trackedTrain.stop + trackedTrain.direction]].name}</span>}
            {!draft && !finished && <button className="deck-lines" onClick={manageLines}>Editar líneas</button>}
          </div>
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
            {cityDraft && !draft && <StationEditor key={selected} city={cityDraft} selected={selected} placement={placement}
              onPlace={value => { setCityMessage(''); setPlacement(value) }} onChange={setCityDraft}
              onSelect={setSelected} onMessage={setCityMessage} />}
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
              const train = cityDraft ? undefined : sim.trains.find(item => item.route.id === route.id)
              return <div className="line" key={route.id}>
                <div className="line-top"><span className="line-id" style={{ background: line.color }}>{line.id}</span><strong>{line.name}</strong>
                  <button aria-label={`Editar ${line.id}`} disabled={!!draft || finished} onClick={() => edit(route)}>Editar</button>
                </div>
                <p>{stationById[route.stops[0]].name} ↔ {stationById[route.stops[route.stops.length - 1]].name}</p>
                <p className="load">{route.stops.length} paradas{train && ` · ${train.riders.length}/${SEATS} a bordo`}{train?.pending ? ' · Cambio en próxima parada' : ''}</p>
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
              <p className="editor-endpoints">{draft.stops.map(stop => stationById[stop].name).join(' → ') || 'Selecciona la primera parada'}</p>
            </section>}
          </div>
        </aside>
      </div>
    </main>
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
