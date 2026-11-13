# Nexo: arquitectura, desarrollo y funcionamiento

> **Estado de entrega GitHub (13/11/2026):** consulte [ENTREGA_GITHUB.md](ENTREGA_GITHUB.md). La evidencia posterior confirma recuperación de Database y persistencia; SSH no estuvo accesible durante la preparación del repositorio.

> **Registro de la etapa de promoción:** los pendientes y direcciones candidatas que siguen corresponden a sus fechas de verificación. La recuperación posterior está en `artifacts/typescript/persistence-after-database-vm-reboot-recovery.json`.

> **Actualización de implantación:** la promoción TypeScript/MySQL a `:8080` pasó 33 pruebas y el reinicio de la VM Backend conservó los registros. El siguiente reinicio de Database se detuvo en el arranque de Linux, sin red/SSH. La API informa 503 mientras se recupera esa VM. PostgreSQL y sus datos siguen preservados. Consulte [el informe de continuación](PROMOCION_TYPESCRIPT_MYSQL.md). Las secciones que describen la candidata `:8082` documentan el estado previo a esta promoción.

**Documentación actual en español.** Fecha: 13 de noviembre de 2026. Esta guía describe las carpetas que se ven en VS Code y el estado real del código y de las máquinas. Separa la API TypeScript desplegada para pruebas de la API C# anterior que aún ocupa el puerto principal.

## 1. Qué es el sistema y cómo se conectan las máquinas

Nexo es una aplicación web de inventario. Tiene una interfaz en el navegador, un Backend que expone una API HTTP y un servidor MySQL que guarda productos, ventas y movimientos. Las VMs y sus redes **ya existían y fueron proporcionadas por el usuario**; no las creamos. La red de laboratorio se llama `RedeProjeto`.

```text
VM Windows 11 — Frontend
Edge: http://10.77.55.3:8082  (candidata TypeScript, verificada)
                       │ HTTP + JSON por RedeProjeto
                       ▼
VM Ubuntu Backend — 10.77.55.3
Node.js 24 / API TypeScript / mysql2
                       │ TCP 3306, MySQL con TLS
                       ▼
VM Ubuntu Database — 10.77.55.4
MySQL 8, motor InnoDB y base inventario_db
```

El Frontend pide datos a la API con llamadas HTTP, como `GET /api/products` o `POST /api/sales`. La API comprueba las entradas, ejecuta reglas de inventario, envía SQL a MySQL y devuelve JSON. Solo la VM Backend se conecta a MySQL. El navegador nunca necesita la contraseña ni una conexión directa al puerto 3306.

El código usa peticiones relativas `/api/...` y el servidor sirve los archivos de la interfaz desde el mismo origen. Esto evita que el navegador llame a un host distinto durante las operaciones normales. MySQL está configurado en la VM Database para escuchar por loopback y por `10.77.55.4:3306`; PostgreSQL continúa instalado y activo en `10.77.55.4:5432`. Los archivos de conexión y la CA TLS están en directorios privados de las VMs, fuera de Git y de los paquetes de código.

Las conexiones SSH del laboratorio se reenvían al equipo local por `127.0.0.1:2222` (Backend) y `127.0.0.1:2223` (Database). Estos puertos son para administrar y consultar las VMs; el navegador usa la IP privada de Backend, no el túnel SSH.

## 2. Cómo abrir y navegar el proyecto

En Windows, el proyecto está en:

```text
C:\Users\euthi\OneDrive\Documentos\ChatGPT\Projeto-Inventario
```

El workspace muestra las carpetas por función. Para abrirlo en VS Code desde PowerShell:

```powershell
$proyecto = 'C:\Users\euthi\OneDrive\Documentos\ChatGPT\Projeto-Inventario'
Set-Location -LiteralPath $proyecto
code "$proyecto\Inventario.code-workspace"
```

En **Explorer / Explorador** del workspace:

| Carpeta visible | Carpeta del proyecto | Qué contiene |
|---|---|---|
| Backend TypeScript | `backend/` | Servidor HTTP, reglas, acceso MySQL y pruebas TS |
| Frontend TypeScript | `frontend/` | Aplicación de navegador en TypeScript, HTML y CSS |
| Base de datos | `db/` | Esquemas MySQL activo y PostgreSQL anterior |
| Contratos | `shared/` | Interfaces JSON compartidas entre las dos aplicaciones |
| Implementación | `deploy/typescript/` | Runtime privado y definición del servicio candidato |
| Pruebas TypeScript | `backend/tests/` | Pruebas de reglas, algoritmo y HTTP |
| Documentación | `docs/` | Esta explicación y guías académicas |
| Entregables | `deliverables/` | Materiales anteriores de la entrega académica |
| C# anterior conservado | `src/Inventario.Api/` | Implementación .NET anterior, incluido el `VentaService` suministrado |
| Pruebas C# anteriores | `tests/Inventario.Tests/` | Pruebas de la implementación C# anterior |
| Proyecto completo | `./` | Archivos del proyecto y configuración VS Code |

