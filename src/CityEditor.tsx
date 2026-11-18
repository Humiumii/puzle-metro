import { useState, type FormEvent } from 'react'
import { canPlace, CITY_LIMIT, CUSTOM_ARRIVAL, removeStation, updateDemand, type City, type CityPoint } from './city.ts'
import type { StationId } from './scenario.ts'

export type Placement = { mode: 'new' | 'move'; point: CityPoint | null }

export function CityTools({ city, placement, editingRoute, saved, message, onPlace, onSave, onPlay, onCancel }: {
  city: City
  placement: Placement | null
  editingRoute: boolean
  saved: boolean
  message: string
  onPlace: (placement: Placement | null) => void
  onSave: () => void
  onPlay: () => void
  onCancel: () => void
}) {
  return <section className="city-tools" aria-label="Editar ciudad">
    <div className="city-tools-actions">
      <button disabled={editingRoute || city.stations.length >= CITY_LIMIT}
        onClick={() => onPlace({mode: 'new', point: null})}>Nueva estación</button>
      <button disabled={editingRoute || !!placement} onClick={onSave}>{saved ? 'Actualizar guardado' : 'Guardar ciudad'}</button>
      <button className="primary" disabled={editingRoute || !!placement} onClick={onPlay}>Jugar ciudad</button>
      <button onClick={onCancel}>Salir del editor</button>
    </div>
    <p role="status">{message || (placement ? 'Elige un punto libre sobre el plano. Luego confirma la ubicación.'
      : 'Selecciona una estación para editarla o abre Líneas para conectarla.')}</p>
  </section>
}

function DemandForm({ city, selected, onChange }: {
  city: City
  selected: StationId
  onChange: (city: City) => void
}) {
  const [peer, setPeer] = useState(city.stations.find(station => station.id !== selected)!.id)
  const [direction, setDirection] = useState('from')
  const [message, setMessage] = useState('')
  const origin = direction === 'from' ? selected : peer
  const destination = direction === 'from' ? peer : selected
  const assigned = city.arrivals.find(arrival => arrival.time === CUSTOM_ARRIVAL && arrival.origin === origin && arrival.destination === destination)
  const scheduled = city.arrivals.filter(arrival => arrival.time === CUSTOM_ARRIVAL &&
    (arrival.origin === selected || arrival.destination === selected))
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const count = Number(new FormData(event.currentTarget).get('count'))
    onChange(updateDemand(city, origin, destination, count))
    setMessage(count ? 'Demanda asignada.' : 'Demanda eliminada.')
  }
  return <form className="city-form" onSubmit={submit} onChange={() => setMessage('')}>
    <h4>Demanda a los {CUSTOM_ARRIVAL} segundos</h4>
    <div className="city-fields">
      <label>Sentido <select value={direction} onChange={event => setDirection(event.target.value)}>
        <option value="from">Desde esta estación</option><option value="to">Hacia esta estación</option>
      </select></label>
      <label>Otra estación <select value={peer} onChange={event => setPeer(event.target.value)}>
        {city.stations.filter(station => station.id !== selected).map(station =>
          <option key={station.id} value={station.id}>{station.name}</option>)}
      </select></label>
      <label>Pasajeros <input key={direction + peer + assigned?.count} name="count" type="number" min="0" max="72" required defaultValue={assigned?.count ?? 12} /></label>
      <button>Asignar demanda</button>
    </div>
    {scheduled.length > 0 && <ul className="city-demands">{scheduled.map(arrival =>
      <li key={arrival.origin + '/' + arrival.destination}>
        {arrival.count} · {city.stations.find(item => item.id === arrival.origin)?.name} → {city.stations.find(item => item.id === arrival.destination)?.name}
      </li>)}</ul>}
    {message && <p role="status">{message}</p>}
  </form>
}

export function StationEditor({ city, selected, placement, onPlace, onChange, onSelect, onMessage }: {
  city: City
  selected: StationId
  placement: Placement | null
  onPlace: (placement: Placement | null) => void
  onChange: (city: City) => void
  onSelect: (id: StationId) => void
  onMessage: (message: string) => void
}) {
  const station = city.stations.find(item => item.id === selected)!
  const [confirmDelete, setConfirmDelete] = useState(false)
  const point = placement?.point
  const valid = point && canPlace(city, point, placement.mode === 'move' ? selected : undefined)

  function place(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!placement || !point || !valid) return
    if (placement.mode === 'move') {
      onChange({ ...city, stations: city.stations.map(item => item.id === selected ? { ...item, ...point } : item) })
      onMessage('Ubicación actualizada.')
    } else {
      const name = String(new FormData(event.currentTarget).get('name') ?? '').trim()
      if (!name) { onMessage('Escribe un nombre para la estación.'); return }
      const id = 'est-' + crypto.randomUUID()
      onChange({ ...city, stations: [...city.stations, { id, name, ...point }] })
      onSelect(id)
      onMessage('Estación creada. Abre Líneas para conectarla.')
    }
    onPlace(null)
  }

  if (placement) return <form className="city-form placement-form" onSubmit={place}>
    <h4>{placement.mode === 'new' ? 'Nueva estación' : 'Mover ' + station.name}</h4>
    <div className="city-fields">
      {placement.mode === 'new' && <label>Nombre de estación <input name="name" required maxLength={28} /></label>}
      <button type="button" onClick={() => onPlace(null)}>Cancelar ubicación</button>
      <button className="primary" disabled={!valid}>Confirmar ubicación</button>
    </div>
    <p>{point ? 'Vista previa en el plano.' : 'Selecciona primero un punto del suelo.'}</p>
  </form>

  return <>
    <form className="city-form" onSubmit={event => {
      event.preventDefault()
      const name = String(new FormData(event.currentTarget).get('name') ?? '').trim()
      if (!name) { onMessage('Escribe un nombre para la estación.'); return }
      onChange({ ...city, stations: city.stations.map(item => item.id === selected ? { ...item, name } : item) })
      onMessage('Nombre actualizado.')
    }}>
      <div className="city-fields">
        <label>Nombre de estación <input name="name" defaultValue={station.name} required maxLength={28} /></label>
        <button>Renombrar</button>
        <button type="button" onClick={() => onPlace({mode:'move', point:null})}>Mover estación</button>
        <button type="button" disabled={city.stations.length <= 2} onClick={() => setConfirmDelete(true)}>Borrar estación</button>
      </div>
      {confirmDelete && <div className="city-fields delete-warning">
        <p>Se quitará la parada de sus líneas y se eliminará su demanda.</p>
        <button type="button" onClick={() => setConfirmDelete(false)}>Conservar</button>
        <button type="button" onClick={() => {
          const next = removeStation(city, selected)
          onChange(next)
          onSelect(next.stations[0].id)
          onMessage('Estación eliminada. Se actualizaron conexiones y demanda.')
        }}>Confirmar borrado</button>
      </div>}
    </form>
    <DemandForm key={selected + city.stations.map(item => item.id).join()} city={city} selected={selected} onChange={onChange} />
  </>
}
