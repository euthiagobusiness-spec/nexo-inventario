import { createServer, type IncomingMessage } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { InventoryStore, poolFromEnvironment } from './InventoryStore.js';
import { DomainError, id, money, pagination, productInput, recursiveValue, saleInput, stockInput } from './domain.js';

async function jsonBody(req: IncomingMessage): Promise<unknown> {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new DomainError(415, 'Se requiere application/json.');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 65536) throw new DomainError(413, 'Solicitud demasiado grande.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; } catch { throw new DomainError(400, 'Solicitud JSON no válida.'); }
}
export function createApp(store: InventoryStore) {
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const send = (status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url ?? '/', 'http://localhost'); const path = url.pathname; const method = req.method ?? 'GET';
      if (path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`))) throw new DomainError(403, 'Origen no autorizado.');
      if (method === 'GET' && path === '/api/health/live') return send(200, { status: 'alive', version: '2.0.0', language: 'TypeScript' });
      if (method === 'GET' && path === '/api/health/ready') { await store.check(); return send(200, { status: 'ready', database: 'MySQL', schema: 1, language: 'TypeScript' }); }
      if (method === 'GET' && path === '/api/products') { const p = pagination(url.searchParams); return send(200, await store.products(url.searchParams.get('search') ?? '', p.page, p.pageSize)); }
      if (method === 'POST' && path === '/api/products') { const p = await store.create(productInput(await jsonBody(req))); res.setHeader('Location', `/api/products/${p.id}`); return send(201, p); }
      const product = /^\/api\/products\/(\d+)(?:\/(stock|movements))?$/.exec(path);
      if (product) {
        const pid = id(product[1]);
        if (method === 'GET' && !product[2]) return send(200, await store.product(pid));
        if (method === 'GET' && product[2] === 'movements') return send(200, await store.movements(pid));
        if (method === 'POST' && product[2] === 'stock') return send(200, await store.adjust(pid, stockInput(await jsonBody(req))));
      }
      if (method === 'GET' && path === '/api/sales') { const p = pagination(url.searchParams); return send(200, await store.sales(p.page, p.pageSize)); }
      if (method === 'POST' && path === '/api/sales') return send(200, await store.sell(saleInput(await jsonBody(req))));
      const sale = /^\/api\/sales\/(\d+)$/.exec(path);
      if (method === 'GET' && sale) return send(200, await store.sale(id(sale[1])));
      if (method === 'GET' && path === '/api/analytics') return send(200, await store.analytics());
      if (method === 'GET' && path === '/api/academic/recursion') { const p = await store.allProducts(); return send(200, { algorithm: 'Suma recursiva por división y conquista', products: p.length, value: money(recursiveValue(p)), timeComplexity: 'O(n)', stackComplexity: 'O(log n)' }); }
      const staticFiles: Record<string, [string, string]> = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/styles.css': ['styles.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'] };
      if ((method === 'GET' || method === 'HEAD') && staticFiles[path]) { const [file, type] = staticFiles[path]; const body = await readFile(new URL(`../../frontend/${file}`, import.meta.url)); res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length }); return res.end(method === 'HEAD' ? undefined : body); }
      throw new DomainError(404, 'Recurso no encontrado.');
    } catch (error) {
      const errno = error && typeof error === 'object' && 'errno' in error ? Number(error.errno) : 0;
      const isDB = error && typeof error === 'object' && 'code' in error;
      const status = error instanceof DomainError ? error.status : errno === 1062 || errno === 1213 || errno === 1205 ? 409 : [1264, 1406, 3819].includes(errno) ? 400 : isDB ? 503 : 500;
      const message = error instanceof DomainError ? error.message : status === 409 ? 'Conflicto de inventario o identificador duplicado.' : status === 400 ? 'Valor fuera del límite permitido.' : status === 503 ? 'Base de datos no disponible.' : 'No fue posible completar la operación.';
      if (!res.headersSent) send(status, { error: message, traceId: randomUUID() }); else res.end();
    }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.env.INVENTARIO_ENV_FILE) process.loadEnvFile(process.env.INVENTARIO_ENV_FILE);
  try {
    const store = new InventoryStore(poolFromEnvironment()); const server = createApp(store);
    const port = Number(process.env.PORT ?? 5080); const host = process.env.HOST ?? '127.0.0.1';
    server.requestTimeout = 30000; server.headersTimeout = 10000;
    server.listen(port, host, () => console.log(`Nexo TypeScript: http://${host}:${port}`));
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { server.close(() => { void store.close().then(() => process.exit(0)); }); server.closeIdleConnections(); });
  } catch { console.error('No fue posible iniciar. Revise la configuración privada de MySQL/TLS.'); process.exitCode = 1; }
}
