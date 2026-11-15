import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Jogador } from './types'

interface AuthState {
  session: Session | null
  carregando: boolean
  /** Cadastro de jogador vinculado à conta (null enquanto não existir). */
  eu: Jogador | null
  /** Vale para a INTERFACE: fica false enquanto o admin está na "360 view" (visão de jogador comum). */
  isAdmin: boolean
  /** O usuário é admin de verdade (independe da 360 view). */
  isAdminReal: boolean
  /** Admin vendo o app como um jogador comum. */
  visao360: boolean
  alternarVisao360: () => void
  /** Conta criada mas ainda não aprovada por um administrador. */
  pendente: boolean
  sair: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [iniciando, setIniciando] = useState(true)
  const ultimoUsuario = useRef<string | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      ultimoUsuario.current = data.session?.user.id
      setSession(data.session)
      setIniciando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
      // O Supabase reemite eventos (ex.: SIGNED_IN, TOKEN_REFRESHED) quando a aba volta ao foco.
      // Só descartamos o cache quando o USUÁRIO muda (login/logout); renovar o token não muda nada.
      const novo = s?.user.id
      if (novo !== ultimoUsuario.current) {
        ultimoUsuario.current = novo
        qc.clear()
      }
      setSession((atual) => (atual?.access_token === s?.access_token && atual?.user.id === s?.user.id ? atual : s))
    })
    return () => data.subscription.unsubscribe()
  }, [qc])

  const [visao360, setVisao360] = useState(() => {
    try { return sessionStorage.getItem('futsabado.360') === '1' } catch { return false }
  })
  const definirVisao360 = (v: boolean) => {
    setVisao360(v)
    try { v ? sessionStorage.setItem('futsabado.360', '1') : sessionStorage.removeItem('futsabado.360') } catch { /* sem storage */ }
  }

  const uid = session?.user.id
  const { data: eu, isLoading } = useQuery({
    queryKey: ['eu', uid],
    enabled: Boolean(uid),
    queryFn: async () => {
      const { data, error } = await supabase.from('jogadores').select('*').eq('user_id', uid!).maybeSingle()
      if (error) throw error
      return data as Jogador | null
    },
  })

  const value: AuthState = {
    session,
    carregando: iniciando || (Boolean(uid) && isLoading),
    eu: eu ?? null,
    isAdmin: Boolean(eu?.is_admin && eu.ativo) && !visao360,
    isAdminReal: Boolean(eu?.is_admin && eu.ativo),
    visao360: Boolean(eu?.is_admin && eu.ativo) && visao360,   // só admin pode estar na 360 view
    alternarVisao360: () => definirVisao360(!visao360),
    pendente: Boolean(session && eu && !eu.ativo),
    sair: async () => {
      definirVisao360(false)
      await supabase.auth.signOut()
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fora do AuthProvider')
  return v
}
