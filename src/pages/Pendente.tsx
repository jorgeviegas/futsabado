import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import PushPendente from '../components/PushPendente'

export default function Pendente() {
  const { eu, sair } = useAuth()
  const qc = useQueryClient()
  // confere a aprovação sozinho a cada 20 s (quando aprovado, o app abre normalmente)
  useEffect(() => {
    const t = setInterval(() => qc.invalidateQueries({ queryKey: ['eu'] }), 20000)
    return () => clearInterval(t)
  }, [qc])
  return (
    <div className="centro">
      <div className="login card">
        <h1>Quase lá, {eu?.nome}!</h1>
        <p className="muted">
          Seu cadastro foi criado e está aguardando aprovação de um administrador do FutSábado.
          Assim que for liberado, é só recarregar esta página.
        </p>
        <PushPendente />
        <button className="btn" onClick={() => location.reload()}>Verificar novamente</button>
        <button className="btn sec" onClick={sair}>Sair</button>
      </div>
    </div>
  )
}
