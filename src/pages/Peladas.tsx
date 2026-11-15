import { useState } from 'react'
import { useCriarJogoAvulso, useExcluirPelada, useGerarJogos, useJogosDaPelada, usePeladas, useSalvarPelada } from '../lib/api'
import { DIAS, formatarHora, hojeISO, moeda, parseData } from '../lib/format'
import { buscarLugar, type Lugar } from '../lib/clima'
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
            {p.limite_jogadores ? `Limite ${p.limite_jogadores} · ` : ''}{p.goleiros_isentos ? 'Goleiros isentos · ' : ''}{p.gerar_proximo_dias_antes != null ? `🔄 Gera o próximo jogo ${p.gerar_proximo_dias_antes} dias antes · ` : ''}Mensalidade {moeda(p.valor_mensalidade)} · {moeda(p.valor_avulso)} por jogo
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

/** Jogos agendados que ainda não começaram. */
const aindaNaoComecou = (j: { data: string; horario: string; status: string }) =>
  j.status === 'agendado' && new Date(`${j.data}T${j.horario}`).getTime() > Date.now()

function Form({ inicial, onFechar }: { inicial: Partial<Pelada>; onFechar: () => void }) {
  const salvar = useSalvarPelada()
  const { data: jogosDaPelada = [] } = useJogosDaPelada(inicial.id)
  const [aplicar, setAplicar] = useState<{ pelada: Partial<Pelada> & { nome: string }; mudancas: string[]; total: number } | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [f, setF] = useState({
    nome: inicial.nome ?? 'Pelada de Sábado',
    dia_semana: inicial.dia_semana ?? 6,
    horario: (inicial.horario ?? '08:00').slice(0, 5),
    local: inicial.local ?? '',
    limite_jogadores: inicial.limite_jogadores?.toString() ?? '',
    valor_mensalidade: String(inicial.valor_mensalidade ?? 0),
    valor_avulso: String(inicial.valor_avulso ?? 0),
    liberar: String(inicial.liberar_confirmacao_dias ?? 2),
    goleirosIsentos: inicial.goleiros_isentos ?? false,
    autoGerar: inicial.gerar_proximo_dias_antes != null,
    autoDias: String(inicial.gerar_proximo_dias_antes ?? 5),
    latitude: inicial.latitude ?? null,
    longitude: inicial.longitude ?? null,
    cidade: inicial.cidade ?? '',
    ativa: inicial.ativa ?? true,
  })
  return (
    <Modal titulo={inicial.id ? 'Editar pelada' : 'Nova pelada'} onFechar={onFechar}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          const pelada = {
              id: inicial.id, nome: f.nome.trim(), dia_semana: Number(f.dia_semana), horario: f.horario,
              local: f.local.trim() || null, limite_jogadores: f.limite_jogadores ? Number(f.limite_jogadores) : null,
              valor_mensalidade: Number(f.valor_mensalidade) || 0, valor_avulso: Number(f.valor_avulso) || 0, ativa: f.ativa,
              liberar_confirmacao_dias: Math.min(6, Math.max(0, Number(f.liberar) || 0)),
              goleiros_isentos: f.goleirosIsentos,
              gerar_proximo_dias_antes: f.autoGerar ? Math.min(30, Math.max(0, Math.round(Number(f.autoDias) || 0))) : null,
              latitude: f.latitude, longitude: f.longitude, cidade: f.latitude == null ? null : f.cidade || null,
          }
          // Editando um modelo que já tem jogos agendados: pergunta se as mudanças valem para eles também
          if (inicial.id) {
            const regulares = jogosDaPelada.filter((j) => aindaNaoComecou(j) && parseData(j.data).getDay() === inicial.dia_semana).length
            const mudancas = descreverMudancas(inicial, pelada)
            if (mudancas.length > 0 && regulares > 0) {
              setAplicar({ pelada, mudancas, total: regulares })
              return
            }
          }
          salvar.mutate({ pelada }, { onSuccess: onFechar })
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
        <LocalDoClima
          cidade={f.latitude == null ? '' : f.cidade}
          onEscolher={(l) => setF({ ...f, latitude: l.latitude, longitude: l.longitude, cidade: l.cidade })}
          onLimpar={() => setF({ ...f, latitude: null, longitude: null, cidade: '' })}
        />
        <label className="linha">
          <input type="checkbox" style={{ width: 'auto' }} checked={f.autoGerar} onChange={(e) => setF({ ...f, autoGerar: e.target.checked })} />
          <span>🔄 Gerar o próximo jogo automaticamente</span>
        </label>
        {f.autoGerar && (
          <label>Gerar quantos dias antes da data do jogo?
            <input type="number" inputMode="numeric" min={0} max={30} value={f.autoDias} onChange={(e) => setF({ ...f, autoDias: e.target.value })} />
            <span className="muted">
              Ex.: 5 = o jogo de sábado é criado na segunda-feira da mesma semana. A criação acontece quando alguém abre o app,
              sem repetir jogos nem recriar um jogo cancelado.
            </span>
          </label>
        )}
        <label>Liberar a confirmação de presença (dias após o jogo anterior)
          <input type="number" min={0} max={6} value={f.liberar} onChange={(e) => setF({ ...f, liberar: e.target.value })} />
          <span className="muted">Ex.: 2 = segunda-feira para jogos de sábado; 1 = domingo. Admins confirmam a qualquer momento.</span>
        </label>
        <label className="linha">
          <input type="checkbox" style={{ width: 'auto' }} checked={f.goleirosIsentos} onChange={(e) => setF({ ...f, goleirosIsentos: e.target.checked })} />
          <span>🧤 Goleiros isentos: quem jogou no gol não paga o jogo</span>
        </label>
        <label className="linha"><input type="checkbox" style={{ width: 'auto' }} checked={f.ativa} onChange={(e) => setF({ ...f, ativa: e.target.checked })} /> Ativa</label>
        <Erro erro={salvar.error} />
        <button className="btn" disabled={salvar.isPending}>Salvar</button>
        {inicial.id && (
          <button type="button" className="btn perigo" onClick={() => setExcluindo(true)}>
            Excluir
          </button>
        )}
      </form>
      {aplicar && (
        <AplicarAosProximos
          mudancas={aplicar.mudancas} total={aplicar.total} salvando={salvar.isPending} erro={salvar.error}
          diaMuda={aplicar.pelada.dia_semana !== inicial.dia_semana}
          onAplicar={() => salvar.mutate({ pelada: aplicar.pelada, aplicarAosProximos: true, diaAntigo: inicial.dia_semana }, { onSuccess: onFechar })}
          onManter={() => salvar.mutate({ pelada: aplicar.pelada }, { onSuccess: onFechar })}
          onVoltar={() => setAplicar(null)}
        />
      )}
      {excluindo && inicial.id && <ExcluirPelada pelada={inicial as Pelada} onFechar={() => setExcluindo(false)} onExcluida={onFechar} />}
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

/** Admin escolhe a cidade/bairro da pelada; a previsão do tempo dos jogos usa esse local. */
function LocalDoClima({ cidade, onEscolher, onLimpar }: {
  cidade: string
  onEscolher: (l: Lugar) => void
  onLimpar: () => void
}) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Lugar[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<unknown>(null)

  async function procurar() {
    if (busca.trim().length < 2) return
    setBuscando(true)
    setErro(null)
    try {
      setResultados(await buscarLugar(busca.trim()))
    } catch (e) {
      setErro(e)
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="form">
      <span className="muted">Local para a previsão do tempo</span>
      {cidade ? (
        <div className="linha entre">
          <strong>📍 {cidade}</strong>
          <button type="button" className="btn sec peq" onClick={onLimpar}>Trocar</button>
        </div>
      ) : (
        <>
          <div className="linha">
            <input
              value={busca} placeholder="Cidade ou bairro (ex.: Porto Alegre)"
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), procurar())}
            />
            <button type="button" className="btn sec" disabled={buscando} onClick={procurar}>{buscando ? '…' : 'Buscar'}</button>
          </div>
          {resultados?.length === 0 && <span className="muted">Nada encontrado. Tente só o nome da cidade.</span>}
          {resultados?.map((l) => (
            <button
              type="button" className="lugar-res" key={`${l.latitude},${l.longitude}`}
              onClick={() => { onEscolher(l); setResultados(null); setBusca('') }}
            >
              📍 {l.rotulo}
            </button>
          ))}
          <Erro erro={erro} />
          <span className="muted">Sem local definido, os jogos ficam sem previsão do tempo.</span>
        </>
      )}
    </div>
  )
}

