import type { ReactNode } from 'react'

export function Spinner() {
  return <div className="spin" role="status" aria-label="Carregando" />
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="vazio">{children}</div>
}

export function mensagemErro(erro: unknown): string {
  const m = erro instanceof Error ? erro.message : String(erro)
  if (m.includes('jogadores_numero_camisa_uk')) return 'Esse número de camisa já pertence a outro jogador.'
  if (m.includes('jogadores_camisa_check')) return 'O número da camisa deve ficar entre 1 e 99.'
  return m
}

export function Erro({ erro }: { erro: unknown }) {
  if (!erro) return null
  return <p className="erro-msg">{mensagemErro(erro)}</p>
}

export function Modal({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="linha entre">
          <h2>{titulo}</h2>
          <button className="btn sec peq" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Mostra o número da camisa, quando o jogador tem um; senão, as iniciais. */
export function Avatar({ nome, numero }: { nome: string; numero?: number | null }) {
  const ini = nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
  const temNumero = numero != null
  return (
    <div className={`avatar ${temNumero ? 'num' : ''}`} aria-hidden>
      {temNumero ? numero : ini}
    </div>
  )
}
