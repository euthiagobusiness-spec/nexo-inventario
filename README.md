# Nexo · Sistema de inventario

Proyecto académico de inventario distribuido en **tres máquinas virtuales**: Windows 11 para utilizar la interfaz, Ubuntu para la API y Ubuntu para MySQL. Incluye catálogo, ventas, control de existencias, movimientos, indicadores BI/BA y el algoritmo académico `VentaService`.

**Versión actual: TypeScript en Frontend y Backend, Node.js y MySQL 8/InnoDB.** Las etapas C#/.NET y PostgreSQL permanecen conservadas como historia. Este repositorio entrega las fuentes y documentación; GitHub no aloja ni ejecuta las máquinas del laboratorio.

## Arquitectura

```text
WIN11-FRONTEND · 10.77.55.5
Edge · HTML / CSS / TypeScript compilado
             │ HTTP / JSON
             ▼
Ubuntu Backend · 10.77.55.3:8080
Node.js / TypeScript · API y archivos de la interfaz
             │ MySQL sobre TLS · TCP 3306
             ▼
Ubuntu Database · 10.77.55.4
MySQL 8 / InnoDB · inventario_db
```

Desde la VM Windows, la dirección de laboratorio es **http://10.77.55.3:8080**. Es una IP privada: requiere las VMs y su red `RedeProjeto`. El navegador consulta `/api/...` en el mismo origen; únicamente Backend accede al banco.

## Revisar la entrega

- [Estado de entrega y evidencias](docs/ENTREGA_GITHUB.md): resultados, límites y diferencias entre evidencia anterior y verificación actual.
- [Cómo ejecutar y desplegar](docs/INSTALACION.md): instalación local y reconstrucción del laboratorio.
- [Explicación del sistema](docs/COMO_O_SISTEMA_FOI_FEITO.md): interfaz, API, SQL, transacciones y BI/BA.
- [Algoritmo académico](docs/ALGORITMO.md), [Scrum](docs/SCRUM.md) y [guion de presentación](docs/GUION_PRESENTACION.md).
- [Presentación académica histórica](deliverables/Nexo-Inventario-ES-final.pptx): corresponde a la etapa anterior C#; consultar el estado actual antes de usarla.

## Ejecutar localmente

Requiere **Node.js 22 o superior** y npm; se valida con Node.js 24. Desde la raíz:

```sh
git clone https://github.com/euthiagobusiness-spec/nexo-inventario.git
cd nexo-inventario
npm ci
npm run typecheck
npm test
npm start
```

Abrir **http://127.0.0.1:5080**. `npm test` compila las dos capas antes de ejecutar las pruebas. Si solo se desea compilar, usar `npm run build`.

Sin configurar MySQL, la interfaz y `/api/health/live` funcionan, pero las operaciones con datos y `/api/health/ready` responden **503**. Para activar persistencia se necesita una instancia con el esquema, una cuenta autorizada y su CA TLS; seguir [INSTALACION.md](docs/INSTALACION.md). `.env.example` contiene únicamente una plantilla vacía. Nunca publicar su copia con valores reales.

Para abrir el workspace de VS Code: `code Inventario.code-workspace`.

## Código y materiales

| Ruta | Contenido |
|---|---|
| `frontend/src/app.ts`, `frontend/public/` | Interfaz del navegador, HTML y CSS |
| `backend/src/` | API, validación, transacciones SQL y `VentaService.ts` |
| `shared/contracts.ts` | Contratos JSON compartidos |
| `db/mysql/001_schema.sql` | Esquema MySQL actual |
| `backend/tests/` | Pruebas de lógica y HTTP locales |
| `tests/http_e2e.py` | 33 escenarios contra una instalación real; crea y conserva registros QA |
| `deploy/typescript/`, `deploy/mysql/` | Preparación de runtime, servicios y configuración del laboratorio |
| `artifacts/typescript/` | Evidencias de la versión actual y persistencia |
| `docs/`, `deliverables/` | Documentación y presentaciones académicas |
| `src/Inventario.Api/`, `tests/Inventario.Tests/`, `docs/history/` | Código y pruebas de etapas C# anteriores |

## Validación y alcance

En la preparación de esta entrega pasaron **39 pruebas locales**, la revisión de tipos y la comprobación del original C#. La auditoría npm de dependencias de producción no informó vulnerabilidades. GitHub Actions vuelve a ejecutar los controles locales en cada publicación; no accede a las VMs privadas.

Las evidencias guardadas documentan **33 escenarios HTTP aprobados** contra TypeScript/MySQL en `:8080`, inicio automático de Backend y recuperación/persistencia después del reinicio de Database. Durante la preparación del repositorio, SSH no estuvo accesible; estos resultados se identifican como evidencia previa. El recorrido visual completo de la versión TypeScript en Edge sigue pendiente de registro. La validación visual antigua corresponde a C#/PostgreSQL.

El sistema está destinado al laboratorio privado: no implementa autenticación de operadores ni HTTPS público. Las credenciales, certificados privados, respaldos, discos de VMs, videos y paquetes de fuentes duplicados quedan fuera de Git. Los datos reales continúan en las VMs; el repositorio incluye el esquema y evidencia QA, sin un volcado privado del banco.
