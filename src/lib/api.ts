import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { hojeISO } from './format'
import { gerarCobrancas, type ConvidadoJogou, type Jogou } from './financeiro'
import type {
  Convidado, ExtratoItem, FuncaoGoleiro, Jogador, Jogo, Lancamento, Pagamento, Pelada, Presenca, RankingAssiduo,
  RankingCraque, RankingVencedor, ResultadoVotacao, ResumoCaixa, StatusPresenca, TipoPagamento, Voto,
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

/** Próximo jogo (o mais próximo ainda por acontecer). */
export const useProximoJogo = () =>
  useQuery({
    queryKey: ['jogos', 'proximo'],
    queryFn: async () => {
      const rows = ok(
        await supabase.from('jogos').select(JOGO_SELECT).eq('status', 'agendado').gte('data', hojeISO()).order('data').limit(1),
      ) as unknown as Jogo[]
      return rows[0] ?? null
    },
  })

/** Jogo anterior (o mais recente que já aconteceu). */
export const useJogoAnterior = () =>
  useQuery({
    queryKey: ['jogos', 'anterior'],
    queryFn: async () => {
      const rows = ok(
        await supabase
          .from('jogos')
          .select(JOGO_SELECT)
          .or(`status.eq.realizado,and(data.lt.${hojeISO()},status.neq.cancelado)`)
          .order('data', { ascending: false })
          .limit(1),
      ) as unknown as Jogo[]
      return rows[0] ?? null
    },
  })

/** Histórico de jogos realizados, com placar. */
export const useResultados = () =>
  useQuery({
    queryKey: ['jogos', 'resultados'],
    queryFn: async () =>
      ok(
        await supabase.from('jogos').select(JOGO_SELECT).eq('status', 'realizado').order('data', { ascending: false }).limit(30),
      ) as unknown as Jogo[],
  })

/** Marca como realizados os jogos que já passaram (a votação abre sozinha). Chamada ao abrir o app. */
export const processarJogos = async (): Promise<number> => {
  const { data, error } = await supabase.rpc('processar_jogos')
  if (error) return 0
  return Number(data ?? 0)
}

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
    [['jogos'], ['jogo'], ['ranking'], ['resultado'], ['jogosNoAno'], ['cobrancas'], ['presencas']],
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
    [['presencas'], ['cobrancas']],
  )

/** Contagem de participantes por jogo (confirmados + convidados) e as respostas de presença. */
export const useConfirmadosPorJogo = (jogoIds: string[]) =>
  useQuery({
    queryKey: ['presencas', 'contagem', jogoIds.join(',')],
    enabled: jogoIds.length > 0,
    queryFn: async () => {
      const [pres, conv] = await Promise.all([
        supabase.from('presencas').select('jogo_id, jogador_id, status').in('jogo_id', jogoIds),
        supabase.from('convidados').select('jogo_id').in('jogo_id', jogoIds),
      ])
      const rows = ok(pres) as Presenca[]
      const mapa: Record<string, number> = {}
      rows.forEach((r) => {
        if (r.status === 'confirmado') mapa[r.jogo_id] = (mapa[r.jogo_id] ?? 0) + 1
      })
      ;(ok(conv) as { jogo_id: string }[]).forEach((c) => {
        mapa[c.jogo_id] = (mapa[c.jogo_id] ?? 0) + 1
      })
      return { contagem: mapa, rows }
    },
  })

/** Data em que a confirmação de presença do jogo abre (null = já aberta / sem jogo anterior). */
export const useLiberacao = (jogoId: string | undefined) =>
  useQuery({
    queryKey: ['jogos', 'liberacao', jogoId],
    enabled: Boolean(jogoId),
    queryFn: async () => (ok(await supabase.rpc('liberacao_confirmacao', { p_jogo_id: jogoId! })) as string | null) ?? null,
  })

// ---------- Convidados e faltosos ----------
export const useConvidados = (jogoId: string | undefined) =>
  useQuery({
    queryKey: ['convidados', jogoId],
    enabled: Boolean(jogoId),
    queryFn: async () => ok(await supabase.from('convidados').select('*').eq('jogo_id', jogoId!).order('created_at')) as Convidado[],
  })

export const useAdicionarConvidado = () =>
  useAcao(
    async (c: Pick<Convidado, 'jogo_id' | 'convidado_por' | 'nome' | 'posicao'>) => ok(await supabase.from('convidados').insert(c)),
    [['convidados'], ['presencas'], ['cobrancas']],
  )

