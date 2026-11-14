import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const base = import.meta.env.BASE_URL

export default function Layout() {
  const { eu, isAdmin, sair } = useAuth()
  return (
    <div className="app">
      <header className="topo">
        <img src={`${base}favicon.svg`} alt="" />
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
        <NavLink to="/financeiro"><span>💰</span><span>Financeiro</span></NavLink>
        {isAdmin && <NavLink to="/peladas"><span>📅</span><span>Peladas</span></NavLink>}
      </nav>
    </div>
  )
}