/** O que mudou em relação à pelada salva (só o que afeta os jogos). */
function descreverMudancas(a: Partial<Pelada>, b: Partial<Pelada>): string[] {
  const l: string[] = []
  const t = (v: string | null | undefined) => (v && v.trim() ? v : '—')
  if (a.nome !== b.nome) l.push(`Nome: ${t(a.nome)} → ${t(b.nome)}`)
  if (a.dia_semana !== b.dia_semana) l.push(`Dia da semana: ${DIAS[a.dia_semana ?? 0]} → ${DIAS[b.dia_semana ?? 0]}`)
  if ((a.horario ?? '').slice(0, 5) !== (b.horario ?? '').slice(0, 5)) l.push(`Horário: ${formatarHora(a.horario ?? '00:00')} → ${formatarHora(b.horario ?? '00:00')}`)
  if ((a.local ?? null) !== (b.local ?? null)) l.push(`Local: ${t(a.local)} → ${t(b.local)}`)
  if ((a.limite_jogadores ?? null) !== (b.limite_jogadores ?? null)) l.push(`Limite de jogadores: ${a.limite_jogadores ?? 'sem limite'} → ${b.limite_jogadores ?? 'sem limite'}`)
  if (Number(a.valor_avulso) !== Number(b.valor_avulso)) l.push(`Valor por jogo: ${moeda(Number(a.valor_avulso))} → ${moeda(Number(b.valor_avulso))}`)
  if (Boolean(a.goleiros_isentos) !== Boolean(b.goleiros_isentos)) l.push(`Goleiros isentos: ${a.goleiros_isentos ? 'sim' : 'não'} → ${b.goleiros_isentos ? 'sim' : 'não'}`)
  if ((a.latitude ?? null) !== (b.latitude ?? null) || (a.longitude ?? null) !== (b.longitude ?? null)) l.push(`Local da previsão do tempo: ${t(a.cidade)} → ${t(b.cidade)}`)
  return l
}

