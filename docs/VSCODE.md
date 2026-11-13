# Organización del sistema en Visual Studio Code

Actualizado: 13 de noviembre de 2026.

## Abrir el workspace

Desde PowerShell, abre el proyecto con el archivo de workspace:

```powershell
$proyecto = 'C:\Users\euthi\OneDrive\Documentos\ChatGPT\Projeto-Inventario'
Set-Location -LiteralPath $proyecto
code .\Inventario.code-workspace
```

En el Explorador de VS Code aparecen estas carpetas separadas. El workspace también incluye `Proyecto completo` para poder usar las tareas y navegar todos los archivos desde una sola raíz.

| Carpeta del Explorador | Ruta real | Función |
|---|---|---|
| Backend TypeScript | `backend/` | API, reglas, lógica de ventas, persistencia MySQL y pruebas |
| Frontend TypeScript | `frontend/` | Aplicación de navegador, estilos y HTML |
| Base de datos | `db/` | Esquema y objetos MySQL; conserva también el SQL histórico de PostgreSQL |
| Contratos | `shared/` | Tipos JSON compartidos entre Frontend y Backend |
| Implementación | `deploy/typescript/` | Preparación de Node.js y unidad de servicio candidata |
| Pruebas TypeScript | `backend/tests/` | Pruebas de reglas, ventas, errores y HTTP local |
| Documentación | `docs/` | Guías, arquitectura, Scrum y explicación académica |
| Entregables | `deliverables/` | Material académico de las etapas anteriores |
| C# anterior conservado | `src/Inventario.Api/` | API .NET anterior y clase `VentaService` original |
| Pruebas C# anteriores | `tests/Inventario.Tests/` | Pruebas de la etapa .NET conservada |
| Proyecto completo | `./` | Acceso a toda la solución y sus configuraciones |

Esta es una organización virtual de VS Code: las carpetas mantienen sus rutas en el proyecto y aparecen como raíces separadas en el Explorador. `Inventario.sln` y el Backend C# se conservan para consulta histórica; el flujo actual de desarrollo usa `package.json` y TypeScript.

## Abrir archivos de cada parte

Desde PowerShell en la raíz del proyecto:

```powershell
code .\backend\src\server.ts
code .\backend\src\VentaService.ts
code .\backend\src\InventoryStore.ts
code .\frontend\src\app.ts
code .\frontend\public\index.html
code .\frontend\public\styles.css
code .\db\mysql\001_schema.sql
code .\docs\COMO_O_SISTEMA_FOI_FEITO.md
```

Las carpetas tienen estas responsabilidades:

- `backend/src/server.ts`: inicia el servidor Node.js, sirve la aplicación y despacha rutas `/api`.
- `backend/src/domain.ts`: tipos y validaciones de dominio.
- `backend/src/VentaService.ts`: traducción TypeScript del algoritmo académico de ventas.
- `backend/src/InventoryStore.ts`: consultas MySQL, transacciones y persistencia.
- `frontend/src/app.ts`: interacción del navegador y llamadas HTTP.
- `frontend/public/index.html` y `styles.css`: estructura accesible y presentación visual.
- `shared/contracts.ts`: estructuras de solicitud y respuesta compartidas.
- `db/mysql/001_schema.sql`: tablas MySQL e índices.

## Compilar, ejecutar y depurar

Abre Terminal integrada (**Terminal → New Terminal**) en la raíz del workspace. Los comandos de desarrollo local son:

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm start
```

`npm run build` compila ambas partes de TypeScript y copia los recursos del Frontend al directorio `dist/`. `npm start` ejecuta la API local en `http://127.0.0.1:5080`. La conexión de base de datos local requiere una configuración privada compatible; no está guardada en el código fuente.

También se pueden usar **Terminal → Run Task / Ejecutar tarea**:

- `TypeScript: revisar tipos`
- `Backend y Frontend: compilar TypeScript` (tarea de compilación predeterminada)
- `TypeScript: ejecutar Backend y Frontend local`
- `TypeScript: pruebas unitarias y HTTP`
- `Pruebas: preservar VentaService original`
- Tareas `VM ...` para inspecciones por SSH y pruebas HTTP contra el laboratorio; necesitan que las VMs y la autenticación SSH ya configurada estén disponibles.

La configuración **Run and Debug → Nexo: Backend TypeScript** (F5) compila y ejecuta el Backend local. Las tareas y depuración están definidas en `.vscode/tasks.json` y `.vscode/launch.json`.

## Comunicación con las VMs

Las pruebas de integración usan estas máquinas y direcciones privadas:

```text
Navegador Windows 11 → HTTP/JSON → Backend 10.77.55.3:8082
Backend 10.77.55.3 → MySQL TLS/TCP 3306 → Database 10.77.55.4
```

Para consultar de forma manual el estado del candidato TypeScript, desde Windows:

```powershell
ssh -o BatchMode=yes -p 2222 inventario@127.0.0.1 "curl --max-time 10 --fail --silent --show-error http://10.77.55.3:8082/api/health/ready"
ssh -o BatchMode=yes -p 2223 inventario@127.0.0.1 "systemctl is-active mysql postgresql"
```

Los puertos locales SSH `2222` y `2223` son canales de administración hacia las VMs; no son las direcciones que usa el navegador para la aplicación.

## Estado verificado y limitaciones

- La API TypeScript en `10.77.55.3:8082` respondió a las pruebas reales con MySQL; el informe más reciente está en `artifacts/typescript/http-e2e-vm-latest.json`.
- Los 33 escenarios HTTP de VM pasaron. Se verificaron productos, ventas, stock, rechazo por stock insuficiente, transacciones, BI/BA y persistencia.
- El reinicio controlado del proceso Node mantuvo la venta y el stock; el resultado está en `artifacts/typescript/persistence-restart-result.json`.
- Las 39 pruebas locales (29 de lógica y 10 HTTP) pasaron en la ejecución documentada. La base MySQL del laboratorio no se expone al Windows físico para desarrollo local.
- La interfaz en `:8082` entregó HTML, CSS y JavaScript con HTTP 200. No se completó una inspección visual de esa versión en Edge.
- El Backend de `:8082` se inició como proceso del usuario `inventario`; no se ha verificado el arranque tras reiniciar la VM ni instalado el servicio automático.
- `http://10.77.55.3:8080` sigue siendo la aplicación anterior .NET/PostgreSQL. PostgreSQL permanece activo y sus datos no se eliminaron.
- La instalación de systemd y la promoción al puerto `8080` requieren administración Linux. La última comprobación `sudo -n whoami` pidió autenticación en ambas VMs; esas operaciones no se ejecutaron.

Consulta [la explicación detallada del sistema](COMO_O_SISTEMA_FOI_FEITO.md) para la arquitectura, el flujo de ventas, la migración y el contenido académico.
