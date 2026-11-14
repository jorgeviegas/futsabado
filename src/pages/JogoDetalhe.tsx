import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  useAtualizarJogo, useDefinirPresenca, useExcluirJogo, useJogadores, useJogo, useJogosNoAno, useMeuVoto,
  usePresencas, useResultado, useTotalVotos, useVotar,
} from '../lib/api'
import { sortear } from '../lib/sorteio'
import Escalacao from '../components/Escalacao'
import { useAuth } from '../lib/auth'
import { exibir, formatarData, formatarHora } from '../lib/format'
import { Avatar, Erro, Modal, Spinner } from '../components/ui'
import type { Escalado, Jogador, StatusPresenca } from '../lib/types'

const NOME_TIME = { grena: 'Time Grená', preto: 'Time Preto', empate: 'Empate' } as const
const NOME_SLOT = { GOL: 'Goleiro', ZAG1: 'Zagueiro', ZAG2: 'Zagueiro', ALA1: 'Ala', ALA2: 'Ala', MEI: 'Meia', ATA: 'Atacante' } as const

const OPCOES: { v: StatusPresenca; rot: string; cls: string }[] = [
  { v: 'confirmado', rot: '✓ Vou', cls: 'ok' },
  { v: 'talvez', rot: '? Talvez', cls: 'aviso' },
  { v: 'ausente', rot: '✕ Não vou', cls: 'erro' },
]

