import { exibir } from '../lib/format'
import { Avatar } from './ui'
import type { Escalado, FuncaoGoleiro, Jogador, Jogo } from '../lib/types'

const NOME_TIME = { branco: 'Time Branco', preto: 'Time Preto' } as const

/** Jogo encerrado: placar e as escalações dos dois times lado a lado, com ✓ ao lado de quem já pagou. */
export default function PosJogo({ jogo, jogadores, participantes, funcoes, pagos, isAdmin, onRegistrar }: {
  jogo: Jogo
  /** Todos os jogadores e convidados (convidados com id "c_<uuid>"). */
  jogadores: Jogador[]
  participantes: Jogador[]
  funcoes: Record<string, FuncaoGoleiro>
  /** Quem já pagou: id do jogador ou "c_<id do convidado>". */
  pagos: Set<string> | undefined
  isAdmin: boolean
  onRegistrar: () => void
}) {
  const por = new Map(jogadores.map((j) => [j.id, j]))
  const s = jogo.sorteio
  const temPlacar = jogo.placar_branco != null && jogo.placar_preto != null
  const v = jogo.time_vencedor
  const isentos = jogo.goleiros_isentos

  return (
    <div className="card">
      {temPlacar ? (
        <div className="placar" aria-label={`Branco ${jogo.placar_branco} x ${jogo.placar_preto} Preto`}>
          <span className={v === 'branco' ? 'vence' : ''}>Branco</span>
          <strong>{jogo.placar_branco}</strong>
          <span>x</span>
          <strong>{jogo.placar_preto}</strong>
          <span className={v === 'preto' ? 'vence' : ''}>Preto</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '.4rem', justifyItems: 'center' }}>
          <span className="muted">Placar ainda não registrado.</span>
          {isAdmin && <button className="btn peq" onClick={onRegistrar}>📝 Registrar placar</button>}
        </div>
      )}

      {s ? (
        <>
          <div className="lado-a-lado">
            <Coluna cor="branco" lista={s.branco} banco={s.reservas_branco ?? []} por={por} funcoes={funcoes} pagos={pagos} venceu={v === 'branco'} isentos={isentos} />
            <Coluna direita cor="preto" lista={s.preto} banco={s.reservas_preto ?? []} por={por} funcoes={funcoes} pagos={pagos} venceu={v === 'preto'} isentos={isentos} />
          </div>
          {(s.reservas?.length ?? 0) > 0 && (
            <Coluna cor={null} lista={[]} banco={s.reservas!} por={por} funcoes={funcoes} pagos={pagos} venceu={false} isentos={isentos} />
          )}
        </>
      ) : (
        <div className="time-col">
          <h3>Jogaram ({participantes.length})</h3>
          {participantes.map((j) => (
            <Linha key={j.id} j={j} cor={undefined} goleiro={j.posicao === 'goleiro' && funcoes[j.id] !== 'linha'} pago={pagos?.has(j.id)} isento={false} />
          ))}
        </div>
      )}
      {pagos && <span className="muted"><span className="pago" style={{ margin: 0 }}>✓</span> pago</span>}
    </div>
  )
}

function Coluna({ cor, lista, banco, por, funcoes, pagos, venceu, isentos, direita = false }: {
  /** Coluna da direita: espelhada (ícones na borda direita, texto à direita). */
  direita?: boolean
  cor: 'branco' | 'preto' | null
  lista: Escalado[]
  banco: string[]
  por: Map<string, Jogador>
  funcoes: Record<string, FuncaoGoleiro>
  pagos: Set<string> | undefined
  venceu: boolean
  isentos: boolean
}) {
  return (
    <div className={`time-col ${direita ? 'direita' : ''}`}>
      <div className="time-cab">
        {cor && <span className={`bolinha ${cor}`} />}
        <h3>{cor ? NOME_TIME[cor] : 'Reservas'}{venceu && ' 🏆'}</h3>
      </div>
      {lista.map((e) => {
        const j = por.get(e.id)
        const gol = e.slot === 'GOL'
        return <Linha key={e.id} j={j} cor={cor ?? undefined} goleiro={gol} pago={pagos?.has(e.id)} isento={isentos && gol} espelhado={direita} />
      })}
      {banco.length > 0 && (
        <>
          <span className="muted">Banco</span>
          {banco.map((id) => {
            const j = por.get(id)
            return <Linha key={id} j={j} cor={cor ?? undefined} goleiro={j?.posicao === 'goleiro' && funcoes[id] !== 'linha'} pago={pagos?.has(id)} isento={false} espelhado={direita} />
          })}
        </>
      )}
    </div>
  )
}

function Linha({ j, cor, goleiro, pago, isento, espelhado = false }: {
  j: Jogador | undefined; cor: 'branco' | 'preto' | undefined; goleiro: boolean; pago?: boolean; isento: boolean
  /** Linha da coluna da direita: a ordem dos itens é invertida para ficar simétrica à da esquerda. */
  espelhado?: boolean
}) {
  const nome = j ? exibir(j) : '—'
  const luva = goleiro && <span role="img" aria-label="Goleiro" title="Goleiro">{espelhado ? '🧤 ' : ' 🧤'}</span>
  const selo = pago ? (
    <span className="pago" role="img" aria-label="Pago" title="Pago">✓</span>
  ) : isento ? (
    <span className="isento" title="Goleiro isento">isento</span>
  ) : null
  return (
    <div className="linha-c">
      <Avatar nome={nome} numero={j?.numero_camisa} time={cor} goleiro={goleiro} pequeno />
      <span className="nome">
        {espelhado ? <>{selo}{luva}{nome}</> : <>{nome}{luva}{selo}</>}
      </span>
    </div>
  )
}
