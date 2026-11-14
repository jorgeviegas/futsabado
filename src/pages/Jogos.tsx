import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfirmadosPorJogo, useJogos, useRanking } from '../lib/api'
import { useAuth } from '../lib/auth'
import { exibir, formatarData, formatarHora } from '../lib/format'
import { Erro, Spinner, Vazio } from '../components/ui'
import type { Jogo } from '../lib/types'

type Aba = 'proximos' | 'passados' | 'craques'

export default function Jogos() {
  const [aba, setAba] = useState<Aba>('proximos')
  return (
    <>
      <div className="seg" role="tablist">
        {(['proximos', 'passados', 'craques'] as const).map((a) => (
          <button key={a} role="tab" className={aba === a ? 'ativo' : ''} onClick={() => setAba(a)}>
            {{ proximos: 'Próximos', passados: 'Resultados', craques: '🏆 Craques' }[a]}
          </button>
        ))}
      </div>
      {aba === 'craques' ? <Craques /> : <Lista filtro={aba} />}
    </>
  )
}

function Lista({ filtro }: { filtro: 'proximos' | 'passados' }) {
  const { eu } = useAuth()
  const { data: jogos, isLoading, error } = useJogos(filtro)
  const ids = (jogos ?? []).map((j) => j.id)
  const { data: pres } = useConfirmadosPorJogo(ids)

  if (isLoading) return <Spinner />
  if (error) return <Erro erro={error} />
  if (!jogos?.length)
    return <Vazio>{filtro === 'proximos' ? 'Nenhum jogo agendado. Um admin pode gerar os jogos em “Peladas”.' : 'Nenhum jogo realizado ainda.'}</Vazio>

  return (
    <>
      {jogos.map((j) => (
        <CartaoJogo
          key={j.id}
          jogo={j}
          confirmados={pres?.contagem[j.id] ?? 0}
          minha={pres?.rows.find((r) => r.jogo_id === j.id && r.jogador_id === eu?.id)?.status}
        />
      ))}
    </>
  )
}

function CartaoJogo({ jogo, confirmados, minha }: { jogo: Jogo; confirmados: number; minha?: string }) {
  const limite = jogo.peladas?.limite_jogadores
  return (
    <Link to={`/jogo/${jogo.id}`} className="card link">
      <div className="linha entre">
        <h3>{jogo.peladas?.nome ?? 'Pelada'}</h3>
        {jogo.status === 'cancelado' && <span className="chip erro">Cancelado</span>}
        {jogo.status === 'realizado' && <span className="chip">{jogo.placar || 'Realizado'}</span>}
        {jogo.status === 'agendado' && minha === 'confirmado' && <span className="chip ok">Confirmado ✓</span>}
        {jogo.status === 'agendado' && minha === 'talvez' && <span className="chip aviso">Talvez</span>}
        {jogo.status === 'agendado' && minha === 'ausente' && <span className="chip erro">Ausente</span>}
        {jogo.status === 'agendado' && !minha && <span className="chip grena">Responder</span>}
      </div>
      <div className="muted">
        {formatarData(jogo.data)} · {formatarHora(jogo.horario)}
        {jogo.local && ` · ${jogo.local}`}
      </div>
      <div className="muted">
        👥 {confirmados}{limite ? `/${limite}` : ''} confirmados
        {jogo.votacao_aberta && ' · 🗳️ votação aberta'}
      </div>
    </Link>
  )
}

function Craques() {
  const { data, isLoading, error } = useRanking()
  if (isLoading) return <Spinner />
  if (error) return <Erro erro={error} />
  if (!data?.length) return <Vazio>Ainda não há craques. O ranking aparece após a primeira votação encerrada.</Vazio>
  return (
    <div className="card">
      <h2>Ranking de craques</h2>
      {data.map((r, i) => (
        <div className="linha" key={r.jogador_id}>
          <strong style={{ width: 28 }}>{['🥇', '🥈', '🥉'][i] ?? `${i + 1}º`}</strong>
          <span className="grow">{exibir(r)}</span>
          <span className="chip grena">{r.premios} {r.premios === 1 ? 'vez' : 'vezes'}</span>
        </div>
      ))}
    </div>
  )
}
