import { useState } from 'react'
import { useEncerrarJogo } from '../lib/api'
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
  const [branco, setBranco] = useState(jogo.placar_branco?.toString() ?? '')
  const [preto, setPreto] = useState(jogo.placar_preto?.toString() ?? '')
  const [faltou, setFaltou] = useState<Set<string>>(new Set())
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
            <label>Branco
              <input type="number" inputMode="numeric" min={0} value={branco} onChange={(e) => setBranco(e.target.value)} autoFocus />
            </label>
            <span className="x">x</span>
            <label>Preto
              <input type="number" inputMode="numeric" min={0} value={preto} onChange={(e) => setPreto(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="form">
          <strong>Quem não compareceu?</strong>
          <span className="muted">Marque quem confirmou e não apareceu: sai dos times, da cobrança e da votação.</span>
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
              </div>
            )
          })}
        </div>

        <Erro erro={encerrar.error} />
        {agendado && <span className="muted">Ao encerrar, o jogo vira “realizado” e a votação do craque abre automaticamente.</span>}
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
