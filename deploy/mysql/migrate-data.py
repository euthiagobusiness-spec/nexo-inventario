#!/usr/bin/env python3
"""Copia íntegra PostgreSQL -> MySQL con aplicación detenida, respaldo y comparación por fila."""
import hashlib, json, os, pathlib, pwd, socket, subprocess
from datetime import datetime, timezone
from decimal import Decimal
if os.geteuid()!=0 or socket.gethostname()!='ubuntu-database':raise SystemExit('Solo root en ubuntu-database.')
tables={
 'schema_versions':(['version','applied_at'],['version']),
 'products':(['id','sku','name','category','price','stock','minimum_stock','created_at'],['id']),
 'sales':(['id','request_id','payload_hash','total','created_at'],['id']),
 'sale_items':(['sale_id','product_id','product_name','sku','quantity','unit_price'],['sale_id','product_id']),
 'stock_movements':(['id','product_id','delta','reason','sale_id','created_at'],['id']),
 'stock_requests':(['request_id','payload_hash','product_id','resulting_stock'],['request_id'])}
def pg(sql):
    r=subprocess.run(['runuser','-u','postgres','--','psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d','inventario_db'],input=sql,text=True,capture_output=True)
    if r.returncode:raise SystemExit('Fallo al leer PostgreSQL. Datos originales preservados.')
    return r.stdout.strip()
def my(sql):
    r=subprocess.run(['mysql','--batch','--skip-column-names','--raw','--default-character-set=utf8mb4'],input=sql,text=True,capture_output=True)
    if r.returncode:raise SystemExit('Fallo MySQL. Transacción no confirmada o comparación pendiente; PostgreSQL preservado.')
    return r.stdout.strip()
if my('SELECT '+ '+'.join('(SELECT COUNT(*) FROM inventario_db.'+t+')' for t in tables)+';')!='0':
    raise SystemExit('Destino no vacío: no se reemplazan ni eliminan datos.')
backup=pathlib.Path('/var/backups/inventario-mysql-migration')/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup.mkdir(mode=0o700,parents=True)
account=pwd.getpwnam('postgres');os.chown(backup,account.pw_uid,account.pw_gid)
subprocess.run(['runuser','-u','postgres','--','pg_dump','-Fc','-d','inventario_db','-f',str(backup/'postgres-before-mysql.dump')],check=True)
os.chown(backup,0,0)
selects=[]
for name,(cols,keys) in tables.items():
    selects.append("'"+name+"',(SELECT COALESCE(json_agg(t),'[]'::json) FROM (SELECT "+','.join(cols)+' FROM inventario_mvp.'+name+' ORDER BY '+','.join(keys)+') t)')
raw=pg("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TIME ZONE 'UTC'; SELECT json_build_object("+','.join(selects)+'); COMMIT;')
data=json.loads(raw,parse_float=Decimal)
fd=os.open(backup/'rows-private.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:f.write(raw)
next_ids={}
for table in ['products','sales','stock_movements']:
    seq=pg("SELECT pg_get_serial_sequence('inventario_mvp."+table+"','id');")
    v=pg('SELECT last_value,is_called FROM '+seq+';').split('|')
    next_ids[table]=int(v[0])+(v[1]=='t')
def timestamp(value):
    d=datetime.fromisoformat(value.replace('Z','+00:00'))
    if d.tzinfo is not None:d=d.astimezone(timezone.utc)
    return d.strftime('%Y-%m-%d %H:%M:%S.%f')
def literal(value,column):
    if value is None:return 'NULL'
    if column in ['created_at','applied_at']:value=timestamp(value)
    if isinstance(value,(int,Decimal)):return str(value)
    return 'CONVERT(0x'+str(value).encode('utf-8').hex()+' USING utf8mb4)'
statements=["SET time_zone='+00:00'; START TRANSACTION;"]
for name,(cols,keys) in tables.items():
    for row in data[name]:
        statements.append('INSERT INTO inventario_db.'+name+' ('+','.join(cols)+') VALUES ('+','.join(literal(row[c],c) for c in cols)+');')
statements.append('COMMIT;')
my('\n'.join(statements))
for name,value in next_ids.items():my('ALTER TABLE inventario_db.'+name+' AUTO_INCREMENT='+str(value)+';')
def canonical(rows,cols,keys):
    result=[]
    for row in sorted(rows,key=lambda r:tuple(str(r[k]) for k in keys)):
        values=[]
        for c in cols:
            v=row[c]
            if v is not None and c in ['created_at','applied_at']:v=timestamp(v)
            if v is not None and c in ['price','total','unit_price']:v=format(Decimal(str(v)),'.2f')
            values.append(v)
        result.append(values)
    return json.dumps(result,ensure_ascii=False,separators=(',',':'),default=str)
proof=[]
for name,(cols,keys) in tables.items():
    pairs=','.join("'"+c+"',`"+c+'`' for c in cols)
    rows=json.loads(my('SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('+pairs+')),JSON_ARRAY()) FROM inventario_db.'+name+';'),parse_float=Decimal)
    before=canonical(data[name],cols,keys);after=canonical(rows,cols,keys)
    proof.append({'table':name,'postgresRows':len(data[name]),'mysqlRows':len(rows),'identical':before==after,'sha256':hashlib.sha256(before.encode()).hexdigest()})
result={'timestampUtc':datetime.now(timezone.utc).isoformat(),'status':'PASS' if all(x['identical'] for x in proof) else 'FAIL','tables':proof,'nextIds':next_ids,'backupDirectory':str(backup),'postgresRemoved':False}
out=pathlib.Path('/home/inventario/inventario-mvp/artifacts/mysql');out.mkdir(exist_ok=True,parents=True)
(out/'migration-proof.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result));raise SystemExit(0 if result['status']=='PASS' else 1)
