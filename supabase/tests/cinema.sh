#!/usr/bin/env bash
# Aplica solo lo necesario (0001, 0002 y 0025) y prueba las reglas de acceso de los horarios de cine contra un Postgres local.
# Uso: PGPASSWORD=postgres ./cinema.sh [host] [usuario]
set -euo pipefail
HOST="${1:-127.0.0.1}"
U="${2:-postgres}"
DB=cinema_test
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
psql -h "$HOST" -U "$U" -q -c "drop database if exists $DB;" -c "create database $DB;"
psql -h "$HOST" -U "$U" -d "$DB" -q -v ON_ERROR_STOP=1 \
  -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end \$\$;" \
  -c "grant usage on schema public to anon, authenticated;" -f "$DIR/stub_auth_local.sql" >/dev/null
for f in 0001_cartagena_mall.sql 0002_mall_settings.sql 0025_cinema_showtimes.sql; do
  psql -h "$HOST" -U "$U" -d "$DB" -q -v ON_ERROR_STOP=1 -f "$DIR/../migrations/$f" >/dev/null 2>&1
done
psql -h "$HOST" -U "$U" -d "$DB" -q -v ON_ERROR_STOP=1 -f "$DIR/cinema.sql" 2>&1 | grep -E "NOTICE|ERROR" | sed 's/.*NOTICE:  //'
