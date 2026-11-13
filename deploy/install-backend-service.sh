#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" != 0 ] || [ "$(hostname)" != ubuntu-backend ]; then
    printf '%s\n' 'Ejecutar como administrador únicamente en ubuntu-backend.' >&2; exit 1
fi
base=/home/inventario/inventario-mvp
test -f "$base/publish/Inventario.Api.dll"
test -f /home/inventario/.config/inventario/backend.env
if [ -e /etc/systemd/system/inventario-mvp.service ]; then
    cp -a /etc/systemd/system/inventario-mvp.service "$base/artifacts/system-service-before-$(date -u +%Y%m%dT%H%M%SZ).service"
fi
install -m 644 "$base/deploy/inventario-mvp.service" /etc/systemd/system/inventario-mvp.service
systemctl daemon-reload
systemctl --user -M inventario@.host disable --now inventario-mvp
if ! systemctl enable --now inventario-mvp; then
    systemctl --user -M inventario@.host enable --now inventario-mvp
    printf '%s\n' 'Falló la unidad de sistema. Servicio de usuario restaurado.' >&2
    exit 1
fi
systemctl is-active inventario-mvp
systemctl is-enabled inventario-mvp
