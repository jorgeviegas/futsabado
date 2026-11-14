import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { hojeISO, somaMeses } from './format'
import type {
  FuncaoGoleiro, Jogador, Jogo, Pagamento, Pelada, Presenca, RankingCraque, RankingVencedor, ResultadoVotacao, StatusPresenca, Voto,
} from './types'

function ok<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

/** Mutation que invalida as queries indicadas ao concluir. */
function useAcao<V, R = unknown>(fn: (v: V) => PromiseLike<R>, invalida: string[][]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: V) => fn(v),
    onSuccess: () => invalida.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  })
}

// ---------- Jogadores ----------
export const useJogadores = () =>
  useQuery({
    queryKey: ['jogadores'],
    queryFn: async () => ok(await supabase.from('jogadores').select('*').order('nome')) as Jogador[],
  })

export const useSalvarJogador = () =>
  useAcao(
    async (j: Partial<Jogador> & { nome: string }) =>
      ok(
        j.id
          ? await supabase.from('jogadores').update(j).eq('id', j.id)
          : await supabase.from('jogadores').insert(j),
      ),
    [['jogadores'], ['eu']],
  )

export const useExcluirJogador = () =>
  useAcao(async (id: string) => ok(await supabase.from('jogadores').delete().eq('id', id)), [['jogadores']])

// ---------- Peladas ----------
export const usePeladas = () =>
  useQuery({
    queryKey: ['peladas'],
    queryFn: async () =>
      ok(await supabase.from('peladas').select('*').order('dia_semana').order('horario')) as Pelada[],
  })

export const useSalvarPelada = () =>
  useAcao(
    async (p: Partial<Pelada> & { nome: string }) =>
      ok(
        p.id
          ? await supabase.from('peladas').update(p).eq('id', p.id)
          : await supabase.from('peladas').insert(p),
      ),
    [['peladas']],
  )

export const useExcluirPelada = () =>
  useAcao(
    async (id: string) => ok(await supabase.from('peladas').delete().eq('id', id)),
    [['peladas'], ['jogos']],
  )

export const useGerarJogos = () =>
  useAcao(
    async (v: { peladaId: string; semanas: number }) =>
      ok(await supabase.rpc('gerar_jogos', { p_pelada_id: v.peladaId, p_semanas: v.semanas })) as number,
    [['jogos']],
  )

// ---------- Jogos ----------
const JOGO_SELECT = '*, peladas(nome, limite_jogadores, valor_avulso)'

export const useJogos = (filtro: 'proximos' | 'passados') =>
  useQuery({
    queryKey: ['jogos', filtro],
    queryFn: async () => {
      const hoje = hojeISO()
      let q = supabase.from('jogos').select(JOGO_SELECT)
      q =
        filtro === 'proximos'
          ? q.gte('data', hoje).neq('status', 'cancelado').order('data').limit(20)
          : q.or(`data.lt.${hoje},status.eq.realizado`).order('data', { ascending: false }).limit(30)
      return ok(await q) as unknown as Jogo[]
    },
  })

export const useJogo = (id: string | undefined) =>
  useQuery({
    queryKey: ['jogo', id],
    enabled: Boolean(id),
    queryFn: async () =>
      ok(await supabase.from('jogos').select(JOGO_SELECT).eq('id', id!).single()) as unknown as Jogo,
  })

export const useAtualizarJogo = () =>
  useAcao(
    async (j: Partial<Jogo> & { id: string }) => {
      const { id, peladas: _p, ...resto } = j
      return ok(await supabase.from('jogos').update(resto).eq('id', id))
    },
    [['jogos'], ['jogo'], ['ranking'], ['resultado'], ['jogosNoAno']],
  )

export const useExcluirJogo = () =>
  useAcao(async (id: string) => ok(await supabase.from('jogos').delete().eq('id', id)), [['jogos']])

export const useCriarJogoAvulso = () =>
  useAcao(
    async (j: { pelada_id: string; data: string; horario: string; local: string | null; valor: number }) =>
      ok(await supabase.from('jogos').insert(j)),
    [['jogos']],
  )

// ---------- Presenças ----------
export const usePresencas = (jogoId: string | undefined) =>
  useQuery({
    queryKey: ['presencas', jogoId],
    enabled: Boolean(jogoId),
    queryFn: async () =>
      ok(await supabase.from('presencas').select('*').eq('jogo_id', jogoId!)) as Presenca[],
  })

export const useDefinirPresenca = () =>
  useAcao(
    async (v: { jogoId: string; jogadorId: string; status: StatusPresenca | null; funcao?: FuncaoGoleiro | null }) =>
      ok(
        v.status
          ? await supabase.from('presencas').upsert({
              jogo_id: v.jogoId,
              jogador_id: v.jogadorId,
              status: v.status,
              funcao: v.status === 'confirmado' ? (v.funcao ?? null) : null,
            })
          : await supabase.from('presencas').delete().eq('jogo_id', v.jogoId).eq('jogador_id', v.jogadorId),
      ),
    [['presencas']],
  )

/** Contagem de confirmados por jogo (para a lista de jogos). */
export const useConfirmadosPorJogo = (jogoIds: string[]) =>
  useQuery({
    queryKey: ['presencas', 'contagem', jogoIds.join(',')],
    enabled: jogoIds.length > 0,
    queryFn: async () => {
      const rows = ok(
        await supabase.from('presencas').select('jogo_id, jogador_id, status').in('jogo_id', jogoIds),
      ) as Presenca[]
      const mapa: Record<string, number> = {}
      rows.forEach((r) => {
        if (r.status === 'confirmado') mapa[r.jogo_id] = (mapa[r.jogo_id] ?? 0) + 1
      })
      return { contagem: mapa, rows }
    },
  })

