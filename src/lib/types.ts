export type Posicao = 'goleiro' | 'zagueiro' | 'ala' | 'meia' | 'atacante'
export type TipoJogador = 'mensalista' | 'avulso'
export type StatusPresenca = 'confirmado' | 'talvez' | 'ausente'
export type StatusJogo = 'agendado' | 'realizado' | 'cancelado'

export interface Jogador {
  id: string
  user_id: string | null
  nome: string
  apelido: string | null
  email: string | null
  telefone: string | null
  posicao: Posicao | null
  posicao_secundaria: Posicao | null
  numero_camisa: number | null
  perfil_completo: boolean
  tipo: TipoJogador
  is_admin: boolean
  ativo: boolean
}

export interface Pelada {
  id: string
  nome: string
  dia_semana: number
  horario: string
  local: string | null
  limite_jogadores: number | null
  valor_mensalidade: number
  valor_avulso: number
  ativa: boolean
}

export type Slot = 'GOL' | 'ZAG1' | 'ZAG2' | 'ALA1' | 'MEI' | 'ALA2' | 'ATA'
export type TimeCor = 'grena' | 'preto'

export interface Escalado {
  id: string
  slot: Slot
  /** Jogando fora da posição (primária e secundária não bateram). */
  fora: boolean
}

export interface Sorteio {
  grena: Escalado[]
  preto: Escalado[]
  reservas: string[]
  gerado_em: string
}

export interface Jogo {
  id: string
  pelada_id: string
  data: string
  horario: string
  local: string | null
  status: StatusJogo
  votacao_aberta: boolean
  placar: string | null
  /** Valor individual cobrado de cada jogador que jogou. */
  valor: number | null
  sorteio: Sorteio | null
  time_vencedor: TimeCor | 'empate' | null
  observacoes: string | null
  peladas?: Pick<Pelada, 'nome' | 'limite_jogadores' | 'valor_avulso'> | null
}

/** Goleiro com posição secundária escolhe se joga no gol ou na linha. */
export type FuncaoGoleiro = 'gol' | 'linha'

export interface Presenca {
  jogo_id: string
  jogador_id: string
  status: StatusPresenca
  funcao: FuncaoGoleiro | null
}

export interface Voto {
  jogo_id: string
  eleitor_id: string
  votado_id: string
}

export interface Pagamento {
  id: string
  jogador_id: string
  tipo: 'mensalidade' | 'avulso'
  competencia: string
  jogo_id: string | null
  valor: number
  pago: boolean
  pago_em: string | null
}

export interface ResultadoVotacao {
  jogador_id: string
  nome: string
  apelido: string | null
  votos: number
}

export interface RankingCraque {
  jogador_id: string
  nome: string
  apelido: string | null
  premios: number
}

export interface RankingVencedor {
  jogador_id: string
  nome: string
  apelido: string | null
  vitorias: number
}
