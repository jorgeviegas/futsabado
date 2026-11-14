-- =====================================================================
-- FutSabado - schema do banco (Supabase / Postgres)
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- O script pode ser executado mais de uma vez (idempotente).
-- =====================================================================

-- ---------------------------------------------------------------------
-- TABELAS
-- ---------------------------------------------------------------------

-- Jogadores do time. Um jogador pode (ou não) ter uma conta de login (user_id).
create table if not exists public.jogadores (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete set null,
  nome        text not null,
  apelido     text,
  email       text unique,
  telefone    text,
  posicao     text check (posicao in ('goleiro','zagueiro','ala','meia','atacante')),
  tipo        text not null default 'mensalista' check (tipo in ('mensalista','avulso')),
  is_admin    boolean not null default false,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Migração (fut7): ajusta posições em bancos criados antes desta versão.
alter table public.jogadores drop constraint if exists jogadores_posicao_check;
update public.jogadores set posicao = 'ala'  where posicao = 'lateral';
update public.jogadores set posicao = 'meia' where posicao = 'meio';
alter table public.jogadores add constraint jogadores_posicao_check
  check (posicao in ('goleiro','zagueiro','ala','meia','atacante'));

-- Peladas recorrentes (ex.: "Pelada de sábado", todo sábado às 8h).
create table if not exists public.peladas (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  dia_semana         smallint not null check (dia_semana between 0 and 6), -- 0 = domingo
  horario            time not null,
  local              text,
  limite_jogadores   int check (limite_jogadores is null or limite_jogadores > 0),
  valor_mensalidade  numeric(10,2) not null default 0,
  valor_avulso       numeric(10,2) not null default 0,
  ativa              boolean not null default true,
  created_at         timestamptz not null default now()
);

-- Cada ocorrência (jogo) de uma pelada.
create table if not exists public.jogos (
  id              uuid primary key default gen_random_uuid(),
  pelada_id       uuid not null references public.peladas(id) on delete cascade,
  data            date not null,
  horario         time not null,
  local           text,
  status          text not null default 'agendado' check (status in ('agendado','realizado','cancelado')),
  votacao_aberta  boolean not null default false,
  placar          text,
  observacoes     text,
  created_at      timestamptz not null default now(),
  unique (pelada_id, data)
);
create index if not exists jogos_data_idx on public.jogos (data);

-- Confirmação de presença.
create table if not exists public.presencas (
  jogo_id     uuid not null references public.jogos(id) on delete cascade,
  jogador_id  uuid not null references public.jogadores(id) on delete cascade,
  status      text not null check (status in ('confirmado','talvez','ausente')),
  updated_at  timestamptz not null default now(),
  primary key (jogo_id, jogador_id)
);

-- Votação do craque do jogo (1 voto por eleitor por jogo).
create table if not exists public.votos (
  jogo_id     uuid not null references public.jogos(id) on delete cascade,
  eleitor_id  uuid not null references public.jogadores(id) on delete cascade,
  votado_id   uuid not null references public.jogadores(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (jogo_id, eleitor_id),
  check (eleitor_id <> votado_id)
);

-- Financeiro: mensalidades (por competência/mês) e avulsos (por jogo).
create table if not exists public.pagamentos (
  id           uuid primary key default gen_random_uuid(),
  jogador_id   uuid not null references public.jogadores(id) on delete cascade,
  tipo         text not null check (tipo in ('mensalidade','avulso')),
  competencia  date not null,               -- sempre o 1º dia do mês
  jogo_id      uuid references public.jogos(id) on delete cascade,
  valor        numeric(10,2) not null default 0,
  pago         boolean not null default false,
  pago_em      timestamptz,
  created_at   timestamptz not null default now(),
  check (tipo = 'mensalidade' or jogo_id is not null)
);
create unique index if not exists pagamentos_mensalidade_uk
  on public.pagamentos (jogador_id, competencia) where tipo = 'mensalidade';
create unique index if not exists pagamentos_avulso_uk
  on public.pagamentos (jogador_id, jogo_id) where tipo = 'avulso';

-- ---------------------------------------------------------------------
-- EVOLUÇÕES (v2): posição secundária, camisa, sorteio de times e vencedor
-- (idempotente: seguro rodar em bancos novos ou já existentes)
-- ---------------------------------------------------------------------
alter table public.jogadores add column if not exists posicao_secundaria text;
alter table public.jogadores add column if not exists numero_camisa smallint;
alter table public.jogadores add column if not exists perfil_completo boolean not null default false;

alter table public.jogadores drop constraint if exists jogadores_posicao_sec_check;
alter table public.jogadores add constraint jogadores_posicao_sec_check
  check (posicao_secundaria is null or posicao_secundaria in ('goleiro','zagueiro','ala','meia','atacante'));
alter table public.jogadores drop constraint if exists jogadores_camisa_check;
alter table public.jogadores add constraint jogadores_camisa_check
  check (numero_camisa is null or numero_camisa between 1 and 99);
-- numeração fixa: cada número pertence a um único jogador
create unique index if not exists jogadores_numero_camisa_uk
  on public.jogadores (numero_camisa) where numero_camisa is not null;

-- sorteio: {"branco":[{"id","slot","fora"}], "preto":[...], "reservas":[ids], "gerado_em"}
alter table public.jogos add column if not exists sorteio jsonb;
alter table public.jogos add column if not exists time_vencedor text;
alter table public.jogos drop constraint if exists jogos_time_vencedor_check;
-- v4: os times passaram a ser Preto e Branco (antes Grená e Preto) — converte dados já gravados
update public.jogos set time_vencedor = 'branco' where time_vencedor = 'grena';
update public.jogos
   set sorteio = (sorteio - 'grena') || jsonb_build_object('branco', sorteio -> 'grena')
 where sorteio ? 'grena';
alter table public.jogos add constraint jogos_time_vencedor_check
  check (time_vencedor is null or time_vencedor in ('branco','preto','empate'));

-- v3: goleiro escolhe gol/linha, valor individual por jogo e padrão "avulso"
alter table public.presencas add column if not exists funcao text;
alter table public.presencas drop constraint if exists presencas_funcao_check;
alter table public.presencas add constraint presencas_funcao_check
  check (funcao is null or funcao in ('gol','linha'));

alter table public.jogos add column if not exists valor numeric(10,2);
alter table public.jogos drop constraint if exists jogos_valor_check;
alter table public.jogos add constraint jogos_valor_check check (valor is null or valor >= 0);
-- jogos já criados herdam o valor individual da pelada
update public.jogos j set valor = p.valor_avulso
  from public.peladas p where j.pelada_id = p.id and j.valor is null;

-- todo jogador novo entra como AVULSO; só um administrador muda para mensalista
alter table public.jogadores alter column tipo set default 'avulso';

-- ---------------------------------------------------------------------
-- FUNÇÕES AUXILIARES (usadas nas políticas RLS)
-- ---------------------------------------------------------------------

create or replace function public.meu_jogador_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.jogadores where user_id = auth.uid() and ativo;
$$;

create or replace function public.is_membro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.jogadores where user_id = auth.uid() and ativo);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.jogadores where user_id = auth.uid() and ativo and is_admin);
$$;

