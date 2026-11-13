#!/usr/bin/env python3
"""Administración exclusiva de ubuntu-database. Nunca imprime credenciales."""
import os, pathlib, pwd, secrets, shutil, socket, subprocess
from datetime import datetime, timezone

if os.geteuid() != 0 or socket.gethostname() != 'ubuntu-database':
    raise SystemExit('Ejecutar como administrador únicamente en ubuntu-database.')
project = pathlib.Path('/home/inventario/inventario-mvp')
def sql(statement, database='inventario_db'):
    result = subprocess.run(['runuser','-u','postgres','--','psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-d',database],
        input=statement, text=True, capture_output=True)
    if result.returncode:
        raise SystemExit('Falló una operación PostgreSQL. Revise el estado localmente. No se imprime SQL sensible.')
    return result.stdout.strip()

if sql("SELECT count(*) FROM pg_roles WHERE rolname='inventario_app' AND NOT rolsuper") != '1':
    raise SystemExit('Rol esperado inexistente o con privilegios incompatibles.')
backup = pathlib.Path('/var/backups/inventario-mvp')/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
backup.mkdir(parents=True,mode=0o700)
postgres = pwd.getpwnam('postgres')
os.chown(backup,postgres.pw_uid,postgres.pw_gid)
subprocess.run(['runuser','-u','postgres','--','pg_dump','-Fc','-d','inventario_db','-f',str(backup/'before-deployment.dump')],check=True)
os.chown(backup,0,0)
conf = pathlib.Path('/etc/postgresql/16/main')
for name in ['pg_hba.conf','postgresql.conf']:
    shutil.copy2(conf/name,backup/name)
prior = sql("SELECT 'ALTER ROLE inventario_app PASSWORD ' || quote_literal(rolpassword) || ';' FROM pg_authid WHERE rolname='inventario_app';")
fd = os.open(backup/'restore-role-private.sql',os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
with os.fdopen(fd,'w') as f:
    f.write("SET log_statement='none';\n"+prior+'\n')
sql((project/'db/001_schema.sql').read_text())
sql('GRANT CONNECT ON DATABASE inventario_db TO inventario_app; GRANT USAGE ON SCHEMA inventario_mvp TO inventario_app; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA inventario_mvp TO inventario_app; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA inventario_mvp TO inventario_app;')

account = pwd.getpwnam('inventario')
private = pathlib.Path('/home/inventario/.config/inventario')
private.mkdir(mode=0o700,parents=True,exist_ok=True)
os.chmod(private,0o700); os.chown(private,account.pw_uid,account.pw_gid)
transfer = private/'connection-transfer.env'
if transfer.exists():
    connection = transfer.read_text()
    password = connection.split('Password=',1)[1].split(';',1)[0]
else:
    password = secrets.token_urlsafe(48)
    connection = 'ConnectionStrings__Inventory="Host=10.77.55.4;Port=5432;Database=inventario_db;Username=inventario_app;Password='+password+';Timeout=5;Command Timeout=15;Include Error Detail=false"\n'
    fd = os.open(transfer,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    with os.fdopen(fd,'w') as f: f.write(connection)
    os.chown(transfer,account.pw_uid,account.pw_gid)
# Credencial del rol dedicado al banco vacío del proyecto. Respaldo privado permite reversión.
sql("SET log_statement='none'; SET log_min_duration_statement=-1; SET password_encryption='scram-sha-256'; ALTER ROLE inventario_app PASSWORD '"+password+"';")
private_conf = conf/'conf.d/inventario-private.conf'
if private_conf.exists(): shutil.copy2(private_conf,backup/'inventario-private.conf')
private_conf.write_text("# Inventario: solo loopback y dirección del laboratorio\nlisten_addresses = '127.0.0.1,10.77.55.4'\npassword_encryption = 'scram-sha-256'\n")
os.chmod(private_conf,0o644)
hba = conf/'pg_hba.conf'
text = hba.read_text()
marker = '# BEGIN INVENTARIO MVP PRIVATE'
if marker not in text:
    text += '\n'+marker+'\n'+'''host inventario_db inventario_app 10.77.55.3/32 scram-sha-256
host all all 10.77.55.0/24 reject
host all all 0.0.0.0/0 reject
host all all ::/0 reject
# END INVENTARIO MVP PRIVATE
'''
    hba.write_text(text)
os.chown(hba,postgres.pw_uid,postgres.pw_gid);os.chmod(hba,0o640)
if sql('SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL') != '0':
    shutil.copy2(backup/'pg_hba.conf',hba)
    raise SystemExit('Reglas inválidas: se restauró pg_hba.conf; no se reinició PostgreSQL.')
subprocess.run(['systemctl','restart','postgresql@16-main'],check=True)
sql('SELECT version FROM inventario_mvp.schema_versions WHERE version=1')
print('OK: respaldo privado, esquema v1, SCRAM, acceso exclusivo del Backend y PostgreSQL activo.')
print('Credencial disponible solo en archivo privado 0600 para transferencia SSH. No se muestra.')
