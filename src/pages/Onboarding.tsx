import { useState } from 'react'
import { useSalvarJogador } from '../lib/api'
import { useAuth } from '../lib/auth'
import CampoPosicoes from '../components/CampoPosicoes'
import { Erro } from '../components/ui'
import type { Posicao } from '../lib/types'

/** Primeiro acesso: o jogador escolhe posições e (opcionalmente) o número da camisa. */
export default function Onboarding() {
  const { eu, sair } = useAuth()
  const salvar = useSalvarJogador()
  const [pos, setPos] = useState<{ primaria: Posicao | null; secundaria: Posicao | null }>({ primaria: null, secundaria: null })
  const [camisa, setCamisa] = useState('')
  if (!eu) return null

  const concluir = (comDados: boolean) =>
    salvar.mutate({
      id: eu.id,
      nome: eu.nome,
      perfil_completo: true,
      ...(comDados ? {
        posicao: pos.primaria,
        posicao_secundaria: pos.secundaria,
        numero_camisa: camisa ? Number(camisa) : null,
      } : {}),
    })

  return (
    <div className="centro" style={{ alignItems: 'start' }}>
      <form className="login form" style={{ maxWidth: 420 }} onSubmit={(e) => { e.preventDefault(); concluir(true) }}>
        <div>
          <h1>Bem-vindo, {eu.apelido || eu.nome}! ⚽</h1>
          <p className="muted">Conte onde você joga. Isso ajuda no sorteio dos times. Dá para mudar depois em <strong>Elenco</strong>.</p>
        </div>

        <CampoPosicoes primaria={pos.primaria} secundaria={pos.secundaria} onChange={setPos} />

        <label>
          Número da camisa (opcional)
          <input type="number" inputMode="numeric" min={1} max={99} value={camisa} onChange={(e) => setCamisa(e.target.value)} placeholder="Ex.: 10" />
        </label>

        <Erro erro={salvar.error} />
        <button className="btn" disabled={salvar.isPending || !pos.primaria}>Salvar e continuar</button>
        <button type="button" className="btn sec" disabled={salvar.isPending} onClick={() => concluir(false)}>Pular por enquanto</button>
        <button type="button" className="btn sec peq" onClick={sair}>Sair</button>
      </form>
    </div>
  )
}
