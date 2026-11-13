"""Retira PostgreSQL del servicio activo; conserva paquetes, datos y backup."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import urllib.request

def run(*args, check=True, **kwargs):
    return subprocess.run(args, check=check, capture_output=True, text=True, **kwargs)

def mysql_ready():
    with urllib.request.urlopen('http://10.77.55.3:8080/api/health/ready', timeout=10) as r:
        v = json.load(r)
    if v.get('database') != 'MySQL' or v.get('language') != 'TypeScript':
        raise RuntimeError('La API principal no confirma TypeScript/MySQL.')
    run('systemctl', 'is-active', 'mysql')

if os.geteuid() != 0 or socket.gethostname() != 'ubuntu-database':
    raise SystemExit('Ejecutar con sudo solamente en ubuntu-database.')
mysql_ready()
dbs = run('runuser', '-u', 'postgres', '--', 'psql', '-XAt', '-d', 'postgres', '-c',
          'SELECT datname FROM pg_database WHERE NOT datistemplate').stdout.splitlines()
if set(dbs) - {'postgres', 'inventario_db'}:
    raise SystemExit('Hay otras bases. PostgreSQL no será detenido.')
connections = run('runuser', '-u', 'postgres', '--', 'psql', '-XAt', '-d', 'postgres', '-c',
                  "SELECT count(*) FROM pg_stat_activity WHERE backend_type='client backend' AND pid<>pg_backend_pid()").stdout.strip()
if connections != '0':
    raise SystemExit('Existen sesiones PostgreSQL; no se interrumpirán.')
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = Path('/var/backups') / ('inventario-postgresql-' + stamp)
backup.mkdir(mode=0o700)
config = Path('/etc/postgresql/16/main/start.conf')
shutil.copy2(config, backup / 'start.conf')
dump = backup / 'inventario_db.dump'
with dump.open('wb') as target:
    subprocess.run(['runuser', '-u', 'postgres', '--', 'pg_dump', '-Fc', 'inventario_db'],
                   stdout=target, stderr=subprocess.PIPE, check=True)
dump.chmod(0o600)
if not dump.stat().st_size:
    raise SystemExit('Backup vacío; no se detendrá PostgreSQL.')
report = {'timestampUtc': stamp, 'backupDirectory': str(backup),
          'packagesRemoved': False, 'dataDeleted': False}
try:
    config.write_text('# Conservado para recuperación manual; aplicación migrada a MySQL.\nmanual\n')
    run('systemctl', 'daemon-reload')
    run('systemctl', 'stop', 'postgresql@16-main.service')
    run('systemctl', 'disable', '--now', 'postgresql.service')
    if run('systemctl', 'is-active', 'postgresql@16-main', check=False).returncode == 0:
        raise RuntimeError('El cluster continúa activo.')
    mysql_ready()
    report.update(status='PASS', postgresqlCluster='inactive', postgresqlAutostart='manual/disabled', mysql='active')
except Exception:
    shutil.copy2(backup / 'start.conf', config)
    run('systemctl', 'daemon-reload', check=False)
    run('systemctl', 'enable', '--now', 'postgresql.service', check=False)
    run('systemctl', 'start', 'postgresql@16-main.service', check=False)
    report.update(status='FAIL_ROLLED_BACK')
    raise
finally:
    output = Path('/home/inventario/inventario-maintenance/postgresql-retirement.json')
    output.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
