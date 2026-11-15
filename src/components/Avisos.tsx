import { Link } from 'react-router-dom'
import {
  useCobrancas, useJogadores, useJogosSemEncerrar, useJogosSemPlacar, useJogosVotacaoAberta, useLiberacao, useMeusVotos, useMinhasPresencas,
  useProximoJogo,
} from '../lib/api'
import { useAuth } from '../lib/auth'
import { confirmacaoLiberada, formatarData, moeda } from '../lib/format'
import { totalDe } from '../lib/financeiro'

interface Aviso {
  chave: string
  icone: string
  titulo: string
  detalhe?: string
  linhas?: string[]
  to: string
  destaque?: boolean
  /** Pendência financeira: destaque em vermelho. */
  perigo?: boolean
}

/** Quadro de avisos: ações pendentes do jogador (e, para admins, da organização). */
export default function Avisos() {
  const { eu, isAdmin } = useAuth()
  const { data: abertas = [] } = useJogosVotacaoAberta()
  const { data: proximo } = useProximoJogo()
  const { data: liberaEm } = useLiberacao(proximo?.id)
  const { data: semEncerrar = [] } = useJogosSemEncerrar(isAdmin)
  const { data: semPlacar = [] } = useJogosSemPlacar(isAdmin)
  const { data: jogadores = [] } = useJogadores()

  const ids = [...new Set([...abertas, ...(proximo ? [proximo] : [])].map((j) => j.id))]
  const { data: minhas = [] } = useMinhasPresencas(eu?.id, ids)
  const { data: meusVotos = [] } = useMeusVotos(eu?.id, abertas.map((j) => j.id))

  const { cobrancas: minhasCobrancas } = useCobrancas(eu?.id)

  const avisos: Aviso[] = []

  // 0) Pendência financeira do jogador logado (sempre em primeiro lugar)
  if (eu) {
    const pendencias = minhasCobrancas.filter((c) => !c.pago)
    if (pendencias.length > 0) {
      avisos.push({
        chave: 'financeiro', icone: '💸', perigo: true,
        titulo: `Pagamento pendente: ${moeda(totalDe(pendencias))}`,
        linhas: [
          ...pendencias.slice(0, 3).map((p) => `${p.rotulo} · ${moeda(p.valor)}`),
          ...(pendencias.length > 3 ? [`e mais ${pendencias.length - 3}…`] : []),
        ],
        to: '/financeiro',
      })
    }
    // 0b) Ainda sem posição (pulou a escolha): lembrar
    if (!eu.posicao) {
      avisos.push({
        chave: 'posicao', icone: '📍', destaque: true,
        titulo: 'Escolha sua posição na quadra',
        detalhe: 'Isso ajuda no sorteio dos times.',
        to: '/posicoes',
      })
    }
  }

  // 1) Lembrete de votar no craque: jogo encerrado, votação aberta, eu estava presente e ainda não votei
  abertas.forEach((j) => {
    const fui = minhas.some((p) => p.jogo_id === j.id && p.status === 'confirmado')
    const votei = meusVotos.some((v) => v.jogo_id === j.id)
    if (fui && !votei) {
      avisos.push({
        chave: `voto-${j.id}`, icone: '⭐', destaque: true,
        titulo: 'Vote no craque do jogo!',
        detalhe: `${j.peladas?.nome ?? 'Pelada'} · ${formatarData(j.data)}`,
        to: `/jogo/${j.id}`,
      })
    }
  })

  // 2) Confirmar presença no PRÓXIMO jogo — só aparece quando a confirmação abre (ex.: segunda-feira)
  if (proximo && proximo.status === 'agendado' && confirmacaoLiberada(liberaEm) && !minhas.some((p) => p.jogo_id === proximo.id)) {
    avisos.push({
      chave: `pres-${proximo.id}`, icone: '🙋',
      titulo: 'Confirme sua presença',
      detalhe: `${proximo.peladas?.nome ?? 'Pelada'} · ${formatarData(proximo.data)}`,
      to: `/jogo/${proximo.id}`,
    })
  }

  if (isAdmin) {
    // 3) Admin: jogos que já passaram e não foram encerrados
    semEncerrar.forEach((j) =>
      avisos.push({
        chave: `enc-${j.id}`, icone: '✅', destaque: true,
        titulo: 'Encerre o jogo: placar e faltantes',
        detalhe: `${j.peladas?.nome ?? 'Pelada'} · ${formatarData(j.data)}`,
        to: `/jogo/${j.id}`,
      }),
    )
    // 3b) Admin: jogos realizados ainda sem placar
    semPlacar.forEach((j) =>
      avisos.push({
        chave: `placar-${j.id}`, icone: '📝', destaque: true,
        titulo: 'Registre o placar e os faltantes',
        detalhe: `${j.peladas?.nome ?? 'Pelada'} · ${formatarData(j.data)}`,
        to: `/jogo/${j.id}`,
      }),
    )
    // 4) Admin: votações abertas aguardando encerramento
    abertas.forEach((j) =>
      avisos.push({
        chave: `fechar-${j.id}`, icone: '🔒',
        titulo: 'Votação aberta: encerre para revelar o craque',
        detalhe: `${j.peladas?.nome ?? 'Pelada'} · ${formatarData(j.data)}`,
        to: `/jogo/${j.id}`,
      }),
    )
    // 5) Admin: cadastros aguardando aprovação
    const pendentes = jogadores.filter((j) => !j.ativo && j.user_id).length
    if (pendentes > 0) {
      avisos.push({
        chave: 'aprovar', icone: '⏳', destaque: true,
        titulo: `${pendentes} ${pendentes === 1 ? 'cadastro aguardando' : 'cadastros aguardando'} aprovação`,
        to: '/jogadores',
      })
    }
    // 6) Admin: nenhum jogo futuro
    if (!proximo) {
      avisos.push({ chave: 'gerar', icone: '📅', titulo: 'Não há próximos jogos. Gere as próximas semanas.', to: '/peladas' })
    }
  }

  if (avisos.length === 0) return null

  return (
    <section className="card avisos" aria-label="Quadro de avisos">
      <h2>📌 Quadro de avisos <span className="chip grena">{avisos.length}</span></h2>
      {avisos.map((a) => (
        <Link key={a.chave} to={a.to} className={`aviso ${a.destaque ? 'destaque' : ''} ${a.perigo ? 'perigo' : ''}`}>
          <span className="aviso-icone" aria-hidden>{a.icone}</span>
          <span className="grow">
            <strong>{a.titulo}</strong>
            {a.detalhe && <span className="muted" style={{ display: 'block' }}>{a.detalhe}</span>}
            {a.linhas?.map((l) => <span key={l} className="muted" style={{ display: 'block' }}>{l}</span>)}
          </span>
          <span aria-hidden>›</span>
        </Link>
      ))}
    </section>
  )
}