export default function JogoDetalhe() {
  const { id } = useParams()
  const nav = useNavigate()
  const { eu, isAdmin } = useAuth()
  const { data: jogo, isLoading, error } = useJogo(id)
  const { data: pres = [] } = usePresencas(id)
  const { data: jogadores = [] } = useJogadores()
  const definir = useDefinirPresenca()
  const atualizar = useAtualizarJogo()
  const excluir = useExcluirJogo()
  const [editando, setEditando] = useState(false)
  const { data: jogosAno = {} } = useJogosNoAno()

  if (isLoading) return <Spinner />
  if (error || !jogo) return <Erro erro={error ?? new Error('Jogo não encontrado')} />

  const minha = pres.find((p) => p.jogador_id === eu?.id)?.status
  const confirmados = jogadores.filter((j) => pres.some((p) => p.jogador_id === j.id && p.status === 'confirmado'))
  const talvez = jogadores.filter((j) => pres.some((p) => p.jogador_id === j.id && p.status === 'talvez'))
  const ausentes = jogadores.filter((j) => pres.some((p) => p.jogador_id === j.id && p.status === 'ausente'))
  const limite = jogo.peladas?.limite_jogadores
  const lotado = Boolean(limite && confirmados.length >= limite && minha !== 'confirmado')
  const agendado = jogo.status === 'agendado'

  function sortearTimes() {
    if (jogo!.sorteio && !confirm('Já existe um sorteio. Sortear de novo e substituir?')) return
    const sorteio = sortear(
      confirmados.map((j) => ({
        id: j.id, posicao: j.posicao, posicao_secundaria: j.posicao_secundaria, jogosAno: jogosAno[j.id] ?? 0,
      })),
    )
    atualizar.mutate({ id: jogo!.id, sorteio })
  }

  return (
    <>
      <Link to="/" className="muted">← Voltar</Link>
      <div className="card">
        <div className="linha entre">
          <h1>{jogo.peladas?.nome ?? 'Pelada'}</h1>
          {jogo.status !== 'agendado' && (
            <span className={`chip ${jogo.status === 'cancelado' ? 'erro' : ''}`}>
              {jogo.status === 'cancelado' ? 'Cancelado' : 'Realizado'}
            </span>
          )}
        </div>
        <div className="muted">
          {formatarData(jogo.data)} às {formatarHora(jogo.horario)}{jogo.local && ` · ${jogo.local}`}
        </div>
        {jogo.placar && <div>Placar: <strong>{jogo.placar}</strong></div>}
        {jogo.time_vencedor && <div>Resultado: <strong>{jogo.time_vencedor === 'empate' ? 'Empate' : `Vitória do ${NOME_TIME[jogo.time_vencedor]}`}</strong></div>}
        {jogo.observacoes && <div className="muted">{jogo.observacoes}</div>}
      </div>

      {agendado && eu && (
        <div className="card">
          <h2>Você vai?</h2>
          <div className="seg">
            {OPCOES.map((o) => (
              <button
                key={o.v}
                className={`${minha === o.v ? 'ativo' : ''} ${o.cls}`}
                disabled={definir.isPending || (o.v === 'confirmado' && lotado)}
                onClick={() => definir.mutate({ jogoId: jogo.id, jogadorId: eu.id, status: minha === o.v ? null : o.v })}
              >
                {o.rot}
              </button>
            ))}
          </div>
          {lotado && <p className="muted">Lista cheia ({limite} jogadores). Fale com um admin.</p>}
          <Erro erro={definir.error} />
        </div>
      )}

      <Lista titulo={`Confirmados (${confirmados.length}${limite ? `/${limite}` : ''})`} lista={confirmados} />
      {talvez.length > 0 && <Lista titulo={`Talvez (${talvez.length})`} lista={talvez} />}
      {ausentes.length > 0 && <Lista titulo={`Não vão (${ausentes.length})`} lista={ausentes} />}

      {jogo.sorteio && <Times jogo={jogo} jogadores={jogadores} jogosAno={jogosAno} />}

      {jogo.status === 'realizado' || jogo.votacao_aberta ? (
        <Votacao jogoId={jogo.id} aberta={jogo.votacao_aberta} confirmados={confirmados} />
      ) : null}

      {isAdmin && (
        <div className="card">
          <h2>Administração</h2>
          <div className="linha wrap">
            <button className="btn sec peq" onClick={() => setEditando(true)}>✏️ Editar jogo</button>
            {jogo.status !== 'cancelado' && (
              <button className="btn peq" disabled={confirmados.length < 2 || atualizar.isPending} onClick={sortearTimes}>
                🎲 {jogo.sorteio ? 'Sortear de novo' : 'Sortear times'}
              </button>
            )}
            {jogo.sorteio && (
              <button className="btn sec peq" onClick={() => confirm('Remover o sorteio?') && atualizar.mutate({ id: jogo.id, sorteio: null })}>Limpar sorteio</button>
            )}
            {agendado && (
              <button className="btn sec peq" onClick={() => atualizar.mutate({ id: jogo.id, status: 'cancelado' })}>🚫 Cancelar</button>
            )}
            {jogo.status !== 'realizado' && (
              <button className="btn peq" onClick={() => atualizar.mutate({ id: jogo.id, status: 'realizado', votacao_aberta: true })}>
                ✅ Encerrar e abrir votação
              </button>
            )}
            {jogo.status === 'realizado' && !jogo.votacao_aberta && (
              <button className="btn sec peq" onClick={() => atualizar.mutate({ id: jogo.id, votacao_aberta: true })}>🗳️ Reabrir votação</button>
            )}
            {jogo.status === 'cancelado' && (
              <button className="btn sec peq" onClick={() => atualizar.mutate({ id: jogo.id, status: 'agendado' })}>↩️ Reativar</button>
            )}
            <button
              className="btn perigo peq"
              onClick={() => confirm('Excluir este jogo?') && excluir.mutate(jogo.id, { onSuccess: () => nav('/') })}
            >
              🗑️ Excluir
            </button>
          </div>
          <Erro erro={atualizar.error ?? excluir.error} />
          {agendado && (
            <AdminPresenca jogoId={jogo.id} jogadores={jogadores} presencas={pres} />
          )}
        </div>
      )}

      {editando && (
        <EditarJogo
          jogo={jogo}
          onFechar={() => setEditando(false)}
        />
      )}
    </>
  )
}

function Lista({ titulo, lista }: { titulo: string; lista: Jogador[] }) {
  return (
    <div className="card">
      <h3>{titulo}</h3>
      {lista.length === 0 && <span className="muted">Ninguém ainda.</span>}
      {lista.map((j) => (
        <div className="linha" key={j.id}>
          <Avatar nome={exibir(j)} numero={j.numero_camisa} />
          <span className="grow">{exibir(j)}</span>
          {j.tipo === 'avulso' && <span className="chip">avulso</span>}
        </div>
      ))}
    </div>
  )
}

