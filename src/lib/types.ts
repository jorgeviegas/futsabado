export type Posicao = 'goleiro' | 'zagueiro' | 'ala' | 'meia' | 'atacante'
export type TipoJogador = 'mensalista' | 'avulso'
/** 'faltou' = confirmou, mas não compareceu (marcado pelo admin). */
export type StatusPresenca = 'confirmado' | 'talvez' | 'ausente' | 'faltou' | 'espera'
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
  created_at: string
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
  /** Dias após o jogo anterior em que a confirmação de presença abre (2 = segunda, para jogos de sábado). */
  liberar_confirmacao_dias: number
  /** Local para a previsão do tempo (escolhido pelo admin). */
  latitude: number | null
  longitude: number | null
  cidade: string | null
  /** Goleiros não pagam o jogo em que jogaram no gol. */
  goleiros_isentos: boolean
  /** Gera o próximo jogo automaticamente quando faltarem N dias (null = desligado). */
  gerar_proximo_dias_antes: number | null
  ativa: boolean
}

export type Slot = 'GOL' | 'ZAG1' | 'ZAG2' | 'ALA1' | 'MEI' | 'ALA2' | 'ATA'
export type TimeCor = 'branco' | 'preto'

export interface Escalado {
  id: string
  slot: Slot
  /** Jogando fora da posição (primária e secundária não bateram). */
  fora: boolean
}

export interface Sorteio {
  /** Titulares de cada time (até 7, com a vaga na formação). */
  branco: Escalado[]
  preto: Escalado[]
  /** Banco de cada time: confirmados além dos 14 titulares também entram em um time. */
  reservas_branco?: string[]
  reservas_preto?: string[]
  /** (legado) reservas sem time, de sorteios antigos. */
  reservas?: string[]
  gerado_em: string
}

export interface Jogo {
  id: string
  /** Pelada (modelo) de origem; nulo se ela foi excluída. */
  pelada_id: string | null
  data: string
  horario: string
  local: string | null
  status: StatusJogo
  votacao_aberta: boolean
  placar: string | null
  placar_branco: number | null
  placar_preto: number | null
  votacao_iniciada_em: string | null
  /** Valor individual cobrado de cada jogador que jogou. */
  valor: number | null
  sorteio: Sorteio | null
  time_vencedor: TimeCor | 'empate' | null
  observacoes: string | null
  /** Cópia dos dados da pelada no momento em que o jogo foi criado: a pelada é só um modelo e pode mudar ou ser apagada. */
  pelada_nome: string | null
  limite_jogadores: number | null
  goleiros_isentos: boolean
  latitude: number | null
  longitude: number | null
  cidade: string | null
}

/** Goleiro com posição secundária escolhe se joga no gol ou na linha. */
export type FuncaoGoleiro = 'gol' | 'linha'

export interface Presenca {
  jogo_id: string
  jogador_id: string
  status: StatusPresenca
  funcao: FuncaoGoleiro | null
  /** Quando entrou na lista de espera (define a ordem da fila). */
  espera_desde: string | null
  /** Gols e assistências no jogo (registrados pelo admin ao encerrar). */
  gols: number
  assistencias: number
}

export interface Voto {
  jogo_id: string
  eleitor_id: string
  /** Jogador votado (ou null, se o voto foi em um convidado). */
  votado_id: string | null
  /** Convidado votado (ou null, se o voto foi em um jogador). */
  votado_convidado_id: string | null
}

export type TipoPagamento = 'mensalidade' | 'avulso' | 'convidado'

export interface Pagamento {
  id: string
  jogador_id: string
  tipo: TipoPagamento
  convidado_id: string | null
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
  /** true quando quem recebeu os votos é um convidado (jogador_id é o id do convidado). */
  convidado: boolean
}

export interface RankingCraque {
  jogador_id: string
  nome: string
  apelido: string | null
  premios: number
}

export interface RankingEstatistica {
  jogador_id: string
  nome: string
  apelido: string | null
  total: number
  jogos: number
}

export interface RankingVencedor {
  jogador_id: string
  nome: string
  apelido: string | null
  vitorias: number
}

export interface Convidado {
  id: string
  jogo_id: string
  convidado_por: string
  nome: string
  posicao: Posicao | null
}

export interface Lancamento {
  id: string
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: number
  data: string
}

/** Linha do extrato do caixa (pagamentos recebidos + lançamentos avulsos). */
export interface ExtratoItem {
  id: string
  data: string
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: number
}

export interface ResumoCaixa {
  entradas: number
  saidas: number
}

export interface RankingAssiduo {
  jogador_id: string
  nome: string
  apelido: string | null
  presencas: number
  total_jogos: number
}

export interface RankingGoleiro {
  jogador_id: string
  nome: string
  apelido: string | null
  jogos: number
  gols_sofridos: number
  /** Média simples de gols sofridos por jogo. */
  media: number
  /** Média ajustada (peso para quem jogou mais): define a ordem. */
  media_ajustada: number
  total_jogos: number
  minimo_jogos: number
}

/** Aviso avulso do admin, visível no quadro de avisos durante o período de validade. */
export interface AvisoAvulso {
  id: string
  titulo: string
  mensagem: string | null
  inicio: string
  fim: string
  enviar_push: boolean
  push_enviado_em: string | null
}

export type TipoPix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'

export interface ConfigTime {
  id: number
  pix_chave: string | null
  pix_tipo: TipoPix | null
  pix_beneficiario: string | null
}

/** Quais avisos push o jogador quer receber. */
export interface PushPreferencias {
  jogador_id: string
  confirmacao_aberta: boolean
  vaga_lista_espera: boolean
  lembrete_vespera: boolean
  resultado_craque: boolean
  aviso_time: boolean
}
