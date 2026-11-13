import type { Product, Page, Sale, SaleSummary, Movement, Analytics, Money } from '../../shared/contracts.js';
interface CartItem extends Product { quantity: number }
interface Elements {
  '#refresh': HTMLButtonElement;
  '#main': HTMLElement;
  '#page-title': HTMLElement;
  '#page-description': HTMLElement;
  '#connection': HTMLElement;
  '#global-error': HTMLElement;
  '#view-dashboard': HTMLElement;
  '#metrics': HTMLElement;
  '#recent-products': HTMLElement;
  '#low-stock': HTMLElement;
  '#recent-sales': HTMLElement;
  '#view-products': HTMLElement;
  '#inventory-metrics': HTMLElement;
  '#new-product': HTMLElement;
  '#product-form': HTMLFormElement;
  '#search-form': HTMLFormElement;
  '#search': HTMLInputElement;
  '#products-body': HTMLElement;
  '#products-page': HTMLElement;
  '#products-prev': HTMLButtonElement;
  '#products-next': HTMLButtonElement;
  '#view-sales': HTMLElement;
  '#sale-search-form': HTMLFormElement;
  '#sale-search': HTMLInputElement;
  '#sale-options': HTMLElement;
  '#cart': HTMLElement;
  '#cart-total': HTMLElement;
  '#checkout': HTMLButtonElement;
  '#sale-error': HTMLElement;
  '#sale-success': HTMLElement;
  '#sales-body': HTMLElement;
  '#sales-page': HTMLElement;
  '#sales-prev': HTMLButtonElement;
  '#sales-next': HTMLButtonElement;
  '#sale-detail': HTMLElement;
  '#view-analytics': HTMLElement;
  '#bi-metrics': HTMLElement;
  '#daily-chart': HTMLElement;
  '#top-products': HTMLElement;
  '#ba-method': HTMLElement;
  '#ba-body': HTMLElement;
  '#view-academic': HTMLElement;
  '#recursion': HTMLButtonElement;
  '#recursion-result': HTMLElement;
  '#stock-dialog': HTMLDialogElement;
  '#stock-title': HTMLElement;
  '#stock-close': HTMLButtonElement;
  '#stock-current': HTMLElement;
  '#stock-form': HTMLFormElement;
  '#movements': HTMLElement;
  '#toast': HTMLElement;
}
function $<K extends keyof Elements>(selector: K): Elements[K];
function $<T extends HTMLElement = HTMLElement>(selector: string): T;
function $(selector: string): HTMLElement { const element = document.querySelector<HTMLElement>(selector); if (!element) throw new Error('Elemento requerido: ' + selector); return element; }

