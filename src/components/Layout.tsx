import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { gerarJogosAutomaticos, processarJogos } from '../lib/api'
import { useAuth } from '../lib/auth'

const base = import.meta.env.BASE_URL

export default function Layout() {
  const { eu, isAdmin, sair } = useAuth()
  const qc = useQueryClient()

  // Ao abrir o app: jogos que já passaram viram "realizados" (a votação do craque abre sozinha)
  // e os próximos jogos das peladas com geração automática são criados.
  useEffect(() => {
    Promise.all([processarJogos(), gerarJogosAutomaticos()]).then(([realizados, criados]) => {
      if (realizados > 0 || criados > 0) qc.invalidateQueries({ queryKey: ['jogos'] })
    })
  }, [qc])
  return (
    <div className="app">
      <header className="topo">
        <img src={`${base}logo.png`} alt="" />
        <h1>FutSábado</h1>
        <span className="muted" style={{ color: '#ffd9df' }}>
          {eu?.apelido || eu?.nome}
          {isAdmin && ' · admin'}
        </span>
        <button className="btn sec peq" onClick={sair}>Sair</button>
      </header>
      <main className="conteudo">
        <Outlet />
      </main>
      <nav className="nav" aria-label="Navegação principal">
        <NavLink to="/" end><span>⚽</span><span>Jogos</span></NavLink>
        <NavLink to="/jogadores"><span>👥</span><span>Elenco</span></NavLink>
        <NavLink to="/rankings"><span>🏆</span><span>Rankings</span></NavLink>
        <NavLink to="/financeiro"><span>💰</span><span>Financeiro</span></NavLink>
        {isAdmin && <NavLink to="/peladas"><span>📅</span><span>Peladas</span></NavLink>}
      </nav>
    </div>
  )
}
