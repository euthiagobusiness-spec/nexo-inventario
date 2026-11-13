# Entrega final del MVP académico

> **INFORME HISTÓRICO — etapa C#/.NET y PostgreSQL.** Los resultados, endpoint `:8080`, versión de algoritmo, pruebas y estado que siguen describen aquella entrega. La versión vigente TypeScript/MySQL, sus pruebas y pendientes están en [la guía actual](COMO_O_SISTEMA_FOI_FEITO.md). No use este informe como estado actual del despliegue.

13 de noviembre de 2026, America/Manaus.

**El flujo principal quedó integrado y probado en las tres máquinas virtuales.** Edge dentro de WIN11-FRONTEND registró el producto `VM13`, confirmó la venta #9, mostró la actualización del stock y rechazó una venta superior al saldo. Una consulta SQL independiente confirmó los mismos registros en PostgreSQL.

Aplicación: **http://10.77.55.3:8080**, abierta desde WIN11-FRONTEND. El dashboard quedó abierto y conectado al terminar la validación.

## Las tres máquinas

| Máquina | Dirección | Función y verificación |
|---|---|---|
| WIN11-FRONTEND | 10.77.55.5 | Edge, HTML/CSS/JavaScript, flujo visual completo verificado |
| Ubuntu Backend | 10.77.55.3:8080 | API C#/.NET 8, VentaService y transacciones |
| Ubuntu Database | 10.77.55.4:5432 | PostgreSQL 16, esquema inventario_mvp y persistencia SQL |

El navegador usa HTTP contra el Backend. El Backend usa Npgsql contra `inventario_db` con el rol `inventario_app`. PostgreSQL autoriza conexiones privadas de la aplicación únicamente desde 10.77.55.3. No se utilizó el túnel del Windows físico para la prueba final.

## Prueba de aceptación visual ejecutada

| Acción real dentro de la VM Frontend | Resultado observado |
|---|---|
| Abrir la aplicación | «Base de datos conectada», indicadores y productos reales |
| Alta de producto | SKU VM13, nombre demo, categoría demo, precio R$49,90, stock 10, mínimo 5 |
| Añadir dos unidades al carrito | Total estimado R$99,80 |
| Confirmar venta | «Venta #9 confirmada por R$99,80. Existencias actualizadas.» |
| Consultar catálogo | Stock 8 |
| Abrir movimientos | Venta #9, salida −2, stock actual 8 |
| Intentar vender nueve unidades | Rechazo explícito de VentaService por stock insuficiente |
| Recargar el navegador | Stock conservado en 8 |
| Abrir BI | Ingresos R$252,00, ticket medio R$28,00, inventario R$843,80, nueve ventas |
| Abrir BA | VM13: dos unidades vendidas, media mostrada 0,07/día, cobertura 120 días, compra sugerida 0 |
| Ejecutar recursividad desde la UI | Nueve productos, valor R$843,80, O(n) tiempo y O(log n) pila |

La entrada de teclado directa del automatizador no llegó al Windows invitado. Se utilizó el teclado de pantalla del propio VirtualBox para el formulario, sin habilitar portapapeles compartido ni cambiar protecciones. Los clics, formularios, mensajes, tablas y gráficos se observaron dentro de la VM real. Los intentos anteriores bloqueados/interrumpidos se conservan en documentos históricos.

## Contraste directo con PostgreSQL

`tests/verify_frontend_records.py` se ejecutó dentro de Ubuntu Database utilizando la credencial ya configurada, únicamente en memoria y sin imprimirla.

| Registro persistido | Valor confirmado por SQL |
|---|---|
| Producto | ID 13, SKU VM13, precio 49.90, stock 8, mínimo 5 |
| Venta del producto | Una sola venta: ID 9, cantidad 2, precio unitario 49.90, total 99.80 |
| Movimientos | ID 21: +10 inicial; ID 22: −2 asociado a venta #9 |
| Intento rechazado | No creó otra venta ni otro movimiento para VM13 |
| Stock negativo en toda la tabla | Cero productos |

Resultado: **6 comprobaciones SQL aprobadas**. Evidencia: `artifacts/frontend-database-proof.json`. Las observaciones visuales están registradas en `artifacts/ui-vm-final.json`.

## VentaService obligatorio

La aplicación real utiliza `VentaService.RegistrarVenta(Venta venta, Producto[] productos)`. El adaptador abre una transacción, bloquea productos en orden ascendente mediante `FOR UPDATE`, llama al método académico y persiste el total, los detalles y el stock calculados antes del commit.

Se preservaron firma, copia temporal, búsquedas y validaciones, cálculo de subtotales, actualización del stock, total y los **seis while**. Solo tres líneas monetarias cambian `double` por `decimal`, con justificación exacta en `ALGORITMO.md`. El original está conservado en `VentaService.original.cs.txt` y la comparación automatizada volvió a aprobarse. No existe una implementación paralela que reemplace el algoritmo de venta.