-- ---------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------

-- Ao criar uma conta: vincula ao jogador pré-cadastrado com o mesmo e-mail
-- ou cria um jogador novo INATIVO (aguardando aprovação de um admin).
-- O primeiro usuário do sistema vira administrador automaticamente.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_primeiro boolean;
begin
  select not exists (select 1 from public.jogadores where is_admin) into v_primeiro;

  update public.jogadores
     set user_id = new.id
   where lower(email) = lower(new.email) and user_id is null
  returning id into v_id;

  if v_id is null then
    insert into public.jogadores (user_id, nome, email, is_admin, ativo)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'nome', ''), split_part(new.email, '@', 1)),
      lower(new.email),
      v_primeiro,
      v_primeiro
    );
  elsif v_primeiro then
    update public.jogadores set is_admin = true, ativo = true where id = v_id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impede que um jogador comum altere campos privilegiados do próprio cadastro.
create or replace function public.proteger_campos_jogador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.is_admin := old.is_admin;
    new.ativo    := old.ativo;
    new.tipo     := old.tipo;
    new.user_id  := old.user_id;
    new.email    := old.email;
  end if;
  if new.email is not null then
    new.email := lower(new.email);
  end if;
  return new;
end;
$$;

drop trigger if exists jogadores_proteger on public.jogadores;
create trigger jogadores_proteger
  before update on public.jogadores
  for each row execute function public.proteger_campos_jogador();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists presencas_touch on public.presencas;
