import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './lib/auth'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import Pendente from './pages/Pendente'
import Jogos from './pages/Jogos'
import JogoDetalhe from './pages/JogoDetalhe'
import Jogadores from './pages/Jogadores'
import Peladas from './pages/Peladas'
import Financeiro from './pages/Financeiro'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } },
})

function Rotas() {
  const { session, carregando, pendente, eu, isAdmin } = useAuth()
  if (carregando) return <div className="centro"><Spinner /></div>
  if (!session) return <Login />
  if (!eu || pendente) return <Pendente />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Jogos />} />
        <Route path="jogo/:id" element={<JogoDetalhe />} />
        <Route path="jogadores" element={<Jogadores />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="peladas" element={isAdmin ? <Peladas /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* HashRouter: funciona no GitHub Pages sem configurar redirecionamento de rotas */}
        <HashRouter>
          <Rotas />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