Complejidad del método: O(n + m·n) tiempo, O(n) memoria adicional, donde n es el número de productos cargados y m el número de detalles. La recursividad se implementó separadamente para sumar el valor del inventario: O(n) tiempo y O(log n) pila. No se implementaron punteros `unsafe`; la aplicación usa referencias administradas y documenta esa decisión. Scrum se presenta como organización individual del trabajo mediante backlog y criterios, sin inventar reuniones o equipo.

## Resumen de pruebas reales

| Área | Resultado | Evidencia |
|---|---|---|
| Algoritmo, reglas y recursividad en memoria | 24 PASS, 0 FAIL | artifacts/unit-tests.txt |
| Comparación con original | PASS, solo tres líneas adaptadas | artifacts/original-check.txt |
| Regresión HTTP desde Backend | 33 PASS, 0 FAIL, 0 BLOCKED | artifacts/http-final-backend.json |
| Regresión HTTP desde Database | 33 PASS, 0 FAIL, 0 BLOCKED | artifacts/http-final-database.json |
| UI real dentro de WIN11-FRONTEND | Diez observaciones aprobadas | artifacts/ui-vm-final.json |
| SQL del flujo visual | 6 PASS | artifacts/frontend-database-proof.json |
| Persistencia tras reiniciar API | PASS | artifacts/persistence-after-api-restart.json |
| Persistencia tras reiniciar PostgreSQL | PASS | artifacts/persistence-after-postgresql-restart.json |
| Persistencia e inicio tras reiniciar VM Backend | PASS | artifacts/persistence-after-backend-vm-reboot.json |
| Persistencia e inicio tras reiniciar VM Database | PASS | artifacts/persistence-after-database-vm-reboot.json |
| Restricción de acceso PostgreSQL | Origen .3 funciona; origen .4 rechazado por pg_hba | artifacts/lab-validation-final.json |

Las dos suites HTTP repiten escenarios desde orígenes diferentes. No se presentan como 66 escenarios distintos. Incluyen rollback multiproducto, idempotencia y dos ventas simultáneas por una unidad: una acepta, otra rechaza y el saldo queda en cero. Los reinicios se probaron con checkpoints de registros reales en la etapa anterior. No se borraron los registros QA.

No se ejecutó un ajuste manual adicional desde el formulario visual de stock en esta última sesión. Ese endpoint sí se probó con PostgreSQL mediante las suites HTTP; la UI de consulta y movimientos fue verificada. No se presenta la observación de un formulario como prueba de todas sus posibles combinaciones.

## Estado de datos al cierre

Nueve productos, nueve ventas, 44 unidades disponibles, ingresos R$252,00 y valor de inventario R$843,80. Son datos de prueba conservados. El valor del inventario usa precio de venta y no representa coste o beneficio. El gráfico y la reposición BA utilizan los registros reales, sin cifras ficticias incrustadas en la interfaz.

## Instalación y operación

Fuentes y aplicación en ambas VMs: `/home/inventario/inventario-mvp`. Ejecutable del Backend: subdirectorio `publish`. Unidad activa: `/etc/systemd/system/inventario-mvp.service`, usuario de ejecución inventario, habilitada para arrancar automáticamente. La unidad de usuario antigua está deshabilitada.

```bash
# Consultar desde Ubuntu Backend
systemctl status inventario-mvp --no-pager
curl --fail http://10.77.55.3:8080/api/health/ready

# Pruebas HTTP, conservan datos QA
cd /home/inventario/inventario-mvp
python3 tests/http_e2e.py --output artifacts/http-new-run.json
python3 tests/check_original.py
```

Compilación, configuración y reversión detalladas en `README.md` y `OPERACION.md`. Los scripts administrativos se limitan por hostname a las VMs del laboratorio. No reejecutar el configurador de credencial sin revisar sus efectos y respaldos.

La conexión y los respaldos privados permanecen fuera del árbol del proyecto y no se incluyen en el ZIP. No se hicieron commits ni pushes, no se eliminaron datos existentes y no se modificaron Windows físico, VPN, VPS o servicios ajenos al laboratorio.

## Archivos de entrega

- Código y UI: `src/Inventario.Api`.
- SQL: `db/001_schema.sql`.
- Despliegue: `deploy`.
- Pruebas y evidencias seleccionadas: `tests` y `artifacts`.
- Arquitectura, algoritmo, Scrum y operación: `docs`.
- Guion de exposición: `docs/GUION_PRESENTACION.md`.
- Presentación española, ocho diapositivas editables: `deliverables/Nexo-Inventario-ES-final.pptx`.
- Paquete de entrega final: `deliverables/Inventario-MVP-FINAL.zip`.

Los documentos anteriores se conservan como historia y están identificados como tales. La referencia vigente de conclusión es este informe.

## Alcance y pendientes

**No hay bloqueos pendientes del flujo principal del MVP académico.** No se incluye autenticación de operadores, HTTPS público, devoluciones, impuestos o predicción estadística. Son límites de alcance, no funcionalidades declaradas como entregadas. La prueba visual no sustituye una auditoría completa de accesibilidad, carga o seguridad de producción. El sistema debe permanecer en la red privada del laboratorio.
