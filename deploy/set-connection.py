#!/usr/bin/env python3
"""Ejecutar SOLO en Backend. Lee la contraseña localmente sin mostrarla ni registrarla."""
import getpass, os
from pathlib import Path

def quote(value):
    # Valor de connection string Npgsql entre comillas dobles.
    return '"'+value.replace('"','""')+'"'

password = getpass.getpass('Contraseña existente de inventario_app (entrada oculta): ')
if not password or '\n' in password or '\r' in password or '\x00' in password:
    raise SystemExit('Contraseña vacía o no compatible con EnvironmentFile.')
connection='Host=10.77.55.4;Port=5432;Database=inventario_db;Username=inventario_app;Password='+quote(password)+';Timeout=5;Command Timeout=15;Include Error Detail=false'
# Escape separado para systemd EnvironmentFile, sin expansión de shell.
environment='ConnectionStrings__Inventory="'+connection.replace('\\','\\\\').replace('"','\\"')+'"\n'
directory=Path.home()/'.config/inventario'
directory.mkdir(mode=0o700,parents=True,exist_ok=True)
destination=directory/'backend.env'
if destination.exists():
    raise SystemExit('Ya existe backend.env. Revíselo localmente; no se sobrescribe automáticamente.')
fd=os.open(destination,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f: f.write(environment)
print('Conexión guardada con permisos 0600; no se muestra el contenido. Reinicie el servicio.')
