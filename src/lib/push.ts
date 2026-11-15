import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/** Chave pública VAPID (a privada fica só na Edge Function). */
export const VAPID_PUBLICA = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() || ''
export const pushConfigurado = Boolean(VAPID_PUBLICA)

export type EstadoPush =
  | 'nao-configurado' // o time ainda não configurou as chaves
  | 'instalar' // iPhone/iPad fora do app instalado: o push só funciona no app da tela de início
  | 'nao-suportado'
  | 'negado' // permissão bloqueada nas configurações
  | 'desativado' // pode ativar
  | 'ativado'

export const ehIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const appInstalado = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export const pushSuportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function chaveParaBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const preenchida = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const bruto = atob(preenchida)
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length))
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i)
  return bytes
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!pushConfigurado) return 'nao-configurado'
  // no iPhone o PushManager nem existe fora do app instalado, então vem antes
  if (ehIOS() && !appInstalado()) return 'instalar'
  if (!pushSuportado()) return 'nao-suportado'
  if (Notification.permission === 'denied') return 'negado'
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return sub && Notification.permission === 'granted' ? 'ativado' : 'desativado'
  } catch {
    return 'desativado'
  }
}

/** Ativa as notificações neste aparelho. Deve ser chamada a partir de um toque do usuário (exigência do iPhone). */
export async function ativarPush(): Promise<void> {
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('Permissão negada. Libere as notificações nas configurações do aparelho.')

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(VAPID_PUBLICA) })
    } catch {
      throw new Error('Não foi possível registrar este aparelho para notificações. Tente de novo em instantes.')
    }
  }
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Inscrição inválida.')
  const { error } = await supabase.rpc('push_registrar', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) throw new Error(error.message)
}

/**
 * Reenvia ao banco a inscrição que este aparelho JÁ tem (sem pedir permissão nem mostrar nada). Corrige o caso em que
 * o app mostra "ativado" mas a assinatura sumiu do banco (dados apagados/restaurados) ou mudou de dono (outra conta
 * entrou no mesmo aparelho). É idempotente: se já estiver cadastrada, só atualiza.
 */
export async function sincronizarPush(): Promise<void> {
  if ((await estadoPush()) !== 'ativado') return
  const reg = await navigator.serviceWorker.ready
  const json = (await reg.pushManager.getSubscription())?.toJSON()
  if (!json?.endpoint || !json.keys?.p256dh || !json.keys.auth) return
  await supabase.rpc('push_registrar', {
    p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth, p_user_agent: navigator.userAgent,
  })
}

export async function desativarPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_assinaturas').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/** Envia uma notificação de teste para o próprio jogador (chega em até 1 minuto). */
export async function enviarTeste(): Promise<void> {
  const { error } = await supabase.rpc('push_teste')
  if (error) throw new Error(error.message)
}

/** Estado das notificações neste aparelho, com atualização manual. */
export function usePushEstado() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['pushEstado'], queryFn: estadoPush, staleTime: 0, refetchOnWindowFocus: true })
  return { estado: q.data, carregando: q.isLoading, atualizar: () => qc.invalidateQueries({ queryKey: ['pushEstado'] }) }
}
