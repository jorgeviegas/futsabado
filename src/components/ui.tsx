import type { ReactNode } from 'react'

export function Spinner() {
  return <div className="spin" role="status" aria-label="Carregando" />
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="vazio">{children}</div>
}

export function Erro({ erro }: { erro: unknown }) {
  if (!erro) return null
  return <p className="erro-msg">{erro instanceof Error ? erro.message : String(erro)}</p>
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

export function Avatar({ nome }: { nome: string }) {
  const ini = nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
  return <div className="avatar" aria-hidden>{ini}</div>
}
