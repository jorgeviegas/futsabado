import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  useAdicionarConvidado, useAtualizarJogo, useConvidados, useDefinirPresenca, useExcluirJogo, useJogadores, useJogo,
  useJogosNoAno, useLiberacao, useMeuVoto, usePresencas, useRemoverConvidado, useRemoverFaltoso, useResultado,
  useTotalVotos, useVotar, usePagosDoJogo,
} from '../lib/api'
import { sortear } from '../lib/sorteio'
import EncerrarJogo from '../components/EncerrarJogo'
import PosJogo from '../components/PosJogo'
import Escalacao from '../components/Escalacao'
import ClimaJogo from '../components/ClimaJogo'
import { useAuth } from '../lib/auth'
import { confirmacaoLiberada, exibir, formatarData, formatarHora, hojeISO, textoPosicao } from '../lib/format'
import { Avatar, Erro, Modal, Spinner } from '../components/ui'
import type { Convidado, Escalado, FuncaoGoleiro, Jogador, Posicao, StatusPresenca } from '../lib/types'
import { POSICOES, moeda } from '../lib/format'

const NOME_TIME = { branco: 'Time Branco', preto: 'Time Preto', empate: 'Empate' } as const
const NOME_SLOT = { GOL: 'Goleiro', ZAG1: 'Zagueiro', ZAG2: 'Zagueiro', ALA1: 'Ala', ALA2: 'Ala', MEI: 'Meia', ATA: 'Atacante' } as const

