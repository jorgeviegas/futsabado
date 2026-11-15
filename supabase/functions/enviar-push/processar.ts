/**
 * Lógica de envio da fila de notificações (sem dependências externas, para poder ser testada).
 * A Edge Function (index.ts) injeta o acesso ao banco e o envio real via Web Push.
 */
export interface ItemFila {
  id: string
  jogador_id: string
  tipo: string
  titulo: string
  corpo: string
  url: string | null
  tentativas: number
}

export interface Assinatura {
  id: string
  jogador_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export type ResultadoEnvio = { ok: true } | { ok: false; status: number; erro: string }

export interface Deps {
  buscarPendentes(limite: number): Promise<ItemFila[]>
  buscarAssinaturas(jogadorIds: string[]): Promise<Assinatura[]>
  enviar(assinatura: Assinatura, payload: string): Promise<ResultadoEnvio>
  removerAssinatura(id: string): Promise<void>
  /** Atualiza o item: enviado (enviado_em = agora) ou falho (tentativas + erro). */
  atualizarItem(id: string, dados: { enviado: boolean; tentativas: number; erro: string | null }): Promise<void>
}

export interface Resumo {
  itens: number
  enviadas: number
  semAparelho: number
  falhas: number
  aparelhosRemovidos: number
}

export const MAX_TENTATIVAS = 3

/** Aparelho que o serviço de push informa como inexistente/expirado: deve ser removido. */
const aparelhoExpirou = (status: number) => status === 404 || status === 410

export async function processarFila(deps: Deps, limite = 200): Promise<Resumo> {
  const resumo: Resumo = { itens: 0, enviadas: 0, semAparelho: 0, falhas: 0, aparelhosRemovidos: 0 }
  const itens = await deps.buscarPendentes(limite)
  resumo.itens = itens.length
  if (itens.length === 0) return resumo

  const assinaturas = await deps.buscarAssinaturas([...new Set(itens.map((i) => i.jogador_id))])
  const porJogador = new Map<string, Assinatura[]>()
  for (const a of assinaturas) porJogador.set(a.jogador_id, [...(porJogador.get(a.jogador_id) ?? []), a])

  for (const item of itens) {
    const aparelhos = porJogador.get(item.jogador_id) ?? []
    if (aparelhos.length === 0) {
      // sem aparelho inscrito: não adianta tentar de novo
      await deps.atualizarItem(item.id, { enviado: true, tentativas: item.tentativas, erro: 'sem aparelho inscrito' })
      resumo.semAparelho++
      continue
    }

    const payload = JSON.stringify({ titulo: item.titulo, corpo: item.corpo, url: item.url ?? '/', tipo: item.tipo, tag: item.id })
    let entregue = 0
    let ultimoErro: string | null = null
    for (const a of aparelhos) {
      const r = await deps.enviar(a, payload)
      if (r.ok) {
        entregue++
      } else if (aparelhoExpirou(r.status)) {
        await deps.removerAssinatura(a.id)
        resumo.aparelhosRemovidos++
        ultimoErro = `aparelho expirado (${r.status})`
      } else {
        ultimoErro = `${r.status}: ${r.erro}`.slice(0, 300)
      }
    }

    if (entregue > 0) {
      await deps.atualizarItem(item.id, { enviado: true, tentativas: item.tentativas + 1, erro: null })
      resumo.enviadas++
    } else if (ultimoErro?.startsWith('aparelho expirado')) {
      // todos os aparelhos tinham expirado: nada mais a fazer
      await deps.atualizarItem(item.id, { enviado: true, tentativas: item.tentativas + 1, erro: ultimoErro })
      resumo.falhas++
    } else {
      // falha temporária: tenta de novo na próxima rodada (até MAX_TENTATIVAS)
      await deps.atualizarItem(item.id, { enviado: false, tentativas: item.tentativas + 1, erro: ultimoErro })
      resumo.falhas++
    }
  }
  return resumo
}
