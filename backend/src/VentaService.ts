// Port explícito del algoritmo C# original. El original se conserva en src/Inventario.Api.
// Conserva seis while, copia temporal, validaciones, subtotales y actualización final.
export interface Producto { Id: number; Nombre: string; PrecioVenta: bigint; StockActual: number }
export interface DetalleVenta { ProductoId: number; Cantidad: number; PrecioUnitario: bigint; Subtotal: bigint }
export interface Venta { Detalles: DetalleVenta[]; Total: bigint }

export class VentaService {
  RegistrarVenta(venta: Venta, productos: Producto[]): boolean {
    let total = 0n;
    let i = 0;
    const stockTemporal: number[] = new Array(productos.length);
    while (i < productos.length) { stockTemporal[i] = productos[i].StockActual; i++; }
    i = 0;
    while (i < venta.Detalles.length) {
      const detalle = venta.Detalles[i]; let j = 0;
      while (j < productos.length && productos[j].Id !== detalle.ProductoId) { j++; }
      if (j === productos.length || detalle.Cantidad <= 0 || stockTemporal[j] < detalle.Cantidad) return false;
      stockTemporal[j] -= detalle.Cantidad; i++;
    }
    i = 0;
    while (i < venta.Detalles.length) {
      const detalle = venta.Detalles[i]; let j = 0;
      while (productos[j].Id !== detalle.ProductoId) { j++; }
      const precio = productos[j].PrecioVenta;
      const subtotal = precio * BigInt(detalle.Cantidad);
      detalle.PrecioUnitario = precio; detalle.Subtotal = subtotal; total += subtotal; i++;
    }
    i = 0;
    while (i < productos.length) { productos[i].StockActual = stockTemporal[i]; i++; }
    venta.Total = total;
    return true;
  }
}
