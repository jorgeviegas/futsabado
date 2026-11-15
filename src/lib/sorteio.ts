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
 * Escolha dos titulares quando há mais confirmados que vagas (14): a PRIORIDADE É A POSIÇÃO.
 * Cada vaga da formação (2 goleiros, 4 zagueiros, 4 alas, 2 meias, 2 atacantes) vai primeiro para quem joga
 * naquela posição; depois, para quem a tem como secundária; só então para quem sobrar.
 *
 * O número de jogos no ano entra APENAS como DESEMPATE entre jogadores da mesma posição disputando a mesma vaga:
 * entra primeiro quem tem MAIS jogos no ano (premia a frequência). Para dar prioridade
 * a quem jogou MENOS (rodízio), troque para `false`. Persistindo o empate, sorteia.
 */
export const PRIORIDADE_PARA_QUEM_MAIS_JOGOU = true

export interface Candidato {
  id: string
  posicao: Posicao | null
  posicao_secundaria: Posicao | null
  jogosAno: number
  /** Só vale para goleiro com posição secundária: 'linha' = hoje joga na linha. */
  funcao?: 'gol' | 'linha' | null
  /** (interno) tipo de vaga em que foi escolhido como titular. */
  vaga?: Posicao
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
  const i = ORDEM_GRUPO.indexOf(c.vaga ?? c.posicao)
  return i < 0 ? 99 : i
}

/** Vagas de um time na ordem em que são preenchidas (as mais escassas primeiro). */
const VAGAS_DO_TIME: Posicao[] = ['goleiro', 'atacante', 'meia', 'zagueiro', 'zagueiro', 'ala', 'ala']

/**
 * Escolhe os 14 que começam jogando; os demais ficam no banco (na ordem de prioridade), mas também entram nos times.
 * Preenche as 14 vagas da formação em três rodadas: posição primária, depois secundária, depois quem sobrar.
 * Em cada vaga, entre quem tem a posição certa, o desempate é o nº de jogos no ano.
 */
function separarTitulares(candidatos: Candidato[], rnd: () => number) {
  if (candidatos.length <= TAMANHO_TIME * 2) return { titulares: [...candidatos], reservas: [] as Candidato[] }

  const sinal = PRIORIDADE_PARA_QUEM_MAIS_JOGOU ? -1 : 1
  // embaralha antes: o sort é estável, então empates no nº de jogos são decididos no sorteio
  const livres = embaralhar(candidatos, rnd).sort((a, b) => sinal * (a.jogosAno - b.jogosAno))
  const reservasEmOrdem = [...livres]

  const vagas: Posicao[] = [...VAGAS_DO_TIME, ...VAGAS_DO_TIME]
  const preenchidas: (Candidato | null)[] = vagas.map(() => null)

  for (const nivel of ['primaria', 'secundaria', 'qualquer'] as const) {
    vagas.forEach((tipo, v) => {
      if (preenchidas[v]) return
      const i = livres.findIndex((c) =>
        nivel === 'primaria' ? c.posicao === tipo : nivel === 'secundaria' ? c.posicao_secundaria === tipo : true,
      )
      if (i >= 0) preenchidas[v] = { ...livres.splice(i, 1)[0], vaga: tipo }
    })
  }

  const titulares = preenchidas.filter((c): c is Candidato => c !== null)
  const tit = new Set(titulares.map((c) => c.id))
  return { titulares, reservas: reservasEmOrdem.filter((c) => !tit.has(c.id)) }
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

  // Quem começa na reserva também entra no sorteio: vai para o banco de um dos times,
  // alternando na ordem de prioridade para que os bancos fiquem equilibrados.
  const bancoBranco: string[] = []
  const bancoPreto: string[] = []
  let vezBanco = rnd() < 0.5 ? 0 : 1
  for (const c of reservas) {
    ;(vezBanco === 0 ? bancoBranco : bancoPreto).push(c.id)
    vezBanco = 1 - vezBanco
  }

  return {
    branco: escalar(branco),
    preto: escalar(preto),
    reservas_branco: bancoBranco,
    reservas_preto: bancoPreto,
    gerado_em: new Date().toISOString(),
  }
}
