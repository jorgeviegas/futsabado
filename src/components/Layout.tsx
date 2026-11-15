import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { gerarJogosAutomaticos, processarJogos } from '../lib/api'
import { useAuth } from '../lib/auth'
import { sincronizarPush } from '../lib/push'

const base = import.meta.env.BASE_URL

export default function Layout() {
  const { eu, isAdmin, isAdminReal, visao360, alternarVisao360, sair } = useAuth()
  const qc = useQueryClient()

  // Ao abrir o app: jogos que já passaram viram "realizados" (a votação do craque abre sozinha)
  // e os próximos jogos das peladas com geração automática são criados.
  useEffect(() => {
    Promise.all([processarJogos(), gerarJogosAutomaticos()]).then(([realizados, criados]) => {
      if (realizados > 0 || criados > 0) qc.invalidateQueries({ queryKey: ['jogos'] })
    })
  }, [qc])

  // Garante que a assinatura de push deste aparelho esteja no banco (e na conta de quem está logado)
  useEffect(() => {
    sincronizarPush().catch(() => {})
  }, [])

  // Toque numa notificação com o app já aberto: o service worker pede para ir à tela do aviso.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const ouvir = (e: MessageEvent) => {
      if (e.data?.tipo === 'navegar' && typeof e.data.hash === 'string') location.hash = e.data.hash
    }
    navigator.serviceWorker.addEventListener('message', ouvir)
    return () => navigator.serviceWorker.removeEventListener('message', ouvir)
  }, [])
  return (
    <div className="app">
      <header className="topo">
        <img src={`${base}logo.png`} alt="" />
        <h1>FutSábado</h1>
        <span className="muted nome-topo" style={{ color: '#ffd9df' }}>
          {eu?.apelido || eu?.nome}
          {isAdminReal && (visao360 ? ' · 360' : ' · admin')}
        </span>
        <NavLink to="/notificacoes" className="sino" aria-label="Notificações" title="Notificações">🔔</NavLink>
        {isAdminReal && (
          <button
            className="btn sec peq" onClick={alternarVisao360} aria-pressed={visao360}
            title={visao360 ? 'Voltar à visão normal de admin' : 'Ver o app como um jogador comum'}
          >
            {visao360 ? '↩ Normal' : '👁 360 view'}
          </button>
        )}
        <button className="btn sec peq" onClick={sair}>Sair</button>
      </header>
      <main className="conteudo">
        {visao360 && (
          <div className="faixa-360" role="status">
            <span className="grow">
              👁 <strong>360 view:</strong> você está vendo o app como um jogador comum. O que você fizer aqui continua valendo
              como administrador.
            </span>
            <button className="btn peq" onClick={alternarVisao360}>Voltar à visão normal</button>
          </div>
        )}
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