const OPCOES: { v: StatusPresenca; rot: string; cls: string }[] = [
  { v: 'confirmado', rot: '✓ Vou', cls: 'ok' },
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
  const [escolhendoFuncao, setEscolhendoFuncao] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const { data: jogosAno = {} } = useJogosNoAno()
  const { data: convidados = [] } = useConvidados(id)
  const { data: liberaEm } = useLiberacao(id)
  const { data: pagos } = usePagosDoJogo(id, jogo?.status === 'realizado')

  if (isLoading) return <Spinner />
  if (error || !jogo) return <Erro erro={error ?? new Error('Jogo não encontrado')} />

  const minhaPres = pres.find((p) => p.jogador_id === eu?.id)
  const minha = minhaPres?.status
  // goleiro com posição secundária precisa dizer se joga no gol ou na linha
  const precisaFuncao = eu?.posicao === 'goleiro' && Boolean(eu.posicao_secundaria)
  // convidados entram nas listas e no sorteio como participantes avulsos (id "c_<uuid>")
  const convidadosComoJogador: Jogador[] = convidados.map((c) => ({
    id: `c_${c.id}`, user_id: null, nome: c.nome, apelido: null, email: null, telefone: null, posicao: c.posicao,
    posicao_secundaria: null, numero_camisa: null, perfil_completo: true, tipo: 'avulso', is_admin: false, ativo: true, created_at: '',
  }))
  const donoDoConvidado = Object.fromEntries(
    convidados.map((c) => [`c_${c.id}`, exibir(jogadores.find((j) => j.id === c.convidado_por) ?? { nome: '?', apelido: null })]),
  )
  const todos = [...jogadores, ...convidadosComoJogador]
  const confirmados = jogadores.filter((j) => pres.some((p) => p.jogador_id === j.id && p.status === 'confirmado'))
  const participantes = [...confirmados, ...convidadosComoJogador]
  const liberada = isAdmin || confirmacaoLiberada(liberaEm)
  const ausentes = jogadores.filter((j) => pres.some((p) => p.jogador_id === j.id && p.status === 'ausente'))
  const limite = jogo.peladas?.limite_jogadores
  const cheio = Boolean(limite && participantes.length >= limite)
  const funcoes: Record<string, FuncaoGoleiro> = Object.fromEntries(pres.filter((p) => p.funcao).map((p) => [p.jogador_id, p.funcao!]))
  const naFila = minha === 'espera'
  const euConfirmado = minha === 'confirmado'
  // lista de espera, na ordem de chegada
  const fila = pres
    .filter((p) => p.status === 'espera')
    .sort((a, b) => (a.espera_desde ?? '').localeCompare(b.espera_desde ?? '') || a.jogador_id.localeCompare(b.jogador_id))
  const posicaoNaFila = fila.findIndex((p) => p.jogador_id === eu?.id) + 1
  const esperando = fila.map((p) => jogadores.find((j) => j.id === p.jogador_id)).filter(Boolean) as Jogador[]
  // jogo cheio e eu fora da lista de confirmados: o botão vira "lista de espera"
  const vaiParaFila = cheio && !euConfirmado
  const agendado = jogo.status === 'agendado'
  // jogo encerrado: tela enxuta (só informações, escalações com o placar e a votação)
  const posJogo = jogo.status === 'realizado'

  function sortearTimes() {
    if (jogo!.sorteio && !confirm('Já existe um sorteio. Sortear de novo e substituir?')) return
    const sorteio = sortear(
      participantes.map((j) => ({
        id: j.id, posicao: j.posicao, posicao_secundaria: j.posicao_secundaria, jogosAno: jogosAno[j.id] ?? 0,
        funcao: pres.find((p) => p.jogador_id === j.id)?.funcao,
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
        <ClimaJogo jogo={jogo} grande />
        {jogo.valor != null && <div className="muted">💵 {moeda(jogo.valor)} por jogador{jogo.peladas?.goleiros_isentos ? ' · goleiros isentos 🧤' : ''}</div>}
        {jogo.observacoes && <div className="muted">{jogo.observacoes}</div>}
      </div>

      {posJogo ? (
        <PosJogo
          jogo={jogo} jogadores={todos} participantes={participantes} funcoes={funcoes} pagos={pagos}
          isAdmin={isAdmin} onRegistrar={() => setEncerrando(true)}
        />
      ) : (
        <>
        {agendado && eu && !liberada && (
          <div className="card">
            <h2>Você vai?</h2>
            <p className="muted">A confirmação de presença abre em <strong>{formatarData(liberaEm!)}</strong></p>
          </div>
        )}

        {agendado && eu && liberada && (
          <div className="card">
            <h2>Você vai?</h2>
            {isAdmin && !confirmacaoLiberada(liberaEm) && <p className="muted">Ainda não aberta para os jogadores (abre em {formatarData(liberaEm!)}); você, como admin, pode confirmar.</p>}
            <div className="presenca">
              {OPCOES.map((o) => {
                const ehVou = o.v === 'confirmado'
                const ativo = ehVou ? euConfirmado || naFila : minha === o.v
                return (
                  <button
                    key={o.v}
                    type="button"
                    aria-pressed={ativo}
                    className={`btn-presenca ${ehVou && (naFila || (vaiParaFila && !euConfirmado)) ? 'espera' : o.cls} ${ativo ? 'ativo' : ''}`}
                    disabled={definir.isPending}
                    onClick={() => {
                      if (ehVou && precisaFuncao && !euConfirmado && !naFila) return setEscolhendoFuncao(true)
                      setEscolhendoFuncao(false)
                      // sair da lista/da presença: grava vazio; entrar: o banco decide se confirma ou manda para a espera
                      definir.mutate({ jogoId: jogo.id, jogadorId: eu.id, status: ativo ? null : o.v })
                    }}
                  >
                    {ehVou ? (naFila ? '⏳ Na lista de espera' : vaiParaFila ? '⏳ Lista de espera' : o.rot) : o.rot}
                  </button>
                )
              })}
            </div>
            {naFila && (
              <p className="muted">
                Você está em <strong>{posicaoNaFila}º</strong> na lista de espera. Se alguém cancelar, você entra automaticamente.
                Toque de novo para sair da fila.
              </p>
            )}
            {precisaFuncao && (escolhendoFuncao || euConfirmado || naFila) && (
              <div className="form" style={{ borderTop: '1px solid var(--borda)', paddingTop: '.7rem' }}>
                <strong>🧤 Você é goleiro. Onde vai jogar neste jogo?</strong>
                <div className="seg">
                  {([['gol', '🧤 No gol'], ['linha', `🏃 Na linha (${POSICOES[eu.posicao_secundaria!]})`]] as [FuncaoGoleiro, string][]).map(([f, rot]) => (
                    <button
                      key={f}
                      type="button"
                      className={(euConfirmado || naFila) && (minhaPres?.funcao ?? 'gol') === f ? 'ativo ok' : ''}
                      disabled={definir.isPending}
                      onClick={() => {
                        setEscolhendoFuncao(false)
                        definir.mutate({ jogoId: jogo.id, jogadorId: eu.id, status: 'confirmado', funcao: f })
                      }}
                    >
                      {rot}
                    </button>
                  ))}
                </div>
                {!euConfirmado && !naFila && <span className="muted">Escolha uma opção para confirmar sua presença.</span>}
              </div>
            )}
            {vaiParaFila && !naFila && <p className="muted">Jogo cheio ({limite} jogadores). Quem entrar agora fica na lista de espera e é chamado se alguém cancelar.</p>}
            <Erro erro={definir.error} />
          </div>
        )}

        <Lista
          titulo={`Confirmados (${participantes.length}${limite ? `/${limite}` : ''})`}
          lista={participantes}
          convidadoDe={donoDoConvidado}
          posicoes
          funcoes={funcoes}
        />
        {esperando.length > 0 && (
          <Lista titulo={`⏳ Lista de espera (${esperando.length})`} lista={esperando} ordem posicoes funcoes={funcoes} />
        )}
        {(agendado || convidados.length > 0) && (
          <Convidados jogo={jogo} convidados={convidados} jogadores={jogadores} podeConvidar={agendado && liberada && !cheio} cheio={agendado && cheio} />
        )}

        {ausentes.length > 0 && <Lista titulo={`Não vão (${ausentes.length})`} lista={ausentes} />}

        {jogo.sorteio && <Times jogo={jogo} jogadores={todos} jogosAno={jogosAno} funcoes={funcoes} />}

        </>
      )}

      {jogo.status === 'realizado' || jogo.votacao_aberta ? (
        <Votacao jogoId={jogo.id} aberta={jogo.votacao_aberta} confirmados={confirmados} />
      ) : null}

      {isAdmin && (
        <div className="card">
          <h2>Administração</h2>
          <div className="linha wrap">
            <button className="btn sec peq" onClick={() => setEditando(true)}>✏️ Editar jogo</button>
            {!posJogo && jogo.status !== 'cancelado' && (
              <button className="btn peq" disabled={confirmados.length < 2 || atualizar.isPending} onClick={sortearTimes}>
                🎲 {jogo.sorteio ? 'Sortear de novo' : 'Sortear times'}
              </button>
            )}
            {!posJogo && jogo.sorteio && (
              <button className="btn sec peq" onClick={() => confirm('Remover o sorteio?') && atualizar.mutate({ id: jogo.id, sorteio: null })}>Limpar sorteio</button>
            )}
            {agendado && (
              <button className="btn sec peq" onClick={() => atualizar.mutate({ id: jogo.id, status: 'cancelado' })}>🚫 Cancelar</button>
            )}
            {agendado && (
              <button className="btn peq" onClick={() => setEncerrando(true)}>✅ Encerrar jogo</button>
            )}
            {posJogo && (
              <button className="btn peq" onClick={() => setEncerrando(true)}>📝 Placar e faltosos</button>
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
          {jogo.status !== 'cancelado' && jogo.data <= hojeISO() && (
            <Faltosos jogo={jogo} confirmados={confirmados} convidados={convidados} jogadores={jogadores} presencas={pres} />
          )}
          {agendado && (
            <AdminPresenca jogoId={jogo.id} jogadores={jogadores} presencas={pres} />
          )}
        </div>
      )}

      {encerrando && (
        <EncerrarJogo jogo={jogo} participantes={participantes} funcoes={funcoes} onFechar={() => setEncerrando(false)} />
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

function Lista({ titulo, lista, funcoes = {}, convidadoDe = {}, ordem = false, posicoes = false }: {
  titulo: string; lista: Jogador[]; funcoes?: Record<string, FuncaoGoleiro>; convidadoDe?: Record<string, string>
  ordem?: boolean; posicoes?: boolean
}) {
  return (
    <div className="card">
      <h3>{titulo}</h3>
      {lista.length === 0 && <span className="muted">Ninguém ainda.</span>}
      {lista.map((j, i) => (
        <div className="linha" key={j.id}>
          {ordem && <strong className="pos-tag">{i + 1}º</strong>}
          <Avatar nome={exibir(j)} numero={j.numero_camisa} />
          <span className="grow">
            {exibir(j)}
            {j.posicao === 'goleiro' && funcoes[j.id] !== 'linha' && <span role="img" aria-label="Goleiro" title="Goleiro"> 🧤</span>}
            {posicoes && <span className="muted" style={{ display: 'block' }}>{textoPosicao(j, funcoes[j.id])}</span>}
          </span>
          {convidadoDe[j.id] && <span className="chip aviso">convidado de {convidadoDe[j.id]}</span>}
          {funcoes[j.id] === 'linha' && <span className="chip aviso">joga na linha</span>}
          {j.tipo === 'avulso' && !convidadoDe[j.id] && <span className="chip">avulso</span>}
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
    data: jogo.data, horario: jogo.horario.slice(0, 5), local: jogo.local ?? '', observacoes: jogo.observacoes ?? '',
    placar_branco: jogo.placar_branco?.toString() ?? '', placar_preto: jogo.placar_preto?.toString() ?? '', valor: jogo.valor?.toString() ?? '',
  })
  return (
    <Modal titulo="Editar jogo" onFechar={onFechar}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          const temPlacar = f.placar_branco !== '' && f.placar_preto !== ''
          atualizar.mutate(
            {
              id: jogo.id, data: f.data, horario: f.horario, local: f.local || null, observacoes: f.observacoes || null,
              valor: f.valor === '' ? null : Number(f.valor),
              placar_branco: temPlacar ? Number(f.placar_branco) : null,
              placar_preto: temPlacar ? Number(f.placar_preto) : null,
              // com placar, o banco define o vencedor; sem placar, limpa
              ...(temPlacar ? {} : { time_vencedor: null }),
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
        <label>Valor individual (R$) — quem jogou fica devendo este valor
          <input type="number" min={0} step="0.01" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
        </label>
        <div>
          <span className="muted">Placar (registre após o jogo)</span>
          <div className="grid2" style={{ marginTop: '.3rem' }}>
            <label>Branco<input type="number" inputMode="numeric" min={0} value={f.placar_branco} onChange={(e) => setF({ ...f, placar_branco: e.target.value })} /></label>
            <label>Preto<input type="number" inputMode="numeric" min={0} value={f.placar_preto} onChange={(e) => setF({ ...f, placar_preto: e.target.value })} /></label>
          </div>
          <span className="muted">Ao registrar o placar, o jogo é marcado como realizado, o vencedor é definido e a votação do craque abre automaticamente.</span>
        </div>
        <label>Observações<textarea rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></label>
        <Erro erro={atualizar.error} />
        <button className="btn" disabled={atualizar.isPending}>Salvar</button>
      </form>
    </Modal>
  )
}

/** Goleiro "de hoje": de posição, a menos que tenha avisado que joga na linha. */
const ehGoleiroDeHoje = (j: Jogador | undefined, funcao?: FuncaoGoleiro) => j?.posicao === 'goleiro' && funcao !== 'linha'

function Times({ jogo, jogadores, jogosAno, funcoes }: {
  jogo: NonNullable<ReturnType<typeof useJogo>['data']>
  jogadores: Jogador[]
  jogosAno: Record<string, number>
  funcoes: Record<string, FuncaoGoleiro>
}) {
  const sorteio = jogo.sorteio!
  const por = new Map(jogadores.map((j) => [j.id, j]))
  const venceu = jogo.time_vencedor
  const semTime = sorteio.reservas ?? [] // sorteios antigos: reservas sem time

  return (
    <div className="card">
      <h2>🎲 Times sorteados</h2>
      <p className="muted">Todos os confirmados entram em um time. Quem passa de 14 fica no banco do time e é escolhido pela posição; o nº de jogos no ano só desempata.</p>
      <TimeLista cor="branco" lista={sorteio.branco} banco={sorteio.reservas_branco ?? []} por={por} venceu={venceu} funcoes={funcoes} jogosAno={jogosAno} />
      <TimeLista cor="preto" lista={sorteio.preto} banco={sorteio.reservas_preto ?? []} por={por} venceu={venceu} funcoes={funcoes} jogosAno={jogosAno} />
      {semTime.length > 0 && (
        <TimeLista cor={null} lista={[]} banco={semTime} por={por} venceu={venceu} funcoes={funcoes} jogosAno={jogosAno} titulo="Reservas" />
      )}
      <h3>Escalação inicial · formação 2-3-1</h3>
      <Escalacao sorteio={sorteio} jogadores={jogadores} />
      <p className="muted">Camisa verde listrada = goleiro. Contorno tracejado = jogando fora da posição.</p>
    </div>
  )
}

function TimeLista({ cor, lista, banco, por, venceu, funcoes, jogosAno, titulo }: {
  cor: 'branco' | 'preto' | null
  lista: Escalado[]
  banco: string[]
  por: Map<string, Jogador>
  venceu: string | null
  funcoes: Record<string, FuncaoGoleiro>
  jogosAno: Record<string, number>
  titulo?: string
}) {
  const luva = <span role="img" aria-label="Goleiro" title="Goleiro"> 🧤</span>
  return (
    <div style={{ display: 'grid', gap: '.4rem' }}>
      <div className="time-cab">
        {cor && <span className={`bolinha ${cor}`} />}
        <h3>
          {titulo ?? NOME_TIME[cor!]} ({lista.length + banco.length}){cor && venceu === cor && ' 🏆'}
        </h3>
      </div>
      {lista.map((e) => {
        const j = por.get(e.id)
        const gol = e.slot === 'GOL'
        return (
          <div className="linha" key={e.id}>
            <span className="pos-tag">{NOME_SLOT[e.slot].slice(0, 3).toUpperCase()}</span>
            <Avatar nome={j ? exibir(j) : '?'} numero={j?.numero_camisa} time={cor ?? undefined} goleiro={gol} />
            <span className="grow">{j ? exibir(j) : '—'}{gol && luva}</span>
            {e.fora && <span className="chip fora" title="Fora da posição preferida">fora de posição</span>}
          </div>
        )
      })}
      {banco.length > 0 && (
        <>
          <span className="muted">{cor ? 'Banco' : 'Reservas'} ({banco.length})</span>
          {banco.map((id) => {
            const j = por.get(id)
            const gol = ehGoleiroDeHoje(j, funcoes[id])
            return (
              <div className="linha" key={id}>
                <span className="pos-tag">RES</span>
                <Avatar nome={j ? exibir(j) : '?'} numero={j?.numero_camisa} time={cor ?? undefined} goleiro={gol} />
                <span className="grow">
                  {j ? exibir(j) : '—'}{gol && luva}
                  {j && <span className="muted" style={{ display: 'block' }}>{textoPosicao(j, funcoes[id])}</span>}
                </span>
                <span className="chip">{jogosAno[id] ?? 0} {(jogosAno[id] ?? 0) === 1 ? 'jogo' : 'jogos'} no ano</span>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

/** Convidados avulsos: qualquer jogador pode trazer; paga o mesmo valor dos demais (cobrado de quem convidou). */
function Convidados({ jogo, convidados, jogadores, podeConvidar, cheio }: {
  jogo: NonNullable<ReturnType<typeof useJogo>['data']>
  convidados: Convidado[]
  jogadores: Jogador[]
  podeConvidar: boolean
  cheio: boolean
}) {
  const { eu, isAdmin } = useAuth()
  const remover = useRemoverConvidado()
  const [abrir, setAbrir] = useState(false)
  const agendado = jogo.status === 'agendado'

  return (
    <div className="card">
      <div className="linha entre">
        <h3>Convidados ({convidados.length})</h3>
        {eu && podeConvidar && <button className="btn peq" onClick={() => setAbrir(true)}>➕ Convidar</button>}
      </div>
      {agendado && (
        <p className="muted">
          Cada convidado paga o mesmo valor dos jogadores{jogo.valor != null ? ` (${moeda(jogo.valor)})` : ''}; quem convidou fica responsável pelo pagamento.
          {cheio && ' A lista está cheia.'}
        </p>
      )}
      {convidados.length === 0 && <span className="muted">Nenhum convidado.</span>}
      {convidados.map((c) => {
        const dono = jogadores.find((j) => j.id === c.convidado_por)
        const meu = c.convidado_por === eu?.id
        return (
          <div className="linha" key={c.id}>
            <Avatar nome={c.nome} />
            <span className="grow">
              {c.nome}
              <span className="muted" style={{ display: 'block' }}>
                convidado de {dono ? exibir(dono) : '?'}{c.posicao ? ` · ${POSICOES[c.posicao]}` : ''}
              </span>
            </span>
            {((meu && agendado) || isAdmin) && (
              <button
                className="btn perigo peq" disabled={remover.isPending} aria-label={`Remover ${c.nome}`}
                onClick={() => confirm(`Remover o convidado ${c.nome}?`) && remover.mutate(c.id)}
              >
                ✕
              </button>
            )}
          </div>
        )
      })}
      <Erro erro={remover.error} />
      {abrir && eu && <NovoConvidado jogoId={jogo.id} donoId={eu.id} onFechar={() => setAbrir(false)} />}
    </div>
  )
}

function NovoConvidado({ jogoId, donoId, onFechar }: { jogoId: string; donoId: string; onFechar: () => void }) {
  const adicionar = useAdicionarConvidado()
  const [nome, setNome] = useState('')
  const [posicao, setPosicao] = useState<Posicao | ''>('')
  return (
    <Modal titulo="Convidar jogador" onFechar={onFechar}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          adicionar.mutate(
            { jogo_id: jogoId, convidado_por: donoId, nome: nome.trim(), posicao: posicao || null },
            { onSuccess: onFechar },
          )
        }}
      >
        <label>Nome do convidado<input value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus /></label>
        <label>Posição (opcional, ajuda no sorteio)
          <select value={posicao} onChange={(e) => setPosicao(e.target.value as Posicao | '')}>
            <option value="">Qualquer</option>
            {Object.entries(POSICOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <Erro erro={adicionar.error} />
        <button className="btn" disabled={adicionar.isPending}>Adicionar convidado</button>
      </form>
    </Modal>
  )
}

/** Admin: tira da lista quem confirmou e não apareceu (some do sorteio, da cobrança e da votação). */
function Faltosos({ jogo, confirmados, convidados, jogadores, presencas }: {
  jogo: NonNullable<ReturnType<typeof useJogo>['data']>
  confirmados: Jogador[]
  convidados: Convidado[]
  jogadores: Jogador[]
  presencas: { jogador_id: string; status: StatusPresenca }[]
}) {
  const [aberto, setAberto] = useState(false)
  const removerJogador = useRemoverFaltoso()
  const removerConvidado = useRemoverConvidado()
  const restaurar = useDefinirPresenca()
  const faltaram = jogadores.filter((j) => presencas.some((p) => p.jogador_id === j.id && p.status === 'faltou'))
  const votando = jogo.votacao_aberta
  const aviso = votando ? ' A votação já está aberta: os votos dele(a) neste jogo serão apagados.' : ''

  return (
    <>
      <button className="btn sec" onClick={() => setAberto(!aberto)}>
        {aberto ? 'Ocultar' : `🚷 Quem não compareceu? (${confirmados.length + convidados.length})`}
      </button>
      {aberto && (
        <div className="form">
          <p className="muted">Remova quem confirmou e não apareceu, preferencialmente antes de a votação começar.</p>
          {confirmados.map((j) => (
            <div className="linha" key={j.id}>
              <Avatar nome={exibir(j)} numero={j.numero_camisa} />
              <span className="grow">{exibir(j)}</span>
              <button
                className="btn perigo peq" disabled={removerJogador.isPending}
                onClick={() => confirm(`Marcar ${exibir(j)} como faltou?${aviso}`) && removerJogador.mutate({ jogoId: jogo.id, jogadorId: j.id })}
              >
                Faltou
              </button>
            </div>
          ))}
          {convidados.map((c) => (
            <div className="linha" key={c.id}>
              <Avatar nome={c.nome} />
              <span className="grow">{c.nome} <span className="chip">convidado</span></span>
              <button
                className="btn perigo peq" disabled={removerConvidado.isPending}
                onClick={() => confirm(`Remover o convidado ${c.nome}?`) && removerConvidado.mutate(c.id)}
              >
                Faltou
              </button>
            </div>
          ))}
          {faltaram.length > 0 && <h3>Marcados como faltou</h3>}
          {faltaram.map((j) => (
            <div className="linha" key={j.id}>
              <span className="grow">{exibir(j)}</span>
              <button
                className="btn sec peq" disabled={restaurar.isPending}
                onClick={() => restaurar.mutate({ jogoId: jogo.id, jogadorId: j.id, status: 'confirmado' })}
              >
                ↩︎ Desfazer
              </button>
            </div>
          ))}
          <Erro erro={removerJogador.error ?? removerConvidado.error ?? restaurar.error} />
        </div>
      )}
    </>
  )
}
