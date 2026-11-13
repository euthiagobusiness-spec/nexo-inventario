#!/usr/bin/env bash
# Acción administrativa pendiente. No se ejecutó durante la implementación.
# Ejecutar tras revisar y aprobar: sudo bash deploy/prepare-database.sh
# Usa los roles y el banco existentes; NO cambia contraseñas ni pg_hba/listen_addresses.
set -euo pipefail
if [ "$(id -u)" != 0 ]; then printf '%s\n' 'Requiere administrador; no se intenta otro mecanismo.' >&2; exit 1; fi
project_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d inventario_db -tAc "SELECT 1 FROM pg_roles WHERE rolname='inventario_app'" | grep -qx 1 || { printf '%s\n' 'Falta el rol inventario_app; revise la infraestructura.' >&2; exit 1; }
backup_dir="/var/backups/inventario-mvp/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 700 -o postgres -g postgres "$backup_dir"
runuser -u postgres -- pg_dump -Fc -d inventario_db -f "$backup_dir/before-schema.dump"
# psql lee por stdin: no hace falta ampliar permisos del directorio del usuario.
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d inventario_db < "$project_dir/db/001_schema.sql"
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d inventario_db <<'SQL'
GRANT CONNECT ON DATABASE inventario_db TO inventario_app;
GRANT USAGE ON SCHEMA inventario_mvp TO inventario_app;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA inventario_mvp TO inventario_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA inventario_mvp TO inventario_app;
SQL
printf '%s\n' 'Esquema v1 aplicado; copia previa creada. Configuración privada de red aún pendiente de revisión.'
