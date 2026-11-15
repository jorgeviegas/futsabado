-- =====================================================================
-- FutSábado - RESET DOS DADOS  (⚠️ DESTRUTIVO E IRREVERSÍVEL)
--
-- Apaga TODOS os dados do app (a chave Pix do time, em config_time, é mantida) e mantém apenas o jogador administrador
-- indicado em v_email_admin. A estrutura (tabelas, regras, funções) NÃO é
-- alterada: é só esvaziar. Use para "zerar" o app depois de testes.
--
-- Como usar:
--   1) Troque v_email_admin pelo e-mail do administrador que deve ficar.
--   2) Decida v_apagar_contas (veja abaixo).
--   3) Cole no SQL Editor do Supabase e execute.
--
-- Tudo roda em uma única transação: se algo falhar (ou o admin não for
-- encontrado), NADA é apagado.
-- =====================================================================

do $$
declare
  -- ▼▼▼ EDITE AQUI ▼▼▼
  v_email_admin    text    := 'seu-email@exemplo.com';

  -- true  = também apaga as CONTAS DE LOGIN dos outros jogadores (auth.users).
  --         Elas precisarão criar conta de novo. Recomendado: sem isso, quem
  --         já tinha conta fica sem cadastro de jogador e preso na tela
  --         "aguardando aprovação".
  -- false = mantém as contas de login (os outros jogadores ficam sem cadastro).
  v_apagar_contas  boolean := true;
  -- ▲▲▲ EDITE AQUI ▲▲▲

  v_admin public.jogadores;
begin
  select * into v_admin
    from public.jogadores
   where lower(email) = lower(v_email_admin);

  if not found then
    raise exception 'Nenhum jogador com o e-mail "%". Nada foi apagado. Confira v_email_admin.', v_email_admin;
  end if;
  if not v_admin.is_admin then
    raise exception 'O jogador "%" não é administrador. Nada foi apagado.', v_email_admin;
  end if;
  if v_admin.user_id is null then
    raise exception 'O administrador "%" não tem conta de login vinculada. Nada foi apagado.', v_email_admin;
  end if;

  -- Dados do jogo (a ordem não importa: o CASCADE cuida das dependências)
  truncate table
    public.votos,
    public.convidados,
    public.caixa_lancamentos,
    public.avisos_avulsos,
    public.push_fila,
    public.presencas,
    public.pagamentos,
    public.jogos,
    public.peladas
  restart identity cascade;

  -- Jogadores: fica só o administrador
  delete from public.jogadores where id <> v_admin.id;

  -- Contas de login dos demais
  if v_apagar_contas then
    delete from auth.users where id <> v_admin.user_id;
  end if;

  raise notice 'Reset concluído. Mantido: % (%). Contas de login dos demais %.',
    v_admin.nome, v_admin.email, case when v_apagar_contas then 'apagadas' else 'mantidas' end;
end $$;

-- Conferência: deve listar apenas o administrador e todas as demais com 0.
select 'jogadores' as tabela, count(*) as linhas from public.jogadores
union all select 'peladas',    count(*) from public.peladas
union all select 'jogos',      count(*) from public.jogos
union all select 'presencas',  count(*) from public.presencas
union all select 'votos',      count(*) from public.votos
union all select 'pagamentos', count(*) from public.pagamentos
union all select 'auth.users', count(*) from auth.users;
