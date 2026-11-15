import { useState } from 'react'
import { useConfigTime, useSalvarConfigTime } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Erro, Modal } from './ui'
import type { TipoPix } from '../lib/types'

const TIPOS: Record<TipoPix, string> = {
  cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', telefone: 'Telefone', aleatoria: 'Chave aleatória',
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    // alternativa para navegadores sem a API de área de transferência
    const campo = document.createElement('textarea')
    campo.value = texto
    campo.setAttribute('readonly', '')
    campo.style.position = 'fixed'
    campo.style.opacity = '0'
    document.body.appendChild(campo)
    campo.select()
    campo.setSelectionRange(0, texto.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(campo)
    return ok
  }
}

/** Chave Pix do time: todos veem e copiam; o admin cadastra/edita. */
export default function PixDoTime() {
  const { isAdmin } = useAuth()
  const { data: config, isLoading } = useConfigTime()
  const [editando, setEditando] = useState(false)
  const [copiado, setCopiado] = useState<'sim' | 'erro' | null>(null)
  const chave = config?.pix_chave?.trim()

  if (isLoading) return null
  if (!chave && !isAdmin) return null

  async function aoCopiar() {
    const ok = await copiar(chave!)
    setCopiado(ok ? 'sim' : 'erro')
    setTimeout(() => setCopiado(null), 2500)
  }

  return (
    <div className="card">
      <div className="linha entre">
        <h2>💠 Pix do time</h2>
        {config?.pix_tipo && chave && <span className="chip">{TIPOS[config.pix_tipo]}</span>}
      </div>
      {chave ? (
        <>
          <div className="pix-chave" data-testid="pix-chave">{chave}</div>
          {config?.pix_beneficiario && <span className="muted">Favorecido: {config.pix_beneficiario}</span>}
          <button className="btn" onClick={aoCopiar} aria-live="polite">
            {copiado === 'sim' ? '✓ Chave copiada!' : copiado === 'erro' ? 'Não foi possível copiar — selecione o texto' : '📋 Copiar chave'}
          </button>
        </>
      ) : (
        <p className="muted">Ainda não há chave Pix cadastrada. Cadastre para os jogadores pagarem e copiarem com um toque.</p>
      )}
      {isAdmin && <button className="btn sec peq" onClick={() => setEditando(true)}>{chave ? '✏️ Editar chave Pix' : '➕ Cadastrar chave Pix'}</button>}
      {editando && <EditarPix inicial={config} onFechar={() => setEditando(false)} />}
    </div>
  )
}

function EditarPix({ inicial, onFechar }: { inicial: ReturnType<typeof useConfigTime>['data']; onFechar: () => void }) {
  const salvar = useSalvarConfigTime()
  const [tipo, setTipo] = useState<TipoPix>(inicial?.pix_tipo ?? 'aleatoria')
  const [chave, setChave] = useState(inicial?.pix_chave ?? '')
  const [favorecido, setFavorecido] = useState(inicial?.pix_beneficiario ?? '')

  return (
    <Modal titulo="Chave Pix do time" onFechar={onFechar}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          salvar.mutate(
            { pix_chave: chave.trim() || null, pix_tipo: chave.trim() ? tipo : null, pix_beneficiario: favorecido.trim() || null },
            { onSuccess: onFechar },
          )
        }}
      >
        <label>Tipo da chave
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPix)}>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Chave Pix
          <input value={chave} onChange={(e) => setChave(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="Ex.: time@email.com ou 000.000.000-00" />
        </label>
        <label>Nome do favorecido (opcional)
          <input value={favorecido} onChange={(e) => setFavorecido(e.target.value)} placeholder="Quem recebe" />
        </label>
        <span className="muted">Deixe a chave em branco para remover. A chave fica visível para todos os jogadores do time.</span>
        <Erro erro={salvar.error} />
        <button className="btn" disabled={salvar.isPending}>Salvar</button>
      </form>
    </Modal>
  )
}
