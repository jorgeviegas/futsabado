import { useState } from 'react'
import {
  useCaixaExtrato, useCaixaResumo, useCobrancas, useExcluirLancamento, useJogadores, useMarcarPagamento, useSalvarLancamento,
} from '../lib/api'
import { useAuth } from '../lib/auth'
import { totalDe, type Cobranca } from '../lib/financeiro'
import { exibir, hojeISO, moeda, parseData } from '../lib/format'
import { Erro, Spinner } from '../components/ui'
import PixDoTime from '../components/PixDoTime'

type Aba = 'caixa' | 'cobrancas' | 'lancar'

export default function Financeiro() {
  const { isAdmin } = useAuth()
  const [aba, setAba] = useState<Aba>('caixa')
  return (
    <>
      <h1>Financeiro</h1>
      {isAdmin && (
        <div className="seg" role="tablist">
          {(['caixa', 'cobrancas', 'lancar'] as const).map((a) => (
            <button key={a} role="tab" className={aba === a ? 'ativo' : ''} onClick={() => setAba(a)}>
              {{ caixa: 'Caixa', cobrancas: 'Cobranças', lancar: 'Lançar' }[a]}
            </button>
          ))}
        </div>
      )}
      {(!isAdmin || aba === 'caixa') && <Caixa />}
      {isAdmin && aba === 'cobrancas' && <Cobrancas />}
      {isAdmin && aba === 'lancar' && <Lancar onFeito={() => setAba('caixa')} />}
    </>
  )
}

