using System;

public class VentaService
{
    public bool RegistrarVenta(Venta venta, Producto[] productos)
    {
        decimal total = 0;
        int i = 0;

        // Copiar el stock para verificar la venta
        int[] stockTemporal = new int[productos.Length];

        while (i < productos.Length)
        {
            stockTemporal[i] = productos[i].StockActual;
            i++;
        }

        // Verificar los productos y las cantidades
        i = 0;

        while (i < venta.Detalles.Count)
        {
            DetalleVenta detalle = venta.Detalles[i];
            int j = 0;

            while (j < productos.Length &&
                   productos[j].Id != detalle.ProductoId)
            {
                j++;
            }

            if (j == productos.Length)
            {
                Console.WriteLine("Producto no encontrado.");
                return false;
            }

            if (detalle.Cantidad <= 0)
            {
                Console.WriteLine("Cantidad incorrecta.");
                return false;
            }

            if (stockTemporal[j] < detalle.Cantidad)
            {
                Console.WriteLine("Stock insuficiente.");
                return false;
            }

            stockTemporal[j] -= detalle.Cantidad;
            i++;
        }

        // Calcular los precios de la venta
        i = 0;

        while (i < venta.Detalles.Count)
        {
            DetalleVenta detalle = venta.Detalles[i];
            int j = 0;

            while (productos[j].Id != detalle.ProductoId)
            {
                j++;
            }

            decimal precio = Convert.ToDecimal(productos[j].PrecioVenta);
            decimal subtotal = precio * detalle.Cantidad;

            detalle.PrecioUnitario = precio;
            detalle.Subtotal = subtotal;
            total += subtotal;

            Console.WriteLine("Salida de inventario: " + productos[j].Nombre);
            i++;
        }

        // Actualizar el stock
        i = 0;

        while (i < productos.Length)
        {
            productos[i].StockActual = stockTemporal[i];
            i++;
        }

        venta.Total = total;

        Console.WriteLine("Venta registrada.");
        Console.WriteLine("Total: " + total);

        return true;
    }
}
