# Promoción TypeScript/MySQL y prueba de reinicios

> **Estado de entrega GitHub (13/11/2026):** consulte [ENTREGA_GITHUB.md](ENTREGA_GITHUB.md). La revisión posterior con las tres VMs encendidas confirmó servicios, fuentes, MySQL y panel Windows. Consulte [VALIDACION_TRES_VMS.md](VALIDACION_TRES_VMS.md). El bloqueo de arranque que sigue es histórico y quedó resuelto.

> **Registro de la etapa de promoción:** los pendientes y direcciones candidatas que siguen corresponden a sus fechas de verificación. La recuperación posterior está en `artifacts/typescript/persistence-after-database-vm-reboot-recovery.json`.

13 de noviembre de 2026, America/Manaus. La promoción administrativa se ejecutó con autenticación interactiva autorizada, sin credenciales en archivos o comandos. No es necesario repetir el comando de promoción: la unidad destino ya está instalada.

## Resultados comprobados

| Comprobación | Resultado | Evidencia local |
|---|---|---|
| TypeScript/MySQL en `http://10.77.55.3:8080` | PASS antes del reinicio de Database | `artifacts/typescript/promotion-result.json` |
| Suite HTTP en el puerto principal | 33 PASS, 0 FAIL, 0 BLOCKED | `artifacts/typescript/http-e2e-main.json` |
| Reinicio del servicio TypeScript y comparación de datos | PASS | `artifacts/typescript/promotion-result.json` |
| Inicio automático tras reiniciar VM Backend | PASS; MySQL y registros coincidentes | `artifacts/typescript/persistence-after-backend-vm-reboot.json` |
| Reinicio de VM Database | FAIL dentro del tiempo de espera; Linux detenido antes de red/SSH | `artifacts/typescript/persistence-after-database-vm-reboot.json` |
| Recorrido visual de esta versión en Edge | Pendiente; la herramienta visual no pudo iniciar | Verificación manual solicitada |

La prueba de persistencia comparó el producto 13 (VM13, stock 8) y la venta 9 (dos unidades, total 99,80) antes y después de la promoción y del reinicio de Backend. Los registros QA se conservan.

## Configuración aplicada

- Backend actual: `/home/inventario/inventario-typescript`, Node.js/TypeScript.
- Unidad instalada: `/etc/systemd/system/inventario-typescript.service`, habilitada, usuario `inventario`, IP privada `10.77.55.3`, puerto `8080`.
- El servicio .NET anterior `inventario-mvp.service` está detenido y deshabilitado; su código y configuración se conservan.
- La conexión privada MySQL/TLS se lee del archivo protegido ya existente, fuera del repositorio.
- PostgreSQL no se detuvo, deshabilitó ni desinstaló por esta promoción. Sus datos siguen en el disco.

`deploy/typescript/promote-backend.py` comprobó hostname, candidato MySQL, sintaxis de la unidad y checkpoint; instaló el servicio, ejecutó la suite HTTP, reinició el servicio y comparó los registros. Su mecanismo de reversión cubría fallos de esa promoción, que pasó. El fallo posterior ocurrió durante el arranque completo de la VM Database.

## Bloqueo descubierto durante la validación

Después de ejecutar un reinicio normal autorizado de Ubuntu Database, VirtualBox informa que la VM está encendida, pero el Linux invitado quedó en la fase inicial de carga de controladores. No responde al SSH local 2223 ni a la red privada. Las capturas de consola están en `artifacts/typescript/database-boot.png` y `database-boot-latest.png`. El Backend sigue activo y devuelve 503 porque MySQL no está disponible.

Se solicitó apagado ACPI, sin respuesta observada. Se pidió aprobación para un reset forzado de esa VM porque interrumpir un disco sin cierre limpio requiere más cuidado. No se forzó el reset ni se borraron datos mientras se esperaba esa respuesta.

## Pendientes

1. Recuperar el arranque de Database y verificar MySQL y los mismos registros.
2. Repetir la aceptación HTTP tras la recuperación.
3. Completar el recorrido manual en Edge y contrastar SKU/venta reales.
4. Después de validar MySQL y su arranque, retirar PostgreSQL del servicio activo conservando los datos y respaldo anterior.
5. Actualizar la guía principal con el resultado final real.

No se declara completada la migración mientras el arranque de Database siga bloqueado.
