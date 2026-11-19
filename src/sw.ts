/// <reference lib="webworker" />
// Service worker do FutSábado: guarda o app para abrir rápido (offline) e recebe as notificações push.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { hashDe, urlDestino } from './lib/pushUrl'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<string | { url: string; revision: string | null }> }

// atualização automática: a nova versão assume assim que estiver instalada
self.addEventListener('install', () => void self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
// navegação sempre cai no index.html (SPA); chamadas ao Supabase nunca passam pelo cache
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/rest\//, /^\/auth\//, /\/taticas(\/|$)/] }))

interface DadosPush {
  titulo?: string
  corpo?: string
  url?: string
  tipo?: string
  tag?: string
}

// ---- Notificações push ----
self.addEventListener('push', (event) => {
  let dados: DadosPush = {}
  try {
    dados = event.data ? (event.data.json() as DadosPush) : {}
  } catch {
    dados = { corpo: event.data?.text() }
  }
  // No iPhone toda mensagem push PRECISA virar uma notificação visível (senão a Apple cancela a inscrição).
  event.waitUntil(
    self.registration.showNotification(dados.titulo || 'FutSábado', {
      body: dados.corpo || '',
      icon: new URL('pwa-192.png', self.registration.scope).href,
      badge: new URL('pwa-192.png', self.registration.scope).href,
      tag: dados.tag || dados.tipo || 'futsabado',
      lang: 'pt-BR',
      data: { url: dados.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url
  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const aberta = janelas.find((c) => c.url.startsWith(self.registration.scope))
      if (aberta) {
        // app já aberto: pede para ir à tela certa e traz a janela para a frente. A navegação vem ANTES do foco
        // porque o foco pode ser recusado em alguns aparelhos e não deve impedir a navegação.
        aberta.postMessage({ tipo: 'navegar', hash: hashDe(url) })
        await aberta.focus().catch(() => undefined)
        return
      }
      await self.clients.openWindow(urlDestino(self.registration.scope, url))
    })(),
  )
})
