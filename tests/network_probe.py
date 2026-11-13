"""Sondeo TCP de solo lectura; no cambia rutas, firewall o credenciales."""
import argparse, json, socket
from datetime import datetime, timezone
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--output',default='artifacts/network.json')
args=parser.parse_args()
results=[]
for host,port in [('10.77.55.3',8080),('10.77.55.4',5432),('127.0.0.1',5432)]:
    try:
        with socket.create_connection((host,port),timeout=3): pass
        result={'host':host,'port':port,'reachable':True}
    except OSError as error:
        result={'host':host,'port':port,'reachable':False,'error':type(error).__name__}
    results.append(result)
payload={'machine':socket.gethostname(),'timestampUtc':datetime.now(timezone.utc).isoformat(),'results':results}
path=Path(args.output);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(payload,indent=2),encoding='utf-8')
print(json.dumps(payload,indent=2))
