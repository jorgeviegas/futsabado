import { formatarData, moeda, nomeMes, primeiroDiaMes } from './format'
import type { Jogador, Pagamento } from './types'

export interface JogoJogado {
  jogo_id: string
  jogos: { id: string; data: string; valor: number | null; peladas: { nome: string; valor_avulso: number } | null }
}

export interface Pendencia {
  chave: string
  rotulo: string
  valor: number
}

/**
 * Pendências financeiras de UM jogador:
 *  - avulso: cada jogo realizado em que esteve presente e não está marcado como pago (valor individual do jogo);
 *  - mensalista: mensalidade do mês atual em aberto, e meses anteriores que o admin deixou marcados como não pagos.
 */
export function calcularPendencias(args: {
  eu: Jogador
  jogados: JogoJogado[]
  pagamentos: Pagamento[]
  valorMensalidade: number
  mesAtual?: string
}): Pendencia[] {
  const { eu, jogados, pagamentos, valorMensalidade } = args
  const mesAtual = args.mesAtual ?? primeiroDiaMes()
  const lista: Pendencia[] = []

  if (eu.tipo === 'avulso') {
    for (const j of jogados) {
      const valor = Number(j.jogos.valor ?? j.jogos.peladas?.valor_avulso ?? 0)
      const pago = pagamentos.some((p) => p.tipo === 'avulso' && p.jogo_id === j.jogos.id && p.pago)
      if (valor > 0 && !pago) lista.push({ chave: `jogo-${j.jogos.id}`, rotulo: `Jogo de ${formatarData(j.jogos.data)}`, valor })
    }
    lista.sort((a, b) => a.chave.localeCompare(b.chave))
  } else {
    const mensalidades = pagamentos.filter((p) => p.tipo === 'mensalidade')
    const atualPago = mensalidades.some((p) => p.competencia === mesAtual && p.pago)
    if (!atualPago && valorMensalidade > 0) {
      lista.push({ chave: `mes-${mesAtual}`, rotulo: `Mensalidade de ${nomeMes(mesAtual)}`, valor: valorMensalidade })
    }
    for (const p of mensalidades) {
      if (!p.pago && p.competencia !== mesAtual) {
        lista.push({ chave: `mes-${p.competencia}`, rotulo: `Mensalidade de ${nomeMes(p.competencia)}`, valor: Number(p.valor) })
      }
    }
  }
  return lista
}

export const totalPendente = (l: Pendencia[]) => l.reduce((s, p) => s + p.valor, 0)
export { moeda }