Para abrir código del Frontend, API y SQL en pestañas:

```powershell
code --reuse-window `
  "$proyecto\frontend\src\app.ts" `
  "$proyecto\frontend\public\index.html" `
  "$proyecto\frontend\public\styles.css" `
  "$proyecto\backend\src\server.ts" `
  "$proyecto\backend\src\domain.ts" `
  "$proyecto\backend\src\InventoryStore.ts" `
  "$proyecto\backend\src\VentaService.ts" `
  "$proyecto\shared\contracts.ts" `
  "$proyecto\db\mysql\001_schema.sql"
```

## 3. Versiones y lenguajes

La aplicación actual está escrita en **TypeScript** de forma estricta en el Frontend y Backend. Node.js ejecuta el Backend, y el compilador `tsc` genera JavaScript para ejecutarlo y entregarlo al navegador. Se usan versiones fijadas en el lockfile: TypeScript 7.0.2, `mysql2` 3.24.6 y Node.js 24.19.0 como runtime del Backend de prueba. Se conserva también Node.js instalado en Windows para desarrollar localmente.

La API anterior se escribió en C# con .NET 8 y MySqlConnector. Se conserva íntegra en la carpeta C# para su revisión. La nueva aplicación invoca **la traducción TypeScript** del algoritmo de ventas, no el binario o la clase C# en ejecución. Por ello el requisito antiguo de ejecutar `VentaService` C# quedó reemplazado cuando el usuario eligió TypeScript para las dos capas.

El Frontend utiliza HTML semántico, CSS y TypeScript/JavaScript del navegador. No utiliza React, Angular, Bootstrap, biblioteca de gráficos, CDN ni fuentes web externas. El Backend utiliza el módulo HTTP de Node.js y `mysql2/promise`, sin Express, NestJS, ORM ni Entity Framework.

## 4. Frontend: construcción paso a paso

La fuente editable del Frontend es `frontend/src/app.ts`; HTML y CSS viven en `frontend/public/`. El proyecto API y los tipos compartidos están en `shared/contracts.ts`.

1. `index.html` define cinco vistas: panel general, productos, ventas, análisis BI/BA y explicación académica. Cada vista incluye estructura, texto, campos, tablas, botones y estados vacíos.
2. `styles.css` aporta la jerarquía visual: navegación azul oscura, fondo claro, tarjetas blancas, bordes discretos y colores para producto disponible, stock bajo o agotado. Usa Grid y Flexbox.
3. Las reglas de `@media` cambian la disposición en pantallas medianas y estrechas. En una pantalla angosta, la navegación se puede desplazar horizontalmente y las tarjetas pasan a una columna.
4. `app.ts` usa `querySelector`, listeners y `fetch`. Las rutas `#dashboard`, `#products`, `#sales`, `#analytics` y `#academic` cambian de vista sin recargar la página.
5. `shared/contracts.ts` declara los tipos JSON de productos, ventas, movimientos, páginas y análisis. `Elements` en `app.ts` asigna tipos DOM a IDs usados en pantalla.
6. La tarea `npm run build` compila TypeScript a JavaScript y `tools/copy-static.mjs` reúne el JavaScript, HTML y CSS en `dist/frontend/` para servirlos desde la API.

### Funciones de UI

- Panel con productos recientes, unidades disponibles, ventas, alertas de stock e historial reciente.
- Alta de producto con SKU, nombre, categoría, precio, stock inicial y mínimo.
- Búsqueda y paginación del catálogo; estados de agotado, stock bajo y disponible.
- Ajuste de stock positivo/negativo con motivo y vista de los últimos 100 movimientos.
- Carrito con cantidades editables, eliminación de líneas, total estimado y confirmación.
- Consulta del historial y detalle de una venta.
- Panel de BI, gráfico diario HTML `<meter>`, productos más vendidos y reposición estimada.
- Mensajes de estado de la API y del banco.

### UX y estados

