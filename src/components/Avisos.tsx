import { Link } from 'react-router-dom'
import {
  useJogadores, useJogos, useJogosSemEncerrar, useJogosVotacaoAberta, useMeusVotos, useMinhasPresencas,
} from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatarData } from '../lib/format'

interface Aviso {
  chave: string
  icone: string
  titulo: string
  detalhe?: string
  to: string
  destaque?: boolean
}

/** Quadro de avisos: ações pendentes do jogador (e, para admins, da organização). */
export default function Avisos() {
  const { eu, isAdmin } = useAuth()
  const { data: abertas = [] } = useJogosVotacaoAberta()
  const { data: proximos = [] } = useJogos('proximos')
  const { data: semEncerrar = [] } = useJogosSemEncerrar(isAdmin)
  const { data: jogadores = [] } = useJogadores()

  const ids = [...new Set([...abertas, ...proximos].map((j) => j.id))]
  const { data: minhas = [] } = useMinhasPresencas(eu?.id, ids)
  const { data: meusVotos = [] } = useMeusVotos(eu?.id, abertas.map((j) => j.id))

  const avisos: Aviso[] = []

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

  // 2) Responder presença nos próximos jogos
  proximos.forEach((j) => {
    if (j.status === 'agendado' && !minhas.some((p) => p.jogo_id === j.id)) {
      avisos.push({
        chave: `pres-${j.id}`, icone: '🙋',
        titulo: 'Confirme sua presença',
        detalhe: `${j.peladas?.nome ?? 'Pelada'} · ${formatarData(j.data)}`,
        to: `/jogo/${j.id}`,
      })
    }
  })

  if (isAdmin) {
    // 3) Admin: jogos que já passaram e não foram encerrados
    semEncerrar.forEach((j) =>
      avisos.push({
        chave: `enc-${j.id}`, icone: '✅', destaque: true,
        titulo: 'Encerre o jogo e abra a votação',
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
    if (proximos.length === 0) {
      avisos.push({ chave: 'gerar', icone: '📅', titulo: 'Não há próximos jogos. Gere as próximas semanas.', to: '/peladas' })
    }
  }

  if (avisos.length === 0) return null

  return (
    <section className="card avisos" aria-label="Quadro de avisos">
      <h2>📌 Quadro de avisos <span className="chip grena">{avisos.length}</span></h2>
      {avisos.map((a) => (
        <Link key={a.chave} to={a.to} className={`aviso ${a.destaque ? 'destaque' : ''}`}>
          <span className="aviso-icone" aria-hidden>{a.icone}</span>
          <span className="grow">
            <strong>{a.titulo}</strong>
            {a.detalhe && <span className="muted" style={{ display: 'block' }}>{a.detalhe}</span>}
          </span>
          <span aria-hidden>›</span>
        </Link>
      ))}
    </section>
  )
}
