# ⚽ FutSábado

App (PWA) para gerenciar as peladas do time: **elenco, peladas semanais recorrentes, confirmação de presença,
votação do craque do jogo e financeiro** (mensalidades e avulsos). Cores: grená e preto.

**Stack:** React 19 + TypeScript + Vite · TanStack Query · React Router (HashRouter) · Supabase (Postgres + Auth + RLS) ·
vite-plugin-pwa (instalável, funciona offline para o app shell) · deploy via GitHub Actions → GitHub Pages.

## Como funciona o acesso

- Qualquer pessoa cria conta (e-mail + senha). A conta fica **pendente** até um admin aprovar em *Elenco*.
- O **primeiro usuário** a criar conta vira administrador automaticamente.
- Se o admin pré-cadastrar um jogador com o mesmo e-mail, a conta é vinculada e já entra aprovada.
- **Admins**: gerenciam elenco, peladas/jogos, abrem/encerram votação, marcam presença de terceiros e pagamentos.
- **Jogadores**: confirmam a própria presença, votam (voto secreto) e veem o próprio financeiro.
- A segurança é garantida por **Row Level Security** no banco (`supabase/schema.sql`), não só pela interface.

## 1. Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, cole e execute todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql).
3. Em **Authentication → Providers → Email**, deixe e-mail/senha ativo. Para entrar sem confirmar e-mail
   (mais simples para um grupo de amigos), desative *Confirm email*.
4. Em **Authentication → URL Configuration**, defina *Site URL* como a URL do GitHub Pages
   (`https://SEU-USUARIO.github.io/NOME-DO-REPO/`).
5. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**
   (ela é pública por design; quem protege os dados é o RLS. **Nunca** use a `service_role` no front-end).

## 2. Rodar localmente

```bash
cp .env.example .env     # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## 3. Publicar no GitHub Pages

1. Crie o repositório no GitHub e envie o código (branch `main`).
2. Em **Settings → Secrets and variables → Actions**, crie os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Em **Settings → Pages**, em *Source* escolha **GitHub Actions**.
4. A cada push na `main`, o workflow `.github/workflows/deploy.yml` faz o build e publica em
   `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

O `BASE_PATH` é definido automaticamente pelo workflow com o nome do repositório.

## 4. Instalar como app

Abra a URL no celular → Chrome: **Instalar app / Adicionar à tela inicial** · iPhone (Safari): **Compartilhar → Adicionar à Tela de Início**.

## Posições, camisa e sorteio (fut7)

- No **primeiro login** o jogador escolhe a posição primária e a secundária tocando numa quadra em miniatura
  (Goleiro, Zagueiro, Ala, Meia, Atacante) e pode informar o **número da camisa** (fixo: não repete entre jogadores).
  Onde há camisa, o Elenco mostra o número no lugar das iniciais.
- **Sorteio** (admin, na tela do jogo): divide os confirmados em *Time Preto* (camisa com listra vertical grená) e *Time Branco* (off-white com listrado fino grená) equilibrando as posições
  e monta a escalação 2-3-1 num diagrama tático. Cada vaga usa a posição primária, depois a secundária; quem sobrar
  joga fora de posição (marcado em amarelo).
- Com **mais de 14 confirmados**, os titulares são escolhidos **pela posição**: cada vaga da formação (2 goleiros, 4 zagueiros,
  4 alas, 2 meias, 2 atacantes) vai primeiro para quem joga naquela posição, depois para quem a tem como secundária, e só
  então para quem sobrar. O **número de jogos no ano é só desempate** entre jogadores da mesma posição disputando a mesma
  vaga (entra quem tem mais jogos; depois, sorteio). **Todos os confirmados entram nos times**: quem passa de 14 fica no
  *banco* de um dos times (bancos equilibrados). Goleiros usam camisa verde listrada e 🧤 nas listas. Para inverter (rodízio), troque `PRIORIDADE_PARA_QUEM_MAIS_JOGOU`
  em `src/lib/sorteio.ts`.
- **Rankings** (aba própria): top 5 de craques e top 5 de maiores vencedores. Vitórias contam em jogos sorteados em que
  o admin informou o *time vencedor* (Editar jogo).

> Se você já tinha rodado o `schema.sql` antes, rode-o de novo: ele é idempotente e aplica as novas colunas e funções.

## Avisos, goleiros e valores

- **Quadro de avisos** (topo da tela *Jogos*): lembrete de **votar no craque** após o jogo ser encerrado, jogos
  para **confirmar presença** e, para admins, jogos passados para encerrar, votações para fechar, cadastros
  para aprovar e falta de próximos jogos.
- **Goleiro com posição secundária** escolhe, ao confirmar presença, se joga **no gol ou na linha**. O sorteio
  respeita: quem vai para a linha é sorteado na posição secundária.
