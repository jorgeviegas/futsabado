-- =====================================================================
-- FutSábado - RESTAURAR O ADMINISTRADOR
--
-- Use quando as tabelas foram apagadas/recriadas e você não consegue mais
-- entrar (a conta de login continua existindo, mas o cadastro de jogador sumiu).
--
-- Passo a passo:
--   1) Rode primeiro o supabase/schema.sql inteiro (recria tabelas, regras e funções).
--   2) Troque v_email abaixo pelo e-mail com o qual você faz login.
--   3) Cole este script no SQL Editor e execute.
--   4) Abra o app e entre normalmente (se já estava aberto, recarregue a página).
--
-- Seguro para rodar mais de uma vez. Se o e-mail ainda não tiver conta, o script
-- avisa: nesse caso, crie a conta pelo app (o primeiro usuário vira admin sozinho).
-- =====================================================================

do $$
declare
  -- ▼▼▼ EDITE AQUI ▼▼▼
  v_email text := 'seu-email@exemplo.com';
  v_nome  text := null;  -- opcional; se nulo, usa o nome do cadastro ou a parte antes do @
  -- ▲▲▲ EDITE AQUI ▲▲▲

  v_user auth.users;
  v_id   uuid;
begin
  select * into v_user from auth.users where lower(email) = lower(v_email);
  if not found then
    raise exception 'Nenhuma conta de login com o e-mail "%". Crie a conta pelo app (o primeiro usuário vira admin) ou confira o e-mail.', v_email;
  end if;

  -- já existe cadastro ligado a esta conta? só garante admin + ativo
  update public.jogadores
     set is_admin = true, ativo = true
   where user_id = v_user.id
  returning id into v_id;

  -- existe cadastro com este e-mail, mas sem conta ligada? liga à conta
  if v_id is null then
    update public.jogadores
       set user_id = v_user.id, is_admin = true, ativo = true
     where lower(email) = lower(v_email) and user_id is null
    returning id into v_id;
  end if;

  -- senão, cria o cadastro do zero
  if v_id is null then
    insert into public.jogadores (user_id, nome, email, is_admin, ativo)
    values (
      v_user.id,
      coalesce(nullif(trim(v_nome), ''), nullif(v_user.raw_user_meta_data ->> 'nome', ''), split_part(v_user.email, '@', 1)),
      lower(v_user.email),
      true,
      true
    );
  end if;

  raise notice 'Administrador restaurado: %', v_email;
end $$;

-- Conferência: deve listar o seu usuário com is_admin = true e ativo = true.
select nome, email, is_admin, ativo, user_id is not null as com_login
  from public.jogadores
 order by is_admin desc, nome;
