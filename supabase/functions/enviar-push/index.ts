// Edge Function "enviar-push": envia as notificações push da fila (tabela push_fila).
// Chamada a cada minuto pelo pg_cron (veja supabase/push_cron.sql). Antes de enviar, pede ao banco que gere
// os avisos por horário (confirmação aberta e lembrete de véspera).
//
// Segredos (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex.: mailto:contato@seudominio.com), PUSH_CRON_SECRET
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem automaticamente nas Edge Functions.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { MAX_TENTATIVAS, processarFila, type Assinatura, type ItemFila } from './processar.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

Deno.serve(async (req) => {
  // sem JWT (a função é chamada pelo cron): protegida por um segredo próprio
  if (req.headers.get('x-cron-secret') !== Deno.env.get('PUSH_CRON_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }

  try {
    const { data: agendadas, error: e1 } = await supabase.rpc('push_gerar_agendados')
    if (e1) throw new Error(`push_gerar_agendados: ${e1.message}`)

    const resumo = await processarFila({
      async buscarPendentes(limite) {
        const { data, error } = await supabase
          .from('push_fila')
          .select('id, jogador_id, tipo, titulo, corpo, url, tentativas')
          .is('enviado_em', null)
          .lt('tentativas', MAX_TENTATIVAS)
          .order('criado_em')
          .limit(limite)
        if (error) throw error
        return data as ItemFila[]
      },
      async buscarAssinaturas(ids) {
        const { data, error } = await supabase.from('push_assinaturas').select('id, jogador_id, endpoint, p256dh, auth').in('jogador_id', ids)
        if (error) throw error
        return data as Assinatura[]
      },
      async enviar(a, payload) {
        try {
          await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, payload, {
            TTL: 6 * 60 * 60, // se o aparelho estiver desligado, descarta depois de 6 h
            urgency: 'high',
          })
          return { ok: true }
        } catch (e) {
          const err = e as { statusCode?: number; body?: string; message?: string }
          return { ok: false, status: err.statusCode ?? 0, erro: err.body || err.message || 'erro' }
        }
      },
      async removerAssinatura(id) {
        await supabase.from('push_assinaturas').delete().eq('id', id)
      },
      async atualizarItem(id, d) {
        await supabase
          .from('push_fila')
          .update({ enviado_em: d.enviado ? new Date().toISOString() : null, tentativas: d.tentativas, erro: d.erro })
          .eq('id', id)
      },
    })

    return Response.json({ agendadas, ...resumo })
  } catch (e) {
    return Response.json({ erro: (e as Error).message }, { status: 500 })
  }
})
