using Inventario;
var passed = 0; var failed = 0;
void Test(string name, Action test) { try { test(); passed++; Console.WriteLine("PASS " + name); } catch(Exception e) { failed++; Console.WriteLine("FAIL " + name + ": " + e.Message); } }
void Assert(bool value) { if (!value) throw new Exception("Assertion failed"); }
void Reject(Action action) { try { action(); } catch(DomainError) { return; } throw new Exception("Expected DomainError"); }
Producto[] Products() => [new() { Id=1, Nombre="A", PrecioVenta=0.10m, StockActual=5 }, new() { Id=2, Nombre="B", PrecioVenta=0.20m, StockActual=3 }];
Venta Sale(params (long id,int qty)[] lines) => new() { Detalles = lines.Select(x=>new DetalleVenta { ProductoId=x.id, Cantidad=x.qty }).ToList() };
Test("VentaService: venta válida calcula total y actualiza stock", () => { var p=Products();var v=Sale((1,2),(2,1));Assert(new VentaService().RegistrarVenta(v,p));Assert(v.Total==0.40m&&p[0].StockActual==3&&p[1].StockActual==2&&v.Detalles[0].Subtotal==0.20m); });
Test("VentaService: falta de stock conserva todos los productos", () => { var p=Products();var v=Sale((1,1),(2,4));Assert(!new VentaService().RegistrarVenta(v,p));Assert(p[0].StockActual==5&&p[1].StockActual==3&&v.Total==0); });
Test("VentaService: producto inexistente", () => { var p=Products();Assert(!new VentaService().RegistrarVenta(Sale((99,1)),p));Assert(p[0].StockActual==5); });
Test("VentaService: cantidad cero", () => Assert(!new VentaService().RegistrarVenta(Sale((1,0)),Products())));
Test("VentaService: cantidad negativa", () => Assert(!new VentaService().RegistrarVenta(Sale((1,-1)),Products())));
Test("VentaService: detalles repetidos usan stock temporal acumulado", () => {var p=Products();Assert(!new VentaService().RegistrarVenta(Sale((1,3),(1,3)),p));Assert(p[0].StockActual==5);});
Test("VentaService: agotamiento exacto", () => {var p=Products();Assert(new VentaService().RegistrarVenta(Sale((2,3)),p));Assert(p[1].StockActual==0);});
Test("VentaService: cálculo decimal exacto 0.1 + 0.2", () => {var p=Products();var v=Sale((1,1),(2,1));Assert(new VentaService().RegistrarVenta(v,p)&&v.Total==0.30m);});
Test("VentaService: límite monetario sin pérdida de centavos", () => {Producto[] p=[new(){Id=1,Nombre="Límite",PrecioVenta=9999999999.99m,StockActual=1000000}];var v=Sale((1,1000000));Assert(new VentaService().RegistrarVenta(v,p)&&v.Total==9999999999990000m);});
Test("API: normaliza SKU y texto",()=>{var p=Rules.Product(new(" ab-1 "," A "," B ",1.99m,0,0));Assert(p.Sku=="AB-1"&&p.Name=="A");});
Test("API: rechaza precio negativo",()=>Reject(()=>Rules.Product(new("A","A","A",-1,0,0))));
Test("API: rechaza más de dos decimales",()=>Reject(()=>Rules.Product(new("A","A","A",1.001m,0,0))));
Test("API: rechaza stock negativo",()=>Reject(()=>Rules.Product(new("A","A","A",1,-1,0))));
Test("API: rechaza SKU inválido",()=>Reject(()=>Rules.Product(new("<script>","A","A",1,0,0))));
Test("API: rechaza nombre vacío",()=>Reject(()=>Rules.Product(new("A"," ","A",1,0,0))));
Test("API: rechaza venta vacía",()=>Reject(()=>Rules.Sale(new(Guid.NewGuid(),[]))));
Test("API: rechaza detalle nulo",()=>Reject(()=>Rules.Sale(new(Guid.NewGuid(),[null!]))));
Test("API: rechaza productos duplicados",()=>Reject(()=>Rules.Sale(new(Guid.NewGuid(),[new(1,1),new(1,1)]))));
Test("API: rechaza identificador vacío",()=>Reject(()=>Rules.Sale(new(Guid.Empty,[new(1,1)]))));
Test("API: rechaza más de 50 líneas",()=>Reject(()=>Rules.Sale(new(Guid.NewGuid(),Enumerable.Range(1,51).Select(i=>new SaleLine(i,1)).ToList()))));
Test("API: ordena IDs para bloquear sin orden inverso",()=>{var l=Rules.Sale(new(Guid.NewGuid(),[new(2,1),new(1,1)]));Assert(l[0].ProductId==1);});
Test("Recursividad: vacío",()=>Assert(Rules.RecursiveValue([],0,0)==0));
Test("Recursividad: un producto",()=>Assert(Rules.RecursiveValue([new(1,"A","A","A",2.5m,4,1)],0,1)==10));
Test("Recursividad: 100.001 productos y profundidad logarítmica",()=>{var p=Enumerable.Range(1,100001).Select(i=>new Product(i,"A","A","A",1.23m,i%5,0)).ToList();Assert(Rules.RecursiveValue(p,0,p.Count)==p.Sum(x=>x.Price*x.Stock));});
Console.WriteLine($"RESULT passed={passed} failed={failed}");
return failed==0?0:1;
