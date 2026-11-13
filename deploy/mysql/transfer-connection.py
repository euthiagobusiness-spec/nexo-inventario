"""Transferencia SSH en memoria. No guarda credenciales en el Windows físico."""
import subprocess
def read(path):
    r=subprocess.run(['ssh','-o','BatchMode=yes','-p','2223','inventario@127.0.0.1','cat '+path],capture_output=True)
    if r.returncode:raise SystemExit('Fallo al obtener configuración privada; contenido no mostrado.')
    return r.stdout
for source,target in [('mysql-transfer.env','mysql.env'),('mysql-ca.pem','mysql-ca.pem')]:
    content=read('/home/inventario/.config/inventario/'+source)
    command='set -e; mkdir -p /home/inventario/.config/inventario; chmod 700 /home/inventario/.config/inventario; umask 077; test ! -e /home/inventario/.config/inventario/'+target+'; cat > /home/inventario/.config/inventario/'+target
    r=subprocess.run(['ssh','-o','BatchMode=yes','-p','2222','inventario@127.0.0.1',command],input=content,capture_output=True)
    if r.returncode:raise SystemExit('Destino ya existente o transferencia fallida; no se sobrescribe ni se imprime la conexión.')
print('OK: conexión MySQL y CA transferidas por SSH, sin archivo local.')
