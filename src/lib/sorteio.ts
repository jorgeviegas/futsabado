import type { Escalado, Posicao, Slot, Sorteio } from './types'

/**
 * Sorteio de times de fut7 (7 por lado) levando em conta as posições.
 *
 * Formação: 2-3-1  →  Goleiro, 2 Zagueiros, Ala + Meia + Ala, Atacante.
 */
export const TAMANHO_TIME = 7

export const SLOTS: Slot[] = ['GOL', 'ZAG1', 'ZAG2', 'ALA1', 'MEI', 'ALA2', 'ATA']

export const POSICAO_DO_SLOT: Record<Slot, Posicao> = {
  GOL: 'goleiro', ZAG1: 'zagueiro', ZAG2: 'zagueiro', ALA1: 'ala', MEI: 'meia', ALA2: 'ala', ATA: 'atacante',
}

/** Ordem de preenchimento: posições mais escassas primeiro. Time com menos de 7 deixa as últimas vagas. */
const ORDEM_PREENCHIMENTO: Slot[] = ['GOL', 'ATA', 'MEI', 'ZAG1', 'ZAG2', 'ALA1', 'ALA2']

/**
 * Critério de desempate de quem JOGA PRIMEIRO quando há mais confirmados que vagas (14):
 * entra primeiro quem tem MAIS jogos no ano (premia a frequência). Para dar prioridade
 * a quem jogou MENOS (rodízio), troque para `false`.
 */
export const PRIORIDADE_PARA_QUEM_MAIS_JOGOU = true

export interface Candidato {
  id: string
  posicao: Posicao | null
  posicao_secundaria: Posicao | null
  jogosAno: number
  /** Só vale para goleiro com posição secundária: 'linha' = hoje joga na linha. */
  funcao?: 'gol' | 'linha' | null
}

/** Goleiro que avisou que vai jogar na linha passa a ter a posição secundária como principal. */
function aplicarFuncao(c: Candidato): Candidato {
  if (c.posicao === 'goleiro' && c.funcao === 'linha' && c.posicao_secundaria) {
    return { ...c, posicao: c.posicao_secundaria, posicao_secundaria: null }
  }
  return c
}

function embaralhar<T>(lista: T[], rnd: () => number): T[] {
  const a = [...lista]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const ORDEM_GRUPO: (Posicao | null)[] = ['goleiro', 'atacante', 'meia', 'zagueiro', 'ala']
const grupo = (c: Candidato) => {
  const i = ORDEM_GRUPO.indexOf(c.posicao)
  return i < 0 ? 99 : i
}

/** Escolhe os 14 que começam jogando; os demais viram reservas (já em ordem de prioridade). */
function separarTitulares(candidatos: Candidato[], rnd: () => number) {
  if (candidatos.length <= TAMANHO_TIME * 2) return { titulares: [...candidatos], reservas: [] as Candidato[] }

  const sinal = PRIORIDADE_PARA_QUEM_MAIS_JOGOU ? -1 : 1
  // embaralha antes: o sort é estável, então empates no nº de jogos são decididos no sorteio
  const ordenados = embaralhar(candidatos, rnd).sort((a, b) => sinal * (a.jogosAno - b.jogosAno))

  // garante até 2 goleiros entre os titulares (1 por time), se houver
  const goleiros = ordenados.filter((c) => c.posicao === 'goleiro').slice(0, 2)
  const ids = new Set(goleiros.map((g) => g.id))
  const resto = ordenados.filter((c) => !ids.has(c.id))
  const titulares = [...goleiros, ...resto.slice(0, TAMANHO_TIME * 2 - goleiros.length)]
  const tit = new Set(titulares.map((c) => c.id))
  return { titulares, reservas: ordenados.filter((c) => !tit.has(c.id)) }
}

/** Distribui as posições do time nas vagas da formação: primária → secundária → quem sobrar. */
function escalar(time: Candidato[]): Escalado[] {
  const livres = [...time]
  const slots = ORDEM_PREENCHIMENTO.slice(0, Math.min(time.length, TAMANHO_TIME))
  const atribuidos = new Map<Slot, Escalado>()

  for (const nivel of ['primaria', 'secundaria', 'qualquer'] as const) {
    for (const slot of slots) {
      if (atribuidos.has(slot)) continue
      const pos = POSICAO_DO_SLOT[slot]
      const i = livres.findIndex((c) =>
        nivel === 'primaria' ? c.posicao === pos : nivel === 'secundaria' ? c.posicao_secundaria === pos : true,
      )
      if (i < 0) continue
      const [c] = livres.splice(i, 1)
      atribuidos.set(slot, { id: c.id, slot, fora: nivel === 'qualquer' && c.posicao !== null })
    }
  }
  return SLOTS.filter((s) => atribuidos.has(s)).map((s) => atribuidos.get(s)!)
}

export function sortear(entrada: Candidato[], rnd: () => number = Math.random): Sorteio {
  const candidatos = entrada.map(aplicarFuncao)
  const { titulares, reservas } = separarTitulares(candidatos, rnd)

  // Agrupa por posição primária e distribui alternando entre os times (A, B, A, B…),
  // assim cada posição fica dividida por igual e os times têm no máximo 1 jogador de diferença.
  const sequencia = embaralhar(titulares, rnd).sort((a, b) => grupo(a) - grupo(b))
  const a: Candidato[] = []
  const b: Candidato[] = []
  let vez = rnd() < 0.5 ? 0 : 1
  for (const c of sequencia) {
    ;(vez === 0 ? a : b).push(c)
    vez = 1 - vez
  }

  // sorteia qual grupo é o Branco, para não favorecer sempre o mesmo lado
  const [branco, preto] = rnd() < 0.5 ? [a, b] : [b, a]
  return {
    branco: escalar(branco),
    preto: escalar(preto),
    reservas: reservas.map((c) => c.id),
    gerado_em: new Date().toISOString(),
  }
}
