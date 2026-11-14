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

export interface Jogo {
  id: string
  pelada_id: string
  data: string
  horario: string
  local: string | null
  status: StatusJogo
  votacao_aberta: boolean
  placar: string | null
  observacoes: string | null
  peladas?: Pick<Pelada, 'nome' | 'limite_jogadores' | 'valor_avulso'> | null
}

export interface Presenca {
  jogo_id: string
  jogador_id: string
  status: StatusPresenca
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
