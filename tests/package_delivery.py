"""Empaqueta código y evidencia pública seleccionada. Excluye credenciales y cachés."""
import argparse, pathlib, zipfile
root=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--output',default='deliverables/Inventario-MVP-validado.zip')
args=parser.parse_args()
files=[]
for folder in ['src','db','deploy','docs','tests']:
    for f in (root/folder).rglob('*'):
        if not f.is_file() or any(p in {'__pycache__','bin','obj','node_modules'} for p in f.parts): continue
        if f.suffix in {'.env','.pyc'} or f.name.endswith('.local.json'): continue
        files.append(f)
files.extend(root/name for name in ['README.md','.gitignore'])
final_deck=root/'deliverables/Nexo-Inventario-ES-final.pptx'
files.append(final_deck if final_deck.exists() else root/'deliverables/Nexo-Inventario-ES.pptx')
evidence=['unit-tests.txt','original-check.txt','dependency-audit.txt','http-with-db-backend.json','http-with-db-database.json',
    'persistence-checkpoint.json','persistence-after-api-restart.json','persistence-after-postgresql-restart.json',
    'persistence-after-backend-vm-reboot.json','persistence-after-database-vm-reboot.json','analytics-with-db.json',
    'recursion-with-db.json','lab-validation.json','backend-runtime.txt']
files.extend(root/'artifacts'/name for name in evidence)
for name in ['http-final-backend.json','http-final-database.json','ui-vm-final.json',
    'frontend-database-proof.json','analytics-final.json','recursion-final.json','lab-validation-final.json']:
    candidate=root/'artifacts'/name
    if candidate.exists(): files.append(candidate)
manifest=root/'deliverables/manifest-validado.txt'
manifest.write_text('\n'.join(sorted(str(f.relative_to(root)).replace('\\','/') for f in files))+'\n',encoding='utf-8')
files.append(manifest)
destination=(root/args.output).resolve()
if not destination.is_relative_to(root): raise SystemExit('El paquete debe permanecer dentro del proyecto.')
with zipfile.ZipFile(destination,'x',zipfile.ZIP_DEFLATED) as archive:
    for f in sorted(files): archive.write(f,f.relative_to(root))
print('OK:',len(files),'archivos incluidos, sin .env ni datos privados de las VMs')
