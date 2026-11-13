namespace Inventario;

public sealed record Product(long Id, string Sku, string Name, string Category, decimal Price, int Stock, int MinimumStock);
public sealed record ProductInput(string? Sku, string? Name, string? Category, decimal Price, int Stock, int MinimumStock);
public sealed record StockInput(Guid RequestId, int Delta, string? Reason);
public sealed record SaleLine(long ProductId, int Quantity);
public sealed record SaleInput(Guid RequestId, List<SaleLine>? Items);
public sealed record SaleItem(long ProductId, string Sku, string Name, int Quantity, decimal UnitPrice);
public sealed record Sale(long Id, Guid RequestId, decimal Total, DateTime CreatedAt, List<SaleItem> Items);
public sealed class DomainError(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
public static class Rules
{
    public static ProductInput Product(ProductInput p)
    {
        var sku = (p.Sku ?? "").Trim().ToUpperInvariant();
        var name = (p.Name ?? "").Trim();
        var category = (p.Category ?? "").Trim();
        if (!System.Text.RegularExpressions.Regex.IsMatch(sku, "^[A-Z0-9][A-Z0-9_-]{0,39}$"))
            throw new DomainError(400, "SKU: use 1–40 letras, números, guion o guion bajo.");
        if (name.Length is < 1 or > 120 || category.Length is < 1 or > 60)
            throw new DomainError(400, "Nombre (1–120) y categoría (1–60) son obligatorios.");
        if (p.Price <= 0 || p.Price > 9999999999.99m || decimal.Round(p.Price, 2) != p.Price)
            throw new DomainError(400, "Precio positivo, máximo 9.999.999.999,99 y dos decimales.");
        if (p.Stock is < 0 or > 1000000 || p.MinimumStock is < 0 or > 1000000)
            throw new DomainError(400, "Existencias y mínimo deben estar entre 0 y 1.000.000.");
        return p with { Sku = sku, Name = name, Category = category };
    }
    public static List<SaleLine> Sale(SaleInput sale)
    {
        if (sale.RequestId == Guid.Empty || sale.Items is null || sale.Items.Count is < 1 or > 50)
            throw new DomainError(400, "La venta requiere un identificador y de 1 a 50 productos.");
        if (sale.Items.Any(x => x is null || x.ProductId <= 0 || x.Quantity is < 1 or > 1000000)
            || sale.Items.Select(x => x.ProductId).Distinct().Count() != sale.Items.Count)
            throw new DomainError(400, "Productos únicos y cantidades enteras positivas son obligatorios.");
        return sale.Items.OrderBy(x => x.ProductId).ToList();
    }
    // Divide y vencerás: O(n) tiempo, O(log n) pila. No copia sublistas.
    public static decimal RecursiveValue(IReadOnlyList<Product> products, int start, int count)
    {
        if (count == 0) return 0;
        if (count == 1) return products[start].Price * products[start].Stock;
        int half = count / 2;
        return RecursiveValue(products, start, half) + RecursiveValue(products, start + half, count - half);
    }
}
