import type { CSSProperties } from 'react'
import { lines, stations, stationById, type Route, type StationId } from './scenario.ts'

export type Marker = { id: Route['id']; x: number; y: number; angle: number }

function proposedPath(stops: StationId[]) {
  return stops.slice(1).map((id, index) => {
    const from = stationById[stops[index]]
    const to = stationById[id]
    const dx = to.x - from.x
    const dy = to.y - from.y
    const offset = (dx < 0 ? 12 : -12) / Math.hypot(dx, dy)
    return `M${from.x - dy * offset} ${from.y + dx * offset} L${to.x - dy * offset} ${to.y + dx * offset}`
  }).join(' ')
}

export function MetroMap({ routes, pending, draft, waiting, selected, markers, moving, onStation }: {
  routes: Route[]
  pending: Route[]
  draft: Route | null
  waiting: Partial<Record<StationId, number>>
  selected: StationId
  markers: Marker[]
  moving: boolean
  onStation: (id: StationId) => void
}) {
  const previewPath = draft ? proposedPath(draft.stops) : ''
  return <div className={`map ${moving ? 'map-moving' : ''}`}>
      <svg viewBox="0 0 850 488" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id="blocks" width="37" height="31" patternTransform="rotate(-14)" patternUnits="userSpaceOnUse">
            <rect x="3" y="3" width="30" height="24" rx="3" fill="#dce4db" />
          </pattern>
          <pattern id="water" width="29" height="22" patternUnits="userSpaceOnUse">
            <path d="M3 13h12m4-6h6" stroke="#adc9c5" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="850" height="488" fill="#edf0e6" />
        <path d="M0 35 218 0h189l-7 193-188 96L0 253Z M0 325l201-52 210 68-11 147H0Z M507 0h343v358l-200 116-144-53-18-155Z" fill="url(#blocks)" />
        <path d="M491-40C413 58 553 163 471 274S413 432 465 520" fill="none" stroke="#a7c5bf" strokeWidth="97" />
        <path d="M491-40C413 58 553 163 471 274S413 432 465 520" fill="none" stroke="#bdd4cd" strokeWidth="92" />
        <path d="M491-40C413 58 553 163 471 274S413 432 465 520" fill="none" stroke="url(#water)" strokeWidth="88" />
        <path d="M545 64l51-34 82 4 50 43-42 14-91-5Z M657 389l82-38 68 25-3 57-80 31-68-29Z" fill="#d0dfc3" stroke="#bfcfb3" />
        <g className="map-label">
          <text x="38" y="45">RIBERA OESTE</text>
          <text x="688" y="45">BAHÍA ESTE</text>
          <text x="449" y="374" transform="rotate(-74 449 374)">RÍO BRUMA</text>
          <text x="596" y="70">Parque del Viento</text>
          <text x="693" y="423">Reserva del Faro</text>
        </g>
        <g transform="translate(335 69)" className="venue">
          <path d="M0 26v59" stroke="#8c6149" strokeWidth="2" strokeDasharray="3 5" />
          <path d="M-28-13-15-24h30l13 11v28L15 26h-30l-13-11Z" fill="#fce0ba" stroke="#a2643d" strokeWidth="2" />
          <path d="M-8 10V-9l19-4V6m-19-8 19-4" fill="none" stroke="#663b27" strokeWidth="3" />
          <ellipse cx="-12" cy="10" rx="5" ry="3.5" fill="#663b27" />
          <ellipse cx="7" cy="6" rx="5" ry="3.5" fill="#663b27" />
        </g>
        {routes.map(route => {
          const color = lines.find(line => line.id === route.id)?.color
          return <g key={route.id} className={`active-rail ${draft && draft.id !== route.id ? 'other-rail' : ''}`}>
            {route.stops.slice(1).map((id, index) => {
              const from = stationById[route.stops[index]]
              const to = stationById[id]
              const segment = { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
              // Draw each casing immediately under its rail so even a self-crossing reads as an overpass.
              return <g key={id}>
                <line {...segment} className="rail-bed" />
                <line {...segment} className="rail" stroke={color} />
              </g>
            })}
          </g>
        })}
        {pending.map(route => <path key={route.id} d={proposedPath(route.stops)} className="rail queued-rail" />)}
        {draft && <g className="route-preview" data-line={draft.id}>
          <path d={previewPath} className="rail preview-bed" />
          <path d={previewPath} className="rail preview-rail" />
        </g>}
      </svg>
      {markers.map(marker => <span key={marker.id} className="train-marker" aria-hidden="true"
        style={{ '--x': marker.x / 8.5 + '%', '--y': marker.y / 4.88 + '%',
          '--heading': marker.angle + 'deg', '--line': lines.find(line => line.id === marker.id)?.color } as CSSProperties}>
        <i /><b>{marker.id}</b>
      </span>)}
      {stations.map(station => {
        const count = waiting[station.id] ?? 0
        const order = draft?.stops.indexOf(station.id) ?? -1
        const interchange = routes.filter(route => route.stops.includes(station.id)).length > 1
        return <button key={station.id}
          className={`station ${count >= 12 ? 'crowded' : ''} ${interchange ? 'interchange' : ''} ${selected === station.id ? 'selected' : ''} ${order >= 0 ? 'proposed-stop' : ''}`}
          data-station={station.id}
          style={{ '--x': station.x / 8.5 + '%', '--y': station.y / 4.88 + '%' } as CSSProperties}
          aria-label={`${station.name}, ${count} en espera${interchange ? ', transbordo' : ''}${order >= 0 ? `, parada ${order + 1}` : ''}`}
          aria-pressed={draft ? order >= 0 : selected === station.id}
          onClick={() => onStation(station.id)}>
          <span className="station-dot">{order >= 0 ? order + 1 : ''}</span>
          {count > 0 && <span className="count" aria-hidden="true">{count >= 12 && <b>!</b>}{count}</span>}
          <span className="station-name">{station.name}</span>
        </button>
      })}
  </div>
}