Los formularios describen cada campo y limitan valores antes del envío; las mismas reglas se vuelven a comprobar en Backend. Los botones se deshabilitan mientras se envía una petición, se muestran errores legibles y el catálogo indica cuando está vacío. El sistema utiliza el UUID de la operación como llave de idempotencia. El navegador conserva el carrito y el UUID pendiente en `sessionStorage`, de forma que una repetición por pérdida de conexión no descuente dos veces.

El código incluye foco visible, etiquetas, enlace para saltar al contenido, `aria-label`, `aria-current` y roles de estado/alerta. No se ha hecho una auditoría completa de accesibilidad ni un estudio formal de usuarios. La interfaz se refresca al abrir, al pulsar actualizar y después de una operación; no tiene actualizaciones push continuas.

## 5. Backend: construcción paso a paso

La API TS está en `backend/src/`; la interfaz de contratos compartidos está en `shared/contracts.ts`.

1. `server.ts` crea un servidor con el módulo estándar `node:http`, recibe una solicitud, interpreta método y ruta, llama la regla/consulta correspondiente y devuelve JSON.
2. `jsonBody()` exige JSON y limita las peticiones a 64 KiB.
3. Las validaciones de `domain.ts` normalizan el SKU, limitan el tamaño de nombres, verifican importes a dos decimales, enteros, UUID, tamaño de venta, productos duplicados y paginación.
4. `InventoryStore.ts` administra un pool asíncrono `mysql2/promise` con un límite de 20 conexiones, consulta SQL parametrizada y tiempos de espera.
5. `VentaService.ts` lleva la clase académica al código TypeScript. El total en memoria usa centavos `BigInt` exactos y se almacena como `DECIMAL`.
6. El endpoint de venta comienza transacción SQL, espera el bloqueo de la solicitud y las filas de producto, verifica el stock con `VentaService`, graba venta, partidas y movimientos y solo entonces confirma.
7. Fallos o falta de stock ejecutan `rollback`; las peticiones repetidas usan UUID/hash para que un reintento no duplique la operación.
8. `server.ts` mantiene HTML, CSS y JavaScript compilado en el mismo origen que `/api`.

Rutas disponibles:

| Método y ruta | Resultado |
|---|---|
| `GET /api/health/live` | Confirma que el proceso responde |
| `GET /api/health/ready` | Confirma que puede consultar el esquema MySQL |
| `GET /api/products` | Lista y busca productos, con paginación |
| `POST /api/products` | Crea un producto y registra stock inicial |
| `GET /api/products/{id}` | Obtiene un producto |
| `POST /api/products/{id}/stock` | Ajusta stock y registra el motivo |
| `GET /api/products/{id}/movements` | Consulta movimientos recientes |
| `GET /api/sales` | Lista ventas |
| `POST /api/sales` | Registra y devuelve una venta confirmada |
| `GET /api/sales/{id}` | Consulta venta y partidas |
| `GET /api/analytics` | Devuelve BI y recomendaciones BA |
| `GET /api/academic/recursion` | Ejecuta la suma recursiva con datos reales |

La API devuelve HTTP 400 para entrada inválida, 404 para registro ausente, 409 para conflictos e inventario insuficiente y 503 cuando la base no está disponible. También establece CSP, `no-store`, `nosniff` y `Referrer-Policy` y rechaza orígenes externos para operaciones de escritura. Esto no implementa login ni cuentas de usuario.

### Venta y transacción

1. El navegador envía un UUID, IDs de producto y cantidades; nunca decide el precio definitivo.
2. `saleInput()` valida identificador, cantidades y productos únicos; ordena los IDs.
3. `InventoryStore.sell()` abre `READ COMMITTED`.
4. Inserta o bloquea una fila de `request_locks` para serializar la misma solicitud.
5. Bloquea las filas de producto en orden con `SELECT ... FOR UPDATE`.
6. Construye `Producto[]` y `Venta` y ejecuta `VentaService.RegistrarVenta(...)` de TypeScript.
7. Si acepta, inserta la cabecera y las partidas, actualiza el stock y registra los movimientos en la misma transacción.
8. `commit` confirma todos los cambios juntos. Si alguna regla, sentencia o insert falla, se revierte todo.

### VentaService y requisitos académicos

`src/Inventario.Api/VentaService.cs` mantiene el algoritmo C# original de referencia. La versión ejecutada ahora está en `backend/src/VentaService.ts`, conserva el método `RegistrarVenta(Venta venta, Producto[] productos)`, copia temporalmente el inventario, valida producto/cantidad/stock, calcula subtotales y total, actualiza stock al final y mantiene los seis `while`.

