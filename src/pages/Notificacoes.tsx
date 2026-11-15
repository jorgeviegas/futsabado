import { useState } from 'react'
import { PUSH_PADRAO, usePushPreferencias, useSalvarPushPreferencias } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ativarPush, desativarPush, enviarTeste, ehIOS, usePushEstado } from '../lib/push'
import { Erro, Spinner } from '../components/ui'

const AVISOS: { chave: keyof typeof PUSH_PADRAO; icone: string; titulo: string; detalhe: string }[] = [
  { chave: 'confirmacao_aberta', icone: '⚽', titulo: 'Confirmação de presença aberta', detalhe: 'Quando abrir a confirmação do próximo jogo (se você ainda não respondeu).' },
  { chave: 'vaga_lista_espera', icone: '✅', titulo: 'Entrei no jogo', detalhe: 'Quando uma vaga abrir e você sair da lista de espera.' },
  { chave: 'lembrete_vespera', icone: '⏰', titulo: 'Lembrete de véspera', detalhe: '12 horas antes do jogo, se você estiver confirmado.' },
  { chave: 'resultado_craque', icone: '🏆', titulo: 'Craque do jogo', detalhe: 'Quando a votação encerrar e o resultado estiver pronto.' },
]

export default function Notificacoes() {
  const { eu } = useAuth()
  const { estado, carregando, atualizar } = usePushEstado()
  const { data: prefs } = usePushPreferencias(eu?.id)
  const salvarPrefs = useSalvarPushPreferencias(eu?.id)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<unknown>(null)
  const [msg, setMsg] = useState('')
  // o interruptor muda na hora (sem esperar o servidor); volta atrás se der erro
  const [local, setLocal] = useState<Partial<typeof PUSH_PADRAO>>({})

  async function executar(acao: () => Promise<void>, ok?: string) {
    setOcupado(true)
    setErro(null)
    setMsg('')
    try {
      await acao()
      if (ok) setMsg(ok)
    } catch (e) {
      setErro(e)
    } finally {
      setOcupado(false)
      atualizar()
    }
  }

  return (
    <>
      <h1>🔔 Notificações</h1>

      <div className="card">
        {carregando && <Spinner />}

        {estado === 'nao-configurado' && (
          <p className="muted">As notificações ainda não foram configuradas neste app. Peça a um administrador para finalizar a configuração.</p>
        )}

        {estado === 'instalar' && (
          <>
            <h2>Instale o app para receber avisos</h2>
            <p className="muted">No iPhone, as notificações só funcionam no app instalado na tela de início:</p>
            <ol className="passos">
              <li>No Safari, toque em <strong>Compartilhar</strong> (o quadrado com a seta).</li>
              <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
              <li>Abra o FutSábado pelo <strong>ícone novo</strong> e volte a esta tela.</li>
            </ol>
          </>
        )}

        {estado === 'nao-suportado' && <p className="muted">Este navegador não suporta notificações push. Tente instalar o app ou usar o Chrome/Safari atualizado.</p>}

        {estado === 'negado' && (
          <>
            <h2>Notificações bloqueadas</h2>
            <p className="muted">
              {ehIOS()
                ? 'Abra Ajustes → Notificações → FutSábado e permita as notificações. Depois volte aqui.'
                : 'Libere as notificações para este site nas configurações do navegador e volte aqui.'}
            </p>
          </>
        )}

        {estado === 'desativado' && (
          <>
            <h2>Receba avisos no celular</h2>
            <p className="muted">Ative para ser avisado da confirmação de presença, da fila de espera, da véspera do jogo e do craque da partida.</p>
            <button className="btn" disabled={ocupado} onClick={() => executar(ativarPush, 'Notificações ativadas neste aparelho!')}>
              {ocupado ? 'Ativando…' : '🔔 Ativar notificações neste aparelho'}
            </button>
          </>
        )}

        {estado === 'ativado' && (
          <>
            <div className="linha entre">
              <h2>Notificações ativadas</h2>
              <span className="chip ok">✓ neste aparelho</span>
            </div>
            <div className="linha wrap">
              <button className="btn sec peq" disabled={ocupado} onClick={() => executar(enviarTeste, 'Teste enviado! Chega em até 1 minuto.')}>
                📨 Enviar teste
              </button>
              <button className="btn perigo peq" disabled={ocupado} onClick={() => executar(desativarPush, 'Notificações desativadas neste aparelho.')}>
                Desativar
              </button>
            </div>
          </>
        )}

        {msg && <p className="ok-msg">{msg}</p>}
        <Erro erro={erro} />
      </div>

      <div className="card">
        <h2>O que você quer receber</h2>
        <p className="muted">Vale para todos os seus aparelhos.</p>
        {AVISOS.map((a) => {
          const ligado = local[a.chave] ?? prefs?.[a.chave] ?? true
          return (
            <label className="pref-linha" key={a.chave}>
              <span className="grow">
                <strong>{a.icone} {a.titulo}</strong>
                <span className="muted" style={{ display: 'block' }}>{a.detalhe}</span>
              </span>
              <input
                type="checkbox" style={{ width: 'auto' }} checked={ligado}
                onChange={(e) => {
                  const valor = e.target.checked
                  setLocal((l) => ({ ...l, [a.chave]: valor }))
                  salvarPrefs.mutate({ [a.chave]: valor }, {
                    onSettled: () => setLocal(({ [a.chave]: _descartado, ...resto }) => resto),
                  })
                }}
              />
            </label>
          )
        })}
        <Erro erro={salvarPrefs.error} />
      </div>
    </>
  )
}
