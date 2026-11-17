import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useExcluirJogoCompetitivo, useJogosCompetitivos, useSalvarJogoCompetitivo, type JogoCompetitivoForm } from '../lib/api'
import { formatarHora, hojeISO, parseData } from '../lib/format'
import { Erro, Modal, Spinner } from '../components/ui'
import type { Jogo } from '../lib/types'

type Resultado = 'V' | 'E' | 'D'
const resultado = (j: Jogo): Resultado | null =>
  j.status === 'realizado' && j.gols_pro != null && j.gols_contra != null
    ? j.gols_pro > j.gols_contra ? 'V' : j.gols_pro < j.gols_contra ? 'D' : 'E'
    : null

/** Aba Competitivo: jogos do time contra outros times. Só enxerga quem recebeu acesso de um admin; só admins editam. */
export default function Competitivo() {
  const { isAdmin } = useAuth()
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(anoAtual)
  const { data: jogos = [], isLoading, error } = useJogosCompetitivos(ano)
  const [editando, setEditando] = useState<Partial<Jogo> | null>(null)

  const feitos = jogos.filter((j) => resultado(j))
  const v = feitos.filter((j) => resultado(j) === 'V').length
  const e = feitos.filter((j) => resultado(j) === 'E').length
  const d = feitos.filter((j) => resultado(j) === 'D').length
  const gp = feitos.reduce((a, j) => a + (j.gols_pro ?? 0), 0)
  const gc = feitos.reduce((a, j) => a + (j.gols_contra ?? 0), 0)

  return (
    <>
      <div className="linha entre">
        <h1>🏅 Competitivo</h1>
        {isAdmin && <button className="btn peq" onClick={() => setEditando({})}>➕ Novo jogo</button>}
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
                const futuro = j.status === 'agendado'
                return (
                  <tr key={j.id} className={isAdmin ? 'clicavel' : ''} onClick={isAdmin ? () => setEditando(j) : undefined} style={{ opacity: j.status === 'cancelado' ? 0.5 : 1 }}>
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
                    </td>
                    <td>
                      {r ? (
                        <span className={`chip ${r === 'V' ? 'ok' : r === 'D' ? 'erro' : ''}`}>{j.gols_pro} x {j.gols_contra}</span>
                      ) : j.status === 'cancelado' ? (
                        <span className="chip erro">Cancelado</span>
                      ) : futuro && j.data >= hojeISO() ? (
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
      {isAdmin && jogos.length > 0 && <p className="muted">Toque em um jogo para editar ou registrar o placar.</p>}
      <p className="muted">Estes jogos não entram nos rankings, no score nem nas cobranças da pelada.</p>

      {editando && <FormJogo inicial={editando} onFechar={() => setEditando(null)} />}
    </>
  )
}

function FormJogo({ inicial, onFechar }: { inicial: Partial<Jogo>; onFechar: () => void }) {
  const salvar = useSalvarJogoCompetitivo()
  const excluir = useExcluirJogoCompetitivo()
  const [f, setF] = useState({
    adversario: inicial.adversario ?? '',
    competicao: inicial.competicao ?? '',
    data: inicial.data ?? hojeISO(),
    horario: inicial.horario?.slice(0, 5) ?? '20:00',
    local: inicial.local ?? '',
    status: (inicial.status ?? 'agendado') as JogoCompetitivoForm['status'],
    pro: inicial.gols_pro?.toString() ?? '',
    contra: inicial.gols_contra?.toString() ?? '',
  })
  const realizado = f.status === 'realizado'
  const placarOk = !realizado || (f.pro !== '' && f.contra !== '' && Number(f.pro) >= 0 && Number(f.contra) >= 0)
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))

  return (
    <Modal titulo={inicial.id ? 'Editar jogo' : 'Novo jogo competitivo'} onFechar={onFechar}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!placarOk) return
          salvar.mutate(
            {
              id: inicial.id, adversario: f.adversario.trim(), competicao: f.competicao.trim() || null, data: f.data, horario: f.horario,
              local: f.local.trim() || null, status: f.status,
              gols_pro: realizado ? Number(f.pro) : null, gols_contra: realizado ? Number(f.contra) : null,
            },
            { onSuccess: onFechar },
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
        <label>Situação
          <select value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="agendado">Agendado</option>
            <option value="realizado">Realizado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>
        {realizado && (
          <div className="placar-form">
            <label>Nosso time<input type="number" inputMode="numeric" min={0} max={99} value={f.pro} onChange={(e) => set('pro', e.target.value)} required /></label>
            <span className="x">x</span>
            <label>Adversário<input type="number" inputMode="numeric" min={0} max={99} value={f.contra} onChange={(e) => set('contra', e.target.value)} required /></label>
          </div>
        )}
        <Erro erro={salvar.error ?? excluir.error} />
        <button className="btn" disabled={salvar.isPending || !placarOk}>{salvar.isPending ? 'Salvando…' : 'Salvar'}</button>
        {inicial.id && (
          <button
            type="button" className="btn perigo" disabled={excluir.isPending}
            onClick={() => confirm(`Excluir o jogo contra ${inicial.adversario}?`) && excluir.mutate(inicial.id!, { onSuccess: onFechar })}
          >
            Excluir jogo
          </button>
        )}
      </form>
    </Modal>
  )
}
