# Base de datos del inventario

El código SQL está centralizado en esta carpeta. Los registros reales y los servicios permanecen en la VM Ubuntu Database, `10.77.55.4`.

| Archivo | Finalidad |
|---|---|
| `mysql/001_schema.sql` | Esquema MySQL 8/InnoDB utilizado por el Backend actual |
| `mysql/demo-data.sql` | 114 filas académicas QA/demo exportadas de una instantánea consistente; solo para Database nueva |
| `001_schema.sql` | Esquema PostgreSQL anterior, conservado para recuperación e historia |
| `../deploy/mysql/configure-database.py` | Preparación administrativa de MySQL en la VM Database |
| `../deploy/mysql/migrate-data.py` | Copia transaccional y comparación de los datos PostgreSQL con MySQL |

La API actual es TypeScript/MySQL en el puerto 8080. La evidencia conservada documenta 33 escenarios HTTP aprobados y recuperación de Database con registros persistidos. Las candidatas 8081 (.NET/MySQL) y 8082 (TypeScript) son etapas anteriores. Consulte [el estado de entrega](../docs/ENTREGA_GITHUB.md). No ejecutar de nuevo la migración sobre un destino poblado: el script se detiene para proteger los datos.

Las credenciales y los respaldos privados permanecen fuera del código, en las VMs. No copiar archivos `.env`, claves o directorios de datos del motor al workspace. Editar un archivo SQL en VS Code no ejecuta sus instrucciones en la VM.

La verificación directa de las tres VMs, el esquema observado y los controles de la exportación están en [VALIDACION_TRES_VMS.md](../docs/VALIDACION_TRES_VMS.md). PostgreSQL está inactivo y deshabilitado; los datos y paquetes anteriores siguen preservados.
