# Entrega validada del inventario

> **INFORME HISTÓRICO — etapa C#/.NET y PostgreSQL.** El flujo visual y el contraste SQL de este reporte no prueban la versión TypeScript/MySQL. Consulte [la guía vigente](COMO_O_SISTEMA_FOI_FEITO.md) para estado, pruebas y pendientes actuales.

13 de noviembre de 2026, zona America/Manaus.

**API y PostgreSQL funcionan con datos reales.** El flujo de registro, venta y actualización de stock pasó las pruebas HTTP, incluidos concurrencia e idempotencia. Se verificaron persistencia e inicio automático después de reiniciar las VMs Ubuntu. La interfaz está implementada y tiene pruebas visuales previas, pero **falta validar su flujo completo dentro de WIN11-FRONTEND**. Por eso no se declara completada toda la integración de las tres máquinas.

## Infraestructura y dirección

| Componente | Dirección | Estado comprobado |
|---|---|---|
| WIN11-FRONTEND | 10.77.55.5 | VM activa, IP y red confirmadas mediante Guest Additions/VirtualBox |
| Ubuntu Backend | http://10.77.55.3:8080 | API 200, .NET 8 y servicio systemd activo |
| Ubuntu Database | 10.77.55.4:5432 | PostgreSQL 16, esquema aplicado y persistencia comprobada |

Desde la VM Frontend se debe abrir **http://10.77.55.3:8080**. No hace falta conectar el Windows físico a la subred. El túnel de la etapa anterior se cerró con el reinicio del Backend y dejó de ser la dirección de entrega.

## Cambios administrativos realizados

La comprobación inicial `sudo -n whoami` exigió contraseña en ambas VMs. El usuario proporcionó después autorización y credenciales para autenticar sudo. Se usó entrada oculta en sesiones SSH, sin incluir la contraseña en archivos de proyecto o comandos de historial.

Antes de configurar PostgreSQL se confirmó que `inventario_db` existía, pertenecía a `inventario_app`, no tenía tablas de usuario ni clientes de aplicación activos. No se borró ningún dato anterior.

1. Backup `pg_dump` del banco y copias de configuración en `/var/backups/inventario-mvp/`, directorios privados. El respaldo incluye un archivo privado para revertir la credencial del rol, que no forma parte de la entrega.
2. Aplicación de `db/001_schema.sql`, esquema `inventario_mvp`, con productos, ventas, detalles y movimientos.
3. Escucha PostgreSQL limitada a `127.0.0.1` y `10.77.55.4`. Acceso SCRAM por red permitido únicamente para `inventario_db`/`inventario_app` desde `10.77.55.3/32`. Rechazo explícito del resto de orígenes TCP, conservando reglas locales.
4. Credencial generada para el rol dedicado al proyecto, guardada únicamente en archivos privados de las VMs (0600), transferida por SSH mediante memoria del proceso y sin archivo local en Windows.
5. Unidad de sistema `/etc/systemd/system/inventario-mvp.service`, con usuario de ejecución `inventario`, reinicio por fallo y arranque habilitado. La unidad de usuario anterior quedó deshabilitada.
6. Reinicio controlado de cada VM Ubuntu y comprobación posterior de servicio y registros persistidos.

No se instalaron servicios en el Windows físico ni se modificaron VPN, VPS, adaptadores, NAT, firewall del host o servicios externos. UFW estaba inactivo en ambas VMs y no se activó/desactivó. Las restricciones de PostgreSQL se aplicaron en escucha y autenticación. No se expuso 5432 por un nuevo port-forward del host.

## Uso efectivo de VentaService

El registro HTTP usa `InventoryStore.Sell`. Dentro de una transacción bloquea las filas de productos, construye `Venta` y `Producto[]`, llama **`VentaService.RegistrarVenta`**, persiste los totales y el `StockActual` producidos por el método, registra movimientos y confirma.

El archivo original permanece en `docs/VentaService.original.cs.txt`. La versión ejecutable conserva firma, estructura y los seis `while`. Solo tres líneas monetarias usan `decimal` en lugar de `double`, como se documenta en `ALGORITMO.md`. `tests/check_original.py` volvió a aprobar la comparación. Los logs del servicio contienen los mensajes del algoritmo durante ventas reales y las respuestas HTTP/consultas posteriores confirman el commit.

## Resultados reales

| Prueba | Resultado | Archivo |
|---|---|---|
| Algoritmo, validaciones y recursividad en memoria | 24 PASS, 0 FAIL | artifacts/unit-tests.txt |
| Comparación completa con VentaService original | PASS, solo tres líneas adaptadas | artifacts/original-check.txt |
| HTTP desde Ubuntu Backend contra PostgreSQL | **33 PASS, 0 FAIL, 0 BLOCKED** | artifacts/http-with-db-backend.json |
| HTTP desde Ubuntu Database contra Backend/PostgreSQL | **33 PASS, 0 FAIL, 0 BLOCKED** | artifacts/http-with-db-database.json |
| Persistencia tras reinicio del servicio API | PASS, registro exacto conservado | artifacts/persistence-after-api-restart.json |
| Persistencia tras reinicio de PostgreSQL | PASS, registro exacto conservado | artifacts/persistence-after-postgresql-restart.json |
| Arranque/persistencia tras reiniciar VM Backend | PASS, servicio active/enabled sin iniciarlo manualmente | artifacts/persistence-after-backend-vm-reboot.json |
| Arranque/persistencia tras reiniciar VM Database | PASS, PostgreSQL activo y registros intactos | artifacts/persistence-after-database-vm-reboot.json |
| Rechazo de conexión desde origen privado no autorizado (.4) | PASS, rechazo explícito pg_hba | artifacts/lab-validation.json |
| Flujo por navegador dentro de WIN11-FRONTEND | **PENDIENTE** | Interacción visual detenida por el usuario |

