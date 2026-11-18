import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { StationButton, type MapProps } from './Map.tsx'
import { lines, stations } from './scenario.ts'
import { mountMaquette, type CameraAction } from './maquetteScene.ts'

const cameraButtons: { action: CameraAction; label: string; symbol: string }[] = [
  { action: 'left', label: 'Girar a la izquierda', symbol: '↶' },
  { action: 'right', label: 'Girar a la derecha', symbol: '↷' },
  { action: 'closer', label: 'Acercar', symbol: '+' },
  { action: 'farther', label: 'Alejar', symbol: '−' },
  { action: 'top', label: 'Vista superior', symbol: 'Superior' },
  { action: 'perspective', label: 'Volver a perspectiva', symbol: 'Perspectiva' },
]

export default function Maquette({ map, onFailure, stopFollowing }: {
  map: MapProps
  onFailure: () => void
  stopFollowing: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const labels = useRef<HTMLDivElement>(null)
  const scene = useRef<ReturnType<typeof mountMaquette> | null>(null)
  const currentMap = useRef(map)
  useLayoutEffect(() => { currentMap.current = map }, [map])

  useEffect(() => {
    if (!host.current || !labels.current) return
    try {
      const mounted = mountMaquette(host.current, labels.current, { getMap: () => currentMap.current, onFailure })
      scene.current = mounted
      return () => {
        scene.current = null
        mounted.dispose()
      }
    } catch {
      onFailure()
    }
  }, [onFailure])

  function control(action: CameraAction) {
    if (action === 'top' || action === 'perspective') stopFollowing()
    scene.current?.act(action)
  }

  return <div className="maquette">
    <div className="maquette-stage">
      <div className="maquette-render" ref={host} />
      <div className="maquette-labels" ref={labels}>
        <span className="venue-caption" data-x="335" data-y="71" data-h=".4">♫ Foro</span>
        {stations.map(station => <StationButton key={station.id} station={station} map={map} />)}
        {map.markers.map(marker => <span key={marker.id} aria-hidden="true" data-train={marker.id}
          data-x={marker.x} data-y={marker.y} data-h=".3"
          className={`maquette-train ${map.following === marker.id ? 'followed' : ''}`}
          style={{ '--line': lines.find(line => line.id === marker.id)?.color } as CSSProperties}>{marker.id}</span>)}
      </div>
    </div>
    <div className="camera-deck" aria-label="Controles de cámara">
      {cameraButtons.map(({action, label, symbol}) => <button key={action} aria-label={label}
        onClick={() => control(action)}>{symbol}</button>)}
      <span>Arrastra para girar. Usa la rueda o dos dedos para acercar.</span>
    </div>
  </div>
}
