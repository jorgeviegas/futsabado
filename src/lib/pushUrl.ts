/**
 * Navegação a partir de uma notificação. O app usa HashRouter, então a rota fica depois do "#":
 * "/jogo/123" → "<escopo>#/jogo/123". Sem dependências de DOM: usado pelo service worker e pelo app.
 */
export function hashDe(url: string | null | undefined): string {
  const rota = !url ? '/' : url.startsWith('/') ? url : `/${url}`
  return `#${rota}`
}

export function urlDestino(escopo: string, url: string | null | undefined): string {
  return `${escopo}${hashDe(url)}`
}
