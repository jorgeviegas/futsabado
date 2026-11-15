import { exibir, formatarData, nomeMes, primeiroDiaMes, somaMeses } from './format'
import type { FuncaoGoleiro, Jogador, Pagamento, Posicao, Sorteio, TipoPagamento } from './types'

interface JogoRef {
  id: string
  data: string
  valor: number | null
  sorteio?: Sorteio | null
  pelada_nome: string | null
  goleiros_isentos?: boolean
}

/** Presença confirmada em jogo realizado (quem jogou). */
export interface Jogou {
  jogador_id: string
  funcao?: FuncaoGoleiro | null
  jogos: JogoRef
}

/** Convidado de um jogo realizado. */
export interface ConvidadoJogou {
  id: string
  nome: string
  convidado_por: string
  posicao?: Posicao | null
  jogos: JogoRef
}

export interface Cobranca {
  chave: string
  jogadorId: string
  jogadorNome: string
  tipo: TipoPagamento
  competencia: string
  jogoId: string | null
  convidadoId: string | null
  rotulo: string
  valor: number
  pago: boolean
  /** Para ordenar (jogo ou mês). */
  data: string
}

const valorDoJogo = (j: JogoRef) => Number(j.valor ?? 0)

/**
 * Pelada com "goleiros isentos": quem jogou no gol não paga aquele jogo.
 * Com sorteio salvo, vale quem ficou na vaga de goleiro (GOL); sem sorteio, vale o goleiro de posição
 * (que não avisou que jogaria na linha).
 */
function isentoPorGol(jogo: JogoRef, id: string, goleiroPorPosicao: boolean): boolean {
  if (!jogo.goleiros_isentos) return false
  const s = jogo.sorteio
  if (s) return [...s.branco, ...s.preto].some((e) => e.id === id && e.slot === 'GOL')
  return goleiroPorPosicao
}

/**
 * Todas as cobranças do ano corrente:
 *  - avulso: cada jogo realizado em que esteve presente (valor individual do jogo);
 *  - convidado: o convidado paga o mesmo valor; quem convidou fica responsável pela cobrança;
 *  - mensalista: uma mensalidade por mês, de janeiro (ou do mês do cadastro) até o mês atual.
 * "Pago" vem das linhas de `pagamentos`.
 */
export function gerarCobrancas(a: {
  jogadores: Jogador[]
  jogaram: Jogou[]
  convidados: ConvidadoJogou[]
  pagamentos: Pagamento[]
  valorMensalidade: number
  mesAtual?: string
}): Cobranca[] {
  const atual = a.mesAtual ?? primeiroDiaMes()
  const janeiro = `${atual.slice(0, 4)}-01-01`
  const porId = new Map(a.jogadores.map((j) => [j.id, j]))
  const lista: Cobranca[] = []

  for (const j of a.jogadores) {
    if (!j.ativo) continue
    const nome = exibir(j)

    if (j.tipo === 'mensalista') {
      const criado = `${(j.created_at ?? janeiro).slice(0, 7)}-01`
      for (let m = criado > janeiro ? criado : janeiro; m <= atual; m = somaMeses(m, 1)) {
        const pg = a.pagamentos.find((p) => p.tipo === 'mensalidade' && p.jogador_id === j.id && p.competencia === m)
        lista.push({
          chave: `m-${j.id}-${m}`, jogadorId: j.id, jogadorNome: nome, tipo: 'mensalidade', competencia: m,
          jogoId: null, convidadoId: null, rotulo: `Mensalidade de ${nomeMes(m)}`,
          valor: Number(pg?.valor ?? a.valorMensalidade), pago: Boolean(pg?.pago), data: m,
        })
      }
    } else {
      for (const p of a.jogaram.filter((x) => x.jogador_id === j.id)) {
        const pg = a.pagamentos.find((x) => x.tipo === 'avulso' && x.jogador_id === j.id && x.jogo_id === p.jogos.id)
        if (!pg?.pago && isentoPorGol(p.jogos, j.id, j.posicao === 'goleiro' && p.funcao !== 'linha')) continue
        lista.push({
          chave: `a-${j.id}-${p.jogos.id}`, jogadorId: j.id, jogadorNome: nome, tipo: 'avulso',
          competencia: primeiroDiaMes(new Date(`${p.jogos.data}T12:00:00`)), jogoId: p.jogos.id, convidadoId: null,
          rotulo: `Jogo de ${formatarData(p.jogos.data)}`, valor: Number(pg?.valor ?? valorDoJogo(p.jogos)),
          pago: Boolean(pg?.pago), data: p.jogos.data,
        })
      }
    }
  }

  for (const c of a.convidados) {
    const dono = porId.get(c.convidado_por)
    if (!dono) continue
    const pg = a.pagamentos.find((x) => x.tipo === 'convidado' && x.convidado_id === c.id)
    if (!pg?.pago && isentoPorGol(c.jogos, `c_${c.id}`, c.posicao === 'goleiro')) continue
    lista.push({
      chave: `c-${c.id}`, jogadorId: dono.id, jogadorNome: exibir(dono), tipo: 'convidado',
      competencia: primeiroDiaMes(new Date(`${c.jogos.data}T12:00:00`)), jogoId: c.jogos.id, convidadoId: c.id,
      rotulo: `Convidado ${c.nome} · jogo de ${formatarData(c.jogos.data)}`,
      valor: Number(pg?.valor ?? valorDoJogo(c.jogos)), pago: Boolean(pg?.pago), data: c.jogos.data,
    })
  }

  return lista.filter((c) => c.valor > 0 || c.pago).sort((x, y) => y.data.localeCompare(x.data) || x.jogadorNome.localeCompare(y.jogadorNome))
}

export const totalDe = (l: Cobranca[]) => l.reduce((s, c) => s + c.valor, 0)
