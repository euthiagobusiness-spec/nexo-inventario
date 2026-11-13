# Operación de la etapa C#/.NET y PostgreSQL

> **MANUAL HISTÓRICO.** Los comandos, rutas, servicio y credenciales de entorno que aparecen a continuación pertenecen a la etapa anterior .NET/PostgreSQL. No los aplique a la API TypeScript/MySQL actual. Consulte [la guía de operación y estado actual](COMO_O_SISTEMA_FOI_FEITO.md) y [las instrucciones de VS Code](VSCODE.md). Este manual se conserva como registro de la instalación anterior.

## Estado actualizado tras la intervención autorizada

El acceso administrativo se autenticó con contraseña de forma oculta en las VMs. `deploy/configure-lab-database.py` respaldó el banco vacío del proyecto, aplicó el esquema, configuró escucha privada y SCRAM, y generó una credencial protegida. `deploy/transfer-connection.py` la transfirió por SSH sin archivo local. `deploy/install-backend-service.sh` instaló la unidad de sistema. Ambas VMs Ubuntu fueron reiniciadas y la aplicación conservó sus datos y volvió automáticamente.

Operación actual en Backend:

```bash
systemctl status inventario-mvp --no-pager
curl --fail http://10.77.55.3:8080/api/health/ready
cd /home/inventario/inventario-mvp
python3 tests/http_e2e.py --output artifacts/http-new-run.json
```

Reinicios futuros del servicio requieren autorización administrativa. No volver a ejecutar el configurador de banco sin revisar la rotación de credencial y los respaldos. La conexión activa está en `~/.config/inventario/backend.env` (0600). No imprimirla ni incluirla en archivos de entrega. El servicio de usuario anterior quedó deshabilitado para evitar dos procesos en el mismo puerto.

La VM Frontend correcta es `WIN11-FRONTEND`, IP `10.77.55.5`. Abrir allí `http://10.77.55.3:8080`. No cambiar la red del host físico para esta demostración. La automatización visual fue detenida por el usuario antes de completar esa verificación.

Las secciones siguientes conservan el procedimiento y diagnóstico de la primera etapa. Sus bloqueos e instrucciones pendientes son históricos. El informe actual es `ENTREGA_VALIDADA.md`.

**Estas acciones privilegiadas son propuestas revisables, no acciones ya realizadas.** El usuario debe aprobar las modificaciones sensibles y un administrador debe ejecutarlas localmente. No introducir contraseñas en este chat, comandos con historial o repositorio. No usar `trust`, no desactivar autenticación y no habilitar sudo sin contraseña para resolver este bloqueo.

## Estado instalado

Backend en `/home/inventario/inventario-mvp/publish`. Servicio de usuario `inventario-mvp.service`, activo y habilitado para la sesión del usuario. Escucha exclusivamente en `10.77.55.3:8080`. Unidad en `/home/inventario/.config/systemd/user/inventario-mvp.service`.

`loginctl show-user inventario -p Linger` devuelve `Linger=no`. El servicio de usuario NO garantiza inicio al arrancar sin login. Se preparó una unidad de sistema; su instalación requiere sudo y no se ejecutó. No se reiniciaron las VMs para simular una prueba de arranque.

SSH funciona mediante puertos locales 2222 (Backend) y 2223 (Database). No se cambiaron claves ni autenticación SSH.

## 1. Preparar el banco existente

El paquete del proyecto está disponible en ambas VMs en `/home/inventario/inventario-mvp`. En Database, un administrador revisa primero `db/001_schema.sql` y `deploy/prepare-database.sh`. Después, con aprobación:

```bash
cd /home/inventario/inventario-mvp
sudo bash deploy/prepare-database.sh
```

El script comprueba que existan banco y rol esperados, hace un `pg_dump` previo con permisos privados, crea solo el esquema `inventario_mvp` y concede al rol permisos de lectura, inserción, actualización y secuencias. No concede superusuario ni elimina datos. No modifica contraseña. No aplica automáticamente red o autenticación.

Si ya existe un esquema `inventario_mvp` usado por otra aplicación, detenerse y comparar su estructura antes de ejecutar: `IF NOT EXISTS` no actualiza tablas incompatibles. Si falta el banco o el rol, diagnosticar con el administrador en lugar de asumir su estado.

## 2. Restringir conexiones privadas

Revisar con administrador estas propuestas:

- `deploy/postgresql-private.conf.proposed`: escuchar en loopback y `10.77.55.4`, nunca `*`.
- `deploy/pg_hba.conf.proposed`: autorizar **solo** `inventario_db`/`inventario_app` desde `10.77.55.3/32` con SCRAM. Rechazar otros orígenes TCP y preservar conexiones locales ya aprobadas.

Respaldar los archivos actuales antes de editar. No copiar el ejemplo encima del archivo entero: no se pudo leer `pg_hba.conf` por permisos, y pueden existir reglas locales necesarias. El orden importa: una regla permisiva anterior puede anular la restricción deseada. Revisar las reglas efectivas y el verificador SCRAM del rol sin mostrar hashes o contraseñas.

