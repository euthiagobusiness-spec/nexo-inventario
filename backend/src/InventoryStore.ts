import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import mysql, { type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import type { Analytics, Product, ProductInput, Sale, SaleInput, StockInput, Movement } from '../../shared/contracts.js';
import { cents, decimal, DomainError, money, recursiveValue, roundEven } from './domain.js';
import { VentaService, type Venta } from './VentaService.js';

type Row = RowDataPacket & Record<string, unknown>;
type SqlValue = string | number | null;
const fields = 'id,sku,name,category,price,stock,minimum_stock';
const num = (v: unknown): number => {
  const n = Number(v); if (!Number.isSafeInteger(n)) throw new DomainError(500, 'Valor entero fuera del límite seguro.'); return n;
};
const stamp = (v: unknown): string => String(v).replace(' ', 'T').replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '') + 'Z';
const product = (r: Row): Product => ({ id: num(r.id), sku: String(r.sku), name: String(r.name), category: String(r.category), price: money(cents(String(r.price))), stock: num(r.stock), minimumStock: num(r.minimum_stock) });
// Compatible con el archivo privado de la candidata .NET, sin copiar credenciales al código.
export function poolFromEnvironment(env: NodeJS.ProcessEnv = process.env): Pool | undefined {
  const cs = env.ConnectionStrings__Inventory;
  const p = new Map((cs ?? '').split(';').filter(Boolean).map(pair => { const pos = pair.indexOf('='); return [pair.slice(0, pos).toLowerCase(), pair.slice(pos + 1)] as const; }));
  const host = env.MYSQL_HOST ?? p.get('server');
  if (!host) return undefined;
  const caPath = env.MYSQL_SSL_CA ?? p.get('sslca');
  if (!caPath) throw new DomainError(503, 'Falta el certificado CA para MySQL.');
  return mysql.createPool({
    host, port: Number(env.MYSQL_PORT ?? p.get('port') ?? 3306), database: env.MYSQL_DATABASE ?? p.get('database') ?? 'inventario_db',
    user: env.MYSQL_USER ?? p.get('userid'), password: env.MYSQL_PASSWORD ?? p.get('password'),
    ssl: { ca: readFileSync(caPath), rejectUnauthorized: true, verifyIdentity: false },
    connectionLimit: 20, waitForConnections: true, queueLimit: 100, connectTimeout: 5000,
    namedPlaceholders: false, multipleStatements: false, supportBigNumbers: true, bigNumberStrings: true,
    dateStrings: true, timezone: 'Z', decimalNumbers: false,
  });
}
export class InventoryStore {
  constructor(private readonly pool: Pool | undefined) {}
  async close(): Promise<void> { await this.pool?.end(); }
  private async connection(): Promise<PoolConnection> {
    if (!this.pool) throw new DomainError(503, 'Base de datos pendiente de configuración administrativa.');
    return this.pool.getConnection();
  }
  private async use<T>(work: (c: PoolConnection) => Promise<T>, isolation?: 'READ COMMITTED' | 'REPEATABLE READ'): Promise<T> {
    const c = await this.connection();
    try {
      if (isolation) { await c.query(`SET TRANSACTION ISOLATION LEVEL ${isolation}`); await c.beginTransaction(); }
      const result = await work(c);
      if (isolation) await c.commit();
      return result;
    } catch (error) { if (isolation) await c.rollback().catch(() => undefined); throw error; }
    finally { c.release(); }
  }
  private async rows(c: PoolConnection, sql: string, values: SqlValue[] = []): Promise<Row[]> {
    const [rows] = await c.execute<Row[]>({ sql, timeout: 15000 }, values); return rows;
  }
  private async exec(c: PoolConnection, sql: string, values: SqlValue[] = []): Promise<ResultSetHeader> {
    const [result] = await c.execute<ResultSetHeader>({ sql, timeout: 15000 }, values); return result;
  }
  async check(): Promise<void> {
    await this.use(async c => { if (!(await this.rows(c, 'SELECT version FROM schema_versions WHERE version=1')).length) throw new DomainError(503, 'Falta aplicar el esquema v1.'); });
  }
  async products(search: string, page: number, pageSize: number) {
    if (search.length > 120) throw new DomainError(400, 'Búsqueda demasiado larga.');
    return this.use(async c => {
      const where = " WHERE LOCATE(LOWER(?),LOWER(CONCAT(sku,' ',name,' ',category)))>0";
      const count = await this.rows(c, 'SELECT COUNT(*) AS n FROM products' + where, [search.trim()]);
      const items = await this.rows(c, `SELECT ${fields} FROM products${where} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, [search.trim()]);
      return { items: items.map(product), total: num(count[0].n), page, pageSize };
    });
  }
  private async load(c: PoolConnection, id: number, locked = false): Promise<Product> {
    const rows = await this.rows(c, `SELECT ${fields} FROM products WHERE id=?${locked ? ' FOR UPDATE' : ''}`, [id]);
    if (!rows.length) throw new DomainError(404, 'Producto no encontrado.'); return product(rows[0]);
  }
  async product(id: number) { return this.use(c => this.load(c, id)); }
  private async all(c: PoolConnection): Promise<Product[]> { return (await this.rows(c, `SELECT ${fields} FROM products ORDER BY id`)).map(product); }
  async allProducts(): Promise<Product[]> { return this.use(c => this.all(c)); }
  private async movement(c: PoolConnection, id: number, delta: number, reason: string, saleId: number | null): Promise<void> {
    await this.exec(c, 'INSERT INTO stock_movements(product_id,delta,reason,sale_id) VALUES(?,?,?,?)', [id, delta, reason, saleId]);
  }
  async create(input: ProductInput): Promise<Product> {
    return this.use(async c => {
      const result = await this.exec(c, 'INSERT INTO products(sku,name,category,price,stock,minimum_stock) VALUES(?,?,?,?,?,?)', [input.sku, input.name, input.category, decimal(cents(input.price)), input.stock, input.minimumStock]);
      const p = await this.load(c, num(result.insertId));
      if (input.stock > 0) await this.movement(c, p.id, input.stock, 'Existencias iniciales', null);
      return p;
    }, 'READ COMMITTED');
  }
  private hash(value: unknown): string {
    // System.Text.Json (codificador predeterminado) de la versión .NET anterior.
    const serialized = JSON.stringify(value).replace(/\\"/g, '\\u0022').replace(/[<>&'+\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
    return createHash('sha256').update(serialized).digest('hex').toUpperCase();
  }
  private async lock(c: PoolConnection, key: string): Promise<void> {
    await this.exec(c, 'INSERT INTO request_locks(request_key) VALUES(?) ON DUPLICATE KEY UPDATE request_key=request_key', [key]);
  }
  async adjust(id: number, input: StockInput) {
    // Propiedades PascalCase conservan el hash de las operaciones previas .NET.
    const hash = this.hash({ id, Delta: input.delta, reason: input.reason });
    return this.use(async c => {
      await this.lock(c, 'stock:' + input.requestId);
      const existing = await this.rows(c, 'SELECT payload_hash,resulting_stock FROM stock_requests WHERE request_id=?', [input.requestId]);
      if (existing.length) {
        if (existing[0].payload_hash !== hash) throw new DomainError(409, 'Identificador reutilizado con otro ajuste.');
        return { productId: id, stock: num(existing[0].resulting_stock), requestId: input.requestId };
      }
      const p = await this.load(c, id, true); const stock = p.stock + input.delta;
      if (stock < 0 || stock > 1000000) throw new DomainError(409, 'El ajuste dejaría las existencias fuera de 0–1.000.000.');
      await this.exec(c, 'UPDATE products SET stock=? WHERE id=?', [stock, id]);
      await this.movement(c, id, input.delta, input.reason, null);
      await this.exec(c, 'INSERT INTO stock_requests(request_id,payload_hash,product_id,resulting_stock) VALUES(?,?,?,?)', [input.requestId, hash, id, stock]);
      return { productId: id, stock, requestId: input.requestId };
    }, 'READ COMMITTED');
  }
  async movements(id: number): Promise<Movement[]> {
    return this.use(async c => { await this.load(c, id); return (await this.rows(c, 'SELECT id,delta,reason,sale_id,created_at FROM stock_movements WHERE product_id=? ORDER BY id DESC LIMIT 100', [id])).map(r => ({ id: num(r.id), delta: num(r.delta), reason: String(r.reason), saleId: r.sale_id === null ? null : num(r.sale_id), createdAt: stamp(r.created_at) })); });
  }
  async sell(input: SaleInput): Promise<Sale> {
    const hash = this.hash(input.items.map(i => ({ ProductId: i.productId, Quantity: i.quantity })));
    return this.use(async c => {
      await this.lock(c, 'sale:' + input.requestId);
      const existing = await this.rows(c, 'SELECT id,payload_hash FROM sales WHERE request_id=?', [input.requestId]);
      if (existing.length) {
        if (existing[0].payload_hash !== hash) throw new DomainError(409, 'Identificador reutilizado con otra venta.');
        return this.readSale(c, num(existing[0].id));
      }
      const locked: Product[] = [];
      for (const line of input.items) locked.push(await this.load(c, line.productId, true));
      const productos = locked.map(p => ({ Id: p.id, Nombre: p.name, PrecioVenta: cents(p.price), StockActual: p.stock }));
      const venta: Venta = { Total: 0n, Detalles: input.items.map(i => ({ ProductoId: i.productId, Cantidad: i.quantity, PrecioUnitario: 0n, Subtotal: 0n })) };
      if (!new VentaService().RegistrarVenta(venta, productos)) throw new DomainError(409, 'Venta rechazada por VentaService: existencias insuficientes o detalle inválido.');
      const result = await this.exec(c, 'INSERT INTO sales(request_id,payload_hash,total) VALUES(?,?,?)', [input.requestId, hash, decimal(venta.Total)]);
      const saleId = num(result.insertId);
      for (const line of venta.Detalles) {
        const p = locked.find(p => p.id === line.ProductoId)!; const updated = productos.find(p => p.Id === line.ProductoId)!;
        await this.exec(c, 'UPDATE products SET stock=? WHERE id=?', [updated.StockActual, p.id]);
        await this.exec(c, 'INSERT INTO sale_items(sale_id,product_id,product_name,sku,quantity,unit_price) VALUES(?,?,?,?,?,?)', [saleId, p.id, p.name, p.sku, line.Cantidad, decimal(line.PrecioUnitario)]);
        await this.movement(c, p.id, -line.Cantidad, 'Venta', saleId);
      }
      return this.readSale(c, saleId);
    }, 'READ COMMITTED');
  }
  private async readSale(c: PoolConnection, id: number): Promise<Sale> {
    const records = await this.rows(c, 'SELECT id,request_id,total,created_at FROM sales WHERE id=?', [id]);
    if (!records.length) throw new DomainError(404, 'Venta no encontrada.'); const r = records[0];
    const items = await this.rows(c, 'SELECT product_id,sku,product_name,quantity,unit_price FROM sale_items WHERE sale_id=? ORDER BY product_id', [id]);
    return { id, requestId: String(r.request_id), total: money(cents(String(r.total))), createdAt: stamp(r.created_at), items: items.map(i => ({ productId: num(i.product_id), sku: String(i.sku), name: String(i.product_name), quantity: num(i.quantity), unitPrice: money(cents(String(i.unit_price))) })) };
  }
  async sale(id: number): Promise<Sale> { return this.use(c => this.readSale(c, id)); }
  async sales(page: number, pageSize: number) {
    return this.use(async c => {
      const count = await this.rows(c, 'SELECT COUNT(*) AS n FROM sales');
      const records = await this.rows(c, `SELECT id,total,created_at FROM sales ORDER BY id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`);
      return { items: records.map(r => ({ id: num(r.id), total: money(cents(String(r.total))), createdAt: stamp(r.created_at) })), total: num(count[0].n), page, pageSize };
    });
  }
  async analytics(): Promise<Analytics> {
    return this.use(async c => {
      const products = await this.all(c);
      const [s] = await this.rows(c, 'SELECT COUNT(*) AS n,COALESCE(SUM(total),0) AS revenue,COALESCE(SUM(CASE WHEN created_at>=UTC_TIMESTAMP(6)-INTERVAL 30 DAY THEN total ELSE 0 END),0) AS revenue30 FROM sales');
      const quantities = await this.rows(c, 'SELECT i.product_id,SUM(i.quantity) AS n FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE s.created_at>=UTC_TIMESTAMP(6)-INTERVAL 30 DAY GROUP BY i.product_id');
      const sold = new Map(quantities.map(r => [num(r.product_id), num(r.n)]));
      const days = await this.rows(c, 'WITH RECURSIVE numbers AS (SELECT 0 AS n UNION ALL SELECT n+1 FROM numbers WHERE n<29),days AS (SELECT DATE_SUB(UTC_DATE(),INTERVAL n DAY) AS day FROM numbers) SELECT d.day,COALESCE(SUM(s.total),0) AS revenue FROM days d LEFT JOIN sales s ON DATE(s.created_at)=d.day GROUP BY d.day ORDER BY d.day');
      const recommendations = products.map(p => { const quantity = sold.get(p.id) ?? 0; const average = quantity / 30; return { id: p.id, sku: p.sku, name: p.name, stock: p.stock, minimumStock: p.minimumStock, unitsSold30: quantity, dailyAverage: Math.round(average * 100) / 100, daysCover: average === 0 ? null : Math.round(p.stock / average * 10) / 10, suggestedOrder: Math.max(0, quantity + p.minimumStock - p.stock) }; }).sort((a, b) => b.suggestedOrder - a.suggestedOrder || a.id - b.id);
      const saleCount = num(s.n); const revenue = cents(String(s.revenue));
      return {
        productCount: products.length, stockUnits: products.reduce((sum, p) => sum + p.stock, 0), stockValue: money(recursiveValue(products)), lowStockCount: products.filter(p => p.stock <= p.minimumStock).length,
        saleCount, revenue: money(revenue), revenue30: money(cents(String(s.revenue30))), averageTicket: saleCount === 0 ? 0 : money(roundEven(revenue, BigInt(saleCount))),
        lowStock: products.filter(p => p.stock <= p.minimumStock).sort((a, b) => a.stock - b.stock).slice(0, 20), topProducts: [...recommendations].sort((a, b) => b.unitsSold30 - a.unitsSold30).filter(p => p.unitsSold30 > 0).slice(0, 5), recommendations: recommendations.slice(0, 100),
        daily: days.map(r => ({ date: String(r.day), revenue: money(cents(String(r.revenue))) })),
        method: 'Demanda media de 30 días; compra = max(0, unidades vendidas en 30 días + mínimo − stock). Orientación, no predicción.',
        period: 'Demanda: últimas 720 horas; gráfico: 30 fechas UTC; totales: todo el historial.',
      };
    }, 'REPEATABLE READ');
  }
}