// ---------- Votação ----------
export const useMeuVoto = (jogoId: string | undefined, eleitorId: string | undefined) =>
  useQuery({
    queryKey: ['voto', jogoId, eleitorId],
    enabled: Boolean(jogoId && eleitorId),
    queryFn: async () =>
      ok(
        await supabase.from('votos').select('*').eq('jogo_id', jogoId!).eq('eleitor_id', eleitorId!).maybeSingle(),
      ) as Voto | null,
  })

export const useVotar = () =>
  useAcao(
    async (v: Voto) => ok(await supabase.from('votos').upsert(v)),
    [['voto'], ['totalVotos']],
  )

export const useResultado = (jogoId: string | undefined, habilitado: boolean) =>
  useQuery({
    queryKey: ['resultado', jogoId],
    enabled: Boolean(jogoId) && habilitado,
    queryFn: async () =>
      ok(await supabase.rpc('resultado_votacao', { p_jogo_id: jogoId! })) as ResultadoVotacao[],
  })

export const useTotalVotos = (jogoId: string | undefined) =>
  useQuery({
    queryKey: ['totalVotos', jogoId],
    enabled: Boolean(jogoId),
    queryFn: async () => Number(ok(await supabase.rpc('total_votos', { p_jogo_id: jogoId! }))),
  })

export const useRankingCraques = (limite = 5) =>
  useQuery({
    queryKey: ['ranking', 'craques', limite],
    queryFn: async () =>
      ok(await supabase.rpc('ranking_craques', { p_limite: limite })) as RankingCraque[],
  })

export const useRankingVencedores = (limite = 5) =>
  useQuery({
    queryKey: ['ranking', 'vencedores', limite],
    queryFn: async () =>
      ok(await supabase.rpc('ranking_vencedores', { p_limite: limite })) as RankingVencedor[],
  })

/** Jogos realizados no ano em que cada jogador esteve presente (desempate do sorteio). */
export const useJogosNoAno = () =>
  useQuery({
    queryKey: ['jogosNoAno'],
    queryFn: async () => {
      const rows = ok(await supabase.rpc('jogos_no_ano')) as { jogador_id: string; jogos: number }[]
      return Object.fromEntries(rows.map((r) => [r.jogador_id, Number(r.jogos)])) as Record<string, number>
    },
  })

// ---------- Financeiro ----------
export const usePagamentosMes = (competencia: string) =>
  useQuery({
    queryKey: ['pagamentos', competencia],
    queryFn: async () =>
      ok(await supabase.from('pagamentos').select('*').eq('competencia', competencia)) as Pagamento[],
  })

export const useMarcarPagamento = () =>
  useAcao(
    async (v: {
      jogadorId: string
      tipo: 'mensalidade' | 'avulso'
      competencia: string
      jogoId: string | null
      valor: number
      pago: boolean
    }) =>
      ok(
        await supabase.rpc('marcar_pagamento', {
          p_jogador_id: v.jogadorId,
          p_tipo: v.tipo,
          p_competencia: v.competencia,
          p_jogo_id: v.jogoId,
          p_valor: v.valor,
          p_pago: v.pago,
        }),
      ),
    [['pagamentos']],
  )

/** Jogos realizados do mês: cada avulso que jogou deve o valor individual do jogo. */
export const useJogosDoMes = (competencia: string) =>
  useQuery({
    queryKey: ['jogos', 'mes', competencia],
    queryFn: async () => {
      const fim = somaMeses(competencia, 1)
      return ok(
        await supabase
          .from('jogos')
          .select(JOGO_SELECT)
          .gte('data', competencia)
          .lt('data', fim)
          .eq('status', 'realizado')
          .order('data'),
      ) as unknown as Jogo[]
    },
  })

// ---------- Quadro de avisos ----------
/** Jogos realizados com a votação do craque aberta. */
export const useJogosVotacaoAberta = () =>
  useQuery({
    queryKey: ['jogos', 'votacaoAberta'],
    queryFn: async () =>
      ok(
        await supabase.from('jogos').select(JOGO_SELECT).eq('votacao_aberta', true).order('data', { ascending: false }),
      ) as unknown as Jogo[],
  })

/** Jogos cuja data já passou e ainda não foram encerrados (aviso para admins). */
export const useJogosSemEncerrar = (habilitado: boolean) =>
  useQuery({
    queryKey: ['jogos', 'semEncerrar'],
    enabled: habilitado,
    queryFn: async () =>
      ok(
        await supabase.from('jogos').select(JOGO_SELECT).eq('status', 'agendado').lt('data', hojeISO()).order('data'),
      ) as unknown as Jogo[],
  })

/** Minhas respostas de presença nos jogos informados. */
export const useMinhasPresencas = (jogadorId: string | undefined, jogoIds: string[]) =>
  useQuery({
    queryKey: ['presencas', 'minhas', jogadorId, jogoIds.join(',')],
    enabled: Boolean(jogadorId) && jogoIds.length > 0,
    queryFn: async () =>
      ok(
        await supabase.from('presencas').select('*').eq('jogador_id', jogadorId!).in('jogo_id', jogoIds),
      ) as Presenca[],
  })

/** Meus votos nos jogos informados. */
export const useMeusVotos = (eleitorId: string | undefined, jogoIds: string[]) =>
  useQuery({
    queryKey: ['voto', 'meus', eleitorId, jogoIds.join(',')],
    enabled: Boolean(eleitorId) && jogoIds.length > 0,
    queryFn: async () =>
      ok(await supabase.from('votos').select('*').eq('eleitor_id', eleitorId!).in('jogo_id', jogoIds)) as Voto[],
  })
