import { useAuth } from '../lib/auth'

export default function Pendente() {
  const { eu, sair } = useAuth()
  return (
    <div className="centro">
      <div className="login card">
        <h1>Quase lá, {eu?.nome}!</h1>
        <p className="muted">
          Seu cadastro foi criado e está aguardando aprovação de um administrador do FutSábado.
          Assim que for liberado, é só recarregar esta página.
        </p>
        <button className="btn" onClick={() => location.reload()}>Verificar novamente</button>
        <button className="btn sec" onClick={sair}>Sair</button>
      </div>
    </div>
  )
}