/** Caixa do time: visível (somente leitura) para todos os jogadores. */
function Caixa() {
  const { eu, isAdmin } = useAuth()
  const resumo = useCaixaResumo()
  const extrato = useCaixaExtrato(200)
  const excluir = useExcluirLancamento()
  const [mostrar, setMostrar] = useState(30)

  const saldo = (resumo.data?.entradas ?? 0) - (resumo.data?.saidas ?? 0)

  return (
    <>
      <div className="card">
        <span className="muted">Saldo do caixa do time</span>
        {resumo.isLoading ? <Spinner /> : (
          <>
            <h1 className={saldo >= 0 ? 'saldo-pos' : 'saldo-neg'} style={{ fontSize: '2rem' }}>{moeda(saldo)}</h1>
            <div className="grid2">
              <div><span className="muted">Entradas</span><h3 className="saldo-pos">{moeda(resumo.data?.entradas ?? 0)}</h3></div>
              <div><span className="muted">Saídas</span><h3 className="saldo-neg">{moeda(resumo.data?.saidas ?? 0)}</h3></div>
            </div>
          </>
        )}
        <Erro erro={resumo.error} />
      </div>

      {eu && <MinhasPendencias jogadorId={eu.id} />}

      <PixDoTime />

      <div className="card">
        <h2>Entradas e saídas</h2>
        {extrato.isLoading && <Spinner />}
        <Erro erro={extrato.error ?? excluir.error} />
        {!extrato.isLoading && !extrato.data?.length && <p className="muted">Nenhuma movimentação ainda.</p>}
        {extrato.data?.slice(0, mostrar).map((m) => (
          <div className="extrato-item" key={m.id}>
            <span className={`extrato-sinal ${m.tipo}`} aria-hidden>{m.tipo === 'entrada' ? '+' : '−'}</span>
            <div className="grow">
              <div>{m.descricao}</div>
              <span className="muted">{parseData(m.data).toLocaleDateString('pt-BR')}</span>
            </div>
            <strong className={m.tipo === 'entrada' ? 'saldo-pos' : 'saldo-neg'}>
              {m.tipo === 'entrada' ? '+' : '−'}{moeda(m.valor)}
            </strong>
            {isAdmin && m.id.startsWith('l:') && (
              <button
                className="btn perigo peq" aria-label="Excluir lançamento" disabled={excluir.isPending}
                onClick={() => confirm(`Excluir “${m.descricao}”?`) && excluir.mutate(m.id.slice(2))}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {(extrato.data?.length ?? 0) > mostrar && (
          <button className="btn sec" onClick={() => setMostrar(mostrar + 30)}>Ver mais</button>
        )}
      </div>
    </>
  )
}

/** Pendências do próprio jogador logado. */
function MinhasPendencias({ jogadorId }: { jogadorId: string }) {
  const { cobrancas } = useCobrancas(jogadorId)
  const pendentes = cobrancas.filter((c) => !c.pago)
  if (pendentes.length === 0) return null
  return (
    <div className="card" style={{ borderColor: 'var(--erro)' }}>
      <h2 style={{ color: '#ff8a8e' }}>💸 Suas pendências: {moeda(totalDe(pendentes))}</h2>
      {pendentes.map((c) => (
        <div className="linha entre" key={c.chave}>
          <span>{c.rotulo}</span>
          <strong>{moeda(c.valor)}</strong>
        </div>
      ))}
      <p className="muted">Faça o pagamento e avise um administrador para confirmar.</p>
    </div>
  )
}

/** Admin: confirmar pagamentos pendentes (de todos) e desfazer confirmações. */
function Cobrancas() {
  const { cobrancas, isLoading, error } = useCobrancas()
  const { data: jogadores = [] } = useJogadores()
  const marcar = useMarcarPagamento()
  const [filtro, setFiltro] = useState<'pendentes' | 'pagas'>('pendentes')
  const [quem, setQuem] = useState('')

  if (isLoading) return <Spinner />
  const doJogador = quem ? cobrancas.filter((c) => c.jogadorId === quem) : cobrancas
  const lista = doJogador.filter((c) => (filtro === 'pagas' ? c.pago : !c.pago))
  const pendente = totalDe(doJogador.filter((c) => !c.pago))

  const alternar = (c: Cobranca) =>
    marcar.mutate({
      jogadorId: c.jogadorId, tipo: c.tipo, competencia: c.competencia, jogoId: c.jogoId,
      convidadoId: c.convidadoId, valor: c.valor, pago: !c.pago,
    })

  return (
    <>
      <div className="card">
        <span className="muted">A receber{quem ? ' deste jogador' : ''}</span>
        <h1 className={pendente ? 'saldo-neg' : 'saldo-pos'}>{moeda(pendente)}</h1>
        <label>Jogador
          <select value={quem} onChange={(e) => setQuem(e.target.value)}>
            <option value="">Todos</option>
            {jogadores.filter((j) => j.ativo).map((j) => <option key={j.id} value={j.id}>{exibir(j)}</option>)}
          </select>
        </label>
      </div>
      <div className="seg">
        <button className={filtro === 'pendentes' ? 'ativo' : ''} onClick={() => setFiltro('pendentes')}>Pendentes</button>
        <button className={filtro === 'pagas' ? 'ativo' : ''} onClick={() => setFiltro('pagas')}>Pagas</button>
      </div>
      <Erro erro={error ?? marcar.error} />
      {lista.length === 0 && <p className="vazio">{filtro === 'pendentes' ? 'Nenhuma pendência. 🎉' : 'Nenhum pagamento confirmado.'}</p>}
      {lista.map((c) => (
        <div className="card" key={c.chave}>
          <div className="linha">
            <div className="grow">
              <strong>{c.jogadorNome}</strong>
              <div className="muted">{c.rotulo} · {moeda(c.valor)}</div>
            </div>
            <button
              className={`btn peq ${c.pago ? 'sec' : ''}`} disabled={marcar.isPending}
              onClick={() => (c.pago ? confirm('Desfazer a confirmação deste pagamento?') && alternar(c) : alternar(c))}
            >
              {c.pago ? '↩︎ Desfazer' : '✓ Confirmar pagamento'}
            </button>
          </div>
        </div>
      ))}
    </>
  )
}

/** Admin: entradas e saídas avulsas do caixa. */
function Lancar({ onFeito }: { onFeito: () => void }) {
  const { eu } = useAuth()
  const salvar = useSalvarLancamento()
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(hojeISO())

  return (
    <form
      className="card form"
      onSubmit={(e) => {
        e.preventDefault()
        salvar.mutate({ tipo, descricao: descricao.trim(), valor: Number(valor), data, created_by: eu?.id }, { onSuccess: onFeito })
      }}
    >
      <h2>Nova movimentação</h2>
      <div className="seg">
        <button type="button" className={tipo === 'entrada' ? 'ativo ok' : ''} onClick={() => setTipo('entrada')}>＋ Entrada</button>
        <button type="button" className={tipo === 'saida' ? 'ativo erro' : ''} onClick={() => setTipo('saida')}>− Saída</button>
      </div>
      <label>Descrição
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} required
          placeholder={tipo === 'saida' ? 'Ex.: aluguel da quadra, bolas, coletes' : 'Ex.: patrocínio, doação, venda de camisa'} />
      </label>
      <div className="grid2">
        <label>Valor (R$)<input type="number" inputMode="decimal" min={0.01} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required /></label>
        <label>Data<input type="date" value={data} onChange={(e) => setData(e.target.value)} required /></label>
      </div>
      <p className="muted">Mensalidades e jogos pagos entram no caixa automaticamente ao serem confirmados em “Cobranças”.</p>
      <Erro erro={salvar.error} />
      <button className="btn" disabled={salvar.isPending}>Registrar {tipo === 'entrada' ? 'entrada' : 'saída'}</button>
    </form>
  )
}
