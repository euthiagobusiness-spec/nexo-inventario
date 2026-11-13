"""Confirma que solo tres líneas monetarias cambian respecto al original suministrado."""
from pathlib import Path
import difflib
root=Path(__file__).resolve().parents[1]
original=(root/'docs/VentaService.original.cs.txt').read_text(encoding='utf-8').strip()
actual=(root/'src/Inventario.Api/VentaService.cs').read_text(encoding='utf-8').strip()
expected=original.replace('double total = 0;', 'decimal total = 0;').replace('double precio = Convert.ToDouble(productos[j].PrecioVenta);','decimal precio = Convert.ToDecimal(productos[j].PrecioVenta);').replace('double subtotal = precio * detalle.Cantidad;','decimal subtotal = precio * detalle.Cantidad;')
if actual != expected:
    print('\n'.join(difflib.unified_diff(expected.splitlines(),actual.splitlines())))
    raise SystemExit('FAIL: cambios no documentados en VentaService')
print('PASS: original preservado; exactamente tres líneas monetarias adaptadas; todos los while intactos.')