Los 33 casos se repiten desde dos orígenes. No son 66 escenarios diferentes. Las pruebas crean registros QA y los conservan. Las suites incluyen alta, consulta, SKU duplicado, precio/cantidad inválidos, detalle nulo, venta, total, stock, reintento idempotente, UUID con contenido distinto, venta insuficiente, ajuste, saldo negativo, atomicidad multiproducto, movimientos, BI/BA y recursividad.

La prueba concurrente envió dos ventas contra una unidad: una respondió **200**, otra **409**, y el stock final fue **0**. La prueba de idempotencia conservó el mismo ID de venta sin un segundo descuento.

Ejemplo de la primera suite: producto con stock 10 y precio R$12,35. Venta de 3 unidades: total **R$37,05**, stock **7**. Repetir la solicitud no descontó otra vez. Un ajuste de +2 dejó stock **9**. La venta imposible y la transacción multiproducto inválida conservaron los stocks.

Los checkpoints posteriores conservaron producto ID 6, venta ID 4, stock 0 y total R$1,00, incluidos los demás campos originales de ambos registros. No se usó la mera existencia de un proceso como prueba de persistencia.

## BI y BA observados

Al cierre de las dos primeras suites, antes de regresiones o demostraciones posteriores:

| Indicador | Valor real |
|---|---|
| Productos | 4 |
| Ventas | 4 |
| Unidades disponibles | 18 |
| Ingresos | R$76,10 |
| Valor del inventario a precio de venta | R$222,30 |
| Productos con stock ≤ mínimo | 2 |
| Productos con stock negativo | 0 |

`GET /api/analytics` devolvió esos valores y recomendaciones basadas en ventas reales. Los dos productos agotados mostraron compra sugerida de una unidad. Las cifras pertenecen a los datos QA conservados, no a operaciones comerciales del usuario ni a datos simulados en pantalla. La media se redondea con `decimal.Round` de .NET. El inventario se valora a precio de venta, no coste o beneficio.

## Interfaz y tres máquinas

La interfaz tiene dashboard, catálogo paginado, alta, ajustes con motivo/historial, carrito, ventas, BI/BA y sección académica. La etapa previa verificó navegación, formulario, conservación de valores ante error y breakpoints en Chrome del host mediante túnel, cuando el banco aún no estaba disponible. Esa evidencia sigue siendo histórica y **no prueba el flujo con datos reales dentro de la VM Frontend**.

En esta etapa se detectó WIN11-FRONTEND (10.77.55.5), se abrió Edge dentro de la VM y se intentó navegar. La automatización no confirmó que se completara la navegación y luego el usuario la detuvo con Escape. No se continuó enviando entrada a esa ventana. No se declara aprobado el CRUD visual de las tres VMs.

## Archivos y presentación

Código C# y UI: `src/Inventario.Api`. SQL: `db`. Pruebas: `tests`. Administración de laboratorio: `deploy/configure-lab-database.py`, `transfer-connection.py` e `install-backend-service.sh`. Documentación española: `ALGORITMO.md`, `ARQUITECTURA.md`, `SCRUM.md`, `OPERACION.md`, `GUION_PRESENTACION.md` y este informe.

Presentación en español: ocho diapositivas editables sobre arquitectura, algoritmo, Big O, transacción, UI/UX, BI/BA, pruebas y alcance. Sus ocho renders se revisaron individualmente. La presentación identifica expresamente la validación visual de WIN11-FRONTEND como pendiente. El PowerPoint exportado queda en `deliverables/Nexo-Inventario-ES.pptx`.

Fuentes y documentación actualizadas en ambas VMs, ruta `/home/inventario/inventario-mvp`. La conexión privada se encuentra fuera de ese árbol, en `~/.config/inventario/`, para no incluirla en archivos de entrega. No se hicieron commits ni pushes.

## Pendientes concretos

1. Abrir la aplicación en Edge dentro de WIN11-FRONTEND y verificar producto → venta → stock mediante la UI con un SKU nuevo. Capturar resultado e IDs reales. También verificar allí gráficos y recomendaciones con datos.
2. Si el docente exige punteros crudos, confirmar el criterio. El proyecto usa referencias administradas y documenta por qué no necesita `unsafe`; no se inventó uso de punteros.
3. Después de la presentación, revisar con el propietario la vigencia de la autorización administrativa temporal. No se modificaron reglas sudoers.

Uso limitado al laboratorio privado. No incluye autenticación de operadores, HTTPS público, devoluciones o un sistema predictivo. Estos elementos no se presentan como funcionalidades terminadas.
