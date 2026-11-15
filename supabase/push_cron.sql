-- =====================================================================
-- FutSábado - AGENDAMENTO DO ENVIO DE NOTIFICAÇÕES PUSH (rode UMA vez)
--
-- Faz o Supabase chamar a Edge Function "enviar-push" a cada minuto. Ela gera os avisos por horário
-- (confirmação aberta e lembrete de véspera) e envia tudo que estiver na fila.
--
-- Antes:
--   1) Database → Extensions: ative "pg_cron" e "pg_net".
--   2) Faça o deploy da função "enviar-push" e cadastre os segredos (veja o README, seção Notificações push).
-- Depois: troque <PROJECT_REF> (ex.: abcdefghijklmnop) e <SEGREDO> (o mesmo valor de PUSH_CRON_SECRET) e execute.
-- =====================================================================
select cron.unschedule('futsabado-push') where exists (select 1 from cron.job where jobname = 'futsabado-push');

select cron.schedule(
  'futsabado-push',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/enviar-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<SEGREDO>'),
    body    := '{}'::jsonb
  );
  $$
);

-- Conferir: select * from cron.job where jobname = 'futsabado-push';
-- Últimas execuções: select * from cron.job_run_details order by start_time desc limit 10;
-- Pausar: select cron.unschedule('futsabado-push');
