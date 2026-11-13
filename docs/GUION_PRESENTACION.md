# Guion de presentación · Programación II

Duración orientativa: 8–10 minutos. Guion actualizado para la versión TypeScript/MySQL. El Backend de demostración comprobado está en `http://10.77.55.3:8082`; `:8080` continúa siendo la versión anterior C#/.NET con PostgreSQL. No se debe mostrar un valor esperado como dato real.

## 1. Problema y propósito — 45 segundos

«El sistema centraliza catálogo, existencias y ventas. La regla principal es que una venta solo se confirma si todos los productos existen y tienen saldo suficiente. El stock y la venta se guardan juntos en MySQL para evitar que la pantalla muestre un resultado que la base de datos no confirmó.»

## 2. Tres máquinas — 1 minuto

Mostrar la sección académica o este flujo:

```text
Windows 11 / Edge
    ── HTTP + JSON por la red privada ──>
Ubuntu Backend 10.77.55.3:8082 / Node.js + TypeScript
    ── MySQL con TLS, TCP 3306 ──>
Ubuntu Database 10.77.55.4 / MySQL 8
```

«Las VMs ya existían. El navegador carga HTML, CSS y JavaScript servido por la API. Solo el Backend tiene configuración de MySQL; el navegador nunca recibe una contraseña ni se conecta directamente a `3306`. Los puertos SSH locales `2222` y `2223` son para consultar las VMs.»

Antes de la exposición, consultar readiness desde PowerShell:

```powershell
ssh -o BatchMode=yes -p 2222 inventario@127.0.0.1 "curl --max-time 10 --fail --silent --show-error http://10.77.55.3:8082/api/health/ready"
```

Debe devolver JSON con estado `ready`, `database` igual a `MySQL` y `language` igual a `TypeScript`. Si no responde, explicar el bloqueo y no presentar registros como si fueran una operación nueva.

## 3. Interfaz y flujo producto–venta — 2 minutos

La suite ya probó este flujo contra las VMs y la base real. Para la presentación visual en Edge, primero completar la inspección manual pendiente. Si la API está lista, mostrar el dashboard, crear un producto con SKU nuevo, listar/buscarlo, ajustar existencias y registrar una venta de una cantidad menor al saldo. Volver al catálogo para observar el saldo actualizado y abrir el historial/movimientos.

Para demostrar rechazo de venta, seleccionar una cantidad mayor al stock mostrado. La interfaz debe mostrar error; comprobar que el saldo y las ventas no cambiaron. No borrar registros de prueba previos. Registrar cualquier SKU o ID creado durante la exposición para no repetirlo después.

## 4. Cómo procesa la venta — 2 minutos

Abrir `backend/src/VentaService.ts` y `backend/src/InventoryStore.ts`.

«`InventoryStore` inicia una transacción y bloquea las filas del producto en MySQL. Luego construye los modelos y ejecuta `VentaService.RegistrarVenta`. El método copia el stock a un arreglo temporal, verifica los productos y cantidades con búsquedas lineales, calcula subtotal y total, y solo entonces actualiza el stock de los modelos. `InventoryStore` persiste los cambios y confirma la transacción; ante un error, la revierte.»

«El método en ejecución es la traducción TypeScript solicitada al cambiar el Backend. La clase C# original sigue guardada en `src/Inventario.Api/VentaService.cs`, pero la API TypeScript no ejecuta ese assembly.»

## 5. Complejidad, recursividad y punteros — 1 minuto

«Con `n` productos y `m` detalles, buscar cada producto linealmente cuesta `O(n + m·n)` en tiempo y el arreglo temporal usa `O(n)` de memoria. Si las dos cantidades crecen juntas, el peor caso se aproxima a cuadrático.»

«La suma recursiva del valor del inventario divide la lista en dos: `T(n)=2T(n/2)+O(1)`, por lo que usa `O(n)` tiempo y `O(log n)` pila. Es un cálculo independiente de la venta. No usamos punteros de memoria directa: TypeScript usa memoria administrada y el sistema no necesita aritmética de direcciones.»

## 6. UI, UX, BI y BA — 1 minuto

«La UI organiza navegación, formularios, tablas, indicadores y estados de stock. La UX añade etiquetas, validaciones, mensajes de progreso/error y conserva datos cuando una petición falla. BI resume ventas, ticket medio, inventario y productos que requieren atención. BA ofrece una sugerencia descriptiva de reposición a partir de las ventas recientes, stock y mínimo; no es predicción estadística ni cálculo de beneficio.»

La fórmula documentada es: `compra sugerida = max(0, ceil(media diaria × 30) + mínimo − stock)`. El valor del inventario se calcula con precio de venta, no coste.

## 7. Pruebas y Scrum — 1 minuto

Mostrar `artifacts/typescript/http-e2e-vm-latest.json`: 33 escenarios HTTP aprobados contra Backend y MySQL reales tras actualizar el manejo de importes. Mostrar `artifacts/typescript/persistence-restart-result.json`: comparación exacta de producto/venta antes y después de reiniciar Node. La ejecución local registró 39 pruebas, sin fallos. Explicar que los archivos estáticos respondieron 200; la inspección visual en Edge está pendiente.

«El trabajo se organizó con backlog priorizado e incrementos verticales. Fue una ejecución individual asistida; no afirmamos reuniones ni un equipo Scrum que no existieron. El arranque automático y la publicación en `:8080` siguen pendientes porque `sudo -n whoami` solicita autenticación administrativa.»

## Límites que deben comunicarse

- El candidato TypeScript/MySQL probado está en `:8082`; no llamarlo `:8080`.
- PostgreSQL no se retiró; sigue activo con los datos anteriores.
- El proceso TypeScript responde, pero no está instalado como servicio automático probado tras reinicio de VM.
- Las pruebas HTTP no equivalen a validación visual de accesibilidad o flujo en Edge.
- No hay autenticación de operadores, permisos por rol, devoluciones, impuestos ni pronóstico de demanda.
- No mostrar credenciales ni copiar archivos privados del servidor.
