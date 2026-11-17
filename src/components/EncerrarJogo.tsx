import { useState } from 'react'
import { useEncerrarJogo, usePresencas } from '../lib/api'
import { exibir, textoPosicao } from '../lib/format'
import { Avatar, Erro, Modal } from './ui'
import type { FuncaoGoleiro, Jogador, Jogo } from '../lib/types'

/**
 * Encerramento da partida (admin): pede o placar e a lista de quem jogou para marcar os faltantes.
 * Tudo é gravado de uma vez; ao registrar o placar o jogo vira "realizado" e a votação do craque abre sozinha.
 */
export default function EncerrarJogo({ jogo, participantes, funcoes, onFechar }: {
  jogo: Jogo
  /** Jogadores confirmados e convidados (ids de convidado começam com "c_"). */
  participantes: Jogador[]
  funcoes: Record<string, FuncaoGoleiro>
  onFechar: () => void
}) {
  const encerrar = useEncerrarJogo()
  const comp = jogo.competitivo
  // jogo competitivo: o placar é "nosso time x adversário"
  const [branco, setBranco] = useState((comp ? jogo.gols_pro : jogo.placar_branco)?.toString() ?? '')
  const [preto, setPreto] = useState((comp ? jogo.gols_contra : jogo.placar_preto)?.toString() ?? '')
  const { data: pres = [] } = usePresencas(jogo.id)
  const [faltou, setFaltou] = useState<Set<string>>(new Set())
  // gols/assistências digitados; quem não foi mexido mostra o valor já gravado (ao reabrir um jogo encerrado)
  const [edit, setEdit] = useState<Record<string, { g?: number; a?: number }>>({})
  const gravado = (id: string) => pres.find((p) => p.jogador_id === id)
  const gols = (id: string) => edit[id]?.g ?? gravado(id)?.gols ?? 0
  const assist = (id: string) => edit[id]?.a ?? gravado(id)?.assistencias ?? 0
  const ajustar = (id: string, campo: 'g' | 'a', delta: number) =>
    setEdit((e) => {
      const atual = campo === 'g' ? gols(id) : assist(id)
      return { ...e, [id]: { ...e[id], [campo]: Math.max(0, Math.min(50, atual + delta)) } }
    })
  const placarOk = branco !== '' && preto !== '' && Number(branco) >= 0 && Number(preto) >= 0
  const agendado = jogo.status === 'agendado'

  const alternar = (id: string) =>
    setFaltou((atual) => {
      const novo = new Set(atual)
      if (!novo.delete(id)) novo.add(id)
      return novo
    })

  function enviar(comPlacar: boolean) {
    const ids = [...faltou]
    encerrar.mutate(
      {
        jogoId: jogo.id,
        faltosos: ids.filter((id) => !id.startsWith('c_')),
        convidadosFaltosos: ids.filter((id) => id.startsWith('c_')).map((id) => id.slice(2)),
        placarBranco: comPlacar ? Number(branco) : null,
        placarPreto: comPlacar ? Number(preto) : null,
        estatisticas: participantes
          .filter((j) => !j.id.startsWith('c_') && !faltou.has(j.id))
          .map((j) => ({ jogador_id: j.id, gols: gols(j.id), assistencias: assist(j.id) })),
      },
      { onSuccess: onFechar },
    )
  }

  return (
    <Modal titulo={agendado ? 'Encerrar partida' : 'Placar e faltosos'} onFechar={onFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (placarOk) enviar(true) }}>
        <div>
          <strong>Placar</strong>
          <div className="placar-form" style={{ marginTop: '.4rem' }}>
            <label>{comp ? 'Nosso time' : 'Branco'}
              <input type="number" inputMode="numeric" min={0} value={branco} onChange={(e) => setBranco(e.target.value)} autoFocus />
            </label>
            <span className="x">x</span>
            <label>{comp ? (jogo.adversario ?? 'Adversário') : 'Preto'}
              <input type="number" inputMode="numeric" min={0} value={preto} onChange={(e) => setPreto(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="form">
          <strong>Quem jogou</strong>
          <span className="muted">{comp ? 'Marque “Faltou” para quem não apareceu' : 'Marque “Faltou” para quem não apareceu (sai dos times, da cobrança e da votação)'} e some gols ⚽ e assistências 🍽️.</span>
          {participantes.length === 0 && <span className="muted">Ninguém confirmado.</span>}
          {participantes.map((j) => {
            const marcado = faltou.has(j.id)
            return (
              <div className="faltou-linha" key={j.id}>
                <Avatar nome={exibir(j)} numero={j.numero_camisa} pequeno />
                <span className="grow" style={{ opacity: marcado ? 0.5 : 1, textDecoration: marcado ? 'line-through' : 'none' }}>
                  {exibir(j)}
                  <span className="muted" style={{ display: 'block' }}>
                    {j.id.startsWith('c_') ? 'Convidado' : textoPosicao(j, funcoes[j.id])}
                  </span>
                </span>
                <button
                  type="button" aria-pressed={marcado}
                  className={`btn peq ${marcado ? 'perigo' : 'sec'}`}
                  style={marcado ? { background: 'var(--erro)', color: '#fff' } : undefined}
                  onClick={() => alternar(j.id)}
                >
                  {marcado ? '✕ Faltou' : 'Faltou'}
                </button>
                {!marcado && !j.id.startsWith('c_') && (
                  <div className="stats-linha">
                    <Contador icone="⚽" rotulo="Gols" valor={gols(j.id)} onMudar={(d) => ajustar(j.id, 'g', d)} />
                    <Contador icone="🍽️" rotulo="Assistências" valor={assist(j.id)} onMudar={(d) => ajustar(j.id, 'a', d)} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <Erro erro={encerrar.error} />
        {agendado && <span className="muted">{comp ? 'Ao encerrar, o jogo vira “realizado” com o placar e as estatísticas de cada jogador.' : 'Ao encerrar, o jogo vira “realizado” e a votação do craque abre automaticamente.'}</span>}
        <button className="btn" disabled={!placarOk || encerrar.isPending}>
          {encerrar.isPending ? 'Salvando…' : agendado ? '✅ Encerrar partida' : 'Salvar placar e faltosos'}
        </button>
        {agendado && (
          <button type="button" className="btn sec" disabled={encerrar.isPending} onClick={() => enviar(false)}>
            Encerrar sem placar (registro depois)
          </button>
        )}
      </form>
    </Modal>
  )
}

function Contador({ icone, rotulo, valor, onMudar }: { icone: string; rotulo: string; valor: number; onMudar: (delta: number) => void }) {
  return (
    <div className="contador" role="group" aria-label={rotulo}>
      <span aria-hidden>{icone}</span>
      <button type="button" aria-label={`Menos ${rotulo.toLowerCase()}`} disabled={valor <= 0} onClick={() => onMudar(-1)}>−</button>
      <strong>{valor}</strong>
      <button type="button" aria-label={`Mais ${rotulo.toLowerCase()}`} onClick={() => onMudar(1)}>+</button>
    </div>
  )
}
