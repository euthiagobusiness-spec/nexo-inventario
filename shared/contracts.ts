export type Money = number | string;
export interface Product { id: number; sku: string; name: string; category: string; price: Money; stock: number; minimumStock: number }
export interface ProductInput { sku: string; name: string; category: string; price: Money; stock: number; minimumStock: number }
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
export interface SaleLine { productId: number; quantity: number }
export interface SaleInput { requestId: string; items: SaleLine[] }
export interface StockInput { requestId: string; delta: number; reason: string }
export interface SaleItem { productId: number; sku: string; name: string; quantity: number; unitPrice: Money }
export interface Sale { id: number; requestId: string; total: Money; createdAt: string; items: SaleItem[] }
export interface SaleSummary { id: number; total: Money; createdAt: string }
export interface Movement { id: number; delta: number; reason: string; saleId: number | null; createdAt: string }
export interface Recommendation { id: number; sku: string; name: string; stock: number; minimumStock: number; unitsSold30: number; dailyAverage: number; daysCover: number | null; suggestedOrder: number }
export interface Analytics {
  productCount: number; stockUnits: number; stockValue: Money; lowStockCount: number;
  saleCount: number; revenue: Money; revenue30: Money; averageTicket: Money;
  lowStock: Product[]; topProducts: Recommendation[]; recommendations: Recommendation[];
  daily: { date: string; revenue: Money }[]; method: string; period: string;
}
