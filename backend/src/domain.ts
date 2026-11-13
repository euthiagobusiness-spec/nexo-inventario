import type { Money, Product, ProductInput, SaleInput, StockInput } from '../../shared/contracts.js';

export class DomainError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError(400, 'Solicitud JSON no válida.');
  return value as Record<string, unknown>;
}
export function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    throw new DomainError(400, 'Cantidad o identificador entero fuera del límite.');
  return value;
}
export function id(value: string): number { return integer(Number(value), 1, Number.MAX_SAFE_INTEGER); }
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value))
    throw new DomainError(400, 'Identificador de operación obligatorio.');
  return value.toLowerCase();
}
// Centavos enteros BigInt: no se utiliza coma flotante en la persistencia monetaria.
export function cents(value: unknown): bigint {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+(?:\.\d{1,2})?$/.test(String(value)))
    throw new DomainError(400, 'Importe positivo con máximo dos decimales.');
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function decimal(value: bigint): string { return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`; }
// The JSON number limit is based on dollar precision, not the integer cent count.
// Below 2^51 cents, IEEE-754 spacing stays small enough to round to the same cent.
const MAX_JSON_MONEY_CENTS = 1n << 51n;
export function money(value: bigint): Money { return value <= MAX_JSON_MONEY_CENTS ? Number(decimal(value)) : decimal(value); }
export function roundEven(numerator: bigint, denominator: bigint): bigint {
  const q = numerator / denominator; const r = numerator % denominator;
  return r * 2n > denominator || (r * 2n === denominator && q % 2n !== 0n) ? q + 1n : q;
}
export function productInput(raw: unknown): ProductInput {
  const p = object(raw);
  const sku = typeof p.sku === 'string' ? p.sku.trim().toUpperCase() : '';
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  const category = typeof p.category === 'string' ? p.category.trim() : '';
  if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(sku)) throw new DomainError(400, 'SKU: use 1–40 letras, números, guion o guion bajo.');
  if (!name || name.length > 120 || !category || category.length > 60) throw new DomainError(400, 'Nombre y categoría obligatorios.');
  const price = cents(p.price);
  if (price <= 0n || price > 999999999999n) throw new DomainError(400, 'Precio fuera del límite.');
  return { sku, name, category, price: money(price), stock: integer(p.stock, 0, 1000000), minimumStock: integer(p.minimumStock, 0, 1000000) };
}
export function saleInput(raw: unknown): SaleInput {
  const s = object(raw); const requestId = uuid(s.requestId);
  if (!Array.isArray(s.items) || s.items.length < 1 || s.items.length > 50) throw new DomainError(400, 'La venta requiere de 1 a 50 productos.');
  const items = s.items.map(item => { const p = object(item); return { productId: integer(p.productId, 1, Number.MAX_SAFE_INTEGER), quantity: integer(p.quantity, 1, 1000000) }; });
  if (new Set(items.map(i => i.productId)).size !== items.length) throw new DomainError(400, 'Productos únicos obligatorios.');
  return { requestId, items: items.sort((a, b) => a.productId - b.productId) };
}
export function stockInput(raw: unknown): StockInput {
  const s = object(raw); const reason = typeof s.reason === 'string' ? s.reason.trim() : '';
  const delta = integer(s.delta, -1000000, 1000000);
  if (!delta || !reason || reason.length > 200) throw new DomainError(400, 'Cantidad no nula y motivo obligatorios.');
  return { requestId: uuid(s.requestId), delta, reason };
}
export function pagination(params: URLSearchParams): { page: number; pageSize: number } {
  return { page: integer(Number(params.get('page') ?? 1), 1, 1000000), pageSize: integer(Number(params.get('pageSize') ?? 20), 1, 100) };
}
export function recursiveValue(products: readonly Product[], start = 0, count = products.length): bigint {
  if (count === 0) return 0n;
  if (count === 1) return cents(products[start].price) * BigInt(products[start].stock);
  const half = Math.floor(count / 2);
  return recursiveValue(products, start, half) + recursiveValue(products, start + half, count - half);
}
