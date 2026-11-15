import { useState } from 'react'
import { useAvisosAvulsos, useExcluirAviso, useSalvarAviso } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatarData, hojeISO, somaDias } from '../lib/format'
import { Erro, Modal } from './ui'

/** Admin: cria avisos avulsos com período de validade; eles aparecem no quadro de avisos de todos. */
export default function AvisosAdmin() {
  const { data: avisos = [] } = useAvisosAvulsos()
  const excluir = useExcluirAviso()
  const [novo, setNovo] = useState(false)
  const hoje = hojeISO()

  return (
    <div className="card">
      <div className="linha entre">
        <h2>📢 Avisos do time</h2>
        <button className="btn peq" onClick={() => setNovo(true)}>➕ Novo aviso</button>
      </div>
      <p className="muted">Aparecem no quadro de avisos de todos os jogadores durante o período de validade.</p>
      {avisos.length === 0 && <span className="muted">Nenhum aviso ativo ou agendado.</span>}
      {avisos.map((a) => {
        const agendado = a.inicio > hoje
        return (
          <div className="linha" key={a.id}>
            <div className="grow">
              <strong>{a.titulo}</strong>
              {a.mensagem && <span className="muted" style={{ display: 'block' }}>{a.mensagem}</span>}
              <span className="muted" style={{ display: 'block' }}>
                {formatarData(a.inicio)} → {formatarData(a.fim)}
              </span>
            </div>
            <span className={`chip ${agendado ? 'aviso' : 'ok'}`}>{agendado ? 'agendado' : 'ativo'}</span>
            <button
              className="btn perigo peq" aria-label={`Excluir aviso ${a.titulo}`} disabled={excluir.isPending}
              onClick={() => confirm(`Excluir o aviso “${a.titulo}”?`) && excluir.mutate(a.id)}
            >
              ✕
            </button>
          </div>
        )
      })}
      <Erro erro={excluir.error} />
      {novo && <NovoAviso onFechar={() => setNovo(false)} />}
    </div>
  )
}

function NovoAviso({ onFechar }: { onFechar: () => void }) {
  const { eu } = useAuth()
  const salvar = useSalvarAviso()
  const [titulo, setTitulo] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [inicio, setInicio] = useState(hojeISO())
  const [fim, setFim] = useState(somaDias(hojeISO(), 7))
  const invalido = fim < inicio

  return (
    <Modal titulo="Novo aviso" onFechar={onFechar}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (invalido) return
          salvar.mutate(
            { titulo: titulo.trim(), mensagem: mensagem.trim() || null, inicio, fim, created_by: eu?.id },
            { onSuccess: onFechar },
          )
        }}
      >
        <label>Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={80} autoFocus placeholder="Ex.: Quadra fechada neste sábado" /></label>
        <label>Mensagem (opcional)
          <textarea rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={400} placeholder="Detalhes do aviso" />
        </label>
        <div className="grid2">
          <label>Válido a partir de<input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required /></label>
          <label>Válido até<input type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} required /></label>
        </div>
        <div className="linha wrap">
          {[['Hoje', 0], ['3 dias', 3], ['1 semana', 7], ['1 mês', 30]].map(([rot, dias]) => (
            <button key={rot as string} type="button" className="btn sec peq" onClick={() => setFim(somaDias(inicio, dias as number))}>{rot}</button>
          ))}
        </div>
        {invalido && <p className="erro-msg">A data final não pode ser anterior à inicial.</p>}
        <Erro erro={salvar.error} />
        <button className="btn" disabled={salvar.isPending || invalido}>Publicar aviso</button>
      </form>
    </Modal>
  )
}
