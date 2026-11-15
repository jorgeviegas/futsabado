#!/usr/bin/env bash
# =====================================================================
# FutSábado - BACKUP DO BANCO (Supabase)
#
# Gera, em backups/, um arquivo .sql.gz com TODOS OS DADOS do app (schema "public": jogadores, jogos, presenças,
# votos, pagamentos, caixa, avisos, assinaturas de push...) e, junto, as contas de login (auth.users / auth.identities)
# em outro arquivo. A ESTRUTURA não entra: ela é o supabase/schema.sql do repositório. Mantém só os N mais recentes.
#
# Uso:
#   export SUPABASE_DB_URL='postgresql://postgres.<REF>:<SENHA>@aws-0-<regiao>.pooler.supabase.com:5432/postgres'
#   ./scripts/backup.sh                # grava em ./backups
#   ./scripts/backup.sh /caminho/dir   # grava em outra pasta (ex.: pasta do Google Drive/Dropbox)
#
# A string de conexão está no Supabase: Connect → "Session pooler" (funciona em redes só IPv4; a conexão direta exige IPv6).
# Troque [YOUR-PASSWORD] pela senha do banco (Project Settings → Database → Reset database password, se não lembrar).
#
# Requisito: pg_dump com versão IGUAL OU MAIOR que a do Postgres do projeto (Supabase usa 15 ou 17).
#   macOS: brew install libpq && brew link --force libpq   |   Ubuntu: sudo apt install postgresql-client
#
# ⚠️  O backup contém dados pessoais (e-mails, telefones, hashes de senha). Guarde em local privado e NUNCA o
#     envie para um repositório público.
# =====================================================================
set -euo pipefail

DESTINO="${1:-backups}"
MANTER="${MANTER:-12}"   # quantos backups guardar (padrão: 12)

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Defina SUPABASE_DB_URL (veja o cabeçalho deste arquivo)." >&2
  exit 1
fi
if ! command -v pg_dump >/dev/null; then
  echo "pg_dump não encontrado. Instale o cliente do PostgreSQL (veja o cabeçalho)." >&2
  exit 1
fi

mkdir -p "$DESTINO"
trap 'rm -f "$DESTINO"/*.tmp' EXIT   # não deixa arquivo pela metade se algo falhar
CARIMBO="$(date +%Y-%m-%d_%H%M%S)"
APP="$DESTINO/futsabado_${CARIMBO}.sql.gz"
AUTH="$DESTINO/futsabado_${CARIMBO}_contas.sql.gz"

echo "→ Exportando dados do app (schema public)…"
pg_dump "$SUPABASE_DB_URL" --data-only --schema=public --no-owner --no-privileges \
  | gzip -9 > "$APP.tmp"
mv "$APP.tmp" "$APP"

echo "→ Exportando contas de login (auth.users, auth.identities)…"
pg_dump "$SUPABASE_DB_URL" --data-only --no-owner --no-privileges --table=auth.users --table=auth.identities \
  | gzip -9 > "$AUTH.tmp"
mv "$AUTH.tmp" "$AUTH"

# retenção: apaga os mais antigos além de MANTER (de cada tipo)
for padrao in 'futsabado_*[0-9].sql.gz' 'futsabado_*_contas.sql.gz'; do
  # shellcheck disable=SC2012
  ls -1t "$DESTINO"/$padrao 2>/dev/null | tail -n +"$((MANTER + 1))" | xargs -r rm -f --
done

echo "✅ Backup pronto:"
ls -lh "$APP" "$AUTH" | awk '{print "   " $5 "  " $9}'
echo
cat <<TXT
Para restaurar (projeto Supabase novo ou esvaziado):
  1) Rode o supabase/schema.sql no SQL Editor (cria a estrutura e as permissões).
  2) Carregue as contas e os dados (a sessão desliga os gatilhos para não duplicar cadastros):
       export PGOPTIONS='-c session_replication_role=replica'
       gunzip -c ${AUTH##*/} | psql "\$SUPABASE_DB_URL"
       gunzip -c ${APP##*/}  | psql "\$SUPABASE_DB_URL"
  3) Reative o push se necessário (supabase/push_cron.sql) e confira o app.
TXT