create trigger presencas_touch
  before update on public.presencas
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.jogadores  enable row level security;
alter table public.peladas    enable row level security;
alter table public.jogos      enable row level security;
alter table public.presencas  enable row level security;
alter table public.votos      enable row level security;
alter table public.pagamentos enable row level security;

-- jogadores
drop policy if exists jogadores_select on public.jogadores;
create policy jogadores_select on public.jogadores for select to authenticated
  using (public.is_membro() or user_id = auth.uid());
drop policy if exists jogadores_insert on public.jogadores;
create policy jogadores_insert on public.jogadores for insert to authenticated
  with check (public.is_admin());
drop policy if exists jogadores_update on public.jogadores;
create policy jogadores_update on public.jogadores for update to authenticated
  using (public.is_admin() or user_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid());
drop policy if exists jogadores_delete on public.jogadores;
create policy jogadores_delete on public.jogadores for delete to authenticated
  using (public.is_admin());

-- peladas
drop policy if exists peladas_select on public.peladas;
create policy peladas_select on public.peladas for select to authenticated
  using (public.is_membro());
drop policy if exists peladas_admin on public.peladas;
create policy peladas_admin on public.peladas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- jogos
drop policy if exists jogos_select on public.jogos;
create policy jogos_select on public.jogos for select to authenticated
  using (public.is_membro());
drop policy if exists jogos_admin on public.jogos;
create policy jogos_admin on public.jogos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- presencas: todos os membros veem; cada um marca a própria (em jogos agendados); admin marca qualquer uma
drop policy if exists presencas_select on public.presencas;
create policy presencas_select on public.presencas for select to authenticated
  using (public.is_membro());
drop policy if exists presencas_insert on public.presencas;
create policy presencas_insert on public.presencas for insert to authenticated
  with check (
    public.is_admin() or (
      jogador_id = public.meu_jogador_id()
      and exists (select 1 from public.jogos j where j.id = jogo_id and j.status = 'agendado')
    )
  );
drop policy if exists presencas_update on public.presencas;
create policy presencas_update on public.presencas for update to authenticated
  using (public.is_admin() or jogador_id = public.meu_jogador_id())
  with check (
    public.is_admin() or (
      jogador_id = public.meu_jogador_id()
      and exists (select 1 from public.jogos j where j.id = jogo_id and j.status = 'agendado')
    )
  );
drop policy if exists presencas_delete on public.presencas;
create policy presencas_delete on public.presencas for delete to authenticated
  using (public.is_admin() or jogador_id = public.meu_jogador_id());

-- votos: voto secreto. Cada um vê só o próprio voto; admin vê todos.
-- Só vota quem confirmou presença, com a votação aberta, em alguém que também confirmou.
drop policy if exists votos_select on public.votos;
create policy votos_select on public.votos for select to authenticated
  using (public.is_admin() or eleitor_id = public.meu_jogador_id());
drop policy if exists votos_insert on public.votos;
create policy votos_insert on public.votos for insert to authenticated
  with check (
    eleitor_id = public.meu_jogador_id()
    and exists (select 1 from public.jogos j where j.id = jogo_id and j.votacao_aberta)
    and exists (select 1 from public.presencas p where p.jogo_id = votos.jogo_id and p.jogador_id = votos.eleitor_id and p.status = 'confirmado')
    and exists (select 1 from public.presencas p where p.jogo_id = votos.jogo_id and p.jogador_id = votos.votado_id and p.status = 'confirmado')
  );
drop policy if exists votos_update on public.votos;
create policy votos_update on public.votos for update to authenticated
  using (eleitor_id = public.meu_jogador_id())
  with check (
    eleitor_id = public.meu_jogador_id()
    and exists (select 1 from public.jogos j where j.id = jogo_id and j.votacao_aberta)
    and exists (select 1 from public.presencas p where p.jogo_id = votos.jogo_id and p.jogador_id = votos.votado_id and p.status = 'confirmado')
  );
