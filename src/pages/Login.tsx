import { useState, type FormEvent } from 'react'
import { supabase, supabaseConfigurado } from '../lib/supabase'

export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(''); setInfo(''); setBusy(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password: senha,
          options: { data: { nome }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
        })
        if (error) throw error
        if (!data.session) setInfo('Conta criada! Confirme seu e-mail para entrar.')
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Erro inesperado'
      setErro(m === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : m)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="centro">
      <form className="login form" onSubmit={enviar}>
        <img className="logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="FutSábado" />
        <h1 style={{ textAlign: 'center' }}>FutSábado</h1>
        {!supabaseConfigurado && (
          <p className="erro-msg">Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README).</p>
        )}
        {modo === 'criar' && (
          <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="name" /></label>
        )}
        <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label>Senha<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} /></label>
        {erro && <p className="erro-msg">{erro}</p>}
        {info && <p className="ok-msg">{info}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="btn sec" onClick={() => { setModo(modo === 'entrar' ? 'criar' : 'entrar'); setErro(''); setInfo('') }}>
          {modo === 'entrar' ? 'Primeiro acesso? Criar conta' : 'Já tenho conta'}
        </button>
      </form>
    </div>
  )
}
