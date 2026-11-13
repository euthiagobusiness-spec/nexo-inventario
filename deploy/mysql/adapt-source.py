"""Adaptación puntual del adaptador SQL. VentaService no se modifica."""
from pathlib import Path
p=Path('src/Inventario.Api/InventoryStore.cs')
s=p.read_text(encoding='utf-8').replace('using Npgsql;','using MySqlConnector;').replace('Npgsql','MySql').replace('inventario_mvp.','inventario_db.')
s=s.replace('Timeout = 5, CommandTimeout = 15, IncludeErrorDetail = false,\n            MaxPoolSize = 20, ApplicationName = "InventarioMVP"',
    'ConnectionTimeout = 5, DefaultCommandTimeout = 15, MaximumPoolSize = 20,\n            DateTimeKind = MySqlDateTimeKind.Utc, GuidFormat = MySqlGuidFormat.Char36')
s=s.replace('MySqlDataSource.Create(settings.ConnectionString)','new MySqlDataSourceBuilder(settings.ConnectionString).Build()')
s=s.replace(" WHERE position(lower(@q) in lower(sku || ' ' || name || ' ' || category)) > 0", " WHERE LOCATE(LOWER(@q),LOWER(CONCAT(sku,' ',name,' ',category))) > 0")
s=s.replace('(long)(await count.ExecuteScalarAsync(ct))!','Convert.ToInt64(await count.ExecuteScalarAsync(ct))')
s=s.replace('BeginTransactionAsync(ct)','BeginTransactionAsync(IsolationLevel.ReadCommitted, ct)')
s=s.replace('MySqlTypes.MySqlDbType.Bigint','MySqlDbType.Int64')
s=s.replace('sold[r.GetInt64(0)] = r.GetInt64(1)','sold[r.GetInt64(0)] = Convert.ToInt64(r.GetValue(1))')
s=s.replace('r.GetFieldValue<DateOnly>(0)','DateOnly.FromDateTime(r.GetDateTime(0))')
p.write_text(s,encoding='utf-8')
