import { useState } from 'react'
import { useDefinirCompetitivo, useExcluirJogador, useJogadores, useSalvarJogador, useScores } from '../lib/api'
import { useAuth } from '../lib/auth'
import { POSICOES, exibir } from '../lib/format'
import { Avatar, Erro, Modal, Spinner } from '../components/ui'
import CampoPosicoes from '../components/CampoPosicoes'
import type { Jogador } from '../lib/types'

export default function Jogadores() {
  const { isAdmin, eu } = useAuth()
  const { data, isLoading, error } = useJogadores()
  const [editando, setEditando] = useState<Partial<Jogador> | null>(null)
  const salvar = useSalvarJogador()
  const { data: scores } = useScores(isAdmin)

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

      {ativos.map((j) => <Linha key={j.id} j={j} euId={eu?.id} admin={isAdmin} score={scores ? (scores[j.id] ?? 500) : undefined} onEditar={() => setEditando(j)} />)}

      {isAdmin && inativos.length > 0 && (
        <>
          <h2>Inativos</h2>
          {inativos.map((j) => <Linha key={j.id} j={j} euId={eu?.id} admin score={scores ? (scores[j.id] ?? 500) : undefined} onEditar={() => setEditando(j)} />)}
        </>
      )}

      {isAdmin && <button className="fab" aria-label="Novo jogador" onClick={() => setEditando({ tipo: 'mensalidade' as never, ativo: true })}>+</button>}
      {editando && <Form inicial={editando} admin={isAdmin} onFechar={() => setEditando(null)} />}
    </>
  )
}

function Linha({ j, euId, admin, score, onEditar }: { j: Jogador; euId?: string; admin: boolean; score?: number; onEditar: () => void }) {
  const podeEditar = admin || j.id === euId
  const definir = useDefinirCompetitivo()
  return (
    <div className="card link" onClick={podeEditar ? onEditar : undefined}>
      <div className="linha">
        <Avatar nome={exibir(j)} numero={j.numero_camisa} />
        <div className="grow">
          <strong>{exibir(j)}</strong>
          {j.apelido && <span className="muted"> · {j.nome}</span>}
          <div className="muted">
            {j.posicao ? POSICOES[j.posicao] : 'Sem posição'}
            {j.posicao_secundaria && ` / ${POSICOES[j.posicao_secundaria]}`}
            {admin && j.telefone ? ` · ${j.telefone}` : ''}
          </div>
        </div>
        {admin && score !== undefined && <span className="chip" title="Player Score (visível só para admins)">⭐ {score}</span>}
        {j.is_admin && <span className="chip grena">admin</span>}
        <span className="chip">{j.tipo}</span>
      </div>
      {admin && j.ativo && (
        <label className="check-comp" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={j.competitivo} disabled={definir.isPending} onChange={(e) => definir.mutate({ id: j.id, competitivo: e.target.checked })} />
          <span>⚔️ Acesso à aba Competitivo</span>
        </label>
      )}
    </div>
  )
}

function Form({ inicial, admin, onFechar }: { inicial: Partial<Jogador>; admin: boolean; onFechar: () => void }) {
  const { eu } = useAuth()
  const salvar = useSalvarJogador()
  const excluir = useExcluirJogador()
  const [f, setF] = useState({
    nome: inicial.nome ?? '', apelido: inicial.apelido ?? '', email: inicial.email ?? '', telefone: inicial.telefone ?? '',
    posicao: inicial.posicao ?? null, posicao_secundaria: inicial.posicao_secundaria ?? null, camisa: inicial.numero_camisa?.toString() ?? '', tipo: inicial.tipo ?? 'avulso', is_admin: inicial.is_admin ?? false, ativo: inicial.ativo ?? true,
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
            telefone: f.telefone.trim() || null, posicao: f.posicao, posicao_secundaria: f.posicao_secundaria,
            numero_camisa: f.camisa ? Number(f.camisa) : null,
            ...(inicial.id && inicial.id === eu?.id ? { perfil_completo: true } : {}),
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
        <label>Número da camisa (fixo, opcional)
          <input type="number" inputMode="numeric" min={1} max={99} value={f.camisa} onChange={(e) => setF({ ...f, camisa: e.target.value })} />
        </label>
        <CampoPosicoes
          primaria={f.posicao}
          secundaria={f.posicao_secundaria}
          onChange={(v) => setF({ ...f, posicao: v.primaria, posicao_secundaria: v.secundaria })}
        />
        {admin && (
          <label>Tipo
            <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as never })}>
              <option value="avulso">Avulso (paga por jogo)</option>
              <option value="mensalista">Mensalista (só admin altera)</option>
            </select>
          </label>
        )}
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
