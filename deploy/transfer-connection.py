"""Transfiere la conexión entre las VMs por SSH. Solo memoria, sin archivo local ni stdout sensible."""
import subprocess
read = subprocess.run(['ssh','-o','BatchMode=yes','-p','2223','inventario@127.0.0.1',
    'cat /home/inventario/.config/inventario/connection-transfer.env'],capture_output=True)
if read.returncode or not read.stdout.startswith(b'ConnectionStrings__Inventory='):
    raise SystemExit('No se obtuvo la conexión privada; no se imprime su contenido.')
write = subprocess.run(['ssh','-o','BatchMode=yes','-p','2222','inventario@127.0.0.1',
    'set -e; mkdir -p /home/inventario/.config/inventario; chmod 700 /home/inventario/.config/inventario; umask 077; test ! -e /home/inventario/.config/inventario/backend.env; cat > /home/inventario/.config/inventario/backend.env'],
    input=read.stdout,capture_output=True)
if write.returncode: raise SystemExit('No se escribió la conexión. Un archivo existente se conserva.')
print('OK: conexión transferida de VM Database a VM Backend, sin guardarla en Windows.')
