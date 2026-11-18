import type { CSSProperties } from 'react'
import { lines, stations, stationById, type Route, type StationId } from './scenario.ts'

export type Marker = { id: Route['id']; x: number; y: number; angle: number }

function pathFor(stops: StationId[]) {
  return stops.map((id, index) => {
    const { x, y } = stationById[id]
    return (index ? 'L' : 'M') + x + ' ' + y
  }).join(' ')
}

export function MetroMap({ routes, pending, draft, waiting, selected, markers, onStation }: {
  routes: Route[]
  pending: Route[]
  draft: Route | null
  waiting: Partial<Record<StationId, number>>
  selected: StationId
  markers: Marker[]
  onStation: (id: StationId) => void
}) {
  return <div className="map-scroll">
    <div className="map">
      <svg viewBox="0 0 850 488" aria-hidden="true">
        <defs>
          <pattern id="blocks" width="37" height="31" patternTransform="rotate(-14)" patternUnits="userSpaceOnUse">
            <rect x="3" y="3" width="30" height="24" rx="3" fill="#e0e5d7" />
          </pattern>
          <pattern id="water" width="29" height="22" patternUnits="userSpaceOnUse">
            <path d="M3 13h12m4-6h6" stroke="#adc9c5" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="850" height="488" fill="#ebeee2" />
        <path d="M0 35 218 0h189l-7 193-188 96L0 253Z M0 325l201-52 210 68-11 147H0Z M507 0h343v358l-200 116-144-53-18-155Z" fill="url(#blocks)" />
        <path d="M491-40C413 58 553 163 471 274S413 432 465 520" fill="none" stroke="#a7c5bf" strokeWidth="97" />
        <path d="M491-40C413 58 553 163 471 274S413 432 465 520" fill="none" stroke="#bdd4cd" strokeWidth="92" />
        <path d="M491-40C413 58 553 163 471 274S413 432 465 520" fill="none" stroke="url(#water)" strokeWidth="88" />
        <path d="M545 64l51-34 82 4 50 43-42 14-91-5Z M657 389l82-38 68 25-3 57-80 31-68-29Z" fill="#d0dfc3" stroke="#bfcfb3" />
        <g className="map-label">
          <text x="27" y="41">PUERTO NIEBLA</text>
          <text x="449" y="374" transform="rotate(-74 449 374)">RÍO BRUMA</text>
          <text x="627" y="61">Parque del Viento</text>
          <text x="708" y="423">Reserva del Faro</text>
        </g>
        <g transform="translate(297 56)">
          <path d="M38 58v40" stroke="#8e5b40" strokeDasharray="3 4" />
          <path d="M3 17 20 4h39l16 13v33L59 63H19L3 49Z" fill="#f4d9ad" stroke="#b97944" strokeWidth="2" />
          <path d="M28 44V23l23-5v22m-23-9 23-5" fill="none" stroke="#784e38" strokeWidth="3" />
          <ellipse cx="23" cy="44" rx="6" ry="4" fill="#784e38" />
          <ellipse cx="46" cy="40" rx="6" ry="4" fill="#784e38" />
        </g>
        {routes.map(route => <g key={route.id} opacity={draft?.id === route.id ? .28 : 1}>
          <path d={pathFor(route.stops)} className="rail-bed" />
          <path d={pathFor(route.stops)} className="rail" stroke={lines.find(line => line.id === route.id)?.color} />
        </g>)}
        {[...pending.filter(route => route.id !== draft?.id), ...(draft ? [draft] : [])].map(route =>
          <path key={route.id} d={pathFor(route.stops)} className="rail preview-rail" stroke={lines.find(line => line.id === route.id)?.color} />
        )}
        {markers.map(marker => <g key={marker.id} transform={`translate(${marker.x} ${marker.y}) rotate(${marker.angle})`}>
          <rect x="-13" y="-7" width="26" height="14" rx="5" fill="#163136" stroke="white" strokeWidth="2" />
          <path d="M-6 0h4m4 0h4" stroke="#fff" strokeWidth="3" />
        </g>)}
      </svg>
      {stations.map(station => {
        const count = waiting[station.id] ?? 0
        const order = draft?.stops.indexOf(station.id) ?? -1
        const interchange = routes.filter(route => route.stops.includes(station.id)).length > 1
        return <button key={station.id}
          className={`station ${count >= 12 ? 'crowded' : ''} ${interchange ? 'interchange' : ''}`}
          style={{ '--x': station.x / 8.5 + '%', '--y': station.y / 4.88 + '%' } as CSSProperties}
          aria-label={`${station.name}, ${count} en espera`}
          aria-pressed={draft ? order >= 0 : selected === station.id}
          onClick={() => onStation(station.id)}>
          <span className="station-dot">{order >= 0 ? order + 1 : ''}</span>
          {count > 0 && <span className="count" aria-hidden="true">{count}</span>}
          <span className="station-name">{station.name}</span>
        </button>
      })}
    </div>
  </div>
}