En el vector de n productos y m detalles, la búsqueda repetida es `O(n + m·n)` en tiempo y la copia temporal requiere `O(n)` memoria. IDs diferentes se ordenan para adquirir bloqueos en un orden compartido. El coste de SQL y comunicaciones es adicional y no está incluido en esa cota.

La operación monetaria almacena céntimos como `BigInt`; SQL lo persiste en columnas `DECIMAL`. La recursividad `recursiveValue()` divide el listado en dos. Tarda `O(n)` y la pila de llamadas usa `O(log n)`; la lista sigue ocupando `O(n)` memoria. Se emplea en el valor del inventario.

No se emplean punteros de memoria directa; TypeScript usa memoria gestionada. `docs/SCRUM.md` conserva la metodología académica y las etapas. Esta documentación no inventa reuniones ni ceremonias que no estén registradas.

## 6. Base de datos MySQL

El esquema está en `db/mysql/001_schema.sql`. Usa InnoDB, clave autoincremental `BIGINT`, claves externas, SKU único, límites `CHECK`, stock entero, `DECIMAL` para precios y `DATETIME(6)` para UTC.

| Tabla | Registro persistente |
|---|---|
| `products` | Producto, precio, categoría, mínimo y saldo actual |
| `sales` | UUID, hash, total y hora |
| `sale_items` | Producto, nombre/SKU al vender, cantidad y precio unitario |
| `stock_movements` | Entrada/salida, motivo, relación con venta y fecha |
| `stock_requests` | Repeticiones idempotentes de ajustes |
| `request_locks` | Exclusión transaccional por operación |
| `schema_versions` | Versión aplicada del esquema |

`mysql2/promise` recibe el certificado CA, valida el certificado TLS y requiere transporte seguro. La cuenta de la aplicación se limita a la base `inventario_db` y al host del Backend `10.77.55.3`. La cadena existente se toma de `~/.config/inventario/mysql.env`; ningún secreto está en el repositorio.

## 7. UI de BI y BA

Los indicadores proceden de `InventoryStore.analytics()` en una transacción `REPEATABLE READ`.

| BI: medida observada | Regla |
|---|---|
| Productos | Número de productos |
| Unidades | Suma de saldos actuales |
| Bajo mínimo | Stock menor o igual que el mínimo, incluye agotados |
| Valor de inventario | Precio de venta × stock, total recursivo |
| Ventas/ingresos | Cantidad de ventas y suma total del historial |
| Ingresos 30 días | Últimas 720 horas UTC |
| Ticket medio | Ingresos históricos ÷ ventas históricas |
| Más vendidos | Hasta cinco productos por cantidad en últimos 30 días |
| Gráfico diario | Ingresos por fecha UTC para 30 días, con fechas sin venta en cero |

BA da una orientación de reposición, no una predicción:

```text
media diaria = unidades vendidas en 30 días / 30
cobertura = stock actual / media diaria
pedido sugerido = max(0, ceil(media diaria × 30) + mínimo − stock actual)
```

Ejemplo didáctico: 60 unidades vendidas, saldo 10 y mínimo 5 sugieren 55 unidades. Sin ventas la cobertura es «Sin demanda». La fórmula no conoce costo, margen, proveedor, plazo o estacionalidad; el valor del inventario usa precio de venta y no representa costo. Ingresos no equivalen a utilidad.

## 8. Cómo se trasladaron los registros

La primera instalación añadió MySQL sin borrar PostgreSQL. `deploy/mysql/migrate-data.py` comprobó que las tablas destino estuvieran vacías, hizo un `pg_dump`, exportó las seis tablas de datos en una instantánea consistente de PostgreSQL, mantuvo IDs y ajustó los siguientes autoincrementos de MySQL. Luego comparó las columnas normalizadas de cada fila y guardó un informe/hash. Se añadieron `request_locks` para serializar las operaciones nuevas.

En la instantánea inicial coincidieron exactamente: 1 versión, 9 productos, 9 ventas, 9 partidas, 22 movimientos y 4 solicitudes de stock. El producto 13, stock 8, y venta 9, total 99,80, de la demostración anterior se volvieron a recuperar sin cambios tras la copia y después de reiniciar el nuevo proceso Node. El respaldo continúa en el servidor Database. No se borraron filas ni esquema PostgreSQL.

## 9. Verificaciones realmente realizadas

La máquina local Windows tiene Node.js `v24.19.0` y npm `11.17.0`. En este workspace se ejecutó:

```powershell
npm ci
npm run typecheck
npm test
```

