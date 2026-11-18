import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { MetroMap } from './Map.tsx'
import { initialRoutes, lines, stationById, validStops, type Route, type StationId } from './scenario.ts'
import './style.css'

function App() {
  const [routes, setRoutes] = useState(initialRoutes)
  const [draft, setDraft] = useState<Route | null>(null)
  const [selected, setSelected] = useState<StationId>('foro')
  const available = lines.find(line => !routes.some(route => route.id === line.id))
  const canApply = draft !== null && validStops(draft.stops)

  function chooseStation(id: StationId) {
    setSelected(id)
    if (!draft) return
    const stops = draft.stops.includes(id) ? draft.stops.filter(stop => stop !== id) : [...draft.stops, id]
    setDraft({ ...draft, stops })
  }

  function apply() {
    if (!draft || !canApply) return
    setRoutes([...routes.filter(route => route.id !== draft.id), draft].sort((a, b) => a.id.localeCompare(b.id)))
    setDraft(null)
  }

  return <>
    <header className="mast"><div className="wrap brand"><span className="symbol" aria-hidden="true">PN</span><span>Metro Puerto Niebla</span></div></header>
    <main className="wrap">
      <div className="intro">
        <div><h1>Último bis</h1><p>Cuando termine el concierto, lleva al público del Foro del Río a casa.</p></div>
      </div>
      <div className="layout">
        <section className="board">
          <div className="bar"><h2>Mapa de la red</h2><span>8 estaciones</span></div>
          <MetroMap routes={routes} draft={draft} waiting={{}} markers={[]} selected={selected} onStation={chooseStation} />
          <div className="legend"><span>◉ Transbordo</span><span>◌ Recorrido propuesto</span></div>
        </section>
        <aside className="console">
          <div className="bar"><h2>Líneas</h2><b>{routes.length}/3</b></div>
          <div className="panel">
            {routes.map(route => {
              const line = lines.find(item => item.id === route.id)!
              return <div className="line" key={route.id}>
                <div className="line-top"><span className="line-id" style={{ background: line.color }}>{line.id}</span><strong>{line.name}</strong>
                  <button aria-label={`Editar ${line.id}`} disabled={!!draft} onClick={() => setDraft(route)}>Editar</button>
                </div>
                <p>{route.stops.map(stop => stationById[stop].name).join(' → ')}</p>
              </div>
            })}
            {!draft && <button className="wide" disabled={!available} onClick={() => available && setDraft({ id: available.id, stops: [] })}>+ Nueva línea</button>}
            {draft && <div className="editor">
              <h3>Recorrido de {draft.id}</h3>
              <p>Elige estaciones en orden. Pulsa una parada marcada para quitarla.</p>
              <ol>{draft.stops.map(stop => <li key={stop}>{stationById[stop].name}</li>)}</ol>
              <div className="actions">
                <button onClick={() => setDraft(null)}>Cancelar</button>
                <button className="primary" disabled={!canApply} onClick={apply}>Aplicar ruta</button>
              </div>
            </div>}
          </div>
          <div className="station-info"><h3>{stationById[selected].name}</h3><p>{selected === 'foro' ? 'Acceso al recinto de conciertos.' : 'Estación de Puerto Niebla.'}</p></div>
        </aside>
      </div>
    </main>
  </>
}

createRoot(document.getElementById('root')!).render(<App />)
