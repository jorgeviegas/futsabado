import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useJogadores, useJogosDoMes, useMarcarPagamento, usePagamentosMes, usePeladas } from '../lib/api'
import { useAuth } from '../lib/auth'
import { exibir, formatarData, moeda, nomeMes, primeiroDiaMes, somaMeses } from '../lib/format'
import { supabase } from '../lib/supabase'
import { Erro, Spinner } from '../components/ui'
import type { Jogador, Pagamento, Presenca } from '../lib/types'

export default function Financeiro() {
  const { isAdmin, eu } = useAuth()
  const [mes, setMes] = useState(primeiroDiaMes())
  const { data: jogadores = [], isLoading } = useJogadores()
  const { data: pagamentos = [] } = usePagamentosMes(mes)
  const { data: peladas = [] } = usePeladas()
  const { data: jogos = [] } = useJogosDoMes(mes)
  const marcar = useMarcarPagamento()

  const { data: presencas = [] } = useQuery({
    queryKey: ['presencas', 'mes', mes, jogos.map((j) => j.id).join(',')],
    enabled: jogos.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('presencas').select('*').in('jogo_id', jogos.map((j) => j.id)).eq('status', 'confirmado')
      if (error) throw error
      return data as Presenca[]
    },
  })

  if (isLoading) return <Spinner />

  const valorMensal = peladas.find((p) => p.ativa)?.valor_mensalidade ?? 0
  const valorAvulso = peladas.find((p) => p.ativa)?.valor_avulso ?? 0
  const ativos = jogadores.filter((j) => j.ativo)
  const visiveis = isAdmin ? ativos : ativos.filter((j) => j.id === eu?.id)

  const pg = (jid: string, tipo: Pagamento['tipo'], jogoId: string | null = null) =>
    pagamentos.find((p) => p.jogador_id === jid && p.tipo === tipo && p.jogo_id === jogoId)

  // Cobranças do mês: mensalistas (1 por jogador) + avulsos (1 por jogo confirmado)
  type Cobranca = { chave: string; jogador: Jogador; tipo: Pagamento['tipo']; jogoId: string | null; rotulo: string; valor: number }
  const cobrancas: Cobranca[] = []
  visiveis.forEach((j) => {
    if (j.tipo === 'mensalista') {
      cobrancas.push({ chave: `${j.id}-m`, jogador: j, tipo: 'mensalidade', jogoId: null, rotulo: 'Mensalidade', valor: valorMensal })
    } else {
      presencas.filter((p) => p.jogador_id === j.id).forEach((p) => {
        const jogo = jogos.find((x) => x.id === p.jogo_id)
        if (jogo) cobrancas.push({
          chave: `${j.id}-${p.jogo_id}`, jogador: j, tipo: 'avulso', jogoId: jogo.id,
          rotulo: `Jogo ${formatarData(jogo.data)}`, valor: jogo.peladas?.valor_avulso ?? valorAvulso,
        })
      })
    }
  })

  const status = (c: Cobranca) => pg(c.jogador.id, c.tipo, c.jogoId)?.pago ?? false
  const previsto = cobrancas.reduce((s, c) => s + (pg(c.jogador.id, c.tipo, c.jogoId)?.valor ?? c.valor), 0)
  const recebido = cobrancas.filter(status).reduce((s, c) => s + (pg(c.jogador.id, c.tipo, c.jogoId)?.valor ?? c.valor), 0)
  const pendentes = cobrancas.filter((c) => !status(c)).length

  return (
    <>
      <div className="linha entre">
        <button className="btn sec peq" onClick={() => setMes(somaMeses(mes, -1))} aria-label="Mês anterior">‹</button>
        <h1>{nomeMes(mes)}</h1>
        <button className="btn sec peq" onClick={() => setMes(somaMeses(mes, 1))} aria-label="Próximo mês">›</button>
      </div>

      {isAdmin && (
        <div className="card">
          <div className="grid2">
            <div><span className="muted">Recebido</span><h2 style={{ color: 'var(--ok)' }}>{moeda(recebido)}</h2></div>
            <div><span className="muted">A receber</span><h2 style={{ color: pendentes ? 'var(--aviso)' : undefined }}>{moeda(previsto - recebido)}</h2></div>
          </div>
          <div className="barra"><div style={{ width: `${previsto ? (recebido / previsto) * 100 : 0}%`, background: 'var(--ok)' }} /></div>
          <span className="muted">{cobrancas.length - pendentes} de {cobrancas.length} pagos</span>
        </div>
      )}

      <Erro erro={marcar.error} />
      {cobrancas.length === 0 && <p className="vazio">Nenhuma cobrança neste mês.</p>}
      {cobrancas.map((c) => {
        const pago = status(c)
        const registro = pg(c.jogador.id, c.tipo, c.jogoId)
        return (
          <div className="card" key={c.chave}>
            <div className="linha">
              <div className="grow">
                <strong>{exibir(c.jogador)}</strong>
                <div className="muted">{c.rotulo} · {moeda(registro?.valor ?? c.valor)}</div>
              </div>
              {isAdmin ? (
                <button
                  className={`btn peq ${pago ? '' : 'sec'}`}
                  style={pago ? { background: 'var(--ok)' } : undefined}
                  disabled={marcar.isPending}
                  onClick={() => marcar.mutate({
                    jogadorId: c.jogador.id, tipo: c.tipo, competencia: mes, jogoId: c.jogoId,
                    valor: registro?.valor ?? c.valor, pago: !pago,
                  })}
                >
                  {pago ? '✓ Pago' : 'Marcar pago'}
                </button>
              ) : (
                <span className={`chip ${pago ? 'ok' : 'aviso'}`}>{pago ? 'Pago' : 'Pendente'}</span>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
