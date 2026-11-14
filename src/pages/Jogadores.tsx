import { useState } from 'react'
import { useExcluirJogador, useJogadores, useSalvarJogador } from '../lib/api'
import { useAuth } from '../lib/auth'
import { POSICOES, exibir } from '../lib/format'
import { Avatar, Erro, Modal, Spinner } from '../components/ui'
import type { Jogador } from '../lib/types'

export default function Jogadores() {
  const { isAdmin, eu } = useAuth()
  const { data, isLoading, error } = useJogadores()
  const [editando, setEditando] = useState<Partial<Jogador> | null>(null)
  const salvar = useSalvarJogador()

  if (isLoading) return <Spinner />
  if (error) return <Erro erro={error} />

  const pendentes = (data ?? []).filter((j) => !j.ativo && j.user_id)
  const ativos = (data ?? []).filter((j) => j.ativo)
  const inativos = (data ?? []).filter((j) => !j.ativo && !j.user_id)

  return (
    <>
      <h1>Elenco ({ativos.length})</h1>

      {isAdmin && pendentes.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--aviso)' }}>
          <h2>⏳ Aguardando aprovação</h2>
          {pendentes.map((j) => (
            <div className="linha" key={j.id}>
              <span className="grow">{j.nome}<br /><span className="muted">{j.email}</span></span>
              <button className="btn peq" onClick={() => salvar.mutate({ id: j.id, nome: j.nome, ativo: true })}>Aprovar</button>
            </div>
          ))}
        </div>
      )}

      {ativos.map((j) => <Linha key={j.id} j={j} euId={eu?.id} admin={isAdmin} onEditar={() => setEditando(j)} />)}

      {isAdmin && inativos.length > 0 && (
        <>
          <h2>Inativos</h2>
          {inativos.map((j) => <Linha key={j.id} j={j} euId={eu?.id} admin onEditar={() => setEditando(j)} />)}
        </>
      )}

      {isAdmin && <button className="fab" aria-label="Novo jogador" onClick={() => setEditando({ tipo: 'mensalidade' as never, ativo: true })}>+</button>}
      {editando && <Form inicial={editando} admin={isAdmin} onFechar={() => setEditando(null)} />}
    </>
  )
}

function Linha({ j, euId, admin, onEditar }: { j: Jogador; euId?: string; admin: boolean; onEditar: () => void }) {
  const podeEditar = admin || j.id === euId
  return (
    <div className="card link" onClick={podeEditar ? onEditar : undefined}>
      <div className="linha">
        <Avatar nome={exibir(j)} />
        <div className="grow">
          <strong>{exibir(j)}</strong>
          {j.apelido && <span className="muted"> · {j.nome}</span>}
          <div className="muted">{j.posicao ? POSICOES[j.posicao] : 'Sem posição'}{admin && j.telefone ? ` · ${j.telefone}` : ''}</div>
        </div>
        {j.is_admin && <span className="chip grena">admin</span>}
        <span className="chip">{j.tipo}</span>
      </div>
    </div>
  )
}

function Form({ inicial, admin, onFechar }: { inicial: Partial<Jogador>; admin: boolean; onFechar: () => void }) {
  const salvar = useSalvarJogador()
  const excluir = useExcluirJogador()
  const [f, setF] = useState({
    nome: inicial.nome ?? '', apelido: inicial.apelido ?? '', email: inicial.email ?? '', telefone: inicial.telefone ?? '',
    posicao: inicial.posicao ?? '', tipo: inicial.tipo ?? 'mensalista', is_admin: inicial.is_admin ?? false, ativo: inicial.ativo ?? true,
  })
  const novo = !inicial.id

  return (
    <Modal titulo={novo ? 'Novo jogador' : 'Editar jogador'} onFechar={onFechar}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          const base = {
            id: inicial.id, nome: f.nome.trim(), apelido: f.apelido.trim() || null,
            telefone: f.telefone.trim() || null, posicao: (f.posicao || null) as Jogador['posicao'],
          }
          const extra = admin
            ? { email: f.email.trim().toLowerCase() || null, tipo: f.tipo, is_admin: f.is_admin, ativo: f.ativo }
            : {}
          salvar.mutate({ ...base, ...extra }, { onSuccess: onFechar })
        }}
      >
        <label>Nome<input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required /></label>
        <label>Apelido<input value={f.apelido} onChange={(e) => setF({ ...f, apelido: e.target.value })} /></label>
        {admin && (
          <label>
            E-mail (para vincular à conta do jogador)
            <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </label>
        )}
        <label>Telefone<input type="tel" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></label>
        <div className="grid2">
          <label>Posição
            <select value={f.posicao} onChange={(e) => setF({ ...f, posicao: e.target.value as never })}>
              <option value="">—</option>
              {Object.entries(POSICOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          {admin && (
            <label>Tipo
              <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as never })}>
                <option value="mensalista">Mensalista</option>
                <option value="avulso">Avulso</option>
              </select>
            </label>
          )}
        </div>
        {admin && (
          <>
            <label className="linha"><input type="checkbox" style={{ width: 'auto' }} checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Ativo</label>
            <label className="linha"><input type="checkbox" style={{ width: 'auto' }} checked={f.is_admin} onChange={(e) => setF({ ...f, is_admin: e.target.checked })} /> Administrador</label>
          </>
        )}
        <Erro erro={salvar.error ?? excluir.error} />
        <button className="btn" disabled={salvar.isPending}>Salvar</button>
        {admin && !novo && (
          <button type="button" className="btn perigo" onClick={() => confirm('Excluir jogador e todo o histórico dele?') && excluir.mutate(inicial.id!, { onSuccess: onFechar })}>
            Excluir
          </button>
        )}
      </form>
    </Modal>
  )
}
