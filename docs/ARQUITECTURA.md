# Arquitectura vigente: TypeScript y MySQL

Actualizado: 13 de noviembre de 2026. Esta guía describe el candidato actual del MVP. La arquitectura C#/.NET y PostgreSQL de informes anteriores se conserva como historial; no es el Backend de TypeScript que responde en el puerto `8082`.

## Comunicación entre máquinas

```text
VM Windows 11 (RedeProjeto)
Navegador Edge: HTML + CSS + JavaScript compilado desde TypeScript
                 │ HTTP, mismo origen; API responde JSON
                 ▼
VM Ubuntu Backend — 10.77.55.3:8082
Node.js 24.19 · TypeScript · módulo HTTP nativo · mysql2/promise
                 │ MySQL sobre TLS, TCP 3306
                 ▼
VM Ubuntu Database — 10.77.55.4:3306
MySQL 8 · inventario_db · InnoDB
```

Las VMs y la red ya estaban creadas antes del desarrollo. El navegador recibe la interfaz del Backend y consulta rutas `/api/...` en el mismo origen. Solo Ubuntu Backend tiene credenciales de base de datos y abre conexiones a MySQL; el Frontend no se conecta a `:3306`. Los puertos locales SSH `2222` y `2223` permiten administrar las VMs, pero no son los puertos HTTP de la aplicación.

La API TypeScript se verificó en `http://10.77.55.3:8082`. El puerto `8080` todavía pertenece a la aplicación C#/.NET anterior, conectada a PostgreSQL; no se promovió ni reemplazó esa instalación. PostgreSQL sigue activo y sus datos están preservados.

## Capas de código

| Carpeta y archivo | Responsabilidad |
|---|---|
| `frontend/public/index.html` | Semántica, navegación, formularios, tablas y secciones del panel |
| `frontend/public/styles.css` | Diseño adaptable, contraste, foco y estados de interacción |
| `frontend/src/app.ts` | Interacción de pantalla y solicitudes HTTP desde el navegador |
| `shared/contracts.ts` | Contratos y tipos de respuestas/solicitudes JSON |
| `backend/src/server.ts` | Servidor HTTP, rutas, respuestas, validación de origen y archivos estáticos |
| `backend/src/domain.ts` | Validación de datos, importes en centavos y suma recursiva |
| `backend/src/VentaService.ts` | Algoritmo de venta portado explícitamente del original C# |
| `backend/src/InventoryStore.ts` | Pool MySQL, consultas SQL, bloqueos y transacciones |
| `db/mysql/001_schema.sql` | Esquema MySQL e índices |

El Backend usa Node.js sin Express, NestJS ni ORM. `mysql2/promise` es el controlador MySQL. `npm run build` compila el TypeScript del servidor y del navegador; luego copia HTML, CSS y JavaScript compilado a `dist/`, que sirve la API. No se necesitan frameworks web, CDN ni fuentes externas.

## Flujo de una venta

1. El navegador envía `POST /api/sales` con un UUID `requestId` y una o más líneas de producto.
2. `domain.ts` valida el JSON, UUID, identificadores y cantidades; el contrato acepta hasta 50 líneas únicas.
3. `InventoryStore.sell` inicia una transacción InnoDB, registra la clave idempotente y bloquea las filas de producto mediante `SELECT ... FOR UPDATE` en orden estable.
4. Crea copias de `Producto[]` y llama `VentaService.RegistrarVenta(venta, productos)` de TypeScript.
5. El método verifica cada producto y saldo temporal, calcula subtotal y total con centavos `BigInt`, y actualiza las cantidades solo si todo es válido.
6. Dentro de la misma transacción se guardan venta, detalles históricos, stock y movimientos. Un error revierte los cambios. Tras `COMMIT`, la API devuelve el resultado JSON y la interfaz actualiza la vista.

Los bloqueos de fila y la transacción protegen el estado persistente ante ventas simultáneas. El método académico en memoria no sustituye esas garantías de base de datos.

## Tablas y relaciones MySQL

| Tabla | Uso |
|---|---|
| `schema_versions` | Versión del esquema aplicada |
| `products` | SKU único, nombre, categoría, precio, saldo y umbral mínimo |
| `sales` | Cabecera, total, UUID y huella del pedido |
| `sale_items` | Detalles con producto y datos históricos de nombre/SKU/precio |
| `stock_movements` | Entradas y salidas, motivo y venta relacionada opcional |
| `stock_requests` | Idempotencia de ajustes de existencias |
| `request_locks` | Serialización de operaciones idempotentes |

Las tablas usan InnoDB, claves primarias, relaciones, restricciones y columnas monetarias `DECIMAL`. `deploy/mysql/` contiene la instalación inicial y la migración no destructiva desde PostgreSQL. El respaldo y la conexión permanecen en los servidores, fuera del código compartido.

## API HTTP

| Método y ruta | Propósito |
|---|---|
| `GET /api/health/live` | Comprueba que responde el proceso HTTP |
| `GET /api/health/ready` | Comprueba MySQL y el esquema |
| `GET /api/products` | Búsqueda y listado paginado |
| `POST /api/products` | Alta de producto |
| `GET /api/products/{id}` | Consulta un producto |
| `POST /api/products/{id}/stock` | Ajuste idempotente de stock con motivo |
| `GET /api/products/{id}/movements` | Movimientos recientes |
| `GET /api/sales` y `GET /api/sales/{id}` | Historial y detalle de ventas |
| `POST /api/sales` | Venta transaccional |
| `GET /api/analytics` | Indicadores BI y análisis BA |
| `GET /api/academic/recursion` | Suma recursiva sobre productos reales |

## Estado probado y operación pendiente

- Health readiness respondió HTTP 200 con `database=MySQL`, `language=TypeScript`.
- Las rutas de interfaz `/`, `/styles.css` y `/app.js` respondieron HTTP 200 durante la revisión actual.
- El informe actualizado de extremo a extremo en `artifacts/typescript/http-e2e-vm-latest.json` contiene **33 PASS, 0 FAIL y 0 BLOCKED** contra las VMs y MySQL.
- El reinicio controlado del proceso conservó una venta y un producto de verificación, con igualdad exacta de la respuesta anterior y posterior.
- PostgreSQL y el servicio .NET anterior siguen activos; no se borraron datos.
- La aplicación TypeScript responde en `:8082`, pero aún no es un servicio systemd de arranque automático. `sudo -n whoami` solicitó contraseña en Backend y Database.
- No se completó la inspección visual del candidato TypeScript en Edge en la VM Windows. Los recursos estáticos se probaron por HTTP.

Las pruebas y la descripción académica completa están en [la guía principal](COMO_O_SISTEMA_FOI_FEITO.md); el orden de carpetas y los accesos desde VS Code están en [VSCODE.md](VSCODE.md).
