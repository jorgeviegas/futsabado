import { exibir } from '../lib/format'
import type { Escalado, Jogador, Slot, Sorteio } from '../lib/types'

// Posição de cada vaga na metade do time (x: 0–100 | y: distância do próprio gol, 0–88). Formação 2-3-1.
// O espaçamento vertical deixa folga para o nome ocupar até 2 linhas sem encostar na fileira seguinte.
const COORD: Record<Slot, { x: number; y: number }> = {
  GOL: { x: 50, y: 9 },
  ZAG1: { x: 26, y: 24 },
  ZAG2: { x: 74, y: 24 },
  ALA1: { x: 11, y: 47 },
  MEI: { x: 50, y: 49 },
  ALA2: { x: 89, y: 47 },
  ATA: { x: 50, y: 72 },
}

const ALTURA = 176

// Largura máxima do nome (em unidades do campo) por vaga: o que cabe sem invadir o vizinho da mesma fileira.
const LARGURA_NOME: Record<Slot, number> = { GOL: 33, ZAG1: 44, ZAG2: 44, ALA1: 22, ALA2: 22, MEI: 52, ATA: 70 }

const FONTE = 3.5
const FONTE_MIN = 2.4
const LARGURA_CHAR = 0.6 // largura média de um caractere, em múltiplos do tamanho da fonte
const larguraTexto = (t: string, fonte: number) => t.length * LARGURA_CHAR * fonte

/**
 * Nome completo em até 2 linhas: quebra no espaço que melhor equilibra as linhas;
 * se ainda não couber (palavra muito longa), reduz a fonte; só abrevia como último recurso.
 */
function quebrarNome(nome: string, largura: number): { linhas: string[]; fonte: number } {
  const limpo = nome.trim().replace(/\s+/g, ' ')
  if (larguraTexto(limpo, FONTE) <= largura) return { linhas: [limpo], fonte: FONTE }

  const palavras = limpo.split(' ')
  let linhas = [limpo]
  if (palavras.length > 1) {
    let melhor = Infinity
    for (let i = 1; i < palavras.length; i++) {
      const a = palavras.slice(0, i).join(' ')
      const b = palavras.slice(i).join(' ')
      const pior = Math.max(a.length, b.length)
      if (pior < melhor) {
        melhor = pior
        linhas = [a, b]
      }
    }
  }

  const maior = Math.max(...linhas.map((l) => l.length))
  let fonte = Math.min(FONTE, (largura / (maior * LARGURA_CHAR)) * 0.98)
  if (fonte < FONTE_MIN) {
    fonte = FONTE_MIN
    const maxChars = Math.max(3, Math.floor(largura / (LARGURA_CHAR * fonte)))
    linhas = linhas.map((l) => (l.length > maxChars ? l.slice(0, maxChars - 1) + '…' : l))
  }
  return { linhas, fonte }
}

function Jogador_({ e, j, cor, baixo }: { e: Escalado; j?: Jogador; cor: 'branco' | 'preto'; baixo: boolean }) {
  const { x, y: gy } = COORD[e.slot]
  const y = baixo ? ALTURA - gy : gy // time de baixo ataca para cima; o de cima, para baixo
  const nome = j ? exibir(j) : '?'
  const rotulo = j?.numero_camisa != null ? String(j.numero_camisa) : nome.trim().slice(0, 2).toUpperCase()
  const { linhas, fonte } = quebrarNome(nome, LARGURA_NOME[e.slot])
  const passo = fonte * 1.05 // distância entre as linhas
  // o nome fica sempre do lado do centro do campo; com 2 linhas, a última encosta no mesmo ponto de antes
  const y0 = baixo ? y - 8.4 - (linhas.length - 1) * passo : y + 11
  return (
    <g>
      <circle cx={x} cy={y} r="6.2" fill={e.slot === 'GOL' ? 'url(#uniforme-goleiro)' : `url(#uniforme-${cor})`} stroke={e.fora ? '#e0a526' : cor === 'preto' ? '#000' : '#fff'} strokeWidth="0.9" strokeDasharray={e.fora ? '1.6 1' : undefined} />
      <text
        x={x} y={y + 1.9} textAnchor="middle" fontSize="5.2" fontWeight="800"
        fill={e.slot === 'GOL' || cor === 'preto' ? '#fff' : '#3a0a14'} stroke={e.slot === 'GOL' ? '#06240f' : cor === 'preto' ? '#000' : '#f4f0e6'} strokeWidth="0.7" paintOrder="stroke"
      >
        {rotulo}
      </text>
      <text x={x} y={y0} textAnchor="middle" fontSize={fonte} fontWeight="600" fill="#fff" stroke="#000" strokeWidth="0.5" paintOrder="stroke" data-nome>
        {linhas.map((l, i) => (
          <tspan key={i} x={x} dy={i === 0 ? 0 : passo}>{l}</tspan>
        ))}
      </text>
    </g>
  )
}

export default function Escalacao({ sorteio, jogadores }: { sorteio: Sorteio; jogadores: Jogador[] }) {
  const por = new Map(jogadores.map((j) => [j.id, j]))
  return (
    <svg className="escalacao" viewBox={`0 0 100 ${ALTURA}`} role="img" aria-label="Escalação sugerida dos dois times">
      <defs>
        {/* Preto: listra vertical grená no meio */}
        <pattern id="uniforme-preto" patternContentUnits="objectBoundingBox" width="1" height="1">
          <rect width="1" height="1" fill="#0d0d0d" />
          <rect x="0.37" width="0.26" height="1" fill="#9b1b36" />
        </pattern>
        {/* Goleiro: verde listrado */}
        <pattern id="uniforme-goleiro" patternUnits="userSpaceOnUse" width="3.2" height="2">
          <rect width="3.2" height="2" fill="#43b05f" />
          <rect width="1.6" height="2" fill="#1d6f36" />
        </pattern>
        {/* Branco: off-white com listrado fino grená */}
        <pattern id="uniforme-branco" patternUnits="userSpaceOnUse" width="1.5" height="2">
          <rect width="1.5" height="2" fill="#f4f0e6" />
          <rect width="0.45" height="2" fill="#9b1b36" />
        </pattern>
      </defs>
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
      <text x="4" y={ALTURA / 2 + 5} fontSize="3.6" fontWeight="700" fill="#fff" opacity=".8">BRANCO ▼</text>
      {sorteio.preto.map((e) => <Jogador_ key={e.id} e={e} j={por.get(e.id)} cor="preto" baixo={false} />)}
      {sorteio.branco.map((e) => <Jogador_ key={e.id} e={e} j={por.get(e.id)} cor="branco" baixo />)}
    </svg>
  )
}
