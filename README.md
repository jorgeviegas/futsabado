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

## Fluxo de uso

1. **Peladas** (admin): crie “Pelada de Sábado” (dia, horário, local, limite, valores) e toque em *Gerar próximas 4 semanas*.
   Opcional: agende a geração automática semanal com `pg_cron` (exemplo comentado no fim do `schema.sql`).
2. **Jogos**: cada jogador responde *Vou / Talvez / Não vou*. O limite de jogadores é respeitado.
3. Após a partida, o admin toca em **Encerrar e abrir votação**; confirmados votam no craque (voto secreto).
   O admin encerra a votação e o resultado aparece para todos. O ranking de craques fica na aba *🏆 Craques*.
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
