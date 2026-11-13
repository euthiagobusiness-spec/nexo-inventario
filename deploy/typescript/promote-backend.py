"""Promoción revisable del laboratorio. Ejecutar con sudo en ubuntu-backend.
Conserva PostgreSQL y sus datos. Revierte al servicio anterior si falla la aceptación.
"""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time
import urllib.request
from datetime import datetime, timezone

BASE = Path('/home/inventario/inventario-typescript')
UNIT = 'inventario-typescript.service'
OLD = 'inventario-mvp.service'
TARGET = Path('/etc/systemd/system') / UNIT

def run(*args, check=True):
    return subprocess.run(args, check=check, capture_output=True, text=True)

def api(port, path):
    with urllib.request.urlopen(f'http://10.77.55.3:{port}/api/{path}', timeout=8) as response:
        return json.load(response)

def ready(port):
    for _ in range(25):
        try:
            value = api(port, 'health/ready')
            if value.get('database') == 'MySQL' and value.get('language') == 'TypeScript':
                return value
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError('Readiness TypeScript/MySQL no confirmado.')

def checkpoint(port):
    return {'product': api(port, 'products/13'), 'sale': api(port, 'sales/9')}

def main():
    if os.geteuid() != 0 or socket.gethostname() != 'ubuntu-backend':
        raise SystemExit('Ejecutar con sudo solamente en ubuntu-backend.')
    source = BASE / 'deploy/typescript' / UNIT
    if not source.is_file() or not (BASE / 'dist/backend/src/server.js').is_file():
        raise SystemExit('Falta la fuente del servicio o el Backend compilado.')
    if TARGET.exists():
        raise SystemExit('La unidad destino ya existe. Revisar su estado antes de reemplazarla.')
    ready(8082)
    before = checkpoint(8082)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    evidence = BASE / 'artifacts/deployment' / stamp
    evidence.mkdir(parents=True, mode=0o755)
    (evidence / 'checkpoint-before.json').write_text(json.dumps(before, indent=2))
    old_active = run('systemctl', 'is-active', OLD, check=False).returncode == 0
    old_enabled = run('systemctl', 'is-enabled', OLD, check=False).returncode == 0
    run('systemd-analyze', 'verify', str(source))
    shutil.copy2(source, evidence / UNIT)
    report = {'timestampUtc': stamp, 'oldActive': old_active, 'oldEnabled': old_enabled,
              'postgresql': 'preservado; sin modificaciones', 'status': 'IN_PROGRESS'}
    try:
        shutil.copyfile(source, TARGET)
        TARGET.chmod(0o644)
        run('systemctl', 'daemon-reload')
        run('systemctl', 'stop', OLD)
        run('systemctl', 'start', UNIT)
        report['readiness'] = ready(8080)
        if checkpoint(8080) != before:
            raise RuntimeError('Los registros no coinciden tras la promoción.')
        suite = run('runuser', '-u', 'inventario', '--', 'python3', str(BASE / 'tests/http_e2e.py'),
                    '--base-url', 'http://10.77.55.3:8080', '--output',
                    str(BASE / 'artifacts/typescript/http-e2e-main.json'), check=False)
        (evidence / 'http-suite.txt').write_text(suite.stdout)
        if suite.returncode != 0:
            raise RuntimeError('Falló la suite HTTP; revisar el informe de aceptación.')
        run('systemctl', 'restart', UNIT)
        ready(8080)
        if checkpoint(8080) != before:
            raise RuntimeError('Los registros no coinciden tras reiniciar el servicio.')
        run('systemctl', 'enable', UNIT)
        run('systemctl', 'disable', OLD)
        report.update(status='PASS', exactRecordMatch=True, serviceRestart='PASS',
                      vmReboot='PENDIENTE', browserVisual='PENDIENTE',
                      application='http://10.77.55.3:8080')
    except Exception as error:
        run('systemctl', 'disable', '--now', UNIT, check=False)
        if TARGET.exists():
            TARGET.unlink()
        run('systemctl', 'daemon-reload', check=False)
        if old_enabled:
            run('systemctl', 'enable', OLD, check=False)
        if old_active:
            run('systemctl', 'start', OLD, check=False)
        report.update(status='FAIL_ROLLED_BACK', error=type(error).__name__ + ': ' + str(error))
    finally:
        (evidence / 'promotion-result.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report, ensure_ascii=False, indent=2))
        print('Informe:', evidence / 'promotion-result.json')
    return 0 if report['status'] == 'PASS' else 1

if __name__ == '__main__':
    raise SystemExit(main())
