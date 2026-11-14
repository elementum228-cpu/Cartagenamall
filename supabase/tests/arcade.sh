#!/usr/bin/env bash
# Aplica la migración 0026 (ranking del Arcade) en un Postgres local vacío y recorre sus reglas: topes, frecuencia, limpieza del apodo y permisos.
# Uso: PGPASSWORD=postgres ./arcade.sh [host] [usuario]
set -euo pipefail
HOST="${1:-127.0.0.1}"
U="${2:-postgres}"
DB=arcade_test
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
psql -h "$HOST" -U "$U" -q -c "drop database if exists $DB;" -c "create database $DB;"
psql -h "$HOST" -U "$U" -d "$DB" -q -v ON_ERROR_STOP=1 \
  -c "create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;" \
  -f "$DIR/../migrations/0026_arcade_ranking.sql"
psql -h "$HOST" -U "$U" -d "$DB" -f "$DIR/arcade.sql" 2>&1 | grep -v '^$'
