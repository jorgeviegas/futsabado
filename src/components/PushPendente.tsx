import { useState } from 'react'
import { ativarPush, ehIOS, usePushEstado } from '../lib/push'
import { Erro } from './ui'

/** Tela "aguardando aprovação": deixa o jogador ligar as notificações para ser avisado assim que um admin aprovar. */
export default function PushPendente() {
  const { estado, atualizar } = usePushEstado()
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<unknown>(null)

  if (!estado || estado === 'nao-configurado' || estado === 'nao-suportado') return null

  async function ativar() {
    setOcupado(true); setErro(null)
    try { await ativarPush(); atualizar() } catch (e) { setErro(e) } finally { setOcupado(false) }
  }

  return (
    <div className="card" style={{ background: 'var(--card-2)' }}>
      {estado === 'desativado' && (
        <>
          <strong>🔔 Quer ser avisado quando for aprovado?</strong>
          <p className="muted" style={{ margin: 0 }}>Ative as notificações neste aparelho e você recebe um aviso assim que o admin liberar seu cadastro.</p>
          <button className="btn" disabled={ocupado} onClick={ativar}>{ocupado ? 'Ativando…' : 'Ativar notificações'}</button>
        </>
      )}
      {estado === 'ativado' && <strong>✅ Pronto! Você será avisado por notificação quando for aprovado.</strong>}
      {estado === 'instalar' && (
        <p className="muted" style={{ margin: 0 }}>
          Para receber o aviso de aprovação no iPhone, instale o app: toque em Compartilhar e depois em “Adicionar à Tela de Início”,
          abra pelo ícone e ative as notificações aqui.
        </p>
      )}
      {estado === 'negado' && (
        <p className="muted" style={{ margin: 0 }}>
          As notificações estão bloqueadas. {ehIOS() ? 'Libere em Ajustes → Notificações → FutSábado.' : 'Libere nas configurações do navegador.'}
        </p>
      )}
      <Erro erro={erro} />
    </div>
  )
}
