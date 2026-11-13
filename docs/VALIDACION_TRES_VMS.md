# Validación directa de las tres máquinas

13 de noviembre de 2026 · America/Manaus. Continuación de la primera publicación en GitHub, después de que el autor encendiera las tres VMs y autenticara localmente el acceso a los Ubuntus.

## Resultado actual

| Máquina | Comprobación directa | Material correspondiente en GitHub |
|---|---|---|
| WIN11-FRONTEND · 10.77.55.5 | Windows 11 encendido, Edge abrió `http://10.77.55.3:8080`; panel con “Base de datos conectada” y datos reales | `frontend/`, `shared/` y [captura del panel](../artifacts/github-vm-audit/frontend-windows11.png) |
| UBUNTU-BACKEND · 10.77.55.3 | Servicio `inventario-typescript` activo y habilitado; API identifica TypeScript/MySQL y responde 200 | `backend/`, `deploy/typescript/`, `package-lock.json` y [comparación de fuentes](../artifacts/github-vm-audit/source-comparison.json) |
| UBUNTU-DATABASE · 10.77.55.4 | MySQL 8.0.46 activo/habilitado, InnoDB, siete tablas, conexión TLS 1.3; PostgreSQL inactivo/deshabilitado y datos conservados | `db/mysql/`, `deploy/mysql/` y [esquema observado](../artifacts/github-vm-audit/mysql-schema.json) |

Las tres VMs usan `RedeProjeto`. La configuración de virtualización, RAM, CPU y direcciones se documenta en [virtual-machines.json](../artifacts/github-vm-audit/virtual-machines.json). No se incluyen discos virtuales ni imágenes del sistema operativo.

## Qué se comparó con las máquinas

En la instalación activa `/home/inventario/inventario-typescript` se compararon 22 archivos de fuentes/configuración: **21 coinciden** con el repositorio después de normalizar BOM y finales de línea; la única diferencia es `db/README.md`, actualizado localmente para describir el estado vigente. No hay fuentes activas encontradas solo en la VM.

También coinciden **los 12 archivos compilados comparados, byte por byte**, y la unidad systemd instalada coincide con `deploy/typescript/inventario-typescript.service`. Las respuestas HTML, CSS y JavaScript se contrastan con la compilación local. Los hashes y las rutas están en `artifacts/github-vm-audit/`.

El Frontend se ejecuta en el navegador de Windows, pero sus archivos son compilados y servidos por Ubuntu Backend. Por eso `frontend/` representa el componente de Windows aunque no necesite una segunda instalación de servidor dentro de Windows. No se realizó una búsqueda general de archivos personales del invitado Windows.

Las copias C# antiguas encontradas en los Ubuntus contienen versiones históricas diferentes. Las fuentes ya conservadas se referencian; las variantes que faltaban se guardan como texto en `docs/history/vm-snapshots/`, sin reemplazar el código activo. El [mapa de fuentes históricas](../artifacts/github-vm-audit/historical-source-map.json) relaciona las copias remotas con su archivo versionado. Los documentos históricos de las VMs no sustituyen las guías actualizadas del repositorio.

El configurador antiguo de Database apuntaba a `inventario-private.cnf`; la configuración instalada efectiva usa `zz-inventario-private.cnf`, que coincide con el configurador actual del repositorio. Las claves de configuración no sensibles y las variables efectivas de MySQL están registradas por separado.

## Banco y datos de demostración

Se leyó una instantánea consistente con una transacción MySQL de solo lectura:

| Tabla | Filas |
|---|---:|
| products | 17 |
| sales | 17 |
| sale_items | 17 |
| stock_movements | 42 |
| stock_requests | 8 |
| request_locks | 12 |
| schema_versions | 1 |
| **Total** | **114** |

Los productos son los registros `QA-...` de pruebas y el producto académico `VM13`. Se revisaron nombres, categorías y motivos: no son clientes ni operaciones comerciales. La exportación pública [demo-data.sql](../db/mysql/demo-data.sql) contiene únicamente esas siete tablas de aplicación, sin cuentas del motor, contraseñas, certificados o respaldos privados.

Se comprobaron las referencias entre filas, los totales de venta frente a sus partidas, el stock frente a la suma de movimientos y la coincidencia de tablas/columnas con el esquema del repositorio. Las sentencias INSERT se verifican mediante EXPLAIN, sin ejecutarlas sobre los datos. **No se probó una restauración completa en un segundo banco vacío.** Importar la demostración es opcional y requiere un banco nuevo; nunca aplicar este archivo al banco existente de las VMs.

El panel mostró 17 productos, 80 unidades, 17 ventas y R$404,20 de ingresos, coincidentes con API y SQL. El producto 13 continúa con stock 8 y la venta 9 con total 99,80.

## Verificación funcional sin alterar la grabación

Se aprobaron **12 consultas HTTP de solo lectura**: HTML, CSS, JavaScript, liveness, readiness, productos, producto 13, movimientos, ventas, venta 9, análisis y recursividad. Evidencia: [read-only-http.json](../artifacts/github-vm-audit/read-only-http.json).

No se volvieron a ejecutar en esta etapa los 33 escenarios que crean productos/ventas. Sus resultados previos permanecen en `artifacts/typescript/`. La captura actual valida la apertura y lectura del panel TypeScript en Windows; el recorrido visual de altas, ventas y rechazo de stock debe quedar registrado en los videos del autor.

No se reiniciaron VMs o servicios, no se cambiaron credenciales o reglas de red y no se importaron datos. La autenticación local se utilizó en memoria para esta revisión y se cerró al terminar.

## Reconstrucción

1. Clonar el repositorio y seguir [INSTALACION.md](INSTALACION.md).
2. En Database nueva aplicar `db/mysql/001_schema.sql`; opcionalmente cargar `db/mysql/demo-data.sql`.
3. Configurar una cuenta y certificados propios, sin reutilizar ni publicar secretos del laboratorio.
4. Compilar y activar Backend; abrir la URL privada desde Windows.

El enlace de entrega continúa siendo https://github.com/euthiagobusiness-spec/nexo-inventario .
