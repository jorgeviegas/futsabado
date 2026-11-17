import { useState } from 'react'
import { useAuth } from '../lib/auth'
import {
  useDefinirPresenca, useExcluirJogoCompetitivo, useJogadores, useJogosCompetitivos, usePresencasCompetitivo,
  useSalvarJogoCompetitivo, type JogoCompetitivoForm,
} from '../lib/api'
import { exibir, formatarData, formatarHora, hojeISO, parseData } from '../lib/format'
import { Avatar, Erro, Modal, Spinner } from '../components/ui'
import EncerrarJogo from '../components/EncerrarJogo'
import type { Jogador, Jogo, Presenca } from '../lib/types'

type Resultado = 'V' | 'E' | 'D'
const resultado = (j: Jogo): Resultado | null =>
  j.status === 'realizado' && j.gols_pro != null && j.gols_contra != null
    ? j.gols_pro > j.gols_contra ? 'V' : j.gols_pro < j.gols_contra ? 'D' : 'E'
    : null

/** Aba Competitivo: jogos do time contra outros times. Só enxerga quem recebeu acesso de um admin; só admins editam. */
export default function Competitivo() {
  const { eu, isAdmin } = useAuth()
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(anoAtual)
  const { data: jogos = [], isLoading, error } = useJogosCompetitivos(ano)
  const { data: pres = [] } = usePresencasCompetitivo(jogos.map((j) => j.id))
  const [aberto, setAberto] = useState<string | null>(null)   // jogo com o detalhe aberto
  const [novo, setNovo] = useState(false)

  const feitos = jogos.filter((j) => resultado(j))
  const v = feitos.filter((j) => resultado(j) === 'V').length
  const e = feitos.filter((j) => resultado(j) === 'E').length
  const d = feitos.filter((j) => resultado(j) === 'D').length
  const gp = feitos.reduce((a, j) => a + (j.gols_pro ?? 0), 0)
  const gc = feitos.reduce((a, j) => a + (j.gols_contra ?? 0), 0)
  const jogoAberto = jogos.find((j) => j.id === aberto) ?? null

  return (
    <>
      <div className="linha entre">
        <h1>⚔️ Competitivo</h1>
        {isAdmin && <button className="btn peq" onClick={() => setNovo(true)}>➕ Novo jogo</button>}
      </div>

      <div className="linha entre">
        <button className="btn sec peq" aria-label="Ano anterior" onClick={() => setAno(ano - 1)}>◀</button>
        <strong>Jogos de {ano}</strong>
        <button className="btn sec peq" aria-label="Próximo ano" disabled={ano >= anoAtual + 1} onClick={() => setAno(ano + 1)}>▶</button>
      </div>

      {feitos.length > 0 && (
        <div className="card campanha">
          <div><strong>{feitos.length}</strong><span className="muted">jogos</span></div>
          <div><strong style={{ color: 'var(--ok)' }}>{v}</strong><span className="muted">vitórias</span></div>
          <div><strong>{e}</strong><span className="muted">empates</span></div>
          <div><strong style={{ color: 'var(--erro)' }}>{d}</strong><span className="muted">derrotas</span></div>
          <div><strong>{gp}:{gc}</strong><span className="muted">gols</span></div>
        </div>
      )}

      {isLoading && <Spinner />}
      <Erro erro={error} />
      {!isLoading && !error && jogos.length === 0 && (
        <p className="vazio">Nenhum jogo competitivo em {ano}.{isAdmin ? ' Toque em “Novo jogo” para marcar o primeiro.' : ''}</p>
      )}

      {jogos.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tabela-comp">
            <thead>
              <tr><th>Data</th><th>Adversário</th><th>Resultado</th></tr>
            </thead>
            <tbody>
              {jogos.map((j) => {
                const r = resultado(j)
                const dt = parseData(j.data)
                const doJogo = pres.filter((p) => p.jogo_id === j.id)
                const confirmados = doJogo.filter((p) => p.status === 'confirmado').length
                const minha = doJogo.find((p) => p.jogador_id === eu?.id)?.status
                const aguardando = j.status === 'agendado'
                return (
                  <tr key={j.id} className="clicavel" onClick={() => setAberto(j.id)} style={{ opacity: j.status === 'cancelado' ? 0.5 : 1 }}>
                    <td>
                      <strong>{String(dt.getDate()).padStart(2, '0')}/{String(dt.getMonth() + 1).padStart(2, '0')}</strong>
                      <span className="muted" style={{ display: 'block' }}>
                        {dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')} · {formatarHora(j.horario)}
                      </span>
                    </td>
                    <td>
                      <strong>{j.adversario}</strong>
                      <span className="muted" style={{ display: 'block' }}>
                        {[j.competicao, j.local].filter(Boolean).join(' · ') || '—'}
                      </span>
                      {aguardando && <span className="muted" style={{ display: 'block' }}>👥 {confirmados} {confirmados === 1 ? 'confirmado' : 'confirmados'}</span>}
                    </td>
                    <td>
                      {r ? (
                        <span className={`chip ${r === 'V' ? 'ok' : r === 'D' ? 'erro' : ''}`}>{j.gols_pro} x {j.gols_contra}</span>
                      ) : j.status === 'cancelado' ? (
                        <span className="chip erro">Cancelado</span>
                      ) : eu?.competitivo && minha === 'confirmado' ? (
                        <span className="chip ok">Confirmado ✓</span>
                      ) : eu?.competitivo && minha === 'ausente' ? (
                        <span className="chip erro">Não vou</span>
                      ) : eu?.competitivo && j.data >= hojeISO() ? (
                        <span className="chip grena">Responder</span>
                      ) : j.data >= hojeISO() ? (
                        <span className="chip aviso">Agendado</span>
                      ) : (
                        <span className="chip aviso">Sem placar</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">Toque em um jogo para ver os detalhes{isAdmin ? ', editar ou encerrar a partida' : ' e confirmar presença'}. Estes jogos não entram nos rankings, no score nem nas cobranças da pelada.</p>

      {jogoAberto && <DetalheJogo jogo={jogoAberto} pres={pres.filter((p) => p.jogo_id === jogoAberto.id)} onFechar={() => setAberto(null)} />}
      {novo && <FormJogo inicial={{}} onFechar={() => setNovo(false)} />}
    </>
  )
}

/** Detalhe do jogo: presença de quem tem acesso; para admins, também editar e encerrar (gols e assistências). */
function DetalheJogo({ jogo, pres, onFechar }: { jogo: Jogo; pres: Presenca[]; onFechar: () => void }) {
  const { eu, isAdmin } = useAuth()
  const { data: jogadores = [] } = useJogadores()
  const definir = useDefinirPresenca()
  const [editando, setEditando] = useState(false)
  const [encerrando, setEncerrando] = useState(false)

  const nome = (id: string) => jogadores.find((j) => j.id === id)
  const confirmados = pres.filter((p) => p.status === 'confirmado').map((p) => nome(p.jogador_id)).filter(Boolean) as Jogador[]
  const ausentes = pres.filter((p) => p.status === 'ausente').map((p) => nome(p.jogador_id)).filter(Boolean) as Jogador[]
  const minha = pres.find((p) => p.jogador_id === eu?.id)?.status
  const agendado = jogo.status === 'agendado'
  const r = resultado(jogo)
  const estat = (id: string) => pres.find((p) => p.jogador_id === id)

  if (editando) return <FormJogo inicial={jogo} onFechar={() => setEditando(false)} aoSalvar={onFechar} />
  if (encerrando) {
    return <EncerrarJogo jogo={jogo} participantes={confirmados} funcoes={{}} onFechar={() => { setEncerrando(false); onFechar() }} />
  }

  return (
    <Modal titulo={`vs ${jogo.adversario}`} onFechar={onFechar}>
      <div className="form">
        <div>
          <strong>⚔️ {jogo.adversario}</strong>
          {jogo.competicao && <span className="muted" style={{ display: 'block' }}>{jogo.competicao}</span>}
          <span className="muted" style={{ display: 'block' }}>
            {formatarData(jogo.data)} às {formatarHora(jogo.horario)}{jogo.local ? ` · 📍 ${jogo.local}` : ''}
          </span>
        </div>

        {r && (
          <div className={`chip ${r === 'V' ? 'ok' : r === 'D' ? 'erro' : ''}`} style={{ justifySelf: 'start', fontSize: '1.1rem' }}>
            {r === 'V' ? 'Vitória' : r === 'D' ? 'Derrota' : 'Empate'} · {jogo.gols_pro} x {jogo.gols_contra}
          </div>
        )}
        {jogo.status === 'cancelado' && <span className="chip erro" style={{ justifySelf: 'start' }}>Jogo cancelado</span>}

        {agendado && eu?.competitivo && (
          <div>
            <strong>Você vai?</strong>
            <div className="presenca">
              {([['confirmado', '✅ Vou', 'ok'], ['ausente', '❌ Não vou', 'erro']] as const).map(([v, rot, cls]) => {
                const ativo = minha === v
                return (
                  <button
                    key={v} type="button" aria-pressed={ativo} disabled={definir.isPending}
                    className={`btn-presenca ${cls} ${ativo ? 'ativo' : ''}`}
                    onClick={() => definir.mutate({ jogoId: jogo.id, jogadorId: eu.id, status: ativo ? null : v })}
                  >
                    {rot}
                  </button>
                )
              })}
            </div>
            <Erro erro={definir.error} />
          </div>
        )}
        {agendado && !eu?.competitivo && <span className="muted">Você não está no grupo competitivo, então não confirma presença neste jogo.</span>}

        <div>
          <strong>Confirmados ({confirmados.length})</strong>
          {confirmados.length === 0 && <span className="muted" style={{ display: 'block' }}>Ninguém confirmou ainda.</span>}
          {confirmados.map((j) => {
            const p = estat(j.id)
            return (
              <div className="faltou-linha" key={j.id}>
                <Avatar nome={exibir(j)} numero={j.numero_camisa} pequeno />
                <span className="grow">{exibir(j)}</span>
                {!agendado && !!(p?.gols || p?.assistencias) && (
                  <span className="muted">{p?.gols ? `⚽ ${p.gols}` : ''} {p?.assistencias ? `🍽️ ${p.assistencias}` : ''}</span>
                )}
              </div>
            )
          })}
        </div>
        {ausentes.length > 0 && (
          <div>
            <strong>Não vão ({ausentes.length})</strong>
            <span className="muted" style={{ display: 'block' }}>{ausentes.map(exibir).join(', ')}</span>
          </div>
        )}

        {isAdmin && (
          <div className="linha wrap">
            {jogo.status !== 'cancelado' && (
              <button className="btn" onClick={() => setEncerrando(true)}>
                {agendado ? '✅ Encerrar partida' : '📝 Placar e estatísticas'}
              </button>
            )}
            <button className="btn sec" onClick={() => setEditando(true)}>✏️ Editar jogo</button>
          </div>
        )}
      </div>
    </Modal>
  )
}

function FormJogo({ inicial, onFechar, aoSalvar }: { inicial: Partial<Jogo>; onFechar: () => void; aoSalvar?: () => void }) {
  const salvar = useSalvarJogoCompetitivo()
  const excluir = useExcluirJogoCompetitivo()
  const [f, setF] = useState({
    adversario: inicial.adversario ?? '',
    competicao: inicial.competicao ?? '',
    data: inicial.data ?? hojeISO(),
    horario: inicial.horario?.slice(0, 5) ?? '20:00',
    local: inicial.local ?? '',
    status: (inicial.status ?? 'agendado') as JogoCompetitivoForm['status'],
  })
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))
  const realizado = inicial.status === 'realizado'

  return (
    <Modal titulo={inicial.id ? 'Editar jogo' : 'Novo jogo competitivo'} onFechar={onFechar}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          salvar.mutate(
            {
              id: inicial.id, adversario: f.adversario.trim(), competicao: f.competicao.trim() || null, data: f.data, horario: f.horario,
              local: f.local.trim() || null, status: f.status,
            },
            { onSuccess: () => { onFechar(); aoSalvar?.() } },
          )
        }}
      >
        <label>Adversário<input value={f.adversario} onChange={(e) => set('adversario', e.target.value)} required maxLength={80} autoFocus placeholder="Ex.: Leões FC" /></label>
        <label>Competição (opcional)<input value={f.competicao} onChange={(e) => set('competicao', e.target.value)} maxLength={80} placeholder="Ex.: Copa da Cidade — 1ª fase" /></label>
        <div className="grid2">
          <label>Data<input type="date" value={f.data} onChange={(e) => set('data', e.target.value)} required /></label>
          <label>Horário<input type="time" value={f.horario} onChange={(e) => set('horario', e.target.value)} required /></label>
        </div>
        <label>Local (opcional)<input value={f.local} onChange={(e) => set('local', e.target.value)} maxLength={120} /></label>
        {inicial.id && (
          <label>Situação
            <select value={f.status} onChange={(e) => set('status', e.target.value)} disabled={realizado && f.status === 'realizado'}>
              <option value="agendado">Agendado</option>
              {realizado && <option value="realizado">Realizado</option>}
              <option value="cancelado">Cancelado</option>
            </select>
          </label>
        )}
        {!inicial.id && <span className="muted">Os jogadores do grupo competitivo recebem uma notificação para confirmar presença.</span>}
        <Erro erro={salvar.error ?? excluir.error} />
        <button className="btn" disabled={salvar.isPending}>{salvar.isPending ? 'Salvando…' : 'Salvar'}</button>
        {inicial.id && (
          <button
            type="button" className="btn perigo" disabled={excluir.isPending}
            onClick={() => confirm(`Excluir o jogo contra ${inicial.adversario}?`) && excluir.mutate(inicial.id!, { onSuccess: () => { onFechar(); aoSalvar?.() } })}
          >
            Excluir jogo
          </button>
        )}
      </form>
    </Modal>
  )
}