El cambio de `listen_addresses` requiere reiniciar PostgreSQL. Una vez aprobada la configuración y revisado el impacto sobre sesiones existentes:

```bash
sudo systemctl restart postgresql@16-main
sudo -u postgres psql -X -d inventario_db -c "SELECT line_number,type,database,user_name,address,auth_method,error FROM pg_hba_file_rules ORDER BY line_number;"
ss -ltn
```

Confirmar que el servicio siga sano y que no haya errores en reglas. Si hay firewall activo, permitir TCP 5432 exclusivamente desde `10.77.55.3` hacia `10.77.55.4`, sin cambiar reglas SSH. Su estado no fue verificado con privilegios; no se desactivó ningún firewall.

## 3. Configurar conexión sin exponer credencial

En Ubuntu Backend, el operador ejecuta:

```bash
cd /home/inventario/inventario-mvp
python3 deploy/set-connection.py
systemctl --user restart inventario-mvp
curl --fail http://10.77.55.3:8080/api/health/ready
```

El script pregunta localmente y con entrada oculta por la contraseña **existente** del rol de banco; la guarda únicamente en `~/.config/inventario/backend.env`, permisos 0600. No sobrescribe un archivo existente. La aplicación consume `ConnectionStrings__Inventory`. No subir ese archivo a Git, copiarlo a la documentación ni imprimirlo para diagnóstico. No se configuró todavía ninguna credencial.

## 4. Instalar inicio automático al arrancar

Revisar `deploy/inventario-mvp.service`. En Backend, después de aprobar y validar sudo:

```bash
sudo -v
sudo install -m 644 /home/inventario/inventario-mvp/deploy/inventario-mvp.service /etc/systemd/system/inventario-mvp.service
sudo systemctl daemon-reload
systemctl --user disable --now inventario-mvp
sudo systemctl enable --now inventario-mvp
sudo systemctl status inventario-mvp --no-pager
```

Si falla la unidad de sistema, restaurar el servicio de usuario con `systemctl --user enable --now inventario-mvp`, revisar logs saneados localmente y no ejecutar ambos en el mismo puerto. Un reinicio de VM debe ser aprobado aparte, seguido por una prueba de servicio, readiness y persistencia.

## 5. Conectividad del Windows

Durante la prueba, el Windows no tenía una dirección `10.77.55.*` y falló el acceso TCP directo a `10.77.55.3:22`. No se modificó ninguna NIC, ruta, NAT o configuración VirtualBox. No puede afirmarse que el host Windows esté efectivamente conectado a RedeProjeto solo por el nombre de la red de las VMs.

El túnel temporal usa la clave SSH existente y escucha solo en loopback:

```powershell
ssh -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -N -L 127.0.0.1:18080:10.77.55.3:8080 -p 2222 inventario@127.0.0.1
```

Mientras ese proceso esté abierto: `http://127.0.0.1:18080`. Ctrl+C termina únicamente el túnel. Para el acceso directo solicitado `http://10.77.55.3:8080`, falta revisar y aprobar la conexión del Windows a la red privada apropiada. El túnel no constituye prueba de esa conectividad directa.

## 6. Pruebas tras desbloquear

```bash
cd /home/inventario/inventario-mvp
dotnet run --project tests/Inventario.Tests/Inventario.Tests.csproj -c Release
python3 tests/check_original.py
python3 tests/http_e2e.py --base-url http://10.77.55.3:8080 --output artifacts/http-results-with-db.json
```

El test HTTP crea productos con prefijo QA único y conserva todos sus registros. Incluye producto, venta, idempotencia, rollback, movimientos y dos ventas simultáneas sobre una unidad. No borra datos. Código de salida: 0 completo; 1 fallo; 2 banco bloqueado. No sustituir 2 por éxito en un informe.

Repetir desde Windows con el túnel o acceso privado ya verificado. Completar además una compra en la UI y registrar sus IDs. Para probar persistencia tras reinicio de proceso: anotar producto/stock/venta, reiniciar solo el servicio y releer los mismos IDs. Esta prueba todavía no se ha podido ejecutar con datos.

## Diagnóstico y reversión

```bash
systemctl --user status inventario-mvp --no-pager
journalctl --user -u inventario-mvp -n 40 --no-pager
curl -i http://10.77.55.3:8080/api/health/live
curl -i http://10.77.55.3:8080/api/health/ready
```

No pegar archivos de entorno ni logs con posibles secretos. Para parar el componente nuevo: `systemctl --user stop inventario-mvp`; esto no elimina código o datos. Cambios futuros al PostgreSQL deben conservar respaldos y tener reversión administrativa de configuración. No ejecutar `DROP DATABASE`, `DROP SCHEMA`, `TRUNCATE` o restauraciones destructivas como parte de una prueba.
