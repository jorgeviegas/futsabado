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

-- sorteio: {"branco":[{"id","slot","fora"}], "preto":[...], "reservas_branco":[ids], "reservas_preto":[ids], "gerado_em"}
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

-- v5: convidados, placar por time, votação automática, caixa do time
alter table public.peladas add column if not exists liberar_confirmacao_dias smallint not null default 2;
alter table public.peladas drop constraint if exists peladas_liberar_dias_check;
alter table public.peladas add constraint peladas_liberar_dias_check check (liberar_confirmacao_dias between 0 and 6);

alter table public.jogos add column if not exists placar_branco smallint;
alter table public.jogos add column if not exists placar_preto smallint;
alter table public.jogos drop constraint if exists jogos_placar_check;
alter table public.jogos add constraint jogos_placar_check
  check ((placar_branco is null or placar_branco >= 0) and (placar_preto is null or placar_preto >= 0));
-- quando a votação foi aberta pela primeira vez (evita reabrir sozinha depois de encerrada)
alter table public.jogos add column if not exists votacao_iniciada_em timestamptz;
update public.jogos set votacao_iniciada_em = now() where status = 'realizado' and votacao_iniciada_em is null;

-- (os status de presença válidos — inclusive 'faltou' e 'espera' — são definidos uma única vez, mais abaixo, no bloco v7)

-- Convidados avulsos: qualquer jogador convida; quem convidou fica responsável pelo pagamento.
create table if not exists public.convidados (
  id            uuid primary key default gen_random_uuid(),
  jogo_id       uuid not null references public.jogos(id) on delete cascade,
  convidado_por uuid not null references public.jogadores(id) on delete cascade,
  nome          text not null check (length(trim(nome)) > 0),
  posicao       text check (posicao is null or posicao in ('goleiro','zagueiro','ala','meia','atacante')),
  created_at    timestamptz not null default now()
);
create index if not exists convidados_jogo_idx on public.convidados (jogo_id);

alter table public.pagamentos add column if not exists convidado_id uuid references public.convidados(id) on delete cascade;
alter table public.pagamentos drop constraint if exists pagamentos_tipo_check;
alter table public.pagamentos add constraint pagamentos_tipo_check check (tipo in ('mensalidade','avulso','convidado'));
alter table public.pagamentos drop constraint if exists pagamentos_convidado_check;
alter table public.pagamentos add constraint pagamentos_convidado_check check ((tipo = 'convidado') = (convidado_id is not null));
create unique index if not exists pagamentos_convidado_uk on public.pagamentos (convidado_id) where tipo = 'convidado';

-- v6: local da pelada para a previsão do tempo (coordenadas escolhidas pelo admin)
alter table public.peladas add column if not exists latitude numeric(9,6);
alter table public.peladas add column if not exists longitude numeric(9,6);
alter table public.peladas add column if not exists cidade text;
alter table public.peladas drop constraint if exists peladas_coord_check;
alter table public.peladas add constraint peladas_coord_check
  check ((latitude is null) = (longitude is null)
         and (latitude is null or (latitude between -90 and 90 and longitude between -180 and 180)));

-- v7: goleiros isentos de pagamento e lista de espera
alter table public.peladas add column if not exists goleiros_isentos boolean not null default false;

alter table public.presencas add column if not exists espera_desde timestamptz;
-- status de presença: 'faltou' = confirmou e não compareceu (removido pelo admin); 'espera' = lista de espera
alter table public.presencas drop constraint if exists presencas_status_check;
alter table public.presencas add constraint presencas_status_check
  check (status in ('confirmado','talvez','ausente','faltou','espera'));

-- v11: geração automática do próximo jogo, avisos avulsos do admin e Pix do time
alter table public.peladas add column if not exists gerar_proximo_dias_antes smallint;
alter table public.peladas drop constraint if exists peladas_gerar_dias_check;
alter table public.peladas add constraint peladas_gerar_dias_check
  check (gerar_proximo_dias_antes is null or gerar_proximo_dias_antes between 0 and 30);