function AdminPresenca({ jogoId, jogadores, presencas }: {
  jogoId: string; jogadores: Jogador[]; presencas: { jogador_id: string; status: StatusPresenca }[]
}) {
  const definir = useDefinirPresenca()
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button className="btn sec" onClick={() => setAberto(!aberto)}>
        {aberto ? 'Ocultar' : 'Marcar presença de outros jogadores'}
      </button>
      {aberto &&
        jogadores.filter((j) => j.ativo).map((j) => {
          const atual = presencas.find((p) => p.jogador_id === j.id)?.status
          return (
            <div className="linha" key={j.id}>
              <span className="grow">{exibir(j)}</span>
              {OPCOES.map((o) => (
                <button
                  key={o.v}
                  className={`btn peq ${atual === o.v ? '' : 'sec'}`}
                  onClick={() => definir.mutate({ jogoId, jogadorId: j.id, status: atual === o.v ? null : o.v })}
                  aria-label={o.rot}
                >
                  {o.rot.split(' ')[0]}
                </button>
              ))}
            </div>
          )
        })}
    </>
  )
}

function Votacao({ jogoId, aberta, confirmados }: { jogoId: string; aberta: boolean; confirmados: Jogador[] }) {
  const { eu, isAdmin } = useAuth()
  const { data: meuVoto } = useMeuVoto(jogoId, eu?.id)
  const { data: total = 0 } = useTotalVotos(jogoId)
  const { data: resultado } = useResultado(jogoId, !aberta || isAdmin)
  const votar = useVotar()
  const euConfirmei = confirmados.some((j) => j.id === eu?.id)
  const candidatos = confirmados.filter((j) => j.id !== eu?.id)
  const max = Math.max(1, ...(resultado ?? []).map((r) => r.votos))

  return (
    <div className="card">
      <div className="linha entre">
        <h2>⭐ Craque do jogo</h2>
        <span className="chip">{total} {total === 1 ? 'voto' : 'votos'}</span>
      </div>

      {aberta && eu && !euConfirmei && <p className="muted">Só quem confirmou presença pode votar.</p>}
      {aberta && eu && euConfirmei && (
        <>
          <p className="muted">{meuVoto ? 'Seu voto está registrado — você pode alterá-lo.' : 'Escolha quem foi o craque (voto secreto):'}</p>
          {candidatos.map((j) => (
            <button
              key={j.id}
              className={`voto-opcao ${meuVoto?.votado_id === j.id ? 'sel' : ''}`}
              disabled={votar.isPending}
              onClick={() => votar.mutate({ jogo_id: jogoId, eleitor_id: eu.id, votado_id: j.id })}
            >
              <Avatar nome={exibir(j)} numero={j.numero_camisa} />
              <span className="grow">{exibir(j)}</span>
              {meuVoto?.votado_id === j.id && <span>✓</span>}
            </button>
          ))}
          <Erro erro={votar.error} />
        </>
      )}

      {(!aberta || isAdmin) && resultado && resultado.length > 0 && (
        <>
          <h3>{aberta ? 'Parcial (visível só para admins)' : 'Resultado'}</h3>
          {resultado.map((r, i) => (
            <div key={r.jogador_id} style={{ display: 'grid', gap: 4 }}>
              <div className="linha entre">
                <span>{!aberta && i === 0 ? '👑 ' : ''}{exibir(r)}</span>
                <strong>{r.votos}</strong>
              </div>
              <div className="barra"><div style={{ width: `${(r.votos / max) * 100}%` }} /></div>
            </div>
          ))}
        </>
      )}
      {!aberta && resultado?.length === 0 && <p className="muted">Votação encerrada sem votos.</p>}

      {isAdmin && aberta && <EncerrarVotacao jogoId={jogoId} />}
    </div>
  )
}

function EncerrarVotacao({ jogoId }: { jogoId: string }) {
  const atualizar = useAtualizarJogo()
  return (
    <button className="btn" onClick={() => atualizar.mutate({ id: jogoId, votacao_aberta: false })} disabled={atualizar.isPending}>
      🔒 Encerrar votação e revelar craque
    </button>
  )
}