drop policy if exists votos_delete on public.votos;
create policy votos_delete on public.votos for delete to authenticated
  using (public.is_admin() or eleitor_id = public.meu_jogador_id());

-- pagamentos: cada um vê os próprios; admin vê e altera todos
drop policy if exists pagamentos_select on public.pagamentos;
create policy pagamentos_select on public.pagamentos for select to authenticated
  using (public.is_admin() or jogador_id = public.meu_jogador_id());
drop policy if exists pagamentos_admin on public.pagamentos;
create policy pagamentos_admin on public.pagamentos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- FUNÇÕES RPC (chamadas pelo app)
-- ---------------------------------------------------------------------

-- Gera os jogos das próximas N semanas de uma pelada recorrente (somente admin).
create or replace function public.gerar_jogos(p_pelada_id uuid, p_semanas int default 4)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_pelada public.peladas;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_data date;
  v_criados int := 0;
  v_linhas int;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem gerar jogos';
  end if;

  select * into v_pelada from public.peladas where id = p_pelada_id;
  if not found then
    raise exception 'Pelada não encontrada';
  end if;

  -- próxima ocorrência do dia da semana (incluindo hoje)
  v_data := v_hoje + ((v_pelada.dia_semana - extract(dow from v_hoje)::int + 7) % 7);

  for i in 1..greatest(1, least(p_semanas, 52)) loop
    insert into public.jogos (pelada_id, data, horario, local, valor)
    values (v_pelada.id, v_data, v_pelada.horario, v_pelada.local, v_pelada.valor_avulso)
    on conflict (pelada_id, data) do nothing;
    get diagnostics v_linhas = row_count;
    v_criados := v_criados + v_linhas;
    v_data := v_data + 7;
  end loop;

  return v_criados;
end;
$$;