Resultado: 39 pruebas pasaron, 0 fallaron; 29 pruebas de lógica/algoritmo y 10 de HTTP. Se comprobó recursividad con 100.001 elementos, precisión monetaria, validaciones, errores, CSP, entrega estática y ausencia de archivos privados. En el test HTTP local, la API sin conexión DB debe responder 503 a `health/ready`. La salida de la ejecución local actual está en `artifacts/typescript/unit-tests-local.txt`.

En las VMs, Node 24.19 se instaló en el directorio del usuario Backend mediante el tarball oficial y una comparación con su checksum SHA256 publicado. `npm ci --omit=dev` instaló las dependencias de producción en `/home/inventario/inventario-typescript`. La API TS en `10.77.55.3:8082` respondió `200` a `/api/health/ready` e informó `{ "database": "MySQL", "language": "TypeScript" }`.

Contra ese Backend y MySQL reales se ejecutaron los 33 escenarios HTTP. Después de ajustar el límite que decide cuándo un importe se serializa como número o cadena decimal, se volvió a desplegar el archivo compilado y se repitió la suite: **33 PASS, 0 FAIL, 0 BLOCKED**. Se verificó creación, listado, venta, totales y stock, escasez, idempotencia, ajuste, movimientos, atomicidad multiproducto, ventas simultáneas, BI/BA, recursividad y segunda conexión HTTP. El informe más reciente está en `artifacts/typescript/http-e2e-vm-latest.json`.

Antes de reiniciar el proceso se guardó la venta y producto reales. Después se terminó Node, se inició de nuevo y se compararon los mismos datos por HTTP. Resultado exacto: `status PASS`, `productId=19`, `saleId=13`, `stock=0`, `saleTotal=1`, `exactRecordMatch=true`. El punto original posterior a la migración también coincidió: producto 13/stock 8 y venta 9/total 99,80.

Todavía no se ha probado la interfaz TypeScript visualmente en Edge dentro de Windows 11. La ruta `/`, CSS y JavaScript compilado sí devolvieron HTTP 200 en las pruebas de los dos servidores. Tampoco se ha probado el arranque automático de Node después de reiniciar la VM Backend.

## 10. Estado de publicación y pasos faltantes

El PostgreSQL de la entrega anterior sigue activo. `http://10.77.55.3:8080` sigue reservado a la API anterior; la API actual TypeScript con MySQL, demostrada y probada, está separada en `http://10.77.55.3:8082`. La candidata anterior MySQL/.NET en 8081 está inactiva.

El runtime y el proceso TypeScript se ejecutan bajo `inventario`, sin reemplazar todavía el puerto principal. El archivo `deploy/typescript/inventario-typescript-candidate.service` prepara una unidad para producción; su instalación en `/etc/systemd` requiere privilegios administrativos. El último `sudo -n whoami` solicitó contraseña en las VMs, por lo que no instalé ni activé esa unidad ni cambié el puerto principal. Tampoco desactivé PostgreSQL. Los datos de ambos motores se conservan.

Para publicar el sistema integrado como servicio automático en `:8080`, queda otorgar/usar administración de Ubuntu Backend, instalar y habilitar la unidad revisada, mover el listener tras pruebas, validar Edge y reinicios y solo entonces detener/deshabilitar PostgreSQL. El sistema funcional de pruebas es la candidata TypeScript/MySQL en `:8082`; no se presenta `:8080` como TypeScript.

## 11. Ejecutar pruebas e iniciar localmente

Desde PowerShell:

```powershell
Set-Location -LiteralPath 'C:\Users\euthi\OneDrive\Documentos\ChatGPT\Projeto-Inventario'
npm ci
npm run typecheck
npm test
npm run build
npm start
```

Abrir `http://127.0.0.1:5080`. Sin variables/conexión a una instancia MySQL permitida, el Backend sirve la interfaz pero las rutas que consultan datos devuelven 503. Las credenciales del laboratorio están limitadas al Backend privado; no se debe copiar `mysql.env` al workspace.

Para ver los registros de un servidor con acceso por SSH:

```powershell
ssh -o BatchMode=yes -p 2222 inventario@127.0.0.1
```

```bash
cd /home/inventario/inventario-typescript
ls backend/src frontend/src frontend/public shared db/mysql
less backend/src/server.ts
less backend/src/InventoryStore.ts
less frontend/src/app.ts
less db/mysql/001_schema.sql
```

La estructura de código, la conexión entre máquinas y el estado de publicación aquí descritos son distintos de los artefactos históricos C#/.NET y PostgreSQL que se conservan para referencia.