- **Valor individual por jogo**: definido na pelada (copiado para cada jogo gerado) e ajustável em *Editar jogo*
  ou ao criar um jogo extra. No Financeiro, cada **avulso que jogou** (presença confirmada em jogo realizado)
  fica devendo o valor daquele jogo. Mensalistas pagam a mensalidade.
- Todo jogador novo entra como **avulso**; apenas administradores alteram para mensalista.

## Jogos, convidados e caixa

- **Aba Jogos:** mostra só o *próximo jogo* e o *jogo anterior*. **Resultados** lista os jogos realizados com o placar
  no formato "Branco 5 x 9 Preto". O admin registra o placar em *Editar jogo*.
- **Confirmação de presença:** abre N dias depois do jogo anterior (configurável na pelada; padrão 2 = segunda-feira
  para jogos de sábado). Antes disso o jogador vê a data de abertura; admins confirmam a qualquer momento.
  O aviso "Confirme sua presença" só aparece quando a confirmação abre.
- **Votação do craque automática:** ao abrir o app, jogos que já passaram (com confirmados) viram *realizados* e a
  votação abre sozinha; registrar o placar também marca o jogo como realizado e abre a votação. Antes disso, o admin
  pode remover quem **não compareceu** ("Quem não compareceu?" na tela do jogo): some do sorteio, da cobrança, da
  votação e do ranking de assiduidade. O admin encerra a votação para revelar o craque.
- **Encerrar a partida (admin):** o botão "Encerrar jogo" abre uma tela que pede o **placar** e a lista de jogadores para
  marcar os **faltantes**; tudo é gravado de uma vez e a votação do craque abre sozinha. Depois do jogo, a tela mostra só
  as informações, o placar com as **escalações lado a lado** (✓ ao lado de quem já pagou) e a votação.
- **Convidados:** qualquer jogador convida um avulso (nome e posição opcional) enquanto o jogo está agendado. O
  convidado ocupa vaga, entra no sorteio e paga o mesmo valor; quem convidou fica responsável pelo pagamento.
- **Lista de espera:** com o jogo cheio, quem toca em "Vou" entra na lista de espera (botão âmbar, com a posição na
  fila). Se alguém deixar de confirmar, o primeiro da fila entra sozinho — feito no banco, então vale também para
  convidado removido, jogador marcado como "faltou" e aumento do limite de jogadores. Admins podem ultrapassar o limite.
- **Goleiros isentos:** opção na pelada. Quem jogou no gol não paga aquele jogo (vale a vaga de goleiro do sorteio; sem
  sorteio, vale o goleiro de posição que não avisou que jogaria na linha). Só afeta cobranças por jogo (avulsos e convidados).
- **Financeiro:** todos veem o *Caixa do time* (saldo, entradas e saídas) em somente leitura e as próprias pendências.
  Admins têm ainda *Cobranças* (confirmar/desfazer pagamentos de todos, de qualquer mês do ano) e *Lançar* (entradas e
  saídas avulsas). Pagamentos confirmados entram no caixa automaticamente.
- **Clima:** o admin define a cidade da pelada (busca pela Open-Meteo, gratuita e sem chave) e cada próximo jogo mostra
  a temperatura e a condição do tempo previstas para a hora marcada, até 15 dias à frente.
- **Rankings:** top 5 de craques, de maiores vencedores e de **assiduidade** (mais presenças no ano).

## Fluxo de uso

1. **Peladas** (admin): crie “Pelada de Sábado” (dia, horário, local, limite, valores) e toque em *Gerar próximas 4 semanas*.
   Opcional: agende a geração automática semanal com `pg_cron` (exemplo comentado no fim do `schema.sql`).
2. **Jogos**: cada jogador responde *Vou / Talvez / Não vou*. O limite de jogadores é respeitado.
3. Após a partida, o admin toca em **Encerrar e abrir votação**; confirmados votam no craque (voto secreto).
   O admin encerra a votação e o resultado aparece para todos. O ranking de craques fica na aba *Rankings*.
4. **Financeiro**: mensalistas têm uma cobrança por mês; avulsos, uma por jogo em que confirmaram.
   O admin marca *pago* com um toque; cada jogador vê apenas a própria situação.

## Estrutura

```
src/
  lib/        supabase.ts · auth.tsx · api.ts (hooks TanStack Query) · types.ts · format.ts
  pages/      Jogos · JogoDetalhe · Jogadores · Peladas · Financeiro · Login · Pendente
  components/ Layout · ui
supabase/schema.sql   tabelas, RLS, triggers e funções RPC
scripts/gen-icons.py regenera logo e ícones PNG a partir de assets/logo-original.webp
```

## Scripts

`npm run dev` · `npm run build` · `npm run preview` · `npm run lint`
