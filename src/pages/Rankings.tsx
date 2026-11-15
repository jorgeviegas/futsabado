import type { ReactNode } from 'react'
import { useJogadores, useRankingArtilheiros, useRankingAssiduidade, useRankingAssistentes, useRankingCraques, useRankingGoleiros, useRankingVencedores } from '../lib/api'
import { exibir } from '../lib/format'
import { Avatar, Erro, Spinner } from '../components/ui'

const ANO = new Date().getFullYear()

type Linha = { jogador_id: string; nome: string; apelido: string | null; valor: number; detalhe?: string }

function Top({ titulo, vazio, rotulo, linhas, carregando, erro, rodape, luva = false }: {
  titulo: string; vazio: string; rotulo: (n: number) => string; linhas?: Linha[]; carregando: boolean; erro: unknown
  rodape?: ReactNode; luva?: boolean
}) {
  const { data: jogadores = [] } = useJogadores()
  const num = (id: string) => jogadores.find((j) => j.id === id)?.numero_camisa
  return (
    <div className="card">
      <h2>{titulo}</h2>
      {carregando && <Spinner />}
      <Erro erro={erro} />
      {!carregando && !erro && !linhas?.length && <p className="muted">{vazio}</p>}
      {linhas?.slice(0, 5).map((r, i) => (
        <div className="linha" key={r.jogador_id}>
          <strong style={{ width: 28 }}>{['🥇', '🥈', '🥉'][i] ?? `${i + 1}º`}</strong>
          <Avatar nome={exibir(r)} numero={num(r.jogador_id)} />
          <span className="grow">
            {exibir(r)}{luva && <span role="img" aria-label="Goleiro"> 🧤</span>}
            {r.detalhe && <span className="muted" style={{ display: 'block' }}>{r.detalhe}</span>}
          </span>
          <span className="chip grena">{rotulo(r.valor)}</span>
        </div>
      ))}
      {rodape && !!linhas?.length && <p className="muted" style={{ margin: 0 }}>{rodape}</p>}
    </div>
  )
}

export default function Rankings() {
  const craques = useRankingCraques(5)
  const vencedores = useRankingVencedores(5)
  const assiduos = useRankingAssiduidade(5)
  const totalJogos = assiduos.data?.[0]?.total_jogos ?? 0
  const artilheiros = useRankingArtilheiros(5)
  const assistentes = useRankingAssistentes(5)
  const goleiros = useRankingGoleiros(5)
  const g0 = goleiros.data?.[0]
  return (
    <>
      <h1>Rankings</h1>
      <Top
        titulo="⭐ Mais craques"
        vazio="Aparece após a primeira votação encerrada."
        rotulo={(n) => `${n} ${n === 1 ? 'vez' : 'vezes'}`}
        linhas={craques.data?.map((r) => ({ ...r, valor: r.premios }))}
        carregando={craques.isLoading}
        erro={craques.error}
      />
      <Top
        titulo="🏅 Maiores vencedores"
        vazio="Aparece quando um jogo sorteado for encerrado com o time vencedor informado."
        rotulo={(n) => `${n} ${n === 1 ? 'vitória' : 'vitórias'}`}
        linhas={vencedores.data?.map((r) => ({ ...r, valor: r.vitorias }))}
        carregando={vencedores.isLoading}
        erro={vencedores.error}
      />
      <Top
        titulo={`📅 Mais assíduos de ${ANO}`}
        vazio="Aparece após o primeiro jogo realizado do ano."
        rotulo={(n) => `${n} de ${totalJogos} ${totalJogos === 1 ? 'jogo' : 'jogos'}`}
        linhas={assiduos.data?.map((r) => ({ ...r, valor: r.presencas }))}
        carregando={assiduos.isLoading}
        erro={assiduos.error}
      />
      <Top
        titulo={`⚽ Artilheiros de ${ANO}`}
        vazio="Aparece quando o admin registrar os gols ao encerrar um jogo."
        rotulo={(n) => `${n} ${n === 1 ? 'gol' : 'gols'}`}
        linhas={artilheiros.data?.map((r) => ({ ...r, valor: r.total, detalhe: `${r.jogos} ${r.jogos === 1 ? 'jogo' : 'jogos'}` }))}
        carregando={artilheiros.isLoading}
        erro={artilheiros.error}
      />
      <Top
        titulo={`🍽️ Garçons de ${ANO} (assistências)`}
        vazio="Aparece quando o admin registrar as assistências ao encerrar um jogo."
        rotulo={(n) => `${n} ${n === 1 ? 'assistência' : 'assistências'}`}
        linhas={assistentes.data?.map((r) => ({ ...r, valor: r.total, detalhe: `${r.jogos} ${r.jogos === 1 ? 'jogo' : 'jogos'}` }))}
        carregando={assistentes.isLoading}
        erro={assistentes.error}
      />
      <Top
        titulo={`🧤 Goleiros menos vazados de ${ANO}`}
        vazio="Aparece quando um goleiro atingir o mínimo de jogos (30% dos jogos do ano com placar e escalação)."
        rotulo={(n) => `${n.toFixed(2).replace('.', ',')} por jogo`}
        linhas={goleiros.data?.map((r) => ({
          ...r,
          valor: r.media,
          detalhe: `${r.jogos} ${r.jogos === 1 ? 'jogo' : 'jogos'} · ${r.gols_sofridos} sofridos`,
        }))}
        carregando={goleiros.isLoading}
        erro={goleiros.error}
        luva
        rodape={
          g0 &&
          `Média de gols sofridos por jogo. Mínimo de ${g0.minimo_jogos} jogos (30% dos ${g0.total_jogos} jogos do ano com placar). ` +
            'A ordem usa a média ajustada: quando a diferença é pequena, quem jogou mais fica acima.'
        }
      />
    </>
  )
}
