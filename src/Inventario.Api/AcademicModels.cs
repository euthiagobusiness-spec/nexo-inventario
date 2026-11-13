// Modelos del algoritmo académico obligatorio. Id compatible con bigint en MySQL.
public sealed class Producto
{
    public long Id { get; init; }
    public string Nombre { get; init; } = "";
    public decimal PrecioVenta { get; init; }
    public int StockActual { get; set; }
}
public sealed class DetalleVenta
{
    public long ProductoId { get; init; }
    public int Cantidad { get; init; }
    public decimal PrecioUnitario { get; set; }
    public decimal Subtotal { get; set; }
}
public sealed class Venta
{
    public List<DetalleVenta> Detalles { get; init; } = [];
    public decimal Total { get; set; }
}