/** Perguntado ao editar a pelada: as mudanças valem também para os próximos jogos já agendados? */
function AplicarAosProximos({ mudancas, total, diaMuda, salvando, erro, onAplicar, onManter, onVoltar }: {
  mudancas: string[]; total: number; diaMuda: boolean; salvando: boolean; erro: unknown
  onAplicar: () => void; onManter: () => void; onVoltar: () => void
}) {
  return (
    <Modal titulo="Aplicar aos próximos jogos?" onFechar={onVoltar}>
      <div className="form">
        <span>Você alterou o modelo da pelada:</span>
        <ul className="passos">{mudancas.map((m) => <li key={m}>{m}</li>)}</ul>
        <span>
          Há <strong>{total} {total === 1 ? 'jogo agendado' : 'jogos agendados'}</strong> ainda por acontecer. Quer aplicar essas mudanças neles também?
        </span>
        <span className="muted">
          {diaMuda && 'Os jogos regulares são movidos para o novo dia da semana, na mesma semana. '}
          Substitui horário, local, valor e limite desses jogos, inclusive ajustes feitos neles. <strong>Jogos já realizados</strong> e jogos
          extras (em outros dias) <strong>nunca são alterados</strong>.
        </span>
        <Erro erro={erro} />
        <button className="btn" disabled={salvando} onClick={onAplicar}>Aplicar aos {total} próximos {total === 1 ? 'jogo' : 'jogos'}</button>
        <button className="btn sec" disabled={salvando} onClick={onManter}>Salvar só a pelada (manter os jogos como estão)</button>
        <button className="btn sec peq" disabled={salvando} onClick={onVoltar}>Voltar</button>
      </div>
    </Modal>
  )
}

/** A pelada é só um modelo: excluir NUNCA apaga jogos já realizados; os próximos são opcionais. */
function ExcluirPelada({ pelada, onFechar, onExcluida }: { pelada: Pelada; onFechar: () => void; onExcluida: () => void }) {
  const { data: jogos = [], isLoading } = useJogosDaPelada(pelada.id)
  const excluir = useExcluirPelada()
  const realizados = jogos.filter((j) => j.status === 'realizado').length
  const proximos = jogos.filter(aindaNaoComecou).length
  const confirmar = (apagarProximos: boolean) => excluir.mutate({ id: pelada.id, apagarProximos }, { onSuccess: onExcluida })

  return (
    <Modal titulo={`Excluir “${pelada.nome}”?`} onFechar={onFechar}>
      <div className="form">
        {isLoading && <Spinner />}
        <span className="muted">A pelada é só o modelo usado para criar jogos.</span>
        <span>
          ✅ <strong>{realizados} {realizados === 1 ? 'jogo já realizado' : 'jogos já realizados'}</strong> continuam no histórico, com placar, escalações,
          votos e pagamentos, sem nenhuma mudança.
        </span>
        {pelada.gerar_proximo_dias_antes != null && <span className="muted">A criação automática de jogos desta pelada deixa de existir.</span>}
        <Erro erro={excluir.error} />
        {proximos > 0 ? (
          <>
            <span>Há <strong>{proximos} {proximos === 1 ? 'próximo jogo agendado' : 'próximos jogos agendados'}</strong>. O que fazer com {proximos === 1 ? 'ele' : 'eles'}?</span>
            <button className="btn perigo" disabled={excluir.isPending} onClick={() => confirmar(true)}>
              Excluir a pelada e os {proximos} próximos {proximos === 1 ? 'jogo' : 'jogos'}
            </button>
            <button className="btn sec" disabled={excluir.isPending} onClick={() => confirmar(false)}>
              Excluir só a pelada (manter os {proximos} próximos {proximos === 1 ? 'jogo' : 'jogos'})
            </button>
          </>
        ) : (
          <button className="btn perigo" disabled={excluir.isPending || isLoading} onClick={() => confirmar(false)}>Excluir pelada</button>
        )}
        <button className="btn sec peq" disabled={excluir.isPending} onClick={onFechar}>Cancelar</button>
      </div>
    </Modal>
  )
}
