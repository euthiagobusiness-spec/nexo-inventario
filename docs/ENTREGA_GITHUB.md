# Entrega del repositorio GitHub

13 de noviembre de 2026 · America/Manaus.

Repositorio: https://github.com/euthiagobusiness-spec/nexo-inventario

## Qué se entrega

Fuentes completas disponibles en el workspace: Frontend y Backend TypeScript, contratos compartidos, SQL MySQL, scripts de despliegue, pruebas, documentación, evidencias y presentaciones anteriores. Se preserva el código C# y la historia PostgreSQL. Los paquetes ZIP/TAR duplicados permanecen localmente; GitHub permite descargar el código como ZIP desde **Code → Download ZIP**.

La arquitectura documentada tiene tres roles y tres VMs identificadas. No se dispone de evidencia de otras tres máquinas adicionales. El frontend se ejecuta en el navegador de Windows; Backend sirve sus archivos estáticos además de la API.

## Verificación de esta entrega

- Identidad GitHub confirmada como cuenta personal `euthiagobusiness-spec`.
- Instalación reproducible con `npm ci --ignore-scripts` aprobada.
- `npm run typecheck` aprobado.
- `npm test`: **39 PASS, 0 FAIL**.
- `python tests/check_original.py`: original C# preservado con las tres adaptaciones monetarias documentadas.
- `npm audit --omit=dev`: cero vulnerabilidades informadas al ejecutar la consulta.
- Revisión de archivos candidatos a publicación para detectar claves privadas, tokens y contraseñas literales; exclusión de archivos de entorno, claves, respaldos y archivos duplicados.
- Las conexiones SSH `127.0.0.1:2222` y `:2223` fueron rechazadas. No se cambió ni reinició ninguna VM. No se afirma haber sincronizado las fuentes remotas en esta etapa.

## Evidencias anteriores conservadas

| Evidencia | Resultado que documenta |
|---|---|
| [http-e2e-main.json](../artifacts/typescript/http-e2e-main.json) | 33 PASS, 0 FAIL, 0 BLOCKED contra `:8080` TypeScript/MySQL |
| [promotion-result.json](../artifacts/typescript/promotion-result.json) | Promoción al servicio principal y persistencia tras reiniciar el servicio |
| [persistence-after-backend-vm-reboot.json](../artifacts/typescript/persistence-after-backend-vm-reboot.json) | Servicio Backend activo/habilitado y registros conservados |
| [persistence-after-database-vm-reboot.json](../artifacts/typescript/persistence-after-database-vm-reboot.json) | Fallo inicial al arrancar Database; se conserva sin ocultarlo |
| [persistence-after-database-vm-reboot-recovery.json](../artifacts/typescript/persistence-after-database-vm-reboot-recovery.json) | Recuperación posterior: MySQL activo/habilitado y coincidencia exacta de producto y venta |

El reporte de recuperación tiene `status=PASS` y `exactRecordMatch=true`: producto 13, SKU `VM13`, precio 49,90 y stock 8; venta 9, dos unidades y total 99,80. No prueba por sí mismo un recorrido visual de la versión TypeScript.

## Videos de demostración

Los videos serán grabados por el autor. Todavía no se incluyen enlaces ni se declaran grabaciones terminadas. Guion sugerido:

1. **Windows 11:** abrir `http://10.77.55.3:8080`, crear un producto con SKU nuevo, vender dos unidades y comprobar stock e historial. Recargar para comprobar persistencia.
2. **Ubuntu Backend:** mostrar hostname, `systemctl status inventario-typescript --no-pager` y `curl -fsS http://10.77.55.3:8080/api/health/ready`. No mostrar archivos privados de conexión.
3. **Ubuntu Database:** mostrar hostname y `systemctl status mysql --no-pager`; con una sesión MySQL local ya autorizada, consultar las filas del producto y venta de la demostración.
4. **Las tres simultáneamente:** mantener las tres ventanas visibles, realizar una venta en Windows y contrastar respuesta de la API y filas MySQL con los mismos IDs.

Los comandos de consulta comprueban el funcionamiento actual cuando se ejecutan; este guion no equivale a evidencia ya observada.

## Límites de publicación

El enlace GitHub permite revisar y descargar el proyecto. No es una aplicación web desplegada en Internet ni una copia ejecutable de las VMs. No se publican datos de acceso, certificados privados, respaldos ni discos virtuales. La cuenta MySQL del laboratorio está limitada al Backend autorizado; clonar desde otro equipo no concede acceso al banco.

Los documentos antiguos conservan sus resultados originales, incluso bloqueos posteriormente resueltos. Para el estado de la entrega se utiliza este documento junto con el README; para estudiar las etapas anteriores se consultan sus informes específicos.
