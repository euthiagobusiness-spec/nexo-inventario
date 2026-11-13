# Informe de entrega — 13 de noviembre de 2026

> **INFORME HISTÓRICO — etapa C#/.NET y PostgreSQL.** El diagnóstico y bloqueo aquí descritos no son el estado vigente. Consulte [la guía actual TypeScript/MySQL](COMO_O_SISTEMA_FOI_FEITO.md). Este archivo conserva la historia sin reemplazar los resultados anteriores.

**Estado: implementación escrita y Backend/interfaz publicados; MVP de tres máquinas todavía NO completado ni validado de extremo a extremo.** La integración PostgreSQL permanece bloqueada por privilegios/autenticación. No hay evidencia de un producto o venta persistidos mediante esta aplicación.

## Lo que sí funcionó

- SSH por clave a ambas VMs: puerto local 2222 → `ubuntu-backend`, 2223 → `ubuntu-database`.
- Compilación Release en Ubuntu Backend con SDK .NET 8.0.134 y lockfile de paquetes.
- Npgsql 8.0.9 restaurado; sin Entity Framework o frameworks JavaScript.
- API y archivos estáticos ejecutándose bajo servicio systemd de usuario, sin privilegios root.
- HTTP de Backend en `http://10.77.55.3:8080`; liveness 200. TCP 8080 también alcanzable desde Ubuntu Database.
- Interfaz en Chrome del Windows mediante `http://127.0.0.1:18080`, usando túnel SSH de loopback. Navegación, formulario y mensaje real de error verificados.
- Formulario conserva sus valores cuando el guardado falla por banco no configurado.
- Layout sin overflow horizontal de página en 375, 768, 1024 y 1440 px y orientación 812×375, en estado sin datos. Las tablas usan su propio contenedor de desplazamiento.
- `VentaService.RegistrarVenta` compila y pasa pruebas directas. El flujo de código del API invoca ese método dentro de la transacción; **esa llamada aún no pudo observarse en una venta HTTP exitosa**, porque no se alcanza el banco.
- Documentación y guion en español, con estado real, fuentes, algoritmo, Big O y Scrum sin ceremonias inventadas.

## Pruebas y evidencia

| Verificación ejecutada | Resultado | Evidencia |
|---|---|---|
| Restauración bloqueada y compilación Release | Exit 0 | `artifacts/build.txt` |
| Pruebas .NET de algoritmo, reglas y recursividad | **24 PASS, 0 FAIL** | `artifacts/unit-tests.txt` |
| Comparación completa de VentaService con original | **PASS**, solo 3 líneas monetarias | `tests/check_original.py` y salida en `artifacts/unit-tests.txt` |
| HTTP desde Ubuntu Backend | **12 PASS, 0 FAIL, 11 BLOCKED** | `artifacts/http-results-vm.json` |
| HTTP desde Windows por túnel SSH | **12 PASS, 0 FAIL, 11 BLOCKED** | `artifacts/http-results-windows.json` |
| Consulta de vulnerabilidades de paquetes, incluidas transitivas | Ninguna conocida en las fuentes consultadas | `artifacts/dependency-audit.txt` |
| UI y breakpoints en Chrome/Windows | Estados de interfaz verificados; sin CRUD exitoso | `artifacts/ui-results.json` |
| Sondeos TCP desde las tres máquinas | Ver matriz inferior | `artifacts/network-*.json` |
| Servicio tras reiniciar su proceso para publicar versión final | active, enabled, Linger=no | `artifacts/deployment.txt` |

Las dos suites HTTP repiten los mismos 12 casos desde orígenes distintos; no son 24 escenarios funcionales diferentes. Verifican HTML/CSS/JS, liveness, validaciones sin banco, JSON malformado, detalles nulos, paginación, origen y cabeceras. El total de bloqueos incluye readiness y diez categorías funcionales dependientes del banco. Las suites completas conservan estado BLOCKED y salida no exitosa; no se reinterpretaron como aprobación del MVP.

Las 24 pruebas de memoria incluyen ventas válidas, producto inexistente, cantidades cero/negativas, falta de stock sin mutación parcial, consumo acumulado de detalles repetidos, agotamiento exacto, cálculo monetario decimal, límites de entrada y recursividad con 100.001 productos. Son pruebas **en memoria**, sin PostgreSQL.

## Conectividad real observada

| Origen | Destino | Resultado |
|---|---|---|
| Windows | 10.77.55.3:8080 | Timeout; acceso directo no disponible |
| Windows | 10.77.55.4:5432 | Timeout |
| Windows | 127.0.0.1:18080 → SSH → Backend | HTTP probado |
| Ubuntu Backend | 10.77.55.3:8080 | Accesible |
| Ubuntu Backend | 10.77.55.4:5432 | Conexión rechazada |
| Ubuntu Database | 10.77.55.3:8080 | Accesible |
| Ubuntu Database | 127.0.0.1:5432 | Accesible |
| Ubuntu Database | 10.77.55.4:5432 | Conexión rechazada |

PostgreSQL 16.15 estaba escuchando solo en `127.0.0.1:5432`. El intento local con el usuario del SO falló porque no existe ese rol de banco; con `inventario_app` por socket falló peer; por TCP requiere contraseña. La clave SSH no sustituye esa credencial. `sudo -n` requiere contraseña en ambas VMs. No se intentó otro mecanismo privilegiado ni una instancia alternativa para eludir el bloqueo.

