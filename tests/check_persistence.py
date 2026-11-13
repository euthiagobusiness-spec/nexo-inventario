"""Captura e verifica los mismos IDs reales después de reiniciar proceso/banco/VM."""
import argparse, json, time, urllib.error, urllib.request
from datetime import datetime, timezone
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--capture',action='store_true')
p.add_argument('--base-url',default='http://10.77.55.3:8080')
p.add_argument('--state',default='artifacts/persistence-checkpoint.json')
p.add_argument('--output',default='artifacts/persistence-result.json')
args=p.parse_args()
def get(path):
    with urllib.request.urlopen(args.base_url+'/api'+path,timeout=5) as response:
        return json.load(response)
deadline=time.monotonic()+30
while True:
    try:
        assert get('/health/ready')['status']=='ready'
        break
    except (OSError,AssertionError):
        if time.monotonic()>=deadline: raise SystemExit('FAIL: readiness no disponible tras 30 segundos')
        time.sleep(.25)
state=Path(args.state)
if args.capture:
    product=get('/products?pageSize=1')['items'][0]
    sale=get('/sales?pageSize=1')['items'][0]
    payload={'product':get('/products/'+str(product['id'])),'sale':get('/sales/'+str(sale['id']))}
    state.parent.mkdir(parents=True,exist_ok=True)
    state.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    print('OK: checkpoint de producto y venta reales guardado')
else:
    payload=json.loads(state.read_text(encoding='utf-8'))
    actual={'product':get('/products/'+str(payload['product']['id'])),'sale':get('/sales/'+str(payload['sale']['id']))}
    passed=actual==payload
    result={'timestampUtc':datetime.now(timezone.utc).isoformat(),'baseUrl':args.base_url,
        'status':'PASS' if passed else 'FAIL','productId':payload['product']['id'],'saleId':payload['sale']['id'],
        'stock':actual['product']['stock'],'saleTotal':actual['sale']['total'],'exactRecordMatch':passed}
    out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result));raise SystemExit(0 if passed else 1)
