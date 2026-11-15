import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfirmadosPorJogo, useJogoAnterior, useLiberacao, useProximoJogo, useResultados } from '../lib/api'
import { useAuth } from '../lib/auth'
import { confirmacaoLiberada, formatarData, formatarHora, placarTexto } from '../lib/format'
import { Erro, Spinner, Vazio } from '../components/ui'
import Avisos from '../components/Avisos'
import ClimaJogo from '../components/ClimaJogo'
import type { Jogo } from '../lib/types'

type Aba = 'jogos' | 'resultados'

export default function Jogos() {
  const [aba, setAba] = useState<Aba>('jogos')
  return (
    <>
      <Avisos />
      <div className="seg" role="tablist">
        {(['jogos', 'resultados'] as const).map((a) => (
          <button key={a} role="tab" className={aba === a ? 'ativo' : ''} onClick={() => setAba(a)}>
            {{ jogos: 'Jogos', resultados: 'Resultados' }[a]}
          </button>
        ))}
      </div>
      {aba === 'jogos' ? <AnteriorEProximo /> : <Resultados />}
    </>
  )
}

/** Mostra apenas o próximo jogo e o jogo anterior. */
function AnteriorEProximo() {
  const proximo = useProximoJogo()
  const anterior = useJogoAnterior()
  const jogos = [proximo.data, anterior.data].filter(Boolean) as Jogo[]
  const { data: pres } = useConfirmadosPorJogo(jogos.map((j) => j.id))

  if (proximo.isLoading || anterior.isLoading) return <Spinner />
  const erro = proximo.error ?? anterior.error
  if (erro) return <Erro erro={erro} />

  return (
    <>
      <h2>Próximo jogo</h2>
      {proximo.data ? (
        <CartaoJogo jogo={proximo.data} participantes={pres?.contagem[proximo.data.id] ?? 0} pres={pres?.rows} />
      ) : (
        <Vazio>Nenhum jogo agendado. Um admin pode gerar os jogos em “Peladas”.</Vazio>
      )}
      <h2>Jogo anterior</h2>
      {anterior.data ? (
        <CartaoJogo jogo={anterior.data} participantes={pres?.contagem[anterior.data.id] ?? 0} pres={pres?.rows} />
      ) : (
        <Vazio>Nenhum jogo realizado ainda.</Vazio>
      )}
    </>
  )
}

function Resultados() {
  const { data, isLoading, error } = useResultados()
  if (isLoading) return <Spinner />
  if (error) return <Erro erro={error} />
  if (!data?.length) return <Vazio>Nenhum jogo realizado ainda.</Vazio>
  return (
    <>
      {data.map((j) => (
        <Link key={j.id} to={`/jogo/${j.id}`} className="card link">
          <div className="muted">{formatarData(j.data)} · {j.peladas?.nome ?? 'Pelada'}</div>
          <Placar jogo={j} />
        </Link>
      ))}
    </>
  )
}

/** "Branco 5 x 9 Preto", com o time vencedor em destaque. */
function Placar({ jogo }: { jogo: Jogo }) {
  const { isAdmin } = useAuth()
  if (placarTexto(jogo) == null) {
    return <span className="muted">{isAdmin ? 'Placar ainda não registrado — toque para registrar' : 'Placar ainda não registrado'}</span>
  }
  const v = jogo.time_vencedor
  return (
    <div className="placar" aria-label={placarTexto(jogo) ?? undefined}>
      <span className={v === 'branco' ? 'vence' : ''}>Branco</span>
      <strong>{jogo.placar_branco}</strong>
      <span>x</span>
      <strong>{jogo.placar_preto}</strong>
      <span className={v === 'preto' ? 'vence' : ''}>Preto</span>
    </div>
  )
}

function CartaoJogo({ jogo, participantes, pres }: { jogo: Jogo; participantes: number; pres?: { jogo_id: string; jogador_id: string; status: string }[] }) {
  const { eu } = useAuth()
  const { data: liberaEm } = useLiberacao(jogo.status === 'agendado' ? jogo.id : undefined)
  const limite = jogo.peladas?.limite_jogadores
  const minha = pres?.find((r) => r.jogo_id === jogo.id && r.jogador_id === eu?.id)?.status
  const bloqueado = jogo.status === 'agendado' && !confirmacaoLiberada(liberaEm)

  return (
    <Link to={`/jogo/${jogo.id}`} className="card link">
      <div className="linha entre">
        <h3>{jogo.peladas?.nome ?? 'Pelada'}</h3>
        {jogo.status === 'cancelado' && <span className="chip erro">Cancelado</span>}
        {jogo.status === 'realizado' && <span className="chip">Realizado</span>}
        {jogo.status === 'agendado' && bloqueado && <span className="chip aviso">Confirmação em {formatarData(liberaEm!)}</span>}
        {jogo.status === 'agendado' && !bloqueado && minha === 'confirmado' && <span className="chip ok">Confirmado ✓</span>}
        {jogo.status === 'agendado' && !bloqueado && minha === 'talvez' && <span className="chip aviso">Talvez</span>}
        {jogo.status === 'agendado' && !bloqueado && minha === 'ausente' && <span className="chip erro">Ausente</span>}
        {jogo.status === 'agendado' && !bloqueado && !minha && <span className="chip grena">Responder</span>}
      </div>
      <div className="linha entre wrap">
        <div className="muted">
          {formatarData(jogo.data)} · {formatarHora(jogo.horario)}
          {jogo.local && ` · ${jogo.local}`}
        </div>
        <ClimaJogo jogo={jogo} />
      </div>
      {jogo.status === 'realizado' && <Placar jogo={jogo} />}
      <div className="muted">
        👥 {participantes}{limite ? `/${limite}` : ''} {jogo.status === 'realizado' ? 'jogaram' : 'confirmados'}
        {jogo.votacao_aberta && ' · 🗳️ votação aberta'}
      </div>
    </Link>
  )
}