`GET /api/health/ready` responde actualmente **503** con «Base de datos pendiente de configuración administrativa». El Backend no recibió una contraseña de banco y no se guardó ninguna credencial en el repositorio.

## Implementado, pero NO probado contra PostgreSQL

- Migración de productos, ventas, detalles y movimientos en esquema aislado.
- Alta y consulta persistentes; unicidad del SKU.
- Venta usando VentaService, cálculo de total y stock persistido.
- Transacciones, `FOR UPDATE`, orden de bloqueos y rechazo de sobreventa concurrente.
- Idempotencia de ventas y ajustes, con UUID y hash de contenido.
- Ajustes auditables y restricciones de integridad.
- BI/BA y recursividad sobre datos del banco.
- Persistencia después de reiniciar proceso o VM.

El script HTTP contiene pruebas para estas operaciones y una carrera de dos ventas por una unidad. Están preparadas, **no ejecutadas con éxito**. No se puede asegurar todavía que el SQL y todos los caminos del adaptador funcionen en el banco real solo porque C# compiló.

## Archivo original y cambios

Se preservó el código proporcionado en `docs/VentaService.original.cs.txt`. La clase ejecutable mantiene firma, estructura, seis lazos while y lógica fundamental. Las únicas tres líneas modificadas usan decimal en total, precio y subtotal; se documentaron con precisión en `ALGORITMO.md`. Los modelos compatibles se añadieron en `AcademicModels.cs`.

El repositorio inicialmente no tenía código ni commits. El MVP previo a la corrección del usuario fue adaptado en el mismo proyecto; no se eliminó el desarrollo ni se mantuvo un segundo algoritmo de venta en producción.

## Implantación y archivos

Backend:

```text
/home/inventario/inventario-mvp/
  src/Inventario.Api/     código fuente
  publish/               versión en ejecución
  publish-staging/       compilación final preparada
  db/                    migración propuesta
  deploy/                unidades y propuestas administrativas
  tests/                 pruebas ejecutables
  docs/                  documentación
  artifacts/             evidencia y respaldo de la publicación previa
```

Unidad activa: `/home/inventario/.config/systemd/user/inventario-mvp.service`. El servicio está habilitado para sesión de usuario; **inicio automático al arrancar sin login pendiente**, porque `Linger=no` y no se pudo instalar unidad de sistema sin sudo. No se reiniciaron VMs. El túnel local es un proceso temporal y no un servicio del notebook; su disponibilidad termina al cerrar el proceso o la sesión.

Database: fuentes, SQL, documentación y scripts preparados en `/home/inventario/inventario-mvp`. **No se aplicó la migración ni se cambió el servicio PostgreSQL.** Solo se copiaron archivos al directorio del usuario.

Workspace Windows: `C:\Users\euthi\OneDrive\Documentos\ChatGPT\Projeto-Inventario`. Código en `src`, SQL en `db`, scripts en `deploy`, pruebas en `tests`, documentación en `docs`, resultados en `artifacts`. Paquete de fuentes: `artifacts/inventario-mvp-source.tar.gz`; manifiesto: `artifacts/files-created.txt`.

## Pendientes, por prioridad

1. **Administrador de Database:** revisar y aprobar configuración privada, autenticación SCRAM y permisos; crear respaldo y aplicar el esquema sin borrar datos. Scripts y propuestas listos en `deploy`.
2. **Operador de Backend:** configurar localmente la contraseña existente del rol mediante entrada oculta, fuera del chat y del repositorio.
3. **Validación funcional:** ejecutar las pruebas completas contra PostgreSQL, corregir cualquier fallo real y completar producto → venta → stock desde Windows.
4. **Administrador de Backend:** instalar unidad de sistema para inicio al arrancar; verificar servicio y datos después de un reinicio autorizado.
5. **Red del Windows:** revisar/autorizar conexión privada hacia 10.77.55.3:8080; actualmente funciona por túnel, no por ruta directa.

Procedimientos concretos en `OPERACION.md`. No se alteraron contraseñas, servicios externos del notebook, reglas de firewall, adaptadores, máquinas virtuales o datos existentes. No se hicieron commits ni pushes.

## Problemas encontrados y correcciones efectuadas

- El SDK no está instalado en Windows: se usó el SDK existente en Ubuntu Backend, sin instalar uno adicional.
- `dotnet publish --locked-mode` no acepta esa opción en este SDK: se corrigió a `dotnet restore --locked-mode` y luego `dotnet publish --no-restore`.
- El primer curl se ejecutó inmediatamente después del inicio y encontró el puerto aún cerrado; se verificó posteriormente el servicio activo y HTTP 200. No se ocultó como prueba exitosa del primer intento.
- Se añadió rechazo de detalle JSON nulo para evitar error 500; nueva prueba de memoria y HTTP aprobadas.
- El navegador no dispone siempre de `crypto.randomUUID` en HTTP privado: se usa UUID v4 mediante `getRandomValues`.
- El automatizador leyó un encabezado antes de que terminara un evento de hash; se volvió a observar la página estabilizada y se verificó una sola sección visible y un solo enlace seleccionado. No se clasificó esa lectura intermedia como defecto persistente de la aplicación.

La entrega deja un componente web ejecutable y material revisable para desbloquear la infraestructura; no declara completada una venta que no se pudo probar.
