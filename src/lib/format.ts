export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export const POSICOES: Record<string, string> = {
  goleiro: 'Goleiro',
  zagueiro: 'Zagueiro',
  ala: 'Ala',
  meia: 'Meia',
  atacante: 'Atacante',
}

/** Interpreta 'YYYY-MM-DD' como data local (evita deslocamento de fuso). */
export function parseData(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function formatarData(iso: string): string {
  return parseData(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

export function formatarHora(h: string): string {
  return h.slice(0, 5)
}

export function moeda(v: number): string {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function primeiroDiaMes(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function nomeMes(iso: string): string {
  const t = parseData(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function somaMeses(iso: string, n: number): string {
  const d = parseData(iso)
  d.setMonth(d.getMonth() + n)
  return primeiroDiaMes(d)
}

export function exibir(j: { nome: string; apelido: string | null }): string {
  return j.apelido?.trim() || j.nome
}

export function hojeISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Branco 5 x 9 Preto" — ou null se o placar ainda não foi registrado. */
export function placarTexto(j: { placar_branco: number | null; placar_preto: number | null }): string | null {
  return j.placar_branco != null && j.placar_preto != null ? `Branco ${j.placar_branco} x ${j.placar_preto} Preto` : null
}

/** Confirmação de presença liberada? (data nula = sempre liberada). */
export function confirmacaoLiberada(liberaEm: string | null | undefined): boolean {
  return !liberaEm || hojeISO() >= liberaEm
}