export const useRemoverConvidado = () =>
  useAcao(
    async (id: string) => ok(await supabase.rpc('remover_convidado', { p_convidado_id: id })),
    [['convidados'], ['presencas'], ['jogo'], ['cobrancas']],
  )

/** Admin: marca quem confirmou mas não compareceu (some do sorteio, da cobrança e da votação). */
export const useRemoverFaltoso = () =>
  useAcao(
    async (v: { jogoId: string; jogadorId: string }) =>
      ok(await supabase.rpc('remover_faltoso', { p_jogo_id: v.jogoId, p_jogador_id: v.jogadorId })),
    [['presencas'], ['jogo'], ['voto'], ['totalVotos'], ['resultado'], ['cobrancas'], ['ranking'], ['jogosNoAno']],
  )

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

export const useRankingAssiduidade = (limite = 5) =>
  useQuery({
    queryKey: ['ranking', 'assiduidade', limite],
    queryFn: async () =>
      ok(await supabase.rpc('ranking_assiduidade', { p_limite: limite })) as RankingAssiduo[],
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

// ---------- Financeiro / Caixa ----------
export const useMarcarPagamento = () =>
  useAcao(
    async (v: {
      jogadorId: string
      tipo: TipoPagamento
      competencia: string
      jogoId: string | null
      convidadoId?: string | null
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
          p_convidado_id: v.convidadoId ?? null,
        }),
      ),
    [['cobrancas'], ['caixa']],
  )

const JOGO_REF = 'jogos!inner(id, data, valor, status, peladas(nome, valor_avulso))'

/**
 * Cobranças do ano. Sem `jogadorId` (admin): de todos. Com `jogadorId`: só as dele
 * (incluindo os convidados que ele trouxe).
 */
export const useCobrancas = (jogadorId?: string) => {
  const { data: jogadores = [], isLoading: l1 } = useJogadores()
  const { data: peladas = [], isLoading: l2 } = usePeladas()
  const { data: base, isLoading: l3, error } = useQuery({
    queryKey: ['cobrancas', jogadorId ?? 'todos'],
    queryFn: async () => {
      let jogaram = supabase.from('presencas').select(`jogador_id, ${JOGO_REF}`).eq('status', 'confirmado').eq('jogos.status', 'realizado')
      let convidados = supabase.from('convidados').select(`id, nome, convidado_por, ${JOGO_REF}`).eq('jogos.status', 'realizado')
      let pagamentos = supabase.from('pagamentos').select('*')
      if (jogadorId) {
        jogaram = jogaram.eq('jogador_id', jogadorId)
        convidados = convidados.eq('convidado_por', jogadorId)
        pagamentos = pagamentos.eq('jogador_id', jogadorId)
      }
      const [a, b, c] = await Promise.all([jogaram, convidados, pagamentos])
      return {
        jogaram: ok(a) as unknown as Jogou[],
        convidados: ok(b) as unknown as ConvidadoJogou[],
        pagamentos: ok(c) as Pagamento[],
      }
    },
  })

  const cobrancas = useMemo(() => {
    if (!base) return []
    const todas = gerarCobrancas({
      jogadores,
      ...base,
      valorMensalidade: peladas.find((p) => p.ativa)?.valor_mensalidade ?? 0,
    })
    return jogadorId ? todas.filter((c) => c.jogadorId === jogadorId) : todas
  }, [base, jogadores, peladas, jogadorId])

  return { cobrancas, isLoading: l1 || l2 || l3, error }
}

export const useCaixaExtrato = (limite = 200) =>
  useQuery({
    queryKey: ['caixa', 'extrato', limite],
    queryFn: async () => {
      const rows = ok(await supabase.rpc('caixa_extrato', { p_limite: limite })) as ExtratoItem[]
      return rows.map((r) => ({ ...r, valor: Number(r.valor) }))
    },
  })

export const useCaixaResumo = () =>
  useQuery({
    queryKey: ['caixa', 'resumo'],
    queryFn: async () => {
      const rows = ok(await supabase.rpc('caixa_resumo')) as ResumoCaixa[]
      return { entradas: Number(rows[0]?.entradas ?? 0), saidas: Number(rows[0]?.saidas ?? 0) }
    },
  })

export const useSalvarLancamento = () =>
  useAcao(
    async (l: Pick<Lancamento, 'tipo' | 'descricao' | 'valor' | 'data'> & { created_by?: string }) =>
      ok(await supabase.from('caixa_lancamentos').insert(l)),
    [['caixa']],
  )

export const useExcluirLancamento = () =>
  useAcao(async (id: string) => ok(await supabase.from('caixa_lancamentos').delete().eq('id', id)), [['caixa']])

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
