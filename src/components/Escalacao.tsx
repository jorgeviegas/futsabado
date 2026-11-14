import { exibir } from '../lib/format'
import type { Escalado, Jogador, Slot, Sorteio } from '../lib/types'

// Posição de cada vaga na metade do time (x: 0–100 | y: distância do próprio gol, 0–70). Formação 2-3-1.
const COORD: Record<Slot, { x: number; y: number }> = {
  GOL: { x: 50, y: 9 },
  ZAG1: { x: 28, y: 24 },
  ZAG2: { x: 72, y: 24 },
  ALA1: { x: 11, y: 43 },
  MEI: { x: 50, y: 46 },
  ALA2: { x: 89, y: 43 },
  ATA: { x: 50, y: 58 },
}

const ALTURA = 146

function curto(txt: string, max = 9) {
  return txt.length > max ? txt.slice(0, max - 1) + '…' : txt
}

function Jogador_({ e, j, cor, baixo }: { e: Escalado; j?: Jogador; cor: 'grena' | 'preto'; baixo: boolean }) {
  const { x, y: gy } = COORD[e.slot]
  const y = baixo ? ALTURA - gy : gy // time de baixo ataca para cima; o de cima, para baixo
  const nome = j ? exibir(j) : '?'
  const rotulo = j?.numero_camisa != null ? String(j.numero_camisa) : nome.trim().slice(0, 2).toUpperCase()
  return (
    <g>
      <circle cx={x} cy={y} r="6.2" fill={cor === 'grena' ? '#9b1b36' : '#0d0d0d'} stroke={e.fora ? '#e0a526' : '#fff'} strokeWidth="0.9" strokeDasharray={e.fora ? '1.6 1' : undefined} />
      <text x={x} y={y + 1.9} textAnchor="middle" fontSize="5.2" fontWeight="700" fill="#fff">{rotulo}</text>
      <text x={x} y={baixo ? y - 8.4 : y + 11} textAnchor="middle" fontSize="3.5" fontWeight="600" fill="#fff" stroke="#000" strokeWidth="0.5" paintOrder="stroke">
        {curto(nome)}
      </text>
    </g>
  )
}

export default function Escalacao({ sorteio, jogadores }: { sorteio: Sorteio; jogadores: Jogador[] }) {
  const por = new Map(jogadores.map((j) => [j.id, j]))
  return (
    <svg className="escalacao" viewBox={`0 0 100 ${ALTURA}`} role="img" aria-label="Escalação sugerida dos dois times">
      <rect width="100" height={ALTURA} fill="#14401f" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} y={(ALTURA / 7) * i} width="100" height={ALTURA / 7} fill={i % 2 ? '#ffffff08' : 'transparent'} />
      ))}
      <g fill="none" stroke="#ffffff66" strokeWidth="0.5">
        <rect x="1.5" y="1.5" width="97" height={ALTURA - 3} />
        <line x1="1.5" y1={ALTURA / 2} x2="98.5" y2={ALTURA / 2} />
        <circle cx="50" cy={ALTURA / 2} r="10" />
        <rect x="25" y="1.5" width="50" height="17" />
        <rect x="38" y="1.5" width="24" height="6" />
        <rect x="25" y={ALTURA - 18.5} width="50" height="17" />
        <rect x="38" y={ALTURA - 7.5} width="24" height="6" />
      </g>
      <text x="4" y={ALTURA / 2 - 2} fontSize="3.6" fontWeight="700" fill="#fff" opacity=".8">PRETO ▲</text>
      <text x="4" y={ALTURA / 2 + 5} fontSize="3.6" fontWeight="700" fill="#fff" opacity=".8">GRENÁ ▼</text>
      {sorteio.preto.map((e) => <Jogador_ key={e.id} e={e} j={por.get(e.id)} cor="preto" baixo={false} />)}
      {sorteio.grena.map((e) => <Jogador_ key={e.id} e={e} j={por.get(e.id)} cor="grena" baixo />)}
    </svg>
  )
}
