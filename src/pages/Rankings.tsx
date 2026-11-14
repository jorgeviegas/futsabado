import { useJogadores, useRankingAssiduidade, useRankingCraques, useRankingVencedores } from '../lib/api'
import { exibir } from '../lib/format'
import { Avatar, Erro, Spinner } from '../components/ui'

const ANO = new Date().getFullYear()

type Linha = { jogador_id: string; nome: string; apelido: string | null; valor: number }

function Top({ titulo, vazio, rotulo, linhas, carregando, erro }: {
  titulo: string; vazio: string; rotulo: (n: number) => string; linhas?: Linha[]; carregando: boolean; erro: unknown
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
          <span className="grow">{exibir(r)}</span>
          <span className="chip grena">{rotulo(r.valor)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Rankings() {
  const craques = useRankingCraques(5)
  const vencedores = useRankingVencedores(5)
  const assiduos = useRankingAssiduidade(5)
  const totalJogos = assiduos.data?.[0]?.total_jogos ?? 0
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
    </>
  )
}
