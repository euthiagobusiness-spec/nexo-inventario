using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MySqlConnector;

namespace Inventario;

public sealed class InventoryStore : IDisposable
{
    private readonly MySqlDataSource? source;
    public InventoryStore(IConfiguration config)
    {
        var connection = config.GetConnectionString("Inventory");
        if (string.IsNullOrWhiteSpace(connection)) return;
        var settings = new MySqlConnectionStringBuilder(connection)
        {
            ConnectionTimeout = 5, DefaultCommandTimeout = 15, MaximumPoolSize = 20,
            DateTimeKind = MySqlDateTimeKind.Utc, GuidFormat = MySqlGuidFormat.Char36
        };
        source = new MySqlDataSourceBuilder(settings.ConnectionString).Build();
    }
    public void Dispose() => source?.Dispose();
    private async Task<MySqlConnection> Open(CancellationToken ct)
    {
        if (source is null) throw new DomainError(503, "Base de datos pendiente de configuración administrativa.");
        return await source.OpenConnectionAsync(ct);
    }
    private static MySqlCommand Command(MySqlConnection c, string sql, MySqlTransaction? tx = null,
        params (string, object)[] values)
    {
        var cmd = new MySqlCommand(sql, c, tx);
        foreach (var (name, value) in values) cmd.Parameters.AddWithValue(name, value);
        return cmd;
    }
    private static Product ReadProduct(MySqlDataReader r) => new(r.GetInt64(0), r.GetString(1), r.GetString(2),
        r.GetString(3), r.GetDecimal(4), r.GetInt32(5), r.GetInt32(6));
    private const string Fields = "id,sku,name,category,price,stock,minimum_stock";
    private static void Page(int page, int size)
    {
        if (page is < 1 or > 1000000 || size is < 1 or > 100)
            throw new DomainError(400, "Página: 1–1.000.000; tamaño: 1–100.");
    }
    public async Task Check(CancellationToken ct)
    {
        await using var c = await Open(ct);
        await using var cmd = Command(c, "SELECT version FROM inventario_db.schema_versions WHERE version=1");
        if (await cmd.ExecuteScalarAsync(ct) is null) throw new DomainError(503, "Falta aplicar el esquema v1.");
    }
    public async Task<object> Products(string? search, int page, int size, CancellationToken ct)
    {
        Page(page, size);
        if (search?.Length > 120) throw new DomainError(400, "Búsqueda demasiado larga.");
        var q = (search ?? "").Trim();
        await using var c = await Open(ct);
        const string where = " WHERE LOCATE(LOWER(@q),LOWER(CONCAT(sku,' ',name,' ',category))) > 0";
        await using var count = Command(c, "SELECT count(*) FROM inventario_db.products" + where, null, ("q", q));
        var total = Convert.ToInt64(await count.ExecuteScalarAsync(ct));
        await using var cmd = Command(c, $"SELECT {Fields} FROM inventario_db.products{where} ORDER BY id DESC LIMIT @limit OFFSET @offset", null,
            ("q", q), ("limit", size), ("offset", ((long)page - 1) * size));
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var items = new List<Product>();
        while (await r.ReadAsync(ct)) items.Add(ReadProduct(r));
        return new { items, total, page, pageSize = size };
    }
    public async Task<Product> Product(long id, CancellationToken ct)
    {
        await using var c = await Open(ct);
        return await LoadProduct(c, null, id, false, ct);
    }
    private static async Task<Product> LoadProduct(MySqlConnection c, MySqlTransaction? tx, long id, bool locked, CancellationToken ct)
    {
        await using var cmd = Command(c, $"SELECT {Fields} FROM inventario_db.products WHERE id=@id" + (locked ? " FOR UPDATE" : ""), tx, ("id", id));
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) throw new DomainError(404, "Producto no encontrado.");
        return ReadProduct(r);
    }
    public async Task<List<Product>> AllProducts(CancellationToken ct)
    {
        await using var c = await Open(ct);
        return await AllProducts(c, null, ct);
    }
    private static async Task<List<Product>> AllProducts(MySqlConnection c, MySqlTransaction? tx, CancellationToken ct)
    {
        await using var cmd = Command(c, $"SELECT {Fields} FROM inventario_db.products ORDER BY id", tx);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var products = new List<Product>();
        while (await r.ReadAsync(ct)) products.Add(ReadProduct(r));
        return products;
    }
    public async Task<Product> Create(ProductInput input, CancellationToken ct)
    {
        await using var c = await Open(ct);
        await using var tx = await c.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
        await using var cmd = Command(c, """
            INSERT INTO inventario_db.products(sku,name,category,price,stock,minimum_stock)
            VALUES(@sku,@name,@category,@price,@stock,@minimum)
            """, tx, ("sku", input.Sku!), ("name", input.Name!), ("category", input.Category!),
            ("price", input.Price), ("stock", input.Stock), ("minimum", input.MinimumStock));
        await cmd.ExecuteNonQueryAsync(ct);
        var product = await LoadProduct(c, tx, cmd.LastInsertedId, false, ct);
        if (input.Stock > 0) await Movement(c, tx, product.Id, input.Stock, "Existencias iniciales", null, ct);
        await tx.CommitAsync(ct);
        return product;
    }
    private static string Hash(object value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value))));
    private static async Task RequestLock(MySqlConnection c, MySqlTransaction tx, string key, CancellationToken ct)
    {
        // InnoDB mantiene el bloqueo exclusivo de esta clave hasta commit/rollback.
        // Se usa una fila transaccional, evitando GET_LOCK y su alcance de conexión.
        await using var cmd = Command(c, """
            INSERT INTO inventario_db.request_locks(request_key) VALUES(@key)
            ON DUPLICATE KEY UPDATE request_key=request_key
            """, tx, ("key", key));
        await cmd.ExecuteNonQueryAsync(ct);
    }
    private static async Task Movement(MySqlConnection c, MySqlTransaction tx, long id, int delta, string reason, long? saleId, CancellationToken ct)
    {
        await using var cmd = Command(c, "INSERT INTO inventario_db.stock_movements(product_id,delta,reason,sale_id) VALUES(@id,@delta,@reason,@sale)", tx,
            ("id", id), ("delta", delta), ("reason", reason));
        cmd.Parameters.Add("sale", MySqlDbType.Int64).Value = saleId.HasValue ? saleId.Value : DBNull.Value;
        await cmd.ExecuteNonQueryAsync(ct);
    }
    public async Task<object> Adjust(long id, StockInput input, CancellationToken ct)
    {
        var reason = (input.Reason ?? "").Trim();
        if (input.RequestId == Guid.Empty || input.Delta is < -1000000 or > 1000000 or 0 || reason.Length is < 1 or > 200)
            throw new DomainError(400, "Ajuste: identificador, cantidad no nula (±1.000.000) y motivo (1–200) obligatorios.");
        string hash = Hash(new { id, input.Delta, reason });
        await using var c = await Open(ct);
        await using var tx = await c.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
        await RequestLock(c, tx, "stock:" + input.RequestId, ct);
        await using (var check = Command(c, "SELECT payload_hash,resulting_stock FROM inventario_db.stock_requests WHERE request_id=@request", tx, ("request", input.RequestId)))
        await using (var r = await check.ExecuteReaderAsync(ct))
        {
            if (await r.ReadAsync(ct))
            {
                if (r.GetString(0) != hash) throw new DomainError(409, "Identificador reutilizado con otro ajuste.");
                return new { productId = id, stock = r.GetInt32(1), requestId = input.RequestId };
            }
        }
        var product = await LoadProduct(c, tx, id, true, ct);
        int stock = product.Stock + input.Delta;
        if (stock is < 0 or > 1000000) throw new DomainError(409, "El ajuste dejaría las existencias fuera de 0–1.000.000.");
        await using (var cmd = Command(c, "UPDATE inventario_db.products SET stock=@stock WHERE id=@id", tx, ("stock", stock), ("id", id)))
            await cmd.ExecuteNonQueryAsync(ct);
        await Movement(c, tx, id, input.Delta, reason, null, ct);
        await using (var cmd = Command(c, "INSERT INTO inventario_db.stock_requests(request_id,payload_hash,product_id,resulting_stock) VALUES(@request,@hash,@id,@stock)",
            tx, ("request", input.RequestId), ("hash", hash), ("id", id), ("stock", stock))) await cmd.ExecuteNonQueryAsync(ct);
        await tx.CommitAsync(ct);
        return new { productId = id, stock, requestId = input.RequestId };
    }
    public async Task<object> Movements(long id, CancellationToken ct)
    {
        await using var c = await Open(ct);
        await LoadProduct(c, null, id, false, ct);
        await using var cmd = Command(c, "SELECT id,delta,reason,sale_id,created_at FROM inventario_db.stock_movements WHERE product_id=@id ORDER BY id DESC LIMIT 100", null, ("id", id));
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var items = new List<object>();
        while (await r.ReadAsync(ct)) items.Add(new { id = r.GetInt64(0), delta = r.GetInt32(1), reason = r.GetString(2),
            saleId = r.IsDBNull(3) ? (long?)null : r.GetInt64(3), createdAt = r.GetDateTime(4) });
        return items;
    }
    public async Task<Sale> Sell(Guid requestId, List<SaleLine> lines, CancellationToken ct)
    {
        var hash = Hash(lines);
        await using var c = await Open(ct);
        await using var tx = await c.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
        await RequestLock(c, tx, "sale:" + requestId, ct);
        long? existing = null;
        await using (var cmd = Command(c, "SELECT id,payload_hash FROM inventario_db.sales WHERE request_id=@request", tx, ("request", requestId)))
        await using (var r = await cmd.ExecuteReaderAsync(ct))
        {
            if (await r.ReadAsync(ct))
            {
                if (r.GetString(1) != hash) throw new DomainError(409, "Identificador reutilizado con otra venta.");
                existing = r.GetInt64(0);
            }
        }
        if (existing.HasValue) return await ReadSale(c, tx, existing.Value, ct);
        var lockedProducts = new List<Product>();
        // Orden global por ID: ventas y ajustes usan el mismo bloqueo de fila.
        foreach (var line in lines)
        {
            var p = await LoadProduct(c, tx, line.ProductId, true, ct);
            lockedProducts.Add(p);
        }
        var productos = lockedProducts.Select(p => new Producto { Id = p.Id, Nombre = p.Name,
            PrecioVenta = p.Price, StockActual = p.Stock }).ToArray();
        var venta = new Venta { Detalles = lines.Select(l => new DetalleVenta {
            ProductoId = l.ProductId, Cantidad = l.Quantity }).ToList() };
        // ÚNICA lógica de venta: método académico obligatorio, después de bloquear las filas.
        if (!new VentaService().RegistrarVenta(venta, productos))
            throw new DomainError(409, "Venta rechazada por VentaService: existencias insuficientes o detalle inválido.");
        var items = venta.Detalles.Select(d => {
            var p = lockedProducts.Single(p => p.Id == d.ProductoId);
            return new SaleItem(p.Id, p.Sku, p.Name, d.Cantidad, d.PrecioUnitario);
        }).ToList();
        decimal total = venta.Total;
        long saleId;
        await using (var cmd = Command(c, "INSERT INTO inventario_db.sales(request_id,payload_hash,total) VALUES(@request,@hash,@total)", tx,
            ("request", requestId), ("hash", hash), ("total", total)))
        {
            await cmd.ExecuteNonQueryAsync(ct);
            saleId = cmd.LastInsertedId;
        }
        foreach (var item in items)
        {
            int stock = productos.Single(p => p.Id == item.ProductId).StockActual;
            await using (var cmd = Command(c, "UPDATE inventario_db.products SET stock=@stock WHERE id=@id", tx,
                ("stock", stock), ("id", item.ProductId))) await cmd.ExecuteNonQueryAsync(ct);
            await using (var cmd = Command(c, """
                INSERT INTO inventario_db.sale_items(sale_id,product_id,product_name,sku,quantity,unit_price)
                VALUES(@sale,@product,@name,@sku,@quantity,@price)
                """, tx, ("sale", saleId), ("product", item.ProductId), ("name", item.Name), ("sku", item.Sku), ("quantity", item.Quantity), ("price", item.UnitPrice)))
                await cmd.ExecuteNonQueryAsync(ct);
            await Movement(c, tx, item.ProductId, -item.Quantity, "Venta", saleId, ct);
        }
        var result = await ReadSale(c, tx, saleId, ct);
        await tx.CommitAsync(ct);
        return result;
    }
    public async Task<Sale> SaleDetail(long id, CancellationToken ct)
    {
        await using var c = await Open(ct);
        return await ReadSale(c, null, id, ct);
    }
    private static async Task<Sale> ReadSale(MySqlConnection c, MySqlTransaction? tx, long id, CancellationToken ct)
    {
        Guid requestId; decimal total; DateTime date;
        await using (var cmd = Command(c, "SELECT request_id,total,created_at FROM inventario_db.sales WHERE id=@id", tx, ("id", id)))
        await using (var r = await cmd.ExecuteReaderAsync(ct))
        {
            if (!await r.ReadAsync(ct)) throw new DomainError(404, "Venta no encontrada.");
            requestId = r.GetGuid(0); total = r.GetDecimal(1); date = r.GetDateTime(2);
        }
        var items = new List<SaleItem>();
        await using (var cmd = Command(c, "SELECT product_id,sku,product_name,quantity,unit_price FROM inventario_db.sale_items WHERE sale_id=@id ORDER BY product_id", tx, ("id", id)))
        await using (var r = await cmd.ExecuteReaderAsync(ct))
            while (await r.ReadAsync(ct)) items.Add(new(r.GetInt64(0), r.GetString(1), r.GetString(2), r.GetInt32(3), r.GetDecimal(4)));
        return new(id, requestId, total, date, items);
    }
    public async Task<object> Sales(int page, int size, CancellationToken ct)
    {
        Page(page, size);
        await using var c = await Open(ct);
        await using var count = Command(c, "SELECT count(*) FROM inventario_db.sales");
        var total = Convert.ToInt64(await count.ExecuteScalarAsync(ct));
        await using var cmd = Command(c, "SELECT id,total,created_at FROM inventario_db.sales ORDER BY id DESC LIMIT @limit OFFSET @offset", null,
            ("limit", size), ("offset", ((long)page - 1) * size));
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var items = new List<object>();
        while (await r.ReadAsync(ct)) items.Add(new { id = r.GetInt64(0), total = r.GetDecimal(1), createdAt = r.GetDateTime(2) });
        return new { items, total, page, pageSize = size };
    }
    public async Task<object> Analytics(CancellationToken ct)
    {
        await using var c = await Open(ct);
        await using var tx = await c.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        var products = await AllProducts(c, tx, ct);
        long saleCount; decimal revenue; decimal revenue30;
        await using (var cmd = Command(c, """
            SELECT count(*),coalesce(sum(total),0),coalesce(sum(CASE WHEN created_at >= UTC_TIMESTAMP(6)-INTERVAL 30 DAY THEN total ELSE 0 END),0)
            FROM inventario_db.sales
            """, tx))
        await using (var r = await cmd.ExecuteReaderAsync(ct))
        { await r.ReadAsync(ct); saleCount = r.GetInt64(0); revenue = r.GetDecimal(1); revenue30 = r.GetDecimal(2); }
        var sold = new Dictionary<long, long>();
        await using (var cmd = Command(c, """
            SELECT i.product_id,sum(i.quantity) FROM inventario_db.sale_items i
            JOIN inventario_db.sales s ON s.id=i.sale_id WHERE s.created_at >= UTC_TIMESTAMP(6)-INTERVAL 30 DAY GROUP BY i.product_id
            """, tx))
        await using (var r = await cmd.ExecuteReaderAsync(ct))
            while (await r.ReadAsync(ct)) sold[r.GetInt64(0)] = Convert.ToInt64(r.GetValue(1));
        var daily = new List<object>();
        await using (var cmd = Command(c, """
            WITH RECURSIVE numbers AS (SELECT 0 AS n UNION ALL SELECT n+1 FROM numbers WHERE n<29),
            days AS (SELECT DATE_SUB(UTC_DATE(),INTERVAL n DAY) AS day FROM numbers)
            SELECT d.day,coalesce(sum(s.total),0) FROM days d LEFT JOIN inventario_db.sales s
            ON DATE(s.created_at)=d.day GROUP BY d.day ORDER BY d.day
            """, tx))
        await using (var r = await cmd.ExecuteReaderAsync(ct))
            while (await r.ReadAsync(ct)) daily.Add(new { date = DateOnly.FromDateTime(r.GetDateTime(0)).ToString("yyyy-MM-dd"), revenue = r.GetDecimal(1) });
        var recommendations = products.Select(p =>
        {
            long quantity = sold.GetValueOrDefault(p.Id);
            decimal average = quantity / 30m;
            return new { p.Id, p.Sku, p.Name, p.Stock, p.MinimumStock, unitsSold30 = quantity,
                dailyAverage = decimal.Round(average, 2), daysCover = average == 0 ? (decimal?)null : decimal.Round(p.Stock / average, 1),
                suggestedOrder = Math.Max(0m, decimal.Ceiling(average * 30) + p.MinimumStock - p.Stock) };
        }).OrderByDescending(x => x.suggestedOrder).ThenBy(x => x.Id).ToList();
        await tx.CommitAsync(ct);
        return new { productCount = products.Count, stockUnits = products.Sum(p => (long)p.Stock),
            stockValue = Rules.RecursiveValue(products, 0, products.Count), lowStockCount = products.Count(p => p.Stock <= p.MinimumStock),
            saleCount, revenue, revenue30, averageTicket = saleCount == 0 ? 0 : decimal.Round(revenue / saleCount, 2),
            lowStock = products.Where(p => p.Stock <= p.MinimumStock).OrderBy(p => p.Stock).Take(20),
            topProducts = recommendations.OrderByDescending(x => x.unitsSold30).Where(x => x.unitsSold30 > 0).Take(5),
            recommendations = recommendations.Take(100), daily,
            method = "Demanda media de 30 días; compra = max(0, ceil(demanda × 30) + mínimo − stock). Orientación, no predicción.",
            period = "Demanda: últimas 720 horas; gráfico: 30 fechas UTC; totales: todo el historial." };
    }
}
