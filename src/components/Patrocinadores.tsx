/** Patrocinadores do time (fixos no código). Logos em public/patrocinadores. `claro` = logo escura, precisa de fundo claro. */
const PATROCINADORES: { nome: string; arquivo: string; claro?: boolean; link?: string }[] = [
  { nome: 'Rossi Airguns & Airsoft', arquivo: 'rossi.webp' },
  { nome: 'Ômega Prime Corretora de Seguros', arquivo: 'omega-prime.webp' },
  { nome: 'Multipres Engenharia e Construções', arquivo: 'multipres.webp', claro: true },
  { nome: 'Mercado 2 Irmãos', arquivo: 'mercado-2-irmaos.webp', claro: true },
  { nome: 'Meta Contabilidade & Despachante', arquivo: 'meta.webp' },
]

export default function Patrocinadores() {
  return (
    <section className="patrocinadores" aria-label="Patrocinadores">
      <h2>🤝 Apoie os patrocinadores</h2>
      <p className="muted">Eles ajudam o FutSábado a acontecer. Prestigie quem prestigia o time!</p>
      <div className="patro-grade">
        {PATROCINADORES.map((p) => {
          const img = <img src={`${import.meta.env.BASE_URL}patrocinadores/${p.arquivo}`} alt={p.nome} loading="lazy" />
          return p.link ? (
            <a key={p.nome} className={`patro ${p.claro ? 'claro' : ''}`} href={p.link} target="_blank" rel="noopener noreferrer">{img}</a>
          ) : (
            <div key={p.nome} className={`patro ${p.claro ? 'claro' : ''}`}>{img}</div>
          )
        })}
      </div>
    </section>
  )
}
