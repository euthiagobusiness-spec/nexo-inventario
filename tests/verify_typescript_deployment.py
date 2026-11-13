"""Verificación real de servicio, red y persistencia por SSH; no cambia datos."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import time

p = argparse.ArgumentParser()
p.add_argument('--checkpoint', default='artifacts/typescript/checkpoint-main-before.json')
p.add_argument('--label', required=True)
p.add_argument('--output', required=True)
p.add_argument('--timeout', type=int, default=300)
args = p.parse_args()
expected = json.loads(Path(args.checkpoint).read_text(encoding='utf-8-sig'))

def ssh(port, command):
    r = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=4',
                        '-p', str(port), 'inventario@127.0.0.1', command],
                       capture_output=True, text=True, timeout=15)
    if r.returncode:
        raise RuntimeError(f'Operación falló en puerto SSH {port}; salida={r.returncode}; comando={command}; detalle={r.stderr.strip()[:200]}')
    return r.stdout.strip()

def api(port, path):
    return json.loads(ssh(port, 'curl --max-time 8 --fail --silent http://10.77.55.3:8080/api/' + path))

deadline = time.monotonic() + args.timeout
report = {'label': args.label, 'timestampUtc': datetime.now(timezone.utc).isoformat()}
while True:
    try:
        health = api(2222, 'health/ready')
        assert health['language'] == 'TypeScript' and health['database'] == 'MySQL'
        records = {'product': api(2222, 'products/13'), 'sale': api(2222, 'sales/9')}
        assert records == expected, 'Checkpoint alterado'
        assert ssh(2222, 'systemctl is-active inventario-typescript') == 'active'
        assert ssh(2222, 'systemctl is-enabled inventario-typescript') == 'enabled'
        assert ssh(2223, 'systemctl is-active mysql') == 'active'
        assert ssh(2223, 'systemctl is-enabled mysql') == 'enabled'
        assert api(2223, 'health/ready')['database'] == 'MySQL'
        report.update(status='PASS', exactRecordMatch=True, backendActive=True,
                      backendEnabled=True, mysqlActive=True, mysqlEnabled=True,
                      databaseToBackendHTTP=True, records=records)
        break
    except (Exception, AssertionError) as error:
        if time.monotonic() >= deadline:
            report.update(status='FAIL', error=type(error).__name__ + ': ' + str(error))
            break
        time.sleep(3)
out = Path(args.output)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(0 if report['status'] == 'PASS' else 1)
