import type { Ref } from 'react'
import type { stats } from './engine.ts'

type Metrics = ReturnType<typeof stats>

const formatWait = (seconds: number | null) =>
  seconds === null ? '—' : seconds.toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' s'

export function Results({ result, previous, finished, headingRef, onReplay }: {
  result: Metrics
  previous: Metrics | null
  finished: boolean
  headingRef: Ref<HTMLHeadingElement>
  onReplay: () => void
}) {
  if (!finished) return <section className="results" aria-labelledby="results-title">
    <h2 id="results-title">Pasajeros en la red</h2>
    <dl>
      <div><dt>Llegaron</dt><dd>{result.arrived}</dd></div>
      <div><dt>En espera</dt><dd>{result.waiting}</dd></div>
      <div><dt>A bordo</dt><dd>{result.aboard}</dd></div>
      <div><dt>Espera media al llegar</dt><dd>{formatWait(result.averageWait)}</dd></div>
    </dl>
  </section>

  const total = result.arrived + result.waiting + result.aboard
  return <section className="results final-results" aria-labelledby="results-title">
    <header className="result-heading">
      <h2 id="results-title" ref={headingRef} tabIndex={-1}>Resumen de la partida</h2>
      <button className="primary" onClick={onReplay}>Volver a jugar</button>
    </header>
    <dl className="result-metrics">
      <div className="arrived-metric">
        <dt>Llegaron a destino</dt><dd>{result.arrived}<small> / {total}</small></dd>
        <progress value={result.arrived} max={total || 1} aria-label="Pasajeros que llegaron a destino" />
      </div>
      <div className="wait-metric"><dt>Siguen en espera</dt><dd>{result.waiting}</dd></div>
      <div className="time-metric"><dt>Espera media</dt><dd>{formatWait(result.averageWait)}</dd><p>De quienes llegaron</p></div>
    </dl>
    <div className="result-notes">
      <p><strong>{result.aboard}</strong> quedaron a bordo al cerrar el servicio.</p>
      {previous && <p>Partida anterior · {previous.arrived} llegaron, {previous.waiting} en espera,
        {' '}{previous.aboard} a bordo y {formatWait(previous.averageWait)} de espera media.</p>}
    </div>
  </section>
}
