#!/usr/bin/env python3
"""Runtime privado do projeto, somente na VM Backend; não altera o Windows."""
import hashlib, pathlib, platform, socket, subprocess, tarfile, urllib.request
if socket.gethostname() != 'ubuntu-backend' or platform.machine() != 'x86_64':
    raise SystemExit('Executar somente na VM Ubuntu Backend x86_64.')
version='24.19.0'; name=f'node-v{version}-linux-x64'
base=pathlib.Path.home()/'.local/lib'; base.mkdir(parents=True,exist_ok=True)
target=base/name
if not target.exists():
    artifacts=pathlib.Path.home()/'inventario-typescript/artifacts/runtime'; artifacts.mkdir(parents=True,exist_ok=True)
    filename=name+'.tar.xz'; url=f'https://nodejs.org/dist/v{version}/'
    sums=urllib.request.urlopen(url+'SHASUMS256.txt',timeout=30).read().decode()
    expected=next(line.split()[0] for line in sums.splitlines() if line.split()[-1]==filename)
    archive=artifacts/filename
    with urllib.request.urlopen(url+filename,timeout=60) as response,archive.open('wb') as output:
        while chunk:=response.read(1024*1024):output.write(chunk)
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:raise SystemExit('Checksum inválido; runtime não instalado.')
    with tarfile.open(archive) as package:
        for member in package.getmembers():
            resolved=(base/member.name).resolve()
            if not resolved.is_relative_to(target.resolve()):raise SystemExit('Caminho inesperado no pacote Node.')
        package.extractall(base,filter='data')
result=subprocess.run([str(target/'bin/node'),'--version'],capture_output=True,text=True,check=True)
if result.stdout.strip()!='v'+version:raise SystemExit('Versão de runtime inesperada.')
print('OK runtime privado:',result.stdout.strip())
