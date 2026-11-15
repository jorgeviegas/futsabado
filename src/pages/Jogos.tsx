import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfirmadosPorJogo, useJogoAnterior, useLiberacao, useProximoJogo, useResultados } from '../lib/api'
import { useAuth } from '../lib/auth'
import { confirmacaoLiberada, formatarData, formatarHora, parseData, placarTexto } from '../lib/format'
import { diasAte } from '../lib/clima'
import { Erro, Spinner, Vazio } from '../components/ui'
import Avisos from '../components/Avisos'
import ClimaJogo from '../components/ClimaJogo'
import AvisosAdmin from '../components/AvisosAdmin'
import Patrocinadores from '../components/Patrocinadores'
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
      <Patrocinadores />
    </>
  )
}

/** Mostra apenas o próximo jogo e o jogo anterior. */
function AnteriorEProximo() {
  const { isAdmin } = useAuth()
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
        <CartaoJogo jogo={proximo.data} participantes={pres?.contagem[proximo.data.id] ?? 0} pres={pres?.rows} destaque />
      ) : (
        <Vazio>Nenhum jogo agendado. Um admin pode gerar os jogos em “Peladas”.</Vazio>
      )}
      <h2>Jogo anterior</h2>
      {anterior.data ? (
        <CartaoJogo jogo={anterior.data} participantes={pres?.contagem[anterior.data.id] ?? 0} pres={pres?.rows} />
      ) : (
        <Vazio>Nenhum jogo realizado ainda.</Vazio>
      )}
      {isAdmin && <AvisosAdmin />}
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
          <div className="muted">{formatarData(j.data)} · {j.pelada_nome ?? 'Pelada'}</div>
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

function CartaoJogo({ jogo, participantes, pres, destaque = false }: {
  jogo: Jogo; participantes: number; pres?: { jogo_id: string; jogador_id: string; status: string }[]
  /** Próximo jogo: data e horário em destaque. */
  destaque?: boolean
}) {
  const { eu } = useAuth()
  const { data: liberaEm } = useLiberacao(jogo.status === 'agendado' ? jogo.id : undefined)
  const limite = jogo.limite_jogadores
  const minha = pres?.find((r) => r.jogo_id === jogo.id && r.jogador_id === eu?.id)?.status
  const bloqueado = jogo.status === 'agendado' && !confirmacaoLiberada(liberaEm)

  return (
    <Link to={`/jogo/${jogo.id}`} className="card link">
      <div className="linha entre">
        <h3>{jogo.pelada_nome ?? 'Pelada'}</h3>
        {jogo.status === 'cancelado' && <span className="chip erro">Cancelado</span>}
        {jogo.status === 'realizado' && <span className="chip">Realizado</span>}
        {jogo.status === 'agendado' && bloqueado && <span className="chip aviso">Confirmação em {formatarData(liberaEm!)}</span>}
        {jogo.status === 'agendado' && !bloqueado && minha === 'confirmado' && <span className="chip ok">Confirmado ✓</span>}
        {jogo.status === 'agendado' && !bloqueado && minha === 'espera' && <span className="chip aviso">⏳ Lista de espera</span>}
        {jogo.status === 'agendado' && !bloqueado && minha === 'ausente' && <span className="chip erro">Ausente</span>}
        {jogo.status === 'agendado' && !bloqueado && !minha && <span className="chip grena">Responder</span>}
      </div>
      {destaque && jogo.status === 'agendado' ? (
        <DataEmDestaque jogo={jogo} />
      ) : (
        <div className="linha entre wrap">
          <div className="muted">
            {formatarData(jogo.data)} · {formatarHora(jogo.horario)}
            {jogo.local && ` · ${jogo.local}`}
          </div>
          <ClimaJogo jogo={jogo} />
        </div>
      )}
      {jogo.status === 'realizado' && <Placar jogo={jogo} />}
      <div className="muted">
        👥 {participantes}{limite ? `/${limite}` : ''} {jogo.status === 'realizado' ? 'jogaram' : 'confirmados'}
        {jogo.votacao_aberta && ' · 🗳️ votação aberta'}
      </div>
    </Link>
  )
}

/** Data e horário do próximo jogo em destaque: "calendário" com o dia, horário grande e "Hoje/Amanhã/em N dias". */
function DataEmDestaque({ jogo }: { jogo: Jogo }) {
  const d = parseData(jogo.data)
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase()
  const mes = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()
  const dias = diasAte(jogo.data)
  const quando = dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : dias > 1 ? `em ${dias} dias` : null
  return (
    <div className="data-destaque" aria-label={`${formatarData(jogo.data)} às ${formatarHora(jogo.horario)}`}>
      <div className="data-tile" aria-hidden>
        <span>{semana}</span>
        <strong>{d.getDate()}</strong>
        <span>{mes}</span>
      </div>
      <div className="data-info">
        <div className="linha">
          <strong className="hora">{formatarHora(jogo.horario)}</strong>
          {quando && <span className={`chip ${dias <= 1 ? 'grena' : ''}`}>{quando}</span>}
        </div>
        {jogo.local && <span className="muted">📍 {jogo.local}</span>}
      </div>
      <ClimaJogo jogo={jogo} />
    </div>
  )
}
