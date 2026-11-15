import { useClima, condicao, DIAS_DE_PREVISAO } from '../lib/clima'
import { formatarData, somaDias } from '../lib/format'
import type { Jogo } from '../lib/types'

/** Temperatura e condição do tempo previstas para a hora do jogo (estilo app de clima). */
export default function ClimaJogo({ jogo, grande = false }: { jogo: Jogo; grande?: boolean }) {
  const { data, isLoading, isError, temLocal, noAlcance, dias } = useClima(jogo)

  if (!temLocal || jogo.status !== 'agendado' || dias < 0) return null

  if (!noAlcance) {
    return (
      <div className={`clima ${grande ? 'grande' : ''}`} title="A previsão cobre os próximos 15 dias">
        <span className="clima-icone" aria-hidden>🌡️</span>
        <span className="clima-rotulo">Previsão a partir de {formatarData(somaDias(jogo.data, -DIAS_DE_PREVISAO))}</span>
      </div>
    )
  }
  if (isLoading) return <div className={`clima ${grande ? 'grande' : ''}`}><span className="clima-rotulo">Carregando clima…</span></div>
  if (isError || !data) return <div className={`clima ${grande ? 'grande' : ''}`}><span className="clima-rotulo">Clima indisponível</span></div>

  const c = condicao(data.codigo, data.dia)
  return (
    <div className={`clima ${grande ? 'grande' : ''}`} aria-label={`Previsão: ${data.temperatura} graus, ${c.rotulo}`}>
      <span className="clima-icone" aria-hidden>{c.icone}</span>
      <span className="clima-temp">{data.temperatura}°</span>
      <span className="clima-rotulo">{c.rotulo}</span>
    </div>
  )
}
