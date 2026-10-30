#!/usr/bin/env bash
# Aplica las migraciones y prueba las reglas de acceso contra un Postgres local (no Supabase),
# con un esquema auth/storage mínimo que imita el de Supabase. Uso: PGPASSWORD=postgres ./run.sh
set -euo pipefail
HOST="${1:-127.0.0.1}"
U="${2:-postgres}"
DB=mall_test
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
psql -h "$HOST" -U "$U" -q -v ON_ERROR_STOP=1 -c "
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end \$\$;"
psql -h "$HOST" -U "$U" -q -c "drop database if exists $DB;" -c "create database $DB;"
psql -h "$HOST" -U "$U" -d "$DB" -q -v ON_ERROR_STOP=1 -c "grant usage on schema public to anon, authenticated;" -f "$DIR/stub_auth_local.sql"
for f in "$DIR"/../migrations/*.sql; do
  echo "-- aplicando $(basename "$f")"
  psql -h "$HOST" -U "$U" -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f"
done
psql -h "$HOST" -U "$U" -d "$DB" -q -v ON_ERROR_STOP=1 -f "$DIR/rls.sql"
psql -h "$HOST" -U "$U" -q -c "drop database if exists $DB;"