-- Resultado da votação de um jogo. Membros só veem depois que a votação é encerrada.
create or replace function public.resultado_votacao(p_jogo_id uuid)
returns table (jogador_id uuid, nome text, apelido text, votos bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_membro() then
    raise exception 'Acesso negado';
  end if;
  if not public.is_admin() and exists (select 1 from public.jogos where id = p_jogo_id and votacao_aberta) then
    return;
  end if;
  return query
    select j.id, j.nome, j.apelido, count(*)::bigint
      from public.votos v
      join public.jogadores j on j.id = v.votado_id
     where v.jogo_id = p_jogo_id
     group by j.id, j.nome, j.apelido
     order by count(*) desc, j.nome;
end;
$$;

-- Total de votos já registrados em um jogo (para mostrar durante a votação).
create or replace function public.total_votos(p_jogo_id uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select case when public.is_membro()
    then (select count(*) from public.votos where jogo_id = p_jogo_id)
    else 0 end;
$$;

-- Ranking de craques: quantas vezes cada jogador foi o mais votado (votações encerradas).
create or replace function public.ranking_craques(p_limite int default 10)
returns table (jogador_id uuid, nome text, apelido text, premios bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_membro() then
    raise exception 'Acesso negado';
  end if;
  return query
    with contagem as (
      select v.jogo_id, v.votado_id, count(*) as n
        from public.votos v
        join public.jogos g on g.id = v.jogo_id
       where not g.votacao_aberta and g.status = 'realizado'
       group by v.jogo_id, v.votado_id
    ), vencedores as (
      select c.jogo_id, c.votado_id,
             rank() over (partition by c.jogo_id order by c.n desc) as pos
        from contagem c
    )
    select j.id, j.nome, j.apelido, count(*)::bigint
      from vencedores w
      join public.jogadores j on j.id = w.votado_id
     where w.pos = 1
     group by j.id, j.nome, j.apelido
     order by count(*) desc, j.nome
     limit p_limite;
end;
$$;

-- Marca (ou desmarca) um pagamento de forma atômica (somente admin).
create or replace function public.marcar_pagamento(
  p_jogador_id uuid,
  p_tipo text,
  p_competencia date,
  p_jogo_id uuid,
  p_valor numeric,
  p_pago boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_comp date := date_trunc('month', p_competencia)::date;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem alterar o financeiro';
  end if;

  if p_tipo = 'mensalidade' then
    select id into v_id from public.pagamentos
     where jogador_id = p_jogador_id and tipo = 'mensalidade' and competencia = v_comp;
  elsif p_tipo = 'avulso' then
    select id into v_id from public.pagamentos
     where jogador_id = p_jogador_id and tipo = 'avulso' and jogo_id = p_jogo_id;
  else
    raise exception 'Tipo de pagamento inválido';
  end if;

  if v_id is null then
    insert into public.pagamentos (jogador_id, tipo, competencia, jogo_id, valor, pago, pago_em)
    values (p_jogador_id, p_tipo, v_comp, case when p_tipo = 'avulso' then p_jogo_id end,
            coalesce(p_valor, 0), p_pago, case when p_pago then now() end);
  else
    update public.pagamentos
       set pago = p_pago,
           valor = coalesce(p_valor, valor),
           pago_em = case when p_pago then coalesce(pago_em, now()) end
     where id = v_id;
  end if;
end;
$$;

-- Maiores vencedores: vitórias de cada jogador em jogos sorteados e realizados.
create or replace function public.ranking_vencedores(p_limite int default 5)
returns table (jogador_id uuid, nome text, apelido text, vitorias bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_membro() then
    raise exception 'Acesso negado';
  end if;
  return query
    select j.id, j.nome, j.apelido, count(*)::bigint
      from public.jogos g
      cross join lateral jsonb_array_elements(g.sorteio -> g.time_vencedor) e
      join public.jogadores j on j.id = (e ->> 'id')::uuid
     where g.status = 'realizado'
       and g.time_vencedor in ('branco', 'preto')
       and g.sorteio is not null
     group by j.id, j.nome, j.apelido
     order by count(*) desc, j.nome
     limit p_limite;
end;
$$;

-- Jogos realizados em que cada jogador confirmou presença no ano (desempate do sorteio).
create or replace function public.jogos_no_ano(p_ano int default null)
returns table (jogador_id uuid, jogos bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_membro() then
    raise exception 'Acesso negado';
  end if;
  return query
    select p.jogador_id, count(*)::bigint
      from public.presencas p
      join public.jogos g on g.id = p.jogo_id
     where p.status = 'confirmado'
       and g.status = 'realizado'
       and extract(year from g.data)::int = coalesce(p_ano, extract(year from now())::int)
     group by p.jogador_id;
end;
$$;

-- Permissões de execução das funções
revoke execute on function public.gerar_jogos(uuid, int) from public, anon;
revoke execute on function public.resultado_votacao(uuid) from public, anon;
revoke execute on function public.total_votos(uuid) from public, anon;
revoke execute on function public.ranking_craques(int) from public, anon;
revoke execute on function public.ranking_vencedores(int) from public, anon;
revoke execute on function public.jogos_no_ano(int) from public, anon;
revoke execute on function public.marcar_pagamento(uuid, text, date, uuid, numeric, boolean) from public, anon;
grant execute on function public.gerar_jogos(uuid, int) to authenticated;
grant execute on function public.resultado_votacao(uuid) to authenticated;
grant execute on function public.total_votos(uuid) to authenticated;
grant execute on function public.ranking_craques(int) to authenticated;
grant execute on function public.ranking_vencedores(int) to authenticated;
grant execute on function public.jogos_no_ano(int) to authenticated;
grant execute on function public.marcar_pagamento(uuid, text, date, uuid, numeric, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- OPCIONAL: gerar jogos automaticamente toda segunda-feira com pg_cron.
-- Ative a extensão pg_cron em Database > Extensions e descomente:
-- ---------------------------------------------------------------------
-- select cron.schedule('futsabado-gerar-jogos', '0 9 * * 1', $$
--   insert into public.jogos (pelada_id, data, horario, local, valor)
--   select p.id, d::date, p.horario, p.local, p.valor_avulso
--     from public.peladas p,
--          generate_series(current_date, current_date + 27, interval '1 day') d
--    where p.ativa and extract(dow from d) = p.dia_semana
--   on conflict (pelada_id, data) do nothing;
-- $$);
