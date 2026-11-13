# Organización Agile/Scrum del proyecto

Actualizado: 13 de noviembre de 2026. Este informe describe el trabajo actual TypeScript/MySQL y diferencia las tareas verificadas de las pendientes. La ejecución fue un trabajo individual asistido: no se presentan reuniones, un equipo Scrum ni estimaciones que no ocurrieron.

## Objetivo del producto

Permitir a una persona encargada consultar productos, ajustar existencias y registrar ventas sin producir saldos negativos, con persistencia en MySQL y un panel web para observar el inventario.

## Organización del trabajo

Se organizó el alcance como un backlog priorizado y se avanzó en incrementos verticales: primero el flujo producto–venta–stock; después las vistas; luego los indicadores, pruebas y documentación. Esta planificación usa ideas de Scrum para una entrega académica. No significa que se hayan celebrado Sprint Planning, Daily Scrum, Review o Retrospective formales.

## Backlog y estado comprobado

| Prioridad | Historia y aceptación | Estado del candidato TypeScript/MySQL |
|---|---|---|
| P0 | Como operador, crear y consultar productos con SKU único y datos válidos | Implementado y cubierto por pruebas HTTP reales en las VMs |
| P0 | Registrar venta solo con producto y stock suficientes | Implementado con el `VentaService` TypeScript portado del original y comprobado por pruebas HTTP |
| P0 | Guardar venta, detalles, stock y movimientos de forma atómica | Implementado con transacción InnoDB; suite real cubrió rollback, simultaneidad y actualización de stock |
| P0 | Rechazar una venta insuficiente sin alterar stock | Comprobado por la suite real de 33 escenarios |
| P1 | Ajustar stock con motivo y consultar movimientos | Implementado; probado mediante API. Falta recorrido visual manual de la pantalla en Edge |
| P1 | Mostrar BI y análisis BA usando registros persistidos | Indicadores y recomendaciones implementados; rutas verificadas en la suite HTTP real |
| P1 | Mostrar recursividad y complejidad académica | Implementado y probado localmente, incluida una lista de 100.001 elementos |
| P1 | Probar persistencia al reiniciar la aplicación | PASS: producto/venta de control comparados antes y después del reinicio de Node |
| P1 | Abrir toda la fuente desde VS Code | Workspace multi-root preparado y abierto; carpetas separadas por componente |
| P2 | Inspeccionar visualmente la interfaz TypeScript dentro de Edge | Pendiente: los archivos respondieron HTTP 200, pero no se observó esta versión en Edge |
| P2 | Instalar inicio automático TypeScript y promoverlo a `:8080` | Pendiente: `sudo -n whoami` pide contraseña en ambas VMs |
| P2 | Retirar PostgreSQL | No realizado; el servicio anterior y sus datos siguen preservados |

## Criterios de aceptación

El incremento funcional se considera demostrado para la API candidata cuando crea y recupera datos en MySQL, procesa una venta válida, rechaza una insuficiente, mantiene la transacción y conserva el resultado tras reiniciar el proceso. La suite registrada ejecutó 33 escenarios HTTP contra las VMs; no se atribuyen esas pruebas a una inspección visual de la interfaz.

Para cerrar toda la entrega de tres máquinas todavía hay que validar la interfaz en Edge y habilitar el arranque automático/promoción del Backend TypeScript con permisos administrativos disponibles. Hasta entonces, la dirección probada es `http://10.77.55.3:8082`; `:8080` corresponde a C#/.NET y PostgreSQL.

## Definition of Done usada

- El código fuente compila y las pruebas registradas pasan.
- El flujo principal persiste en MySQL y mantiene stock consistente.
- La evidencia se conserva en `artifacts/typescript/` y no contiene credenciales.
- La documentación describe qué está probado y qué sigue pendiente.
- No se eliminan registros de prueba ni datos anteriores como parte de las validaciones.

No se afirma que toda la Definition of Done operativa esté cerrada mientras falten la inspección visual en Edge y el inicio automático con privilegios administrativos.
