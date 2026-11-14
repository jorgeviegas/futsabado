import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSalvarJogador } from '../lib/api'
import { useAuth } from '../lib/auth'
import CampoPosicoes from '../components/CampoPosicoes'
import { Erro } from '../components/ui'
import type { Posicao } from '../lib/types'

/**
 * Primeiro acesso após a aprovação: o jogador escolhe posições e (opcionalmente) o número da camisa.
 * "Pular" só adia: a tela volta na próxima vez que o app for aberto, e o quadro de avisos lembra enquanto não houver posição.
 * Com `embutido`, é a página /posicoes (aberta pelo aviso), dentro do layout normal.
 */
export default function Onboarding({ onPular, embutido = false }: { onPular?: () => void; embutido?: boolean }) {
  const { eu, sair } = useAuth()
  const nav = useNavigate()
  const salvar = useSalvarJogador()
  const [pos, setPos] = useState<{ primaria: Posicao | null; secundaria: Posicao | null }>({ primaria: null, secundaria: null })
  const [camisa, setCamisa] = useState('')
  if (!eu) return null

  const salvarEscolhas = () =>
    salvar.mutate(
      {
        id: eu.id,
        nome: eu.nome,
        perfil_completo: true,
        posicao: pos.primaria,
        posicao_secundaria: pos.secundaria,
        numero_camisa: camisa ? Number(camisa) : null,
      },
      { onSuccess: () => embutido && nav('/') },
    )

  return (
    <div className={embutido ? undefined : 'centro'} style={embutido ? undefined : { alignItems: 'start' }}>
      <form className="login form" style={{ maxWidth: 420, margin: '0 auto' }} onSubmit={(e) => { e.preventDefault(); salvarEscolhas() }}>
        <div>
          <h1>Bem-vindo, {eu.apelido || eu.nome}! ⚽</h1>
          <p className="muted">Sua conta foi aprovada. Conte onde você joga: isso ajuda no sorteio dos times. Dá para mudar depois em <strong>Elenco</strong>.</p>
        </div>

        <CampoPosicoes primaria={pos.primaria} secundaria={pos.secundaria} onChange={setPos} />

        <label>
          Número da camisa (opcional)
          <input type="number" inputMode="numeric" min={1} max={99} value={camisa} onChange={(e) => setCamisa(e.target.value)} placeholder="Ex.: 10" />
        </label>

        <Erro erro={salvar.error} />
        <button className="btn" disabled={salvar.isPending || !pos.primaria}>Salvar e continuar</button>
        <button type="button" className="btn sec" disabled={salvar.isPending} onClick={() => (embutido ? nav('/') : onPular?.())}>
          {embutido ? 'Voltar' : 'Pular por enquanto'}
        </button>
        {!embutido && <p className="muted" style={{ textAlign: 'center' }}>Se pular, lembramos você na próxima vez que abrir o app.</p>}
        {!embutido && <button type="button" className="btn sec peq" onClick={sair}>Sair</button>}
      </form>
    </div>
  )
}