-- Avisos avulsos: aparecem no quadro de avisos de todos enquanto estiverem no período de validade.
create table if not exists public.avisos_avulsos (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (length(trim(titulo)) > 0),
  mensagem    text,
  inicio      date not null default current_date,
  fim         date not null,
  created_by  uuid references public.jogadores(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (fim >= inicio)
);
create index if not exists avisos_avulsos_fim_idx on public.avisos_avulsos (fim);

-- Configurações do time (uma única linha): chave Pix para os pagamentos.
create table if not exists public.config_time (
  id                int primary key default 1 check (id = 1),
  pix_chave         text,
  pix_tipo          text check (pix_tipo is null or pix_tipo in ('cpf','cnpj','email','telefone','aleatoria')),
  pix_beneficiario  text,
  updated_at        timestamptz not null default now()
);
insert into public.config_time (id) values (1) on conflict (id) do nothing;

-- v12: notificações push (Web Push)
-- Dispositivos inscritos (um jogador pode ter vários aparelhos).
create table if not exists public.push_assinaturas (
  id          uuid primary key default gen_random_uuid(),
  jogador_id  uuid not null references public.jogadores(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  criado_em   timestamptz not null default now()
);
create index if not exists push_assinaturas_jogador_idx on public.push_assinaturas (jogador_id);

-- Quais avisos cada jogador quer receber (sem linha = todos ligados).
create table if not exists public.push_preferencias (
  jogador_id          uuid primary key references public.jogadores(id) on delete cascade,
  confirmacao_aberta  boolean not null default true,
  vaga_lista_espera   boolean not null default true,
  lembrete_vespera    boolean not null default true,
  resultado_craque    boolean not null default true
);

-- Fila de envio: o banco enfileira, a Edge Function "enviar-push" envia. Sem acesso pelo app (só service_role).
create table if not exists public.push_fila (
  id          uuid primary key default gen_random_uuid(),
  jogador_id  uuid not null references public.jogadores(id) on delete cascade,
  tipo        text not null,
  titulo      text not null,
  corpo       text not null,
  url         text,
  chave       text not null,
  criado_em   timestamptz not null default now(),
  enviado_em  timestamptz,
  tentativas  int not null default 0,
  erro        text,
  unique (jogador_id, chave)
);
create index if not exists push_fila_pendentes_idx on public.push_fila (criado_em) where enviado_em is null;

-- v13: a pelada é só um MODELO para criar jogos. Cada jogo guarda uma CÓPIA do que precisa (nome, limite de
-- jogadores, goleiros isentos, local do clima) e a ligação com a pelada é opcional: apagar ou editar a pelada
-- não mexe em jogos que já foram realizados.
alter table public.jogos alter column pelada_id drop not null;
alter table public.jogos drop constraint if exists jogos_pelada_id_fkey;
alter table public.jogos add constraint jogos_pelada_id_fkey
  foreign key (pelada_id) references public.peladas(id) on delete set null;
alter table public.jogos add column if not exists pelada_nome text;
alter table public.jogos add column if not exists limite_jogadores int;
alter table public.jogos add column if not exists goleiros_isentos boolean not null default false;
alter table public.jogos add column if not exists latitude numeric(9,6);
alter table public.jogos add column if not exists longitude numeric(9,6);
alter table public.jogos add column if not exists cidade text;
-- jogos já existentes ficam com a cópia dos dados atuais da pelada (só os que ainda não têm cópia)
update public.jogos g
   set pelada_nome = p.nome, limite_jogadores = p.limite_jogadores, goleiros_isentos = p.goleiros_isentos,
       latitude = p.latitude, longitude = p.longitude, cidade = p.cidade
  from public.peladas p
 where g.pelada_id = p.id and g.pelada_nome is null;

-- Caixa do time: entradas e saídas avulsas (as mensalidades/jogos pagos entram automaticamente no extrato).
create table if not exists public.caixa_lancamentos (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('entrada','saida')),
  descricao   text not null check (length(trim(descricao)) > 0),
  valor       numeric(10,2) not null check (valor > 0),
  data        date not null default current_date,
  created_by  uuid references public.jogadores(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists caixa_lancamentos_data_idx on public.caixa_lancamentos (data desc);

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

-- Data em que a confirmação de presença abre: data do jogo anterior da pelada + N dias
-- (padrão 2 = segunda-feira para jogos de sábado). Nulo = sempre aberta (não há jogo anterior).
create or replace function public.liberacao_confirmacao(p_jogo_id uuid)
returns date language sql stable security definer set search_path = public as $$
  select (a.data + p.liberar_confirmacao_dias)::date
    from public.jogos j
    join public.peladas p on p.id = j.pelada_id
    cross join lateral (
      select x.data from public.jogos x
       where x.pelada_id = j.pelada_id and x.data < j.data and x.status <> 'cancelado'
       order by x.data desc limit 1
    ) a
   where j.id = p_jogo_id;
$$;

create or replace function public.confirmacao_aberta(p_jogo_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((now() at time zone 'America/Sao_Paulo')::date >= public.liberacao_confirmacao(p_jogo_id), true);
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

drop trigger if exists config_time_touch on public.config_time;
create trigger config_time_touch
  before update on public.config_time
  for each row execute function public.touch_updated_at();

drop trigger if exists presencas_touch on public.presencas;
create trigger presencas_touch
  before update on public.presencas
  for each row execute function public.touch_updated_at();

-- Placar por time define o vencedor; jogo realizado abre a votação do craque automaticamente (uma única vez).
create or replace function public.jogos_resultado()
returns trigger language plpgsql as $$
begin
  if new.placar_branco is not null and new.placar_preto is not null then
    new.time_vencedor := case
      when new.placar_branco > new.placar_preto then 'branco'
      when new.placar_branco < new.placar_preto then 'preto'
      else 'empate' end;
    if new.status = 'agendado' then
      new.status := 'realizado';
    end if;
  end if;
  if new.status = 'realizado' and new.votacao_iniciada_em is null then
    new.votacao_aberta := true;
    new.votacao_iniciada_em := now();
  end if;
  return new;
end;
$$;

drop trigger if exists jogos_resultado on public.jogos;
create trigger jogos_resultado
  before insert or update on public.jogos
  for each row execute function public.jogos_resultado();

-- ---------------------------------------------------------------------
-- LISTA DE ESPERA
--  * jogo cheio: quem confirma entra na lista de espera (status 'espera', com a hora de entrada);
--  * vaga liberada (alguém deixa de confirmar, convidado removido ou limite aumentado):
--    o primeiro da lista entra sozinho.
-- ---------------------------------------------------------------------

-- Vagas ocupadas = jogadores confirmados + convidados.
create or replace function public.vagas_ocupadas(p_jogo_id uuid, p_exceto_jogador uuid default null)
returns int language sql stable security definer set search_path = public as $$
  select (select count(*) from public.presencas x
           where x.jogo_id = p_jogo_id and x.status = 'confirmado'
             and (p_exceto_jogador is null or x.jogador_id <> p_exceto_jogador))::int
       + (select count(*) from public.convidados c where c.jogo_id = p_jogo_id)::int;
$$;

-- Promove, na ordem de chegada, quem está na lista de espera enquanto houver vaga.
create or replace function public.promover_espera(p_jogo_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_limite int;
  v_prox uuid;
  v_n int := 0;
  v_info record;
  v_dias text[] := array['dom','seg','ter','qua','qui','sex','sáb'];
begin
  select j.limite_jogadores into v_limite
    from public.jogos j
   where j.id = p_jogo_id and j.status = 'agendado'
     and (j.data + j.horario) > (now() at time zone 'America/Sao_Paulo');  -- depois do início, ninguém é promovido
  if not found then
    return 0;
  end if;

  loop
    exit when v_limite is not null and public.vagas_ocupadas(p_jogo_id) >= v_limite;
    select x.jogador_id into v_prox from public.presencas x
     where x.jogo_id = p_jogo_id and x.status = 'espera'
     order by x.espera_desde, x.jogador_id limit 1;
    exit when v_prox is null;
    update public.presencas set status = 'confirmado' where jogo_id = p_jogo_id and jogador_id = v_prox;
    v_n := v_n + 1;

    -- push: "você entrou no jogo" (vale para qualquer vaga liberada: cancelamento, convidado removido, limite maior...)
    select g.data, g.horario, coalesce(g.pelada_nome, 'Pelada') as nome into v_info
      from public.jogos g where g.id = p_jogo_id;
    perform public.push_enfileirar(
      v_prox, 'vaga_lista_espera', '✅ Você entrou no jogo!',
      format('Abriu uma vaga e você saiu da lista de espera: %s · %s, %s às %s.',
             v_info.nome, v_dias[extract(dow from v_info.data)::int + 1], to_char(v_info.data, 'DD/MM'), to_char(v_info.horario, 'HH24:MI')),
      '/jogo/' || p_jogo_id,
      'vaga:' || p_jogo_id || ':' || v_prox || ':' || extract(epoch from clock_timestamp())::bigint);
    v_prox := null;
  end loop;
  return v_n;
end;
$$;

-- Antes de gravar a presença: jogo cheio => vira lista de espera (admins podem ultrapassar o limite).
create or replace function public.presenca_vaga()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limite int;
begin
  if new.status = 'confirmado' and (tg_op = 'INSERT' or old.status <> 'confirmado') and not public.is_admin()
     and not exists (select 1 from public.presencas x
                      where x.jogo_id = new.jogo_id and x.jogador_id = new.jogador_id and x.status = 'confirmado') then
    select j.limite_jogadores into v_limite
      from public.jogos j
     where j.id = new.jogo_id;
    if v_limite is not null and public.vagas_ocupadas(new.jogo_id, new.jogador_id) >= v_limite then
      new.status := 'espera';
    end if;
  end if;

  if new.status = 'espera' then
    if tg_op = 'INSERT' or old.status <> 'espera' then
      new.espera_desde := now();   -- mantém a posição se continuar na lista
    end if;
  else
    new.espera_desde := null;
  end if;
  return new;
end;
$$;

drop trigger if exists presencas_vaga on public.presencas;
create trigger presencas_vaga
  before insert or update on public.presencas
  for each row execute function public.presenca_vaga();

-- Depois: se alguém deixou de estar confirmado (ou entrou na espera com vaga livre), chama o próximo da fila.
create or replace function public.presenca_liberou_vaga()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'confirmado' then
      perform public.promover_espera(old.jogo_id);
    end if;
  elsif (old.status = 'confirmado' and new.status <> 'confirmado') or (new.status = 'espera' and old.status is distinct from 'espera') then
    perform public.promover_espera(new.jogo_id);
  end if;
  return null;
end;
$$;

drop trigger if exists presencas_liberou_vaga on public.presencas;
create trigger presencas_liberou_vaga
  after update or delete on public.presencas
  for each row execute function public.presenca_liberou_vaga();

-- insert direto na espera com vaga livre (corrida): promove
create or replace function public.presenca_nova_espera()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'espera' then
    perform public.promover_espera(new.jogo_id);
  end if;
  return null;
end;
$$;

drop trigger if exists presencas_nova_espera on public.presencas;
create trigger presencas_nova_espera
  after insert on public.presencas
  for each row execute function public.presenca_nova_espera();

-- Convidado removido libera vaga; convidado novo não pode ultrapassar o limite (exceto admin).
create or replace function public.convidado_vaga()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limite int;
begin
  if tg_op = 'DELETE' then
    perform public.promover_espera(old.jogo_id);
    return null;
  end if;
  if not public.is_admin() then
    select j.limite_jogadores into v_limite
      from public.jogos j
     where j.id = new.jogo_id;
    if v_limite is not null and public.vagas_ocupadas(new.jogo_id) >= v_limite then
      raise exception 'A lista está cheia. Entre na lista de espera.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists convidados_vaga_ins on public.convidados;
create trigger convidados_vaga_ins
  before insert on public.convidados
  for each row execute function public.convidado_vaga();
drop trigger if exists convidados_vaga_del on public.convidados;
create trigger convidados_vaga_del
  after delete on public.convidados
  for each row execute function public.convidado_vaga();

-- Limite de jogadores aumentado (ou retirado) em um jogo: a lista de espera avança.
create or replace function public.jogo_limite_mudou()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.promover_espera(new.id);
  return null;
end;
$$;

drop trigger if exists jogos_limite_mudou on public.jogos;
create trigger jogos_limite_mudou
  after update of limite_jogadores on public.jogos
  for each row when (new.limite_jogadores is distinct from old.limite_jogadores)
  execute function public.jogo_limite_mudou();

-- (v13) o gatilho antigo ficava na pelada; agora cada jogo tem o próprio limite
drop trigger if exists peladas_limite_mudou on public.peladas;
drop function if exists public.pelada_limite_mudou();

-- Ao criar um jogo a partir de uma pelada, copia os dados dela para o jogo (nome, limite, isenção de goleiros, clima, valor).
create or replace function public.jogo_copiar_da_pelada()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pe public.peladas;
begin
  if new.pelada_id is not null and new.pelada_nome is null then
    select * into pe from public.peladas where id = new.pelada_id;
    if found then
      new.pelada_nome       := pe.nome;
      new.limite_jogadores  := coalesce(new.limite_jogadores, pe.limite_jogadores);
      new.goleiros_isentos  := pe.goleiros_isentos;
      new.latitude          := coalesce(new.latitude, pe.latitude);
      new.longitude         := coalesce(new.longitude, pe.longitude);
      new.cidade            := coalesce(new.cidade, pe.cidade);
      new.valor             := coalesce(new.valor, pe.valor_avulso);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists jogos_copiar_da_pelada on public.jogos;
create trigger jogos_copiar_da_pelada
  before insert on public.jogos
  for each row execute function public.jogo_copiar_da_pelada();

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.jogadores  enable row level security;
alter table public.peladas    enable row level security;
alter table public.jogos      enable row level security;
alter table public.presencas  enable row level security;
alter table public.votos      enable row level security;
alter table public.pagamentos enable row level security;
alter table public.convidados enable row level security;
alter table public.avisos_avulsos enable row level security;
alter table public.config_time enable row level security;
alter table public.push_assinaturas enable row level security;
alter table public.push_preferencias enable row level security;
alter table public.push_fila enable row level security;  -- sem políticas: só o service_role (Edge Function) acessa
alter table public.caixa_lancamentos enable row level security;

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
      and public.confirmacao_aberta(jogo_id)
    )
  );
drop policy if exists presencas_update on public.presencas;
create policy presencas_update on public.presencas for update to authenticated
  using (public.is_admin() or jogador_id = public.meu_jogador_id())
  with check (
    public.is_admin() or (
      jogador_id = public.meu_jogador_id()
      and exists (select 1 from public.jogos j where j.id = jogo_id and j.status = 'agendado')
      and public.confirmacao_aberta(jogo_id)
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

-- convidados: membros veem; cada jogador convida (jogo agendado e confirmação aberta); remoção via RPC
drop policy if exists convidados_select on public.convidados;
create policy convidados_select on public.convidados for select to authenticated
  using (public.is_membro());
drop policy if exists convidados_insert on public.convidados;
create policy convidados_insert on public.convidados for insert to authenticated
  with check (
    public.is_admin() or (
      convidado_por = public.meu_jogador_id()
      and exists (select 1 from public.jogos j where j.id = jogo_id and j.status = 'agendado')
      and public.confirmacao_aberta(jogo_id)
    )
  );
drop policy if exists convidados_admin on public.convidados;
create policy convidados_admin on public.convidados for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists convidados_delete on public.convidados;
create policy convidados_delete on public.convidados for delete to authenticated
  using (public.is_admin());

-- caixa: todos os membros leem os lançamentos avulsos; só admin escreve
drop policy if exists caixa_select on public.caixa_lancamentos;
create policy caixa_select on public.caixa_lancamentos for select to authenticated
  using (public.is_membro());
drop policy if exists caixa_admin on public.caixa_lancamentos;
create policy caixa_admin on public.caixa_lancamentos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- avisos avulsos e config do time: membros leem; só admin escreve
drop policy if exists avisos_select on public.avisos_avulsos;
create policy avisos_select on public.avisos_avulsos for select to authenticated
  using (public.is_membro());
drop policy if exists avisos_admin on public.avisos_avulsos;
create policy avisos_admin on public.avisos_avulsos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists config_select on public.config_time;
create policy config_select on public.config_time for select to authenticated
  using (public.is_membro());
drop policy if exists config_admin on public.config_time;
create policy config_admin on public.config_time for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- push: cada jogador gerencia só os próprios dispositivos e preferências
drop policy if exists push_assinaturas_own on public.push_assinaturas;
create policy push_assinaturas_own on public.push_assinaturas for all to authenticated
  using (jogador_id = public.meu_jogador_id()) with check (jogador_id = public.meu_jogador_id());
drop policy if exists push_preferencias_own on public.push_preferencias;
create policy push_preferencias_own on public.push_preferencias for all to authenticated
  using (jogador_id = public.meu_jogador_id()) with check (jogador_id = public.meu_jogador_id());

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
-- tipo: 'mensalidade' (por mês), 'avulso' (por jogo) ou 'convidado' (por convidado; jogador = quem convidou).
drop function if exists public.marcar_pagamento(uuid, text, date, uuid, numeric, boolean);
create or replace function public.marcar_pagamento(
  p_jogador_id uuid,
  p_tipo text,
  p_competencia date,
  p_jogo_id uuid,
  p_valor numeric,
  p_pago boolean,
  p_convidado_id uuid default null
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
  elsif p_tipo = 'convidado' then
    if p_convidado_id is null then
      raise exception 'Informe o convidado';
    end if;
    select id into v_id from public.pagamentos where tipo = 'convidado' and convidado_id = p_convidado_id;
  else
    raise exception 'Tipo de pagamento inválido';
  end if;

  if v_id is null then
    insert into public.pagamentos (jogador_id, tipo, competencia, jogo_id, convidado_id, valor, pago, pago_em)
    values (p_jogador_id, p_tipo, v_comp, case when p_tipo <> 'mensalidade' then p_jogo_id end,
            case when p_tipo = 'convidado' then p_convidado_id end,
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
      cross join lateral (
        select e ->> 'id' as pid from jsonb_array_elements(g.sorteio -> g.time_vencedor) e
        union all
        select r #>> '{}' from jsonb_array_elements(coalesce(g.sorteio -> ('reservas_' || g.time_vencedor), '[]'::jsonb)) r
      ) x
      join public.jogadores j on j.id::text = x.pid
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

-- Marca como realizados os jogos que já passaram e tiveram confirmados; o trigger abre a votação do craque.
-- O app chama isto ao abrir (qualquer membro). Para rodar sem depender do app, veja o pg_cron no fim do arquivo.
create or replace function public.processar_jogos()
returns int language plpgsql security definer set search_path = public as $$
declare
  v int;
begin
  if not public.is_membro() then
    return 0;
  end if;
  update public.jogos g
     set status = 'realizado'
   where g.status = 'agendado'
     and g.data < (now() at time zone 'America/Sao_Paulo')::date
     and exists (select 1 from public.presencas p where p.jogo_id = g.id and p.status = 'confirmado');
  get diagnostics v = row_count;
  return v;
end;
$$;

-- (interna) tira um participante (jogador ou 'c_<id do convidado>') do sorteio salvo do jogo.
create or replace function public._tirar_do_sorteio(p_jogo_id uuid, p_id text)
returns void language sql security definer set search_path = public as $$
  update public.jogos g
     set sorteio = (
       select jsonb_object_agg(
         t.k,
         case when jsonb_typeof(t.v) = 'array'
              then coalesce((select jsonb_agg(e)
                               from jsonb_array_elements(t.v) e
                              where coalesce(e ->> 'id', e #>> '{}') <> p_id), '[]'::jsonb)
              else t.v end)
         from jsonb_each(g.sorteio) as t(k, v))
   where g.id = p_jogo_id and g.sorteio is not null;
$$;

-- Admin: marca quem confirmou mas não compareceu. Some das listas, do sorteio, da cobrança e da votação.
create or replace function public.remover_faltoso(p_jogo_id uuid, p_jogador_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem fazer isso';
  end if;
  insert into public.presencas (jogo_id, jogador_id, status)
  values (p_jogo_id, p_jogador_id, 'faltou')
  on conflict (jogo_id, jogador_id) do update set status = 'faltou', funcao = null;
  delete from public.votos where jogo_id = p_jogo_id and (eleitor_id = p_jogador_id or votado_id = p_jogador_id);
  delete from public.pagamentos where jogo_id = p_jogo_id and jogador_id = p_jogador_id and tipo = 'avulso' and not pago;
  perform public._tirar_do_sorteio(p_jogo_id, p_jogador_id::text);
end;
$$;

-- Remove um convidado: quem convidou (jogo ainda agendado) ou admin (a qualquer momento, ex.: não compareceu).
create or replace function public.remover_convidado(p_convidado_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.convidados;
begin
  select * into v from public.convidados where id = p_convidado_id;
  if not found then
    return;
  end if;
  if not (
    public.is_admin() or (
      v.convidado_por = public.meu_jogador_id()
      and exists (select 1 from public.jogos j where j.id = v.jogo_id and j.status = 'agendado')
    )
  ) then
    raise exception 'Sem permissão para remover este convidado';
  end if;
  delete from public.convidados where id = p_convidado_id;
  perform public._tirar_do_sorteio(v.jogo_id, 'c_' || v.id::text);
end;
$$;

-- Caixa do time (todos os membros, somente leitura): extrato de entradas e saídas.
create or replace function public.caixa_extrato(p_limite int default 200)
returns table (id text, data date, tipo text, descricao text, valor numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_membro() then
    raise exception 'Acesso negado';
  end if;
  return query
    select x.id, x.data, x.tipo, x.descricao, x.valor
      from (
        select 'p:' || p.id::text as id,
               (p.pago_em at time zone 'America/Sao_Paulo')::date as data,
               'entrada'::text as tipo,
               (case p.tipo
                  when 'mensalidade' then 'Mensalidade ' || to_char(p.competencia, 'MM/YYYY') || ' · ' || coalesce(nullif(j.apelido, ''), j.nome)
                  when 'avulso' then 'Jogo ' || to_char(g.data, 'DD/MM') || ' · ' || coalesce(nullif(j.apelido, ''), j.nome)
                  else 'Convidado ' || coalesce(c.nome, '?') || ' (de ' || coalesce(nullif(j.apelido, ''), j.nome) || ') · jogo ' || coalesce(to_char(g.data, 'DD/MM'), '')
                end)::text as descricao,
               p.valor as valor
          from public.pagamentos p
          join public.jogadores j on j.id = p.jogador_id
          left join public.jogos g on g.id = p.jogo_id
          left join public.convidados c on c.id = p.convidado_id
         where p.pago
        union all
        select 'l:' || l.id::text, l.data, l.tipo, l.descricao, l.valor
          from public.caixa_lancamentos l
      ) x
     order by x.data desc, x.id
     limit greatest(1, p_limite);
end;
$$;

create or replace function public.caixa_resumo()
returns table (entradas numeric, saidas numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_membro() then
    raise exception 'Acesso negado';
  end if;
  return query
    select
      coalesce((select sum(p.valor) from public.pagamentos p where p.pago), 0)
        + coalesce((select sum(l.valor) from public.caixa_lancamentos l where l.tipo = 'entrada'), 0),
      coalesce((select sum(l.valor) from public.caixa_lancamentos l where l.tipo = 'saida'), 0);
end;
$$;

-- Assiduidade: quem mais esteve presente (presença confirmada em jogos realizados) no ano.
create or replace function public.ranking_assiduidade(p_limite int default 5, p_ano int default null)
returns table (jogador_id uuid, nome text, apelido text, presencas bigint, total_jogos bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_ano int := coalesce(p_ano, extract(year from now())::int);
begin
  if not public.is_membro() then
    raise exception 'Acesso negado';
  end if;
  return query
    with jogos_ano as (
      select g.id from public.jogos g
       where g.status = 'realizado' and extract(year from g.data)::int = v_ano
    )
    select j.id, j.nome, j.apelido, count(*)::bigint, (select count(*) from jogos_ano)::bigint
      from public.presencas pr
      join jogos_ano ja on ja.id = pr.jogo_id
      join public.jogadores j on j.id = pr.jogador_id
     where pr.status = 'confirmado'
     group by j.id, j.nome, j.apelido
     order by count(*) desc, j.nome
     limit p_limite;
end;
$$;

-- Admin: encerra a partida de uma vez só (atômico): marca quem faltou, registra o placar e marca como realizado.
-- Com placar, o banco define o vencedor e a votação do craque abre automaticamente.
create or replace function public.encerrar_jogo(
  p_jogo_id uuid,
  p_faltosos uuid[] default '{}',
  p_convidados_faltosos uuid[] default '{}',
  p_placar_branco int default null,
  p_placar_preto int default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem encerrar o jogo';
  end if;
  if (p_placar_branco is null) <> (p_placar_preto is null) then
    raise exception 'Informe o placar dos dois times';
  end if;
  if not exists (select 1 from public.jogos where id = p_jogo_id and status <> 'cancelado') then
    raise exception 'Jogo não encontrado ou cancelado';
  end if;

  -- 1º os faltosos (antes de a votação abrir), 2º o placar/encerramento
  foreach v in array coalesce(p_faltosos, '{}') loop
    perform public.remover_faltoso(p_jogo_id, v);
  end loop;
  foreach v in array coalesce(p_convidados_faltosos, '{}') loop
    if exists (select 1 from public.convidados c where c.id = v and c.jogo_id = p_jogo_id) then
      perform public.remover_convidado(v);
    end if;
  end loop;

  update public.jogos
     set placar_branco = coalesce(p_placar_branco, placar_branco),
         placar_preto  = coalesce(p_placar_preto, placar_preto),
         status = case when status = 'agendado' then 'realizado' else status end
   where id = p_jogo_id;
end;
$$;

-- Quem já pagou (jogo ou mensalidade do mês do jogo): todos os membros veem o ✓ ao lado do nome.
-- Mostra só quem JÁ pagou; pendências continuam privadas.
create or replace function public.pagamentos_do_jogo(p_jogo_id uuid)
returns table (jogador_id uuid, convidado_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_membro() then
    raise exception 'Acesso negado';
  end if;
  return query
    select p.jogador_id, p.convidado_id
      from public.pagamentos p
      join public.jogos g on g.id = p_jogo_id
     where p.pago
       and ((p.tipo in ('avulso', 'convidado') and p.jogo_id = p_jogo_id)
         or (p.tipo = 'mensalidade' and p.competencia = date_trunc('month', g.data)::date));
end;
$$;

-- Goleiros menos vazados: média de gols sofridos por jogo, no ano.
--  * gols sofridos = placar do time adversário nos jogos em que o jogador ficou na vaga de goleiro (GOL) do sorteio;
--  * só contam jogos realizados, com placar e com sorteio salvo;
--  * mínimo de jogos: p_minimo_pct (30%) do total de jogos do ano com placar e sorteio;
--  * ordem pela MÉDIA AJUSTADA = (gols + p_peso * média geral dos goleiros) / (jogos + p_peso):
--    com poucos jogos a média puxa para a média geral, então, quando a diferença é pequena,
--    quem jogou mais fica acima (p_peso = quantos "jogos de dúvida" cada média ganha).
create or replace function public.ranking_goleiros(
  p_limite int default 5,
  p_ano int default null,
  p_minimo_pct numeric default 0.30,
  p_peso numeric default 3
)
returns table (
  jogador_id uuid, nome text, apelido text,
  jogos bigint, gols_sofridos bigint, media numeric, media_ajustada numeric,
  total_jogos bigint, minimo_jogos int
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_ano int := coalesce(p_ano, extract(year from now())::int);
  v_total bigint;
  v_min int;
  v_media_geral numeric;
begin
  if not public.is_membro() then
    raise exception 'Acesso negado';
  end if;

  select count(*) into v_total
    from public.jogos g
   where g.status = 'realizado' and g.placar_branco is not null and g.placar_preto is not null
     and g.sorteio is not null and extract(year from g.data)::int = v_ano;
  if v_total = 0 then
    return;
  end if;
  v_min := greatest(1, ceil(v_total * p_minimo_pct)::int);

  return query
    with jv as (
      select g.sorteio, g.placar_branco, g.placar_preto from public.jogos g
       where g.status = 'realizado' and g.placar_branco is not null and g.placar_preto is not null
         and g.sorteio is not null and extract(year from g.data)::int = v_ano
    ), atuacoes as (   -- uma linha por goleiro e jogo, com os gols que o time dele sofreu
      select e ->> 'id' as pid, jv.placar_preto::int as sofridos
        from jv, jsonb_array_elements(jv.sorteio -> 'branco') e where e ->> 'slot' = 'GOL'
      union all
      select e ->> 'id', jv.placar_branco::int
        from jv, jsonb_array_elements(jv.sorteio -> 'preto') e where e ->> 'slot' = 'GOL'
    ), por_jogador as (
      select j.id as jid, j.nome as jnome, j.apelido as japelido, count(*) as n, sum(a.sofridos) as gols
        from atuacoes a join public.jogadores j on j.id::text = a.pid   -- convidados ficam de fora
       group by j.id, j.nome, j.apelido
    ), geral as (
      select sum(pj.gols)::numeric / nullif(sum(pj.n), 0) as media_geral from por_jogador pj
    )
    select pj.jid, pj.jnome, pj.japelido, pj.n::bigint, pj.gols::bigint,
           round(pj.gols::numeric / pj.n, 2),
           round((pj.gols + p_peso * ge.media_geral) / (pj.n + p_peso), 2),
           v_total, v_min
      from por_jogador pj cross join geral ge
     where pj.n >= v_min
     order by (pj.gols + p_peso * ge.media_geral) / (pj.n + p_peso), pj.n desc, pj.jnome
     limit p_limite;
end;
$$;

-- Geração automática do próximo jogo: para cada pelada ativa com "gerar_proximo_dias_antes" definido, cria o jogo da
-- próxima data (do dia da semana da pelada, depois do último jogo existente) assim que faltarem N dias ou menos para ela.
-- Nunca gera jogo no passado nem recria um jogo cancelado (a data continua ocupada). O app chama isto ao abrir.
create or replace function public.gerar_jogos_automaticos()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_pel public.peladas;
  v_base date;
  v_data date;
  v_total int := 0;
  v_linhas int;
begin
  if not public.is_membro() then
    return 0;
  end if;

  for v_pel in select * from public.peladas where ativa and gerar_proximo_dias_antes is not null loop
    select greatest(coalesce(max(j.data), v_hoje - 1), v_hoje - 1) into v_base
      from public.jogos j where j.pelada_id = v_pel.id;

    for i in 1..8 loop
      -- próxima ocorrência do dia da semana, estritamente depois de v_base
      v_data := v_base + (((v_pel.dia_semana - extract(dow from v_base)::int + 6) % 7) + 1);
      exit when v_hoje < v_data - v_pel.gerar_proximo_dias_antes;
      insert into public.jogos (pelada_id, data, horario, local, valor)
      values (v_pel.id, v_data, v_pel.horario, v_pel.local, v_pel.valor_avulso)
      on conflict (pelada_id, data) do nothing;
      get diagnostics v_linhas = row_count;
      v_total := v_total + v_linhas;
      v_base := v_data;
    end loop;
  end loop;
  return v_total;
end;
$$;

-- ---------------------------------------------------------------------
-- NOTIFICAÇÕES PUSH
-- ---------------------------------------------------------------------

-- (interna) coloca uma notificação na fila, respeitando as preferências do jogador.
-- Não enfileira quem não tem nenhum aparelho inscrito. `chave` evita duplicar o mesmo aviso. Devolve 1 se enfileirou.
create or replace function public.push_enfileirar(
  p_jogador uuid, p_tipo text, p_titulo text, p_corpo text, p_url text, p_chave text
)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_linhas int;
  v_quer boolean;
begin
  if p_tipo <> 'teste' then
    if not exists (select 1 from public.push_assinaturas a where a.jogador_id = p_jogador) then
      return 0;
    end if;
    select case p_tipo
             when 'confirmacao_aberta' then pr.confirmacao_aberta
             when 'vaga_lista_espera'  then pr.vaga_lista_espera
             when 'lembrete_vespera'   then pr.lembrete_vespera
             when 'resultado_craque'   then pr.resultado_craque
             else true end
      into v_quer
      from public.push_preferencias pr where pr.jogador_id = p_jogador;
    if coalesce(v_quer, true) is false then
      return 0;
    end if;
  end if;

  insert into public.push_fila (jogador_id, tipo, titulo, corpo, url, chave)
  values (p_jogador, p_tipo, p_titulo, p_corpo, p_url, p_chave)
  on conflict (jogador_id, chave) do nothing;
  get diagnostics v_linhas = row_count;
  return v_linhas;
end;
$$;

-- Avisos por horário (chamada a cada minuto pela Edge Function "enviar-push"):
--  * confirmação aberta: a partir das 09:00 do dia em que abre, para quem ainda não respondeu;
--  * lembrete de véspera: 12 h antes do jogo, para quem está confirmado.
-- `p_agora` (horário de Brasília) existe só para testes. Devolve quantas notificações foram enfileiradas.
create or replace function public.push_gerar_agendados(p_agora timestamp default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_agora timestamp := coalesce(p_agora, now() at time zone 'America/Sao_Paulo');
  v_hoje date := v_agora::date;
  v_dias text[] := array['dom','seg','ter','qua','qui','sex','sáb'];
  v_n int := 0;
  v_quando text;
  g record;
  j record;
begin
  -- 1) confirmação de presença aberta
  if v_agora::time >= time '09:00' then
    for g in
      select ge.id, ge.data, ge.horario, ge.created_at, coalesce(ge.pelada_nome, 'Pelada') as nome, public.liberacao_confirmacao(ge.id) as lib
        from public.jogos ge
       where ge.status = 'agendado' and (ge.data + ge.horario) > v_agora
    loop
      -- só avisa quando acabou de abrir (hoje ou ontem); sem jogo anterior, vale desde a criação do jogo
      continue when not (
        (g.lib is not null and g.lib <= v_hoje and g.lib >= v_hoje - 1)
        or (g.lib is null and (g.created_at at time zone 'America/Sao_Paulo')::date >= v_hoje - 1)
      );
      for j in
        select jo.id from public.jogadores jo
         where jo.ativo and not exists (select 1 from public.presencas pr where pr.jogo_id = g.id and pr.jogador_id = jo.id)
      loop
        v_n := v_n + public.push_enfileirar(
          j.id, 'confirmacao_aberta', '⚽ Confirmação de presença aberta',
          format('%s · %s, %s às %s. Toque para responder.', g.nome, v_dias[extract(dow from g.data)::int + 1], to_char(g.data, 'DD/MM'), to_char(g.horario, 'HH24:MI')),
          '/jogo/' || g.id, 'conf:' || g.id);
      end loop;
    end loop;
  end if;

  -- 2) lembrete de véspera: de 12 h antes até o início do jogo
  for g in
    select ge.id, ge.data, ge.horario, ge.local, coalesce(ge.pelada_nome, 'Pelada') as nome
      from public.jogos ge
     where ge.status = 'agendado'
       and (ge.data + ge.horario) > v_agora
       and (ge.data + ge.horario) - interval '12 hours' <= v_agora
  loop
    v_quando := case when g.data = v_hoje then 'Hoje'
                     when g.data = v_hoje + 1 then 'Amanhã'
                     else v_dias[extract(dow from g.data)::int + 1] || ' ' || to_char(g.data, 'DD/MM') end;
    for j in select pr.jogador_id as id from public.presencas pr where pr.jogo_id = g.id and pr.status = 'confirmado' loop
      v_n := v_n + public.push_enfileirar(
        j.id, 'lembrete_vespera', format('⏰ %s tem jogo às %s', v_quando, to_char(g.horario, 'HH24:MI')),
        g.nome || coalesce(' · ' || g.local, '') || '. Você está confirmado — até lá!',
        '/jogo/' || g.id, 'vesp:' || g.id);
    end loop;
  end loop;

  -- limpeza: notificações enviadas há mais de 30 dias
  delete from public.push_fila where enviado_em is not null and enviado_em < now() - interval '30 days';
  return v_n;
end;
$$;

-- Votação encerrada com resultado pronto: avisa quem jogou quem foi o craque (só se houve voto).
create or replace function public.push_craque()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dias text[] := array['dom','seg','ter','qua','qui','sex','sáb'];
  v_nomes text;
  v_votos bigint;
  v_n int;
  v_quando text;
  v_corpo text;
  p record;
begin
  if not (old.votacao_aberta is true and new.votacao_aberta is false and new.status = 'realizado') then
    return null;
  end if;

  select string_agg(coalesce(nullif(j.apelido, ''), j.nome), ' e ' order by j.nome), max(c.n), count(*)
    into v_nomes, v_votos, v_n
    from (select v.votado_id, count(*) as n from public.votos v where v.jogo_id = new.id group by v.votado_id) c
    join (select max(z.n) as mx from (select count(*) as n from public.votos v where v.jogo_id = new.id group by v.votado_id) z) m on c.n = m.mx
    join public.jogadores j on j.id = c.votado_id;
  if v_nomes is null then
    return null;   -- ninguém votou: não há resultado para avisar
  end if;

  v_quando := v_dias[extract(dow from new.data)::int + 1] || ', ' || to_char(new.data, 'DD/MM');
  v_corpo := case when v_n > 1
    then format('%s empataram como craques do jogo de %s (%s %s cada).', v_nomes, v_quando, v_votos, case when v_votos = 1 then 'voto' else 'votos' end)
    else format('%s foi eleito craque do jogo de %s (%s %s).', v_nomes, v_quando, v_votos, case when v_votos = 1 then 'voto' else 'votos' end) end;

  for p in select pr.jogador_id from public.presencas pr where pr.jogo_id = new.id and pr.status = 'confirmado' loop
    perform public.push_enfileirar(p.jogador_id, 'resultado_craque', '🏆 Craque do jogo', v_corpo, '/jogo/' || new.id, 'craque:' || new.id);
  end loop;
  return null;
end;
$$;

drop trigger if exists jogos_push_craque on public.jogos;
create trigger jogos_push_craque
  after update of votacao_aberta on public.jogos
  for each row when (old.votacao_aberta is true and new.votacao_aberta is false)
  execute function public.push_craque();

-- App: registra (ou move para o jogador logado) o aparelho que aceitou as notificações.
create or replace function public.push_registrar(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_jogador uuid := public.meu_jogador_id();
begin
  if v_jogador is null then
    raise exception 'Acesso negado';
  end if;
  insert into public.push_assinaturas (jogador_id, endpoint, p256dh, auth, user_agent)
  values (v_jogador, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set jogador_id = excluded.jogador_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end;
$$;

-- App: envia uma notificação de teste para o próprio jogador (chega em até 1 minuto).
create or replace function public.push_teste()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_jogador uuid := public.meu_jogador_id();
begin
  if v_jogador is null then
    raise exception 'Acesso negado';
  end if;
  return public.push_enfileirar(v_jogador, 'teste', '🔔 Teste de notificação', 'Tudo certo! As notificações do FutSábado estão funcionando neste aparelho.', '/', 'teste:' || extract(epoch from clock_timestamp())::bigint);
end;
$$;

-- Admin: exclui a pelada (que é só um modelo). Jogos já realizados NUNCA são apagados: ficam no histórico, sem pelada.
-- Com p_apagar_proximos, apaga também os próximos jogos agendados (que ainda não começaram); sem ele, eles ficam.
create or replace function public.excluir_pelada(p_pelada_id uuid, p_apagar_proximos boolean default false)
returns table (jogos_apagados int, jogos_mantidos int)
language plpgsql security definer set search_path = public as $$
declare
  v_apagados int := 0;
  v_mantidos int;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem excluir peladas';
  end if;
  if not exists (select 1 from public.peladas where id = p_pelada_id) then
    raise exception 'Pelada não encontrada';
  end if;

  if p_apagar_proximos then
    delete from public.jogos
     where pelada_id = p_pelada_id and status = 'agendado'
       and (data + horario) > (now() at time zone 'America/Sao_Paulo');
    get diagnostics v_apagados = row_count;
  end if;

  select count(*) into v_mantidos from public.jogos where pelada_id = p_pelada_id;
  delete from public.peladas where id = p_pelada_id;   -- jogos restantes ficam (pelada_id vira nulo)
  return query select v_apagados, v_mantidos;
end;
$$;

-- Admin: aplica os dados ATUAIS da pelada (horário, local, valor, limite, nome, clima, isenção de goleiros) aos próximos
-- jogos agendados REGULARES (no dia da semana da pelada; jogos extras, em outros dias, não são alterados). Se o dia da semana mudou (p_dia_antigo), move cada jogo regular para o novo dia, no deslocamento mais
-- curto (de -3 a +3 dias), desde que a nova data seja futura e esteja livre. Jogos realizados nunca são tocados.
create or replace function public.sincronizar_jogos_da_pelada(p_pelada_id uuid, p_dia_antigo int default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_pel public.peladas;
  v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_n int := 0;
  v_nova date;
  g record;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem alterar jogos';
  end if;
  select * into v_pel from public.peladas where id = p_pelada_id;
  if not found then
    raise exception 'Pelada não encontrada';
  end if;

  for g in
    select j.id, j.data from public.jogos j
     where j.pelada_id = p_pelada_id and j.status = 'agendado' and (j.data + j.horario) > v_agora
       and extract(dow from j.data)::int = coalesce(p_dia_antigo, v_pel.dia_semana)   -- só jogos regulares; "jogos extras" ficam como estão
     order by j.data
  loop
    v_nova := g.data;
    if p_dia_antigo is not null and p_dia_antigo <> v_pel.dia_semana and extract(dow from g.data)::int = p_dia_antigo then
      v_nova := g.data + (((v_pel.dia_semana - p_dia_antigo + 10) % 7) - 3);
      if (v_nova + v_pel.horario) <= v_agora
         or exists (select 1 from public.jogos x where x.pelada_id = p_pelada_id and x.data = v_nova and x.id <> g.id) then
        v_nova := g.data;   -- não dá para mover (data passada ou ocupada): mantém a data
      end if;
    end if;

    update public.jogos
       set data = v_nova, horario = v_pel.horario, local = v_pel.local, valor = v_pel.valor_avulso,
           pelada_nome = v_pel.nome, limite_jogadores = v_pel.limite_jogadores, goleiros_isentos = v_pel.goleiros_isentos,
           latitude = v_pel.latitude, longitude = v_pel.longitude, cidade = v_pel.cidade
     where id = g.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Permissões de execução das funções
revoke execute on function public.gerar_jogos(uuid, int) from public, anon;
revoke execute on function public.resultado_votacao(uuid) from public, anon;
revoke execute on function public.total_votos(uuid) from public, anon;
revoke execute on function public.ranking_craques(int) from public, anon;
revoke execute on function public.ranking_vencedores(int) from public, anon;
revoke execute on function public.jogos_no_ano(int) from public, anon;
revoke execute on function public.marcar_pagamento(uuid, text, date, uuid, numeric, boolean, uuid) from public, anon;
revoke execute on function public.processar_jogos() from public, anon;
revoke execute on function public.excluir_pelada(uuid, boolean) from public, anon;
revoke execute on function public.sincronizar_jogos_da_pelada(uuid, int) from public, anon;
revoke execute on function public.jogo_limite_mudou() from public, anon, authenticated;
revoke execute on function public.jogo_copiar_da_pelada() from public, anon, authenticated;
revoke execute on function public.push_enfileirar(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.push_gerar_agendados(timestamp) from public, anon, authenticated;
revoke execute on function public.push_craque() from public, anon, authenticated;
revoke execute on function public.push_registrar(text, text, text, text) from public, anon;
revoke execute on function public.push_teste() from public, anon;
revoke execute on function public.gerar_jogos_automaticos() from public, anon;
revoke execute on function public._tirar_do_sorteio(uuid, text) from public, anon, authenticated;
revoke execute on function public.promover_espera(uuid) from public, anon, authenticated;
revoke execute on function public.vagas_ocupadas(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.remover_faltoso(uuid, uuid) from public, anon;
revoke execute on function public.encerrar_jogo(uuid, uuid[], uuid[], int, int) from public, anon;
revoke execute on function public.pagamentos_do_jogo(uuid) from public, anon;
revoke execute on function public.remover_convidado(uuid) from public, anon;
revoke execute on function public.caixa_extrato(int) from public, anon;
revoke execute on function public.caixa_resumo() from public, anon;
revoke execute on function public.ranking_assiduidade(int, int) from public, anon;
revoke execute on function public.ranking_goleiros(int, int, numeric, numeric) from public, anon;
revoke execute on function public.liberacao_confirmacao(uuid) from public, anon;
revoke execute on function public.confirmacao_aberta(uuid) from public, anon;
grant execute on function public.gerar_jogos(uuid, int) to authenticated;
grant execute on function public.resultado_votacao(uuid) to authenticated;
grant execute on function public.total_votos(uuid) to authenticated;
grant execute on function public.ranking_craques(int) to authenticated;
grant execute on function public.ranking_vencedores(int) to authenticated;
grant execute on function public.jogos_no_ano(int) to authenticated;
grant execute on function public.marcar_pagamento(uuid, text, date, uuid, numeric, boolean, uuid) to authenticated;
grant execute on function public.processar_jogos() to authenticated;
grant execute on function public.excluir_pelada(uuid, boolean) to authenticated;
grant execute on function public.sincronizar_jogos_da_pelada(uuid, int) to authenticated;
grant execute on function public.push_registrar(text, text, text, text) to authenticated;
grant execute on function public.push_teste() to authenticated;
grant execute on function public.gerar_jogos_automaticos() to authenticated;
grant execute on function public.remover_faltoso(uuid, uuid) to authenticated;
grant execute on function public.encerrar_jogo(uuid, uuid[], uuid[], int, int) to authenticated;
grant execute on function public.pagamentos_do_jogo(uuid) to authenticated;
grant execute on function public.remover_convidado(uuid) to authenticated;
grant execute on function public.caixa_extrato(int) to authenticated;
grant execute on function public.caixa_resumo() to authenticated;
grant execute on function public.ranking_assiduidade(int, int) to authenticated;
grant execute on function public.ranking_goleiros(int, int, numeric, numeric) to authenticated;
grant execute on function public.liberacao_confirmacao(uuid) to authenticated;
grant execute on function public.confirmacao_aberta(uuid) to authenticated;

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

-- ---------------------------------------------------------------------
-- OPCIONAL: processar jogos passados todo dia às 03:00 (Brasília ≈ 06:00 UTC), sem depender do app.
-- ---------------------------------------------------------------------
-- select cron.schedule('futsabado-processar-jogos', '0 6 * * *', $$
--   update public.jogos g set status = 'realizado'
--    where g.status = 'agendado'
--      and g.data < (now() at time zone 'America/Sao_Paulo')::date
--      and exists (select 1 from public.presencas p where p.jogo_id = g.id and p.status = 'confirmado');
-- $$);
