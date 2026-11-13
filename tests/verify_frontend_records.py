"""Verificación SQL de solo lectura del flujo observado en WIN11-FRONTEND.
Ejecutar en ubuntu-database. La credencial existente se usa solo en memoria.
"""
import json, os, pathlib, socket, subprocess
from datetime import datetime, timezone
if socket.gethostname() != 'ubuntu-database':
    raise SystemExit('Ejecutar esta comprobación únicamente dentro de ubuntu-database.')
private=pathlib.Path.home()/'.config/inventario/connection-transfer.env'
password=private.read_text().split('Password=',1)[1].split(';',1)[0]
query="""
WITH p AS (SELECT id,sku,name,category,price,stock,minimum_stock
 FROM inventario_mvp.products WHERE sku='VM13'),
v AS (SELECT s.id,s.total,i.quantity,i.unit_price FROM inventario_mvp.sales s
 JOIN inventario_mvp.sale_items i ON i.sale_id=s.id JOIN p ON p.id=i.product_id ORDER BY s.id),
m AS (SELECT sm.id,sm.delta,sm.reason,sm.sale_id FROM inventario_mvp.stock_movements sm
 JOIN p ON p.id=sm.product_id ORDER BY sm.id)
SELECT json_build_object('product',(SELECT row_to_json(p) FROM p),
 'sales',(SELECT json_agg(row_to_json(v)) FROM v),
 'movements',(SELECT json_agg(row_to_json(m)) FROM m),
 'negativeStockCount',(SELECT count(*) FROM inventario_mvp.products WHERE stock<0),
 'productCount',(SELECT count(*) FROM inventario_mvp.products),
 'salesCount',(SELECT count(*) FROM inventario_mvp.sales));
"""
result=subprocess.run(['psql','-X','-v','ON_ERROR_STOP=1','-t','-A','-h','127.0.0.1',
    '-U','inventario_app','-d','inventario_db','-c',query],
    env={**os.environ,'PGPASSWORD':password},capture_output=True,text=True)
if result.returncode: raise SystemExit('FAIL: consulta de verificación. No se imprime información de conexión.')
data=json.loads(result.stdout)
p=data['product'];sales=data['sales'] or [];movements=data['movements'] or []
checks={
    'sku_persisted':p is not None and p['sku']=='VM13',
    'price_stock_persisted':p is not None and p['price']==49.9 and p['stock']==8,
    'only_one_sale':len(sales)==1,
    'sale_9_quantity_total':len(sales)==1 and sales[0]['id']==9 and sales[0]['quantity']==2 and sales[0]['total']==99.8,
    'initial_and_sale_movements':len(movements)==2 and [m['delta'] for m in movements]==[10,-2],
    'no_negative_stock':data['negativeStockCount']==0
}
proof={'timestampUtc':datetime.now(timezone.utc).isoformat(),'status':'PASS' if all(checks.values()) else 'FAIL',
    'checks':checks,'databaseRecords':data}
output=pathlib.Path('artifacts/frontend-database-proof.json');output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(proof,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(proof,ensure_ascii=False));raise SystemExit(0 if all(checks.values()) else 1)
