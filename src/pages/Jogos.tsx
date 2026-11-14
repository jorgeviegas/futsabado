import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfirmadosPorJogo, useJogos } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatarData, formatarHora } from '../lib/format'
import { Erro, Spinner, Vazio } from '../components/ui'
import Avisos from '../components/Avisos'
import type { Jogo } from '../lib/types'

const NOME_TIME: Record<string, string> = { branco: 'Vitória Branco', preto: 'Vitória Preto', empate: 'Empate' }

type Aba = 'proximos' | 'passados'

export default function Jogos() {
  const [aba, setAba] = useState<Aba>('proximos')
  return (
    <>
      <Avisos />
      <div className="seg" role="tablist">
        {(['proximos', 'passados'] as const).map((a) => (
          <button key={a} role="tab" className={aba === a ? 'ativo' : ''} onClick={() => setAba(a)}>
            {{ proximos: 'Próximos', passados: 'Resultados' }[a]}
          </button>
        ))}
      </div>
      <Lista filtro={aba} />
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
        {jogo.status === 'realizado' && <span className="chip">{jogo.placar || NOME_TIME[jogo.time_vencedor ?? ''] || 'Realizado'}</span>}
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
