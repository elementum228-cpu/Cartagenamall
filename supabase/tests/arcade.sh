#!/usr/bin/env bash
# Aplica 0001, 0002, 0026, 0027 y 0028 en un Postgres local vacío y recorre las reglas del Arcade: partidas verificadas, topes, ranking
# semanal, podio y premios, descalificaciones y permisos.
# Uso: PGPASSWORD=postgres ./arcade.sh [host] [usuario] [puerto]
set -euo pipefail
HOST="${1:-127.0.0.1}"
U="${2:-postgres}"
PORT="${3:-5432}"
DB=arcade_test
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
P="psql -h $HOST -p $PORT -U $U"
$P -q -c "drop database if exists $DB;" -c "create database $DB;"
$P -d "$DB" -q -v ON_ERROR_STOP=1 \
  -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if; end \$\$;" \
  -c "grant usage on schema public to anon, authenticated, service_role;" -f "$DIR/stub_auth_local.sql" >/dev/null
for f in 0001_cartagena_mall.sql 0002_mall_settings.sql 0026_arcade_ranking.sql 0027_arcade_verificado_y_premios.sql 0028_arcade_historial_y_semana.sql; do
  $P -d "$DB" -q -v ON_ERROR_STOP=1 -f "$DIR/../migrations/$f" >/dev/null 2>&1 || { echo "FALLÓ la migración $f"; $P -d "$DB" -q -v ON_ERROR_STOP=1 -f "$DIR/../migrations/$f" 2>&1 | tail -3; exit 1; }
done
$P -d "$DB" -f "$DIR/arcade.sql" 2>&1 | grep -E "NOTICE|ERROR" | sed 's/.*NOTICE:  //'
