import { useState } from 'react'
import { POSICOES } from '../lib/format'
import type { Posicao } from '../lib/types'

interface Props {
  primaria: Posicao | null
  secundaria: Posicao | null
  onChange: (v: { primaria: Posicao | null; secundaria: Posicao | null }) => void
}

interface Zona { pos: Posicao; x: number; y: number; w: number; h: number; rotulo: string }

// Quadra em miniatura (visão de cima, nosso gol embaixo). Fut7: 2-3-1.
const ZONAS: Zona[] = [
  { pos: 'atacante', x: 10, y: 10, w: 180, h: 66, rotulo: 'Atacante' },
  { pos: 'ala', x: 10, y: 80, w: 48, h: 90, rotulo: 'Ala' },
  { pos: 'meia', x: 62, y: 80, w: 76, h: 90, rotulo: 'Meia' },
  { pos: 'ala', x: 142, y: 80, w: 48, h: 90, rotulo: 'Ala' },
  { pos: 'zagueiro', x: 10, y: 174, w: 180, h: 52, rotulo: 'Zagueiro' },
  { pos: 'goleiro', x: 50, y: 230, w: 100, h: 34, rotulo: 'Goleiro' },
]

export default function CampoPosicoes({ primaria, secundaria, onChange }: Props) {
  const [alvo, setAlvo] = useState<'primaria' | 'secundaria'>(primaria ? 'secundaria' : 'primaria')

  function escolher(pos: Posicao) {
    if (alvo === 'primaria') {
      onChange({ primaria: pos, secundaria: secundaria === pos ? null : secundaria })
      if (!secundaria) setAlvo('secundaria')
    } else {
      // tocar de novo na secundária remove; a primária não pode ser repetida
      if (pos === primaria) return
      onChange({ primaria, secundaria: secundaria === pos ? null : pos })
    }
  }

  return (
    <div className="form">
      <div className="seg" role="tablist" aria-label="Qual posição você está escolhendo">
        <button type="button" role="tab" className={alvo === 'primaria' ? 'ativo' : ''} onClick={() => setAlvo('primaria')}>
          1ª posição{primaria ? `: ${POSICOES[primaria]}` : ''}
        </button>
        <button type="button" role="tab" className={alvo === 'secundaria' ? 'ativo' : ''} onClick={() => setAlvo('secundaria')}>
          2ª posição{secundaria ? `: ${POSICOES[secundaria]}` : ''}
        </button>
      </div>

      <svg className="campo" viewBox="0 0 200 274" role="group" aria-label="Quadra com as posições">
        <rect x="2" y="2" width="196" height="270" rx="10" fill="#14401f" stroke="#ffffff55" strokeWidth="2" />
        <line x1="2" y1="78" x2="198" y2="78" stroke="#ffffff22" />
        <circle cx="100" cy="125" r="26" fill="none" stroke="#ffffff22" />
        {ZONAS.map((z, i) => {
          const ehPrim = primaria === z.pos
          const ehSec = secundaria === z.pos
          return (
            <g
              key={i}
              className="zona"
              role="button"
              tabIndex={0}
              aria-pressed={ehPrim || ehSec}
              aria-label={`${z.rotulo}${ehPrim ? ' (1ª posição)' : ehSec ? ' (2ª posição)' : ''}`}
              onClick={() => escolher(z.pos)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), escolher(z.pos))}
            >
              <rect
                x={z.x} y={z.y} width={z.w} height={z.h} rx="8"
                fill={ehPrim ? '#9b1b36' : ehSec ? '#3a0a14' : '#ffffff12'}
                stroke={ehPrim ? '#fff' : ehSec ? '#e0a526' : '#ffffff40'}
                strokeWidth={ehPrim || ehSec ? 2.5 : 1}
                strokeDasharray={ehSec ? '6 4' : undefined}
              />
              <text x={z.x + z.w / 2} y={z.y + z.h / 2 + 4} textAnchor="middle" fontSize={z.w < 60 ? 11 : 14} fontWeight="700" fill="#fff">
                {z.rotulo}
              </text>
              {(ehPrim || ehSec) && (
                <text x={z.x + z.w / 2} y={z.y + z.h / 2 + 20} textAnchor="middle" fontSize="10" fontWeight="700" fill={ehPrim ? '#fff' : '#e0a526'}>
                  {ehPrim ? '1ª' : '2ª'}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <p className="muted" style={{ textAlign: 'center' }}>
        {alvo === 'primaria' ? 'Toque na área onde você mais joga.' : 'Agora, se quiser, toque na sua segunda opção (toque de novo para remover).'}
      </p>
    </div>
  )
}
