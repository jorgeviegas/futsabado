import { useState } from 'react'
import { useCriarJogoAvulso, useExcluirPelada, useGerarJogos, usePeladas, useSalvarPelada } from '../lib/api'
import { DIAS, formatarHora, hojeISO, moeda } from '../lib/format'
import { Erro, Modal, Spinner, Vazio } from '../components/ui'
import type { Pelada } from '../lib/types'

export default function Peladas() {
  const { data, isLoading, error } = usePeladas()
  const [editando, setEditando] = useState<Partial<Pelada> | null>(null)
  const [extra, setExtra] = useState<Pelada | null>(null)
  const gerar = useGerarJogos()
  const [msg, setMsg] = useState('')

  if (isLoading) return <Spinner />
  if (error) return <Erro erro={error} />

  return (
    <>
      <h1>Peladas recorrentes</h1>
      <p className="muted">Cadastre uma pelada semanal e gere os jogos das próximas semanas com um toque.</p>
      {msg && <p className="ok-msg">{msg}</p>}
      <Erro erro={gerar.error} />
      {!data?.length && <Vazio>Nenhuma pelada cadastrada. Toque em + para criar a primeira.</Vazio>}
      {data?.map((p) => (
        <div className="card" key={p.id} style={{ opacity: p.ativa ? 1 : 0.55 }}>
          <div className="linha entre">
            <h2>{p.nome}</h2>
            {!p.ativa && <span className="chip">pausada</span>}
          </div>
          <div className="muted">
            Toda {DIAS[p.dia_semana].toLowerCase()} às {formatarHora(p.horario)}{p.local && ` · ${p.local}`}
            <br />
            {p.limite_jogadores ? `Limite ${p.limite_jogadores} · ` : ''}Mensalidade {moeda(p.valor_mensalidade)} · {moeda(p.valor_avulso)} por jogo
          </div>
          <div className="linha wrap">
            <button
              className="btn peq"
              disabled={gerar.isPending || !p.ativa}
              onClick={() => gerar.mutate({ peladaId: p.id, semanas: 4 }, {
                onSuccess: (n) => setMsg(n ? `${n} jogo(s) criado(s).` : 'Os próximos 4 jogos já existiam.'),
              })}
            >
              🔄 Gerar próximas 4 semanas
            </button>
            <button className="btn sec peq" onClick={() => setExtra(p)}>➕ Jogo extra</button>
            <button className="btn sec peq" onClick={() => setEditando(p)}>✏️ Editar</button>
          </div>
        </div>
      ))}
      <button className="fab" aria-label="Nova pelada" onClick={() => setEditando({ dia_semana: 6, horario: '08:00', ativa: true })}>+</button>
      {editando && <Form inicial={editando} onFechar={() => setEditando(null)} />}
      {extra && <JogoExtra pelada={extra} onFechar={() => setExtra(null)} />}
    </>
  )
}

function Form({ inicial, onFechar }: { inicial: Partial<Pelada>; onFechar: () => void }) {
  const salvar = useSalvarPelada()
  const excluir = useExcluirPelada()
  const [f, setF] = useState({
    nome: inicial.nome ?? 'Pelada de Sábado',
    dia_semana: inicial.dia_semana ?? 6,
    horario: (inicial.horario ?? '08:00').slice(0, 5),
    local: inicial.local ?? '',
    limite_jogadores: inicial.limite_jogadores?.toString() ?? '',
    valor_mensalidade: String(inicial.valor_mensalidade ?? 0),
    valor_avulso: String(inicial.valor_avulso ?? 0),
    liberar: String(inicial.liberar_confirmacao_dias ?? 2),
    ativa: inicial.ativa ?? true,
  })
  return (
    <Modal titulo={inicial.id ? 'Editar pelada' : 'Nova pelada'} onFechar={onFechar}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          salvar.mutate(
            {
              id: inicial.id, nome: f.nome.trim(), dia_semana: Number(f.dia_semana), horario: f.horario,
              local: f.local.trim() || null, limite_jogadores: f.limite_jogadores ? Number(f.limite_jogadores) : null,
              valor_mensalidade: Number(f.valor_mensalidade) || 0, valor_avulso: Number(f.valor_avulso) || 0, ativa: f.ativa,
              liberar_confirmacao_dias: Math.min(6, Math.max(0, Number(f.liberar) || 0)),
            },
            { onSuccess: onFechar },
          )
        }}
      >
        <label>Nome<input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required /></label>
        <div className="grid2">
          <label>Dia da semana
            <select value={f.dia_semana} onChange={(e) => setF({ ...f, dia_semana: Number(e.target.value) })}>
              {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </label>
          <label>Horário<input type="time" value={f.horario} onChange={(e) => setF({ ...f, horario: e.target.value })} required /></label>
        </div>
        <label>Local<input value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} /></label>
        <label>Limite de jogadores (opcional)<input type="number" min={1} value={f.limite_jogadores} onChange={(e) => setF({ ...f, limite_jogadores: e.target.value })} /></label>
        <p className="muted">O valor individual é copiado para cada jogo gerado e pode ser ajustado jogo a jogo. Quem joga fica devendo esse valor.</p>
        <div className="grid2">
          <label>Mensalidade (R$)<input type="number" min={0} step="0.01" value={f.valor_mensalidade} onChange={(e) => setF({ ...f, valor_mensalidade: e.target.value })} /></label>
          <label>Valor individual por jogo (R$)<input type="number" min={0} step="0.01" value={f.valor_avulso} onChange={(e) => setF({ ...f, valor_avulso: e.target.value })} /></label>
        </div>
        <label>Liberar a confirmação de presença (dias após o jogo anterior)
          <input type="number" min={0} max={6} value={f.liberar} onChange={(e) => setF({ ...f, liberar: e.target.value })} />
          <span className="muted">Ex.: 2 = segunda-feira para jogos de sábado; 1 = domingo. Admins confirmam a qualquer momento.</span>
        </label>
        <label className="linha"><input type="checkbox" style={{ width: 'auto' }} checked={f.ativa} onChange={(e) => setF({ ...f, ativa: e.target.checked })} /> Ativa</label>
        <Erro erro={salvar.error ?? excluir.error} />
        <button className="btn" disabled={salvar.isPending}>Salvar</button>
        {inicial.id && (
          <button type="button" className="btn perigo" onClick={() => confirm('Excluir pelada e todos os jogos dela?') && excluir.mutate(inicial.id!, { onSuccess: onFechar })}>
            Excluir
          </button>
        )}
      </form>
    </Modal>
  )
}

function JogoExtra({ pelada, onFechar }: { pelada: Pelada; onFechar: () => void }) {
  const criar = useCriarJogoAvulso()
  const [data, setData] = useState(hojeISO())
  const [horario, setHorario] = useState(pelada.horario.slice(0, 5))
  const [valor, setValor] = useState(String(pelada.valor_avulso))
  return (
    <Modal titulo="Jogo extra" onFechar={onFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); criar.mutate({ pelada_id: pelada.id, data, horario, local: pelada.local, valor: Number(valor) || 0 }, { onSuccess: onFechar }) }}>
        <div className="grid2">
          <label>Data<input type="date" value={data} onChange={(e) => setData(e.target.value)} required /></label>
          <label>Horário<input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} required /></label>
        </div>
        <label>Valor individual (R$)<input type="number" min={0} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required /></label>
        <Erro erro={criar.error} />
        <button className="btn" disabled={criar.isPending}>Criar jogo</button>
      </form>
    </Modal>
  )
}
