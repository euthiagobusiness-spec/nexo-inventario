"""Evidencia de solo lectura por SSH. No lee secretos ni cambia las VMs."""
import argparse, datetime, json, pathlib, subprocess
parser=argparse.ArgumentParser()
parser.add_argument('--output',default='artifacts/lab-validation.json')
args=parser.parse_args()
def run(port, command):
    return subprocess.run(['ssh','-o','BatchMode=yes','-p',str(port),'inventario@127.0.0.1',command],capture_output=True,text=True)
be=run(2222,'systemctl show inventario-mvp -p ActiveState -p SubState -p UnitFileState -p User; stat -c %a /home/inventario/.config/inventario/backend.env')
db=run(2223,'systemctl is-active postgresql@16-main; ss -ltn')
denied=run(2223,'psql -w -h 10.77.55.4 -U inventario_app -d inventario_db -c "SELECT 1"')
rejection=denied.returncode!=0 and 'rejects connection' in denied.stderr
ui_file=pathlib.Path('artifacts/ui-vm-final.json')
ui_pass=ui_file.exists() and json.loads(ui_file.read_text(encoding='utf-8')).get('status')=='PASS'
data={'timestampUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'backend':be.stdout,'database':db.stdout,'deniedOrigin':'10.77.55.4',
    'networkRejectionPass':rejection,'networkRejectionDiagnostic':denied.stderr,
    'frontendVm':'10.77.55.5','frontendUi':'PASS: UI observada con venta #9' if ui_pass else 'PENDING: sin evidencia visual final'}
pathlib.Path(args.output).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print('Private-network rejection:',rejection)
print('Backend:',be.stdout.strip())
print('Database:',db.stdout.strip())
raise SystemExit(0 if rejection and be.returncode==0 and db.returncode==0 else 1)
