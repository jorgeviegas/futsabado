/** Confere o segredo enviado pelo cron (cabeçalho x-cron-secret) com o PUSH_CRON_SECRET da função. */
export type Autorizacao = { ok: true } | { ok: false; status: number; motivo: string }

export function autorizar(recebido: string | null | undefined, esperado: string | null | undefined): Autorizacao {
  const e = esperado?.trim()
  if (!e) return { ok: false, status: 500, motivo: 'o segredo PUSH_CRON_SECRET NÃO está configurado na função (Edge Functions → Secrets)' }
  const r = recebido?.trim()
  if (!r) return { ok: false, status: 403, motivo: 'a chamada veio SEM o cabeçalho x-cron-secret' }
  if (r !== e) {
    // só os tamanhos (nunca os valores): ajuda a notar espaços, aspas ou os sinais < > do modelo
    return { ok: false, status: 403, motivo: `o segredo recebido NÃO confere com o PUSH_CRON_SECRET (recebido: ${r.length} caracteres; configurado: ${e.length})` }
  }
  return { ok: true }
}