const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, c => (({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[c]));
const money = (n: Money): string => { if (typeof n === 'string' && /^\d+\.\d{2}$/.test(n)) { const [whole, fraction] = n.split('.'); return 'R$ ' + new Intl.NumberFormat('pt-BR').format(BigInt(whole)) + ',' + fraction; } return new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(Number(n)); };
const number = (n: number): string => new Intl.NumberFormat('es').format(n);
const date = (d: string): string => new Intl.DateTimeFormat('es', {dateStyle:'short',timeStyle:'short'}).format(new Date(d));
const uuid = () => { const b = crypto.getRandomValues(new Uint8Array(16)); b[6]=(b[6]&15)|64; b[8]=(b[8]&63)|128; const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join(''); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; };
let productPage=1, salesPage=1, productSearch='';
let currentStockId: number | null = null;
let cart: CartItem[] = [];
let saleOptions: Product[] = [];
let saleRequest: string | null = null, stockRequest: string | null = null;
let busy=false; let toastTimer: number | undefined;
try { const saved: unknown = JSON.parse(sessionStorage.getItem('nexo-pending-sale') || 'null'); if (saved && typeof saved === 'object' && 'cart' in saved && Array.isArray(saved.cart) && saved.cart.every((p: unknown) => p && typeof p === 'object' && 'id' in p && Number.isSafeInteger(p.id) && 'quantity' in p && Number.isSafeInteger(p.quantity) && 'name' in p && typeof p.name === 'string' && 'price' in p && (typeof p.price === 'number' || typeof p.price === 'string'))) { cart = saved.cart as CartItem[]; saleRequest = 'request' in saved && typeof saved.request === 'string' ? saved.request : null; } } catch { /* Storage optional. */ }
function saveCart(){try{sessionStorage.setItem('nexo-pending-sale',JSON.stringify({cart,request:saleRequest}));}catch{}}
async function api<T>(path: string, options: RequestInit = {}): Promise<T>{
  const response=await fetch('/api'+path,{...options,headers:{'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(25000)});
  const body=await response.json().catch(()=>({error:'Respuesta del servidor no válida.'}));
  if(!response.ok) throw new Error(body.error||`Error HTTP ${response.status}`);
  return body as T;
}
function toast(message: string){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,6000);}
function showError(el: HTMLElement, message: string){el.textContent=message;el.hidden=false;}
function errorText(error: unknown): string { if (!(error instanceof Error)) return 'No fue posible completar la operación.'; return error.name==='TimeoutError'?'El servidor tardó demasiado. Puedes reintentar; se conserva el identificador de la operación.':error.message;}
async function submitForm(form: HTMLFormElement, work: () => Promise<void>): Promise<void> { const button = form.querySelector<HTMLButtonElement>('button[type=submit],button:not([type])'); const error = form.querySelector<HTMLElement>('.form-error'); if (!button || !error) throw new Error('Formulario incompleto'); error.hidden = true; button.disabled = true; try { await work(); } catch(e) { showError(error,errorText(e)); } finally { button.disabled = false; } }
const views={dashboard:['Resumen del negocio','Existencias, ventas y decisiones en un solo lugar.'],products:['Inventario de productos','Consulta el catálogo, registra productos y controla sus existencias.'],sales:['Registro de ventas','Venta confirmada, existencias actualizadas y trazabilidad.'],analytics:['Inteligencia de negocio','Datos observados para entender resultados y orientar la reposición.'],academic:['Proyecto académico','Programación II · Arquitectura, algoritmos y decisiones técnicas.']};
function navigate(){const hash=location.hash.slice(1); const key: keyof typeof views=Object.hasOwn(views,hash)?hash as keyof typeof views:'dashboard';for(const [name] of Object.entries(views)){$('#view-'+name).hidden=name!==key;const link=$(`[data-view="${name}"]`);if(name===key)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}$('#page-title').textContent=views[key][0];$('#page-description').textContent=views[key][1];}
window.addEventListener('hashchange',navigate);navigate();
function badge(p: Product){return p.stock===0?'<span class="badge bad">Agotado</span>':p.stock<=p.minimumStock?'<span class="badge warn">Existencias bajas</span>':'<span class="badge good">Disponible</span>';}
function metric(label: string, value: unknown, detail=''){return `<article class="metric"><p>${esc(label)}</p><strong>${esc(value)}</strong><small>${esc(detail)}</small></article>`;}
async function loadProducts(){const data=await api<Page<Product>>(`/products?search=${encodeURIComponent(productSearch)}&page=${productPage}&pageSize=20`);$('#products-body').innerHTML=data.items.map(p=>`<tr><td><strong>${esc(p.name)}</strong><small>${esc(p.sku)}</small></td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td><strong>${number(p.stock)}</strong><small>Mínimo: ${number(p.minimumStock)}</small></td><td>${badge(p)}</td><td><button class="secondary" data-stock="${p.id}" aria-label="Controlar existencias de ${esc(p.name)}">Existencias</button></td></tr>`).join('')||'<tr><td colspan="6">No se encontraron productos. Registra el primero.</td></tr>';$('#products-page').textContent=`${number(data.total)} productos · Página ${productPage} de ${Math.max(1,Math.ceil(data.total/20))}`;$('#products-prev').disabled=productPage<=1;$('#products-next').disabled=productPage*20>=data.total;return data;}
async function loadSales(){const data=await api<Page<SaleSummary>>(`/sales?page=${salesPage}&pageSize=20`);$('#sales-body').innerHTML=data.items.map(s=>`<tr><td><strong>#${s.id}</strong></td><td>${date(s.createdAt)}</td><td>${money(s.total)}</td><td><button class="secondary" data-sale="${s.id}" aria-label="Ver detalle de venta ${s.id}">Ver detalle</button></td></tr>`).join('')||'<tr><td colspan="4">Todavía no hay ventas registradas.</td></tr>';$('#sales-page').textContent=`${number(data.total)} ventas · Página ${salesPage} de ${Math.max(1,Math.ceil(data.total/20))}`;$('#sales-prev').disabled=salesPage<=1;$('#sales-next').disabled=salesPage*20>=data.total;}
async function loadSummary(){const [a,s,p]=await Promise.all([api<Analytics>('/analytics'),api<Page<SaleSummary>>('/sales?pageSize=5'),api<Page<Product>>('/products?pageSize=5')]);$('#metrics').innerHTML=metric('Productos',number(a.productCount),'Referencias registradas')+metric('Unidades disponibles',number(a.stockUnits),'Existencias actuales')+metric('Ventas acumuladas',money(a.revenue),`${number(a.saleCount)} ventas confirmadas`)+metric('Productos por reponer',number(a.lowStockCount),'Existencias ≤ mínimo');$('#inventory-metrics').innerHTML=metric('Total de productos',number(a.productCount))+metric('Existencias bajas',number(a.lowStockCount),'Incluye productos agotados')+metric('Valor del inventario',money(a.stockValue),'Valor a precio de venta')+metric('Unidades disponibles',number(a.stockUnits));$('#low-stock').innerHTML=a.lowStock.map(p=>`<div class="item-row"><div><strong>${esc(p.name)}</strong><small>${esc(p.sku)} · Mínimo ${number(p.minimumStock)}</small></div><span class="badge ${p.stock===0?'bad':'warn'}">${number(p.stock)} unidades</span></div>`).join('')||'Sin alertas de existencias.';$('#low-stock').classList.toggle('empty',!a.lowStock.length);$('#recent-sales').innerHTML=s.items.map(s=>`<div class="item-row"><div><strong>Venta #${s.id}</strong><small>${date(s.createdAt)}</small></div><strong>${money(s.total)}</strong></div>`).join('')||'Aún no hay ventas.';$('#recent-products').innerHTML=p.items.map(p=>`<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.sku)}</td><td>${esc(p.category)}</td><td>${number(p.stock)}</td><td>${money(p.price)}</td><td>${badge(p)}</td></tr>`).join('')||'<tr><td colspan="6">Registra tu primer producto en el catálogo.</td></tr>';$('#bi-metrics').innerHTML=metric('Ingresos · últimas 720 h',money(a.revenue30),'Ventana móvil de 30 días')+metric('Ticket medio',money(a.averageTicket),'Todo el historial')+metric('Valor del inventario',money(a.stockValue),'Stock × precio de venta; no coste')+metric('Ventas confirmadas',number(a.saleCount),'Todo el historial');const daily=a.daily.slice(-7),max=Math.max(1,...daily.map(d=>Number(d.revenue)));$('#daily-chart').innerHTML=daily.map(d=>`<div class="chart-row"><span>${esc(d.date.slice(5))}</span><meter min="0" max="${max}" value="${d.revenue}" aria-label="Ingresos del ${d.date}: ${money(d.revenue)}"></meter><strong>${money(d.revenue)}</strong></div>`).join('');$('#top-products').innerHTML=a.topProducts.map(p=>`<div class="item-row"><div><strong>${esc(p.name)}</strong><small>${esc(p.sku)}</small></div><span class="badge neutral">${number(p.unitsSold30)} unidades</span></div>`).join('')||'Sin ventas en el período.';$('#ba-method').textContent=a.method;$('#ba-body').innerHTML=a.recommendations.map(p=>`<tr><td><strong>${esc(p.name)}</strong><small>${esc(p.sku)}</small></td><td>${number(p.unitsSold30)}</td><td>${number(p.dailyAverage)}</td><td>${p.daysCover===null?'Sin demanda':number(p.daysCover)+' días'}</td><td><span class="badge ${p.suggestedOrder>0?'warn':'good'}">${number(p.suggestedOrder)} unidades</span></td></tr>`).join('')||'<tr><td colspan="5">Registra productos para analizar la reposición.</td></tr>';}
async function loadSaleOptions(){const data=await api<Page<Product>>(`/products?search=${encodeURIComponent($('#sale-search').value.trim())}&pageSize=20`);$('#sale-options').innerHTML=data.items.map(p=>`<div class="item-row"><div><strong>${esc(p.name)}</strong><small>${esc(p.sku)} · ${money(p.price)} · ${number(p.stock)} disponibles</small></div><button class="secondary" data-add="${p.id}" ${p.stock===0?'disabled':''} aria-label="Añadir ${esc(p.name)}">Añadir</button></div>`).join('')||'<p class="empty">No hay productos para esta búsqueda.</p>';saleOptions=data.items;}
function renderCart(){const el=$('#cart');el.classList.toggle('empty',!cart.length);el.innerHTML=cart.map(p=>`<div class="cart-line"><div><strong>${esc(p.name)}</strong><small>${money(p.price)} / unidad</small></div><input type="number" min="1" max="1000000" step="1" value="${p.quantity}" data-quantity="${p.id}" aria-label="Cantidad de ${esc(p.name)}"><button class="secondary" data-remove="${p.id}" aria-label="Quitar ${esc(p.name)}">×</button></div>`).join('')||'Selecciona productos para empezar.';$('#cart-total').textContent=money(cart.reduce((s,p)=>s+Number(p.price)*p.quantity,0));$('#checkout').disabled=!cart.length||busy;saveCart();}
async function refresh(){const button=$('#refresh');button.disabled=true;$('#global-error').hidden=true;try{await api('/health/ready');await Promise.all([loadProducts(),loadSales(),loadSummary(),loadSaleOptions()]);$('#connection').textContent='Base de datos conectada';$('#connection').className='badge good';}catch(e){$('#connection').textContent='Base de datos no disponible';$('#connection').className='badge bad';showError($('#global-error'),errorText(e)+' Los valores anteriores, si existen, pueden estar desactualizados.');}finally{button.disabled=false;}}
$('#refresh').addEventListener('click',refresh);
$('#product-form').addEventListener('submit',event=>{event.preventDefault();const form=$('#product-form');submitForm(form,async()=>{const fields=Object.fromEntries(new FormData(form)); const values={...fields,price:Number(fields.price),stock:Number(fields.stock),minimumStock:Number(fields.minimumStock)};await api('/products',{method:'POST',body:JSON.stringify(values)});form.reset();productPage=1;toast('Producto registrado correctamente.');await refresh();});});
$('#search-form').addEventListener('submit',async e=>{e.preventDefault();productSearch=$('#search').value.trim();productPage=1;try{await loadProducts();}catch(e){toast(errorText(e));}});
for(const [button,delta] of [['products-prev',-1],['products-next',1]] as const)$<HTMLButtonElement>('#'+button).addEventListener('click',async()=>{productPage+=delta;try{await loadProducts();}catch(e){productPage-=delta;toast(errorText(e));}});
for(const [button,delta] of [['sales-prev',-1],['sales-next',1]] as const)$<HTMLButtonElement>('#'+button).addEventListener('click',async()=>{salesPage+=delta;try{await loadSales();}catch(e){salesPage-=delta;toast(errorText(e));}});
$('#sale-search-form').addEventListener('submit',async e=>{e.preventDefault();try{await loadSaleOptions();}catch(e){toast(errorText(e));}});
$('#sale-options').addEventListener('click',e=>{if (!(e.target instanceof Element)) return; const button=e.target.closest<HTMLButtonElement>('[data-add]');if(!button||busy)return;const p=saleOptions.find(p=>p.id===Number(button.dataset.add));if (!p) return; const existing=cart.find(c=>c.id===p.id);if(existing){if(existing.quantity>=p.stock){toast('La cantidad supera las existencias consultadas.');return;}existing.quantity++;}else{if(cart.length>=50){toast('Máximo 50 productos por venta.');return;}cart.push({...p,quantity:1});}saleRequest=null;$('#sale-success').hidden=true;renderCart();});
$('#cart').addEventListener('click',e=>{if (!(e.target instanceof Element)) return; const button=e.target.closest<HTMLButtonElement>('[data-remove]');if(!button||busy)return;cart=cart.filter(p=>p.id!==Number(button.dataset.remove));saleRequest=null;renderCart();});
$('#cart').addEventListener('change',e=>{if (!(e.target instanceof Element)) return; const input=e.target.closest<HTMLInputElement>('[data-quantity]');if(!input||busy)return;const p=cart.find(p=>p.id===Number(input.dataset.quantity));if (!p) return; const qty=Number(input.value);if(!Number.isInteger(qty)||qty<1||qty>1000000){toast('Cantidad entera de 1 a 1.000.000.');renderCart();return;}p.quantity=qty;saleRequest=null;renderCart();});
$('#checkout').addEventListener('click',async()=>{if(!cart.length||busy)return;busy=true;$('#sale-error').hidden=true;$('#sale-success').hidden=true;saleRequest??=uuid();saveCart();renderCart();$('#cart').querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button').forEach(el=>el.disabled=true);try{const sale=await api<Sale>('/sales',{method:'POST',body:JSON.stringify({requestId:saleRequest,items:cart.map(p=>({productId:p.id,quantity:p.quantity}))})});cart=[];saleRequest=null;saveCart();$('#sale-success').textContent=`Venta #${sale.id} confirmada por ${money(sale.total)}. Existencias actualizadas.`;$('#sale-success').hidden=false;salesPage=1;await refresh();}catch(e){showError($('#sale-error'),errorText(e));}finally{busy=false;renderCart();}});
$('#products-body').addEventListener('click',async e=>{if (!(e.target instanceof Element)) return; const button=e.target.closest<HTMLButtonElement>('[data-stock]');if(!button)return;try{currentStockId=Number(button.dataset.stock);stockRequest=null;$('#stock-form').reset();$('#stock-form .form-error').hidden=true;await stockDetails();$('#stock-dialog').showModal();}catch(e){toast(errorText(e));}});
async function stockDetails(){const [p,m]=await Promise.all([api<Product>('/products/'+currentStockId),api<Movement[]>('/products/'+currentStockId+'/movements')]);$('#stock-title').textContent=p.name+' · '+p.sku;$('#stock-current').textContent=`Existencias actuales: ${number(p.stock)} · Mínimo: ${number(p.minimumStock)}`;$('#movements').innerHTML=m.map(m=>`<div class="item-row"><div><strong>${esc(m.reason)}</strong><small>${date(m.createdAt)}${m.saleId?' · Venta #'+m.saleId:''}</small></div><span class="badge ${m.delta>0?'good':'warn'}">${m.delta>0?'+':''}${number(m.delta)}</span></div>`).join('')||'<p class="empty">Sin movimientos.</p>';}
$('#stock-close').addEventListener('click',()=>$('#stock-dialog').close());
$('#stock-form').addEventListener('input',()=>stockRequest=null);
$('#stock-form').addEventListener('submit',e=>{e.preventDefault();const form=$('#stock-form');submitForm(form,async()=>{const values=Object.fromEntries(new FormData(form));stockRequest??=uuid();await api('/products/'+currentStockId+'/stock',{method:'POST',body:JSON.stringify({requestId:stockRequest,delta:Number(values.delta),reason:values.reason})});stockRequest=null;form.reset();toast('Ajuste registrado.');await stockDetails();await refresh();});});
$('#sales-body').addEventListener('click',async e=>{if (!(e.target instanceof Element)) return; const button=e.target.closest<HTMLButtonElement>('[data-sale]');if(!button)return;try{const s=await api<Sale>('/sales/'+button.dataset.sale);$('#sale-detail').innerHTML=`<h3>Venta #${s.id} · ${money(s.total)}</h3>`+s.items.map(p=>`<div class="item-row"><div><strong>${esc(p.name)}</strong><small>${esc(p.sku)} · ${p.quantity} × ${money(p.unitPrice)}</small></div><strong>${money(p.quantity*Number(p.unitPrice))}</strong></div>`).join('');$('#sale-detail').hidden=false;}catch(e){toast(errorText(e));}});
$('#recursion').addEventListener('click',async()=>{const button=$('#recursion');button.disabled=true;try{const r=await api<{products:number;value:Money;timeComplexity:string;stackComplexity:string}>('/academic/recursion');$('#recursion-result').textContent=`${r.products} productos · Valor: ${money(r.value)} · Tiempo ${r.timeComplexity} · Pila ${r.stackComplexity}`;}catch(e){$('#recursion-result').textContent=errorText(e);}finally{button.disabled=false;}});
renderCart();refresh();