function EditarJogo({ jogo, onFechar }: { jogo: NonNullable<ReturnType<typeof useJogo>['data']>; onFechar: () => void }) {
  const atualizar = useAtualizarJogo()
  const [f, setF] = useState({
    data: jogo.data, horario: jogo.horario.slice(0, 5), local: jogo.local ?? '', placar: jogo.placar ?? '', observacoes: jogo.observacoes ?? '',
    time_vencedor: jogo.time_vencedor ?? '',
  })
  return (
    <Modal titulo="Editar jogo" onFechar={onFechar}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          atualizar.mutate(
            {
              id: jogo.id, ...f, local: f.local || null, placar: f.placar || null, observacoes: f.observacoes || null,
              time_vencedor: (f.time_vencedor || null) as typeof jogo.time_vencedor,
            },
            { onSuccess: onFechar },
          )
        }}
      >
        <div className="grid2">
          <label>Data<input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} required /></label>
          <label>Horário<input type="time" value={f.horario} onChange={(e) => setF({ ...f, horario: e.target.value })} required /></label>
        </div>
        <label>Local<input value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} /></label>
        <label>Placar<input value={f.placar} placeholder="Ex.: Grená 5 x 4 Preto" onChange={(e) => setF({ ...f, placar: e.target.value })} /></label>
        <label>Time vencedor
          <select value={f.time_vencedor} onChange={(e) => setF({ ...f, time_vencedor: e.target.value as typeof f.time_vencedor })}>
            <option value="">— não informado —</option>
            <option value="grena">Time Grená</option>
            <option value="preto">Time Preto</option>
            <option value="empate">Empate</option>
          </select>
        </label>
        <label>Observações<textarea rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></label>
        <Erro erro={atualizar.error} />
        <button className="btn" disabled={atualizar.isPending}>Salvar</button>
      </form>
    </Modal>
  )
}

function Times({ jogo, jogadores, jogosAno }: { jogo: NonNullable<ReturnType<typeof useJogo>['data']>; jogadores: Jogador[]; jogosAno: Record<string, number> }) {
  const sorteio = jogo.sorteio!
  const por = new Map(jogadores.map((j) => [j.id, j]))
  const venceu = jogo.time_vencedor

  return (
    <div className="card">
      <h2>🎲 Times sorteados</h2>
      <Escalacao sorteio={sorteio} jogadores={jogadores} />
      <p className="muted">Formação 2-3-1. Contorno tracejado = jogando fora da posição.</p>
      <TimeLista cor="grena" lista={sorteio.grena} por={por} venceu={venceu} />
      <TimeLista cor="preto" lista={sorteio.preto} por={por} venceu={venceu} />
      {sorteio.reservas.length > 0 && (
        <div style={{ display: 'grid', gap: '.4rem' }}>
          <h3>Reservas ({sorteio.reservas.length})</h3>
          <p className="muted">Mais de 14 confirmados: entra primeiro quem tem mais jogos no ano.</p>
          {sorteio.reservas.map((id) => {
            const j = por.get(id)
            return (
              <div className="linha" key={id}>
                <Avatar nome={j ? exibir(j) : '?'} numero={j?.numero_camisa} />
                <span className="grow">{j ? exibir(j) : '—'}</span>
                <span className="chip">{jogosAno[id] ?? 0} {(jogosAno[id] ?? 0) === 1 ? 'jogo' : 'jogos'} no ano</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TimeLista({ cor, lista, por, venceu }: {
  cor: 'grena' | 'preto'; lista: Escalado[]; por: Map<string, Jogador>; venceu: string | null
}) {
  return (
    <div style={{ display: 'grid', gap: '.4rem' }}>
      <div className="time-cab">
        <span className={`bolinha ${cor}`} />
        <h3>{NOME_TIME[cor]} ({lista.length}){venceu === cor && ' 🏆'}</h3>
      </div>
      {lista.map((e) => {
        const j = por.get(e.id)
        return (
          <div className="linha" key={e.id}>
            <span className="pos-tag">{NOME_SLOT[e.slot].slice(0, 3).toUpperCase()}</span>
            <Avatar nome={j ? exibir(j) : '?'} numero={j?.numero_camisa} />
            <span className="grow">{j ? exibir(j) : '—'}</span>
            {e.fora && <span className="chip fora" title="Fora da posição preferida">fora de posição</span>}
          </div>
        )
      })}
    </div>
  )
}
