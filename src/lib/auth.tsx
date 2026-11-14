import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Jogador } from './types'

interface AuthState {
  session: Session | null
  carregando: boolean
  /** Cadastro de jogador vinculado à conta (null enquanto não existir). */
  eu: Jogador | null
  isAdmin: boolean
  /** Conta criada mas ainda não aprovada por um administrador. */
  pendente: boolean
  sair: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [iniciando, setIniciando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIniciando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSession(s)
      qc.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [qc])

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
    isAdmin: Boolean(eu?.is_admin && eu.ativo),
    pendente: Boolean(session && eu && !eu.ativo),
    sair: async () => {
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
