# Ejecutar Nexo

## 1. Fuentes y pruebas locales

Instalar Node.js 22 o superior (se valida con 24), npm y Git. Python 3 sirve para las comprobaciones adicionales.

```sh
git clone https://github.com/euthiagobusiness-spec/nexo-inventario.git
cd nexo-inventario
npm ci
npm run typecheck
npm test
npm start
```

Abrir `http://127.0.0.1:5080`. Sin MySQL configurado se puede revisar la interfaz y liveness, pero las rutas de datos responden 503. Las pruebas locales comprueban deliberadamente ese estado; no requieren acceso al laboratorio.

## 2. Conectar una base MySQL existente

Se necesita MySQL 8 con `db/mysql/001_schema.sql` aplicado y una fila de versión 1 en `schema_versions`. La cuenta de aplicación requiere SELECT, INSERT y UPDATE en `inventario_db`; no debe ser root. Solo el equipo Backend debe estar autorizado en la red y en la cuenta MySQL.

Copiar `.env.example` a `.env`. Completar localmente host, puerto, cuenta, contraseña y ruta absoluta de la CA del servidor. Este archivo no se versiona. El cliente exige TLS y valida la cadena de confianza de la CA; la implementación actual usa `verifyIdentity: false`, por lo que no comprueba la coincidencia del nombre del host con el certificado. Usar la red privada documentada; no presentarlo como validación completa de identidad TLS.

En PowerShell, desde la raíz:

```powershell
$env:INVENTARIO_ENV_FILE = (Resolve-Path .env).Path
npm run build
npm start
```

En Bash:

```sh
export INVENTARIO_ENV_FILE="$PWD/.env"
npm run build
npm start
```

El proceso lee el archivo mediante `process.loadEnvFile`. Con configuración correcta, `GET /api/health/ready` devuelve 200 e identifica MySQL y TypeScript. Un error de certificado o una cuenta no autorizada debe resolverse en esa instalación; no desactivar TLS para eludirlo.

## 3. Reconstrucción del laboratorio de tres VMs

Esta sección es un procedimiento para una instalación nueva revisada por su administrador. **No volver a ejecutar configuradores o migraciones sobre las VMs existentes sin revisar sus archivos y respaldos.** Los scripts contienen nombres, IPs y rutas específicos de este laboratorio.

| VM / hostname | IP privada | Requisitos |
|---|---|---|
| WIN11-FRONTEND | 10.77.55.5 | Windows 11 y navegador en `RedeProjeto` |
| ubuntu-backend | 10.77.55.3 | Ubuntu, Git, Python 3, Node.js/npm, usuario `inventario` |
| ubuntu-database | 10.77.55.4 | Ubuntu, Git, Python 3, MySQL 8 instalado con administración local, usuario `inventario` |

Backend debe alcanzar Database por TCP 3306; Windows debe alcanzar Backend por TCP 8080. Los port-forwards SSH del equipo de administración son 2222→Backend:22 y 2223→Database:22. Revisar rutas y reglas de firewall de acuerdo con la red existente; no abrir MySQL públicamente.

### Database nueva, sin datos previos

Como usuario `inventario`, clonar en `/home/inventario/inventario-mvp`. El configurador requiere ese directorio y el hostname `ubuntu-database`:

```sh
git clone https://github.com/euthiagobusiness-spec/nexo-inventario.git /home/inventario/inventario-mvp
cd /home/inventario/inventario-mvp
# Tras revisión administrativa, únicamente en Database nueva:
sudo python3 deploy/mysql/configure-database.py
sudo mysql --execute="INSERT IGNORE INTO inventario_db.schema_versions(version) VALUES (1);"
```

El configurador crea el esquema, una cuenta exclusiva de `10.77.55.3` con contraseña aleatoria y transporte seguro, y limita escucha a loopback/IP privada. Requiere el cliente `mysql` y administración local por socket. Guarda configuración privada en `~inventario/.config/inventario/`; no imprimirla ni copiarla a Git. Para conservar datos de una instalación anterior existe `deploy/mysql/migrate-data.py`, que requiere PostgreSQL y destino vacío; no forma parte de la instalación nueva.

### Backend nueva

Como usuario `inventario`:

```sh
git clone https://github.com/euthiagobusiness-spec/nexo-inventario.git /home/inventario/inventario-typescript
cd /home/inventario/inventario-typescript
python3 deploy/typescript/prepare-node.py
export PATH="$HOME/.local/lib/node-v24.19.0-linux-x64/bin:$PATH"
npm ci
npm run build
```

`prepare-node.py` requiere Backend Ubuntu x86_64 y descarga el runtime privado fijado por el proyecto, verificando su checksum. No cambia el Node del equipo Windows. Como alternativa, adaptar y revisar la ruta `ExecStart` de la unidad para un Node ya instalado.

Desde el equipo de administración con las claves SSH ya configuradas, ejecutar en la raíz del repositorio:

```sh
python deploy/mysql/transfer-connection.py
```

Transfiere la conexión y CA de Database a Backend mediante memoria/SSH. No muestra el contenido y se detiene si el destino ya existe. En Linux puede usarse `python3`.

Después de verificar que no hay otro servicio ocupando 8080, el administrador de Backend instala la unidad:

```sh
cd /home/inventario/inventario-typescript
sudo install -m 644 deploy/typescript/inventario-typescript.service /etc/systemd/system/inventario-typescript.service
sudo systemctl daemon-reload
sudo systemctl enable --now inventario-typescript
curl --fail http://10.77.55.3:8080/api/health/ready
```

No ejecutar el script de promoción en una instalación nueva: está diseñado para el corte desde las candidatas anteriores. No es necesario retirar PostgreSQL para ejecutar TypeScript/MySQL.

## 4. Aceptación funcional

Desde Backend, contra una instalación disponible:

```sh
python3 tests/http_e2e.py --base-url http://10.77.55.3:8080 --output artifacts/typescript/http-e2e-new-run.json
```

La suite crea productos, ventas y ajustes QA y **los conserva**. Prueba transacciones, falta de stock, idempotencia, concurrencia e indicadores. No ejecutarla durante una toma de video que requiera datos estables. En Windows abrir `http://10.77.55.3:8080` y contrastar el flujo visual con los mismos IDs en API/MySQL.

Los reinicios y la recuperación de VMs no son necesarios para publicar las fuentes. La evidencia previa de persistencia y los límites actuales se describen en [ENTREGA_GITHUB.md](ENTREGA_GITHUB.md).
