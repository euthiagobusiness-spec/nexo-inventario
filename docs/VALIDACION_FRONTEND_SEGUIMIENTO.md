# Seguimiento de validación de la etapa C#/.NET y PostgreSQL

> **REGISTRO HISTÓRICO.** El flujo visual que se describe corresponde a la versión anterior y no valida el Frontend TypeScript actual. Para el estado vigente y los límites de la inspección visual, consulte [la guía actual](COMO_O_SISTEMA_FOI_FEITO.md).

13 de noviembre de 2026, America/Manaus.

El usuario autorizó nuevamente la continuación autónoma del proyecto dentro del laboratorio. Se confirmó que el servicio `inventario-mvp` y PostgreSQL están activos y que `/api/health/ready` responde 200 con esquema v1. La VM WIN11-FRONTEND sigue activa con IP 10.77.55.5.

## Regresión actual

- `artifacts/http-final-backend.json`: 33 PASS, 0 FAIL, 0 BLOCKED.
- `artifacts/http-final-database.json`: 33 PASS, 0 FAIL, 0 BLOCKED.
- Comparación del código original: PASS, solo las tres líneas monetarias documentadas difieren. Los seis while permanecen intactos.

Las pruebas conservaron sus nuevos registros QA sin borrar datos existentes. Los resultados actualizan la evidencia temporal, sin sustituir los archivos históricos de las pruebas anteriores.

## Validación de navegador pendiente

Se seleccionó la ventana de WIN11-FRONTEND y se observó Edge abierto. El envío de teclado encontró un error en la herramienta. Tras recuperar la sesión se observó la pantalla de bloqueo del Windows invitado. Se detuvo la entrada a esa pantalla y se solicitó desbloqueo manual, sin pedir otra contraseña.

La autorización administrativa de Linux y el estado de la API no se utilizaron como sustitutos de una prueba visual de las tres máquinas. Hasta completar esa prueba, el proyecto conserva como pendiente el flujo por navegador dentro de la VM Frontend.

## Próxima prueba

Dentro de WIN11-FRONTEND, con la sesión desbloqueada y Edge abierto:

1. Abrir `http://10.77.55.3:8080` y confirmar conexión a la base de datos.
2. Registrar un producto con SKU único, precio R$49,90 y stock 10.
3. Vender dos unidades. Resultado esperado: venta de R$99,80 y stock 8.
4. Intentar vender nueve unidades. Resultado esperado: rechazo y stock conservado en 8.
5. Consultar movimientos, ventas, dashboard y análisis. Recargar la página y verificar los mismos datos.
6. Contrastar los IDs y valores observados en la UI con el API y PostgreSQL.

Estos pasos son el plan de aceptación, no resultados ya ejecutados. No se consideran aprobados hasta observarlos realmente.
