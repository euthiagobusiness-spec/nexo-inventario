# Algoritmo de ventas y complejidad

Actualizado: 13 de noviembre de 2026. La API actual está escrita en TypeScript. El código original C# se conserva en `src/Inventario.Api/VentaService.cs` y `docs/VentaService.original.cs.txt`, pero el proceso Node en el puerto `8082` ejecuta la traducción TypeScript de `backend/src/VentaService.ts`.

## Firma y lógica preservada

```ts
RegistrarVenta(venta: Venta, productos: Producto[]): boolean
```

La traducción mantiene la lógica académica fundamental: copia existencias a un arreglo temporal, recorre los detalles con `while`, busca cada producto, valida que exista y que la cantidad sea positiva y suficiente, calcula precios y subtotales, actualiza el stock de los objetos solo después de validar todos los detalles y asigna el total. Conserva los seis lazos `while` del original.

El API valida antes del método los límites de la solicitud, el identificador de operación, cantidades enteras y productos sin repetir. El `VentaService` opera en memoria; `InventoryStore` lo invoca dentro de una transacción MySQL que bloquea los productos con `SELECT ... FOR UPDATE`. SQL guarda venta, detalles, movimientos y saldos juntos, o revierte la operación ante un fallo.

## Complejidad temporal y espacial

Sean `n` el número de productos cargados en la venta y `m` el número de detalles:

| Fase | Trabajo |
|---|---:|
| Copiar el inventario temporal | `O(n)` |
| Revisar detalles y buscar cada producto linealmente | `O(m · n)` en el peor caso |
| Calcular precios y subtotales, con búsqueda lineal | `O(m · n)` en el peor caso |
| Aplicar existencias validadas | `O(n)` |
| **Total** | **`O(n + m · n)`** |

El espacio adicional es **`O(n)`** por la copia temporal de existencias. Si `m` crece a la vez que `n`, el peor caso se aproxima a `O(n²)`. Esta explicación mide el algoritmo en memoria y no incluye el tiempo variable de la transacción, red, disco ni bloqueos de MySQL.

## Importes

TypeScript representa el precio como centavos enteros `bigint`. El adaptador convierte el importe de entrada a centavos sin usar aritmética binaria de punto flotante, multiplica por las unidades y acumula los subtotales. MySQL guarda los valores en columnas `DECIMAL`; las respuestas convierten el importe a la representación JSON del contrato.

## Recursividad demostrable

`recursiveValue` en `backend/src/domain.ts` suma el valor de existencias dividiendo el arreglo en dos mitades y combinando los resultados. Sus casos base son cero productos y un producto.

```text
T(n) = 2T(n/2) + O(1)
Tiempo: O(n)
Pila de llamadas: O(log n)
```

La recursión es un ejercicio separado; no registra ventas ni modifica el stock. Una prueba local la ejercitó con 100.001 productos sintéticos en memoria; la ruta académica de la API calcula el valor con el conjunto real de productos.

## Punteros

No hay punteros de memoria directa ni código `unsafe`. JavaScript/TypeScript trabaja con memoria administrada y referencias a objetos; para este inventario no se necesita aritmética de direcciones. Presentar una sección teórica de punteros como implementación real sería incorrecto.

## Procedencia y verificación

El usuario proporcionó la versión C# original y después eligió TypeScript tanto para Frontend como para Backend. Por ello el servidor actual llama a la traducción explícita `backend/src/VentaService.ts`; no ejecuta el assembly ni instancia la clase C# conservada.

La ejecución local aprobó 29 pruebas de dominio/algoritmo y 10 HTTP. Tras actualizar la serialización monetaria, se repitió la suite contra las VMs y MySQL: 33 PASS, 0 FAIL, 0 BLOCKED, incluidos stock insuficiente, actualización del saldo, transacción, reintento idempotente y concurrencia. Evidencias: `artifacts/typescript/http-e2e-vm-latest.json` y `artifacts/typescript/persistence-restart-result.json`.
