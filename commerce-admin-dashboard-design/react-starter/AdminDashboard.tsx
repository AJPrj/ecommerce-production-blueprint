import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, ArrowUpRight, BarChart3, Boxes,
  ChevronRight, CreditCard, Download, LayoutDashboard, Menu, Package,
  Plus, ReceiptText, RefreshCw, RotateCcw, Search, Settings, ShieldCheck,
  ShoppingBag, Sparkles, Tag, Truck, Users, Wallet, X,
} from 'lucide-react';
import { Badge, Button } from 'react-bootstrap';
import type { LucideIcon } from 'lucide-react';
import './AdminDashboard.scss';

export type DashboardPeriod = '7d' | '30d' | '90d';
export type AttentionTone = 'amber' | 'red' | 'blue' | 'green';

export interface DashboardMetric {
  /** A server-supplied, formatted value. Never recompute authoritative money totals in React. */
  value: string;
  note: string;
  positive?: boolean;
}
export interface SalesPoint { label: string; grossMerchandiseValue: number; capturedOnline: number }
export interface AttentionItem {
  id: string; title: string; description: string; count: number;
  tone: AttentionTone; targetPath: string;
}
export interface RecentOrder {
  id: string; customerDisplay: string; amountFormatted: string;
  paymentState: string; orderState: string;
}
export interface InventoryWatchItem {
  sku: string; name: string; availableQuantity: number;
}
export interface AdminDashboardSnapshot {
  /** Response should already be capability-filtered by Spring Security. */
  asOf: string;
  currency: string;
  orderCount: DashboardMetric;
  grossMerchandiseValue: DashboardMetric;
  capturedOnlinePayments: DashboardMetric;
  awaitingFulfillment: DashboardMetric;
  averageOrderValue: string;
  ordersPerDay: string;
  series: SalesPoint[];
  attentionItems: AttentionItem[];
  recentOrders: RecentOrder[];
  inventoryWatchlist: InventoryWatchItem[];
}

export interface AdminDashboardProps {
  /** Connect to an authorized, bounded backend read API. If omitted, explicit demo mode is used. */
  loadDashboard?: (period: DashboardPeriod) => Promise<AdminDashboardSnapshot>;
  /** Supply from authenticated staff claims; it is NOT a substitute for backend RBAC. */
  allowedRoutes?: readonly string[];
  staffName?: string;
  /** Integrate with React Router's navigate function; otherwise use regular page navigation. */
  onNavigate?: (path: string) => void;
}

type NavigationItem = { label: string; path: string; icon: LucideIcon; count?: number };
const navigation: { group: string; items: NavigationItem[] }[] = [
  { group: 'WORKSPACE', items: [
    { label: 'Overview', path: '/admin', icon: LayoutDashboard },
    { label: 'Orders', path: '/admin/orders', icon: ShoppingBag },
    { label: 'Fulfillment', path: '/admin/fulfillment', icon: Truck },
    { label: 'Returns', path: '/admin/returns', icon: RotateCcw },
  ] },
  { group: 'MANAGEMENT', items: [
    { label: 'Products', path: '/admin/products', icon: Package },
    { label: 'Inventory', path: '/admin/inventory', icon: Boxes },
    { label: 'Customers', path: '/admin/customers', icon: Users },
    { label: 'Promotions', path: '/admin/promotions', icon: Tag },
  ] },
  { group: 'FINANCE & SYSTEM', items: [
    { label: 'Payments', path: '/admin/payments', icon: CreditCard },
    { label: 'GST & Tax', path: '/admin/tax', icon: ReceiptText },
    { label: 'Reports', path: '/admin/reports', icon: BarChart3 },
    { label: 'Staff & Roles', path: '/admin/staff', icon: ShieldCheck },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
  ] },
];

const demoOrders: RecentOrder[] = [
  { id: 'ORD-2094', customerDisplay: 'Riya Menon', amountFormatted: '₹3,499', paymentState: 'CAPTURED', orderState: 'PROCESSING' },
  { id: 'ORD-2093', customerDisplay: 'Arjun Nair', amountFormatted: '₹1,299', paymentState: 'COD', orderState: 'PLACED' },
  { id: 'ORD-2092', customerDisplay: 'Nisha Pillai', amountFormatted: '₹5,799', paymentState: 'CAPTURED', orderState: 'SHIPPED' },
  { id: 'ORD-2091', customerDisplay: 'Rahul Das', amountFormatted: '₹2,199', paymentState: 'REVIEW', orderState: 'ON_HOLD' },
  { id: 'ORD-2090', customerDisplay: 'Anu Thomas', amountFormatted: '₹899', paymentState: 'CAPTURED', orderState: 'DELIVERED' },
];
const demoAttention: AttentionItem[] = [
  { id: 'payments', title: 'Payment exceptions', description: 'Webhook & reconciliation review', count: 6, tone: 'amber', targetPath: '/admin/payments' },
  { id: 'shipments', title: 'Shipment exceptions', description: 'Carrier status and recovery', count: 3, tone: 'red', targetPath: '/admin/fulfillment' },
  { id: 'returns', title: 'Returns awaiting inspection', description: 'Received items in quarantine', count: 9, tone: 'blue', targetPath: '/admin/returns' },
  { id: 'inventory', title: 'Stock mismatches', description: 'Ledger reconciliation discrepancies', count: 2, tone: 'green', targetPath: '/admin/inventory' },
];
const demoStock: InventoryWatchItem[] = [
  { name: 'Cotton Crew T-Shirt · M', sku: 'TSH-CT-M', availableQuantity: 4 },
  { name: 'Canvas Everyday Tote', sku: 'BAG-CNV-01', availableQuantity: 6 },
  { name: 'Wireless Earbuds · Black', sku: 'AUD-WL-BK', availableQuantity: 3 },
];
const demoBase = {
  asOf: '2026-10-14T07:30:00+05:30', currency: 'INR',
  attentionItems: demoAttention, recentOrders: demoOrders, inventoryWatchlist: demoStock,
};
const demoSnapshots: Record<DashboardPeriod, AdminDashboardSnapshot> = {
  '7d': { ...demoBase,
    grossMerchandiseValue: { value: '₹8,45,200', note: '↑ 12.8% vs prior period', positive: true },
    capturedOnlinePayments: { value: '₹7,92,400', note: 'Verified online captures' },
    orderCount: { value: '426', note: '↑ 6.2% vs prior period', positive: true },
    awaitingFulfillment: { value: '32', note: 'Requires action' },
    averageOrderValue: '₹1,984', ordersPerDay: '61',
    series: [61,78,73,101,94,116,128].map((v,i)=>({
      label: ['08 Oct','09 Oct','10 Oct','11 Oct','12 Oct','13 Oct','14 Oct'][i],
      grossMerchandiseValue: v*1000, capturedOnline: [49,65,64,82,75,99,108][i]*1000,
    })),
  },
  '30d': { ...demoBase,
    grossMerchandiseValue: { value: '₹31,84,900', note: '↑ 11.0% vs prior period', positive: true },
    capturedOnlinePayments: { value: '₹29,91,200', note: 'Verified online captures' },
    orderCount: { value: '1,638', note: '↑ 8.1% vs prior period', positive: true },
    awaitingFulfillment: { value: '32', note: 'Current active queue' },
    averageOrderValue: '₹1,944', ordersPerDay: '55',
    series: [60,67,62,77,74,82,88,80,95,100].map((v,i)=>({
      label: ['15 Sep','18 Sep','21 Sep','24 Sep','27 Sep','30 Sep','03 Oct','06 Oct','10 Oct','14 Oct'][i],
      grossMerchandiseValue: v*1000, capturedOnline: [50,57,54,65,63,72,71,68,82,84][i]*1000,
    })),
  },
  '90d': { ...demoBase,
    grossMerchandiseValue: { value: '₹91,20,300', note: '↑ 14.3% vs prior period', positive: true },
    capturedOnlinePayments: { value: '₹85,51,000', note: 'Verified online captures' },
    orderCount: { value: '4,729', note: '↑ 10.2% vs prior period', positive: true },
    awaitingFulfillment: { value: '32', note: 'Current active queue' },
    averageOrderValue: '₹1,929', ordersPerDay: '53',
    series: [56,58,64,61,72,79,84,91,96,113,127,123].map((v,i)=>({
      label: ['Jul','','','Aug','','','Sep','','','','Oct',''][i],
      grossMerchandiseValue: v*1000, capturedOnline: [42,49,55,52,59,70,69,74,87,94,102,103][i]*1000,
    })),
  },
};

function SalesChart({ points }: { points: SalesPoint[] }) {
  const width = 670, height = 265, left = 48, right = 12, top = 19, bottom = 36;
  if (points.length < 2) return <div className="ca-empty">No trend data for this period.</div>;
  const maximum = Math.max(1, ...points.flatMap(p => [p.grossMerchandiseValue, p.capturedOnline]));
  const cap = Math.ceil(maximum / 40000) * 40000;
  const x = (i: number) => left + i * (width - left - right) / (points.length - 1);
  const y = (value: number) => top + (cap - value) / cap * (height - top - bottom);
  const line = (key: 'grossMerchandiseValue' | 'capturedOnline') =>
    points.map((p, i) => `${x(i)},${y(p[key])}`).join(' ');
  const fillPath = `M ${x(0)},${height-bottom} L ${points.map((p,i) => `${x(i)},${y(p.grossMerchandiseValue)}`).join(' L ')} L ${x(points.length-1)},${height-bottom} Z`;
  return <svg className="ca-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gross merchandise value and verified online payment captures for the selected period">
    <defs><linearGradient id="ca-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0cad88" stopOpacity=".19"/><stop offset="1" stopColor="#0cad88" stopOpacity="0"/></linearGradient></defs>
    {Array.from({length:5},(_,i)=>{const pos = top + i*(height-top-bottom)/4;return <g key={i}>
      <line x1={left} x2={width-right} y1={pos} y2={pos} stroke="#eaf0f1" strokeDasharray="4 5"/>
      <text x={left-9} y={pos+4} textAnchor="end">{Math.round(cap*(4-i)/1000)}k</text>
    </g>;})}
    <path d={fillPath} fill="url(#ca-fill)"/>
    <polyline points={line('capturedOnline')} fill="none" stroke="#aac2ce" strokeWidth="2.5" strokeDasharray="5 6"/>
    <polyline points={line('grossMerchandiseValue')} fill="none" stroke="#0da486" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round"/>
    {points.map((p,i)=><text key={i} x={x(i)} y={height-8} textAnchor="middle">{p.label}</text>)}
    <circle cx={x(points.length-1)} cy={y(points[points.length-1].grossMerchandiseValue)} r="5" fill="#0da486" stroke="#fff" strokeWidth="2.5"/>
  </svg>;
}

function StatusLabel({ state }: { state: string }) {
  const tone = state === 'CAPTURED' ? 'success' : state === 'REVIEW' ? 'warning' : state === 'COD' ? 'info' : 'neutral';
  return <span className={`ca-status ca-status--${tone}`}>{state.replaceAll('_',' ')}</span>;
}

export default function AdminDashboard({ loadDashboard, allowedRoutes, staffName='Administrator', onNavigate }: AdminDashboardProps) {
  const [period,setPeriod]=useState<DashboardPeriod>('7d');
  const [snapshot,setSnapshot]=useState<AdminDashboardSnapshot | null>(loadDashboard ? null : demoSnapshots['7d']);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [refreshKey,setRefreshKey]=useState(0);
  const [drawer,setDrawer]=useState(false);
  const [search,setSearch]=useState('');
  const demoMode=!loadDashboard;
  const visibleNavigation=useMemo(()=>navigation.map(group=>({
    ...group, items:group.items.filter(item=>allowedRoutes ? allowedRoutes.includes(item.path) : (demoMode || item.path === '/admin')),
  })).filter(group=>group.items.length>0),[allowedRoutes,demoMode]);
  const mayNavigate=(path:string)=>allowedRoutes ? allowedRoutes.includes(path) : (demoMode || path === '/admin');
  const navigate=(path:string)=>{if(!mayNavigate(path))return;setDrawer(false);if(onNavigate)onNavigate(path);else window.location.assign(path)};
  const orders=useMemo(()=>snapshot?.recentOrders.filter(o=>[o.id,o.customerDisplay,o.paymentState,o.orderState].some(s=>s.toLowerCase().includes(search.toLowerCase()))) ?? [],[snapshot,search]);
  useEffect(()=>{
    if(!loadDashboard){setSnapshot(demoSnapshots[period]);setError(null);return;}
    let active=true;
    setLoading(true);setError(null);setSnapshot(null);
    loadDashboard(period).then(data=>{if(active)setSnapshot(data)}).catch(()=>{if(active)setError('Unable to load the authorized dashboard data. Please try again.');}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false;};
  },[loadDashboard,period,refreshKey]);

  if (!snapshot) return <div className="commerce-admin"><div className="ca-boot-state" role={error ? 'alert' : 'status'}>
    {error ? <><AlertTriangle size={20}/><span>{error}</span><Button onClick={()=>setRefreshKey(v=>v+1)} size="sm">Retry</Button></> : <><RefreshCw size={20}/><span>Loading your authorized admin dashboard…</span></>}
  </div></div>;

  const openCount=snapshot.attentionItems.reduce((n,item)=>n+item.count,0);
  const metrics=[
    {label:'Gross merchandise value',icon:Wallet,data:snapshot.grossMerchandiseValue},
    {label:'Captured online payments',icon:CreditCard,data:snapshot.capturedOnlinePayments},
    {label:'Orders placed',icon:ShoppingBag,data:snapshot.orderCount},
    {label:'Awaiting fulfillment',icon:Truck,data:snapshot.awaitingFulfillment},
  ];
  const attentionIcons:Record<AttentionTone,LucideIcon>={amber:CreditCard,red:Truck,blue:RotateCcw,green:Boxes};

  return <div className="commerce-admin">
    <div className={`ca-backdrop${drawer?' is-visible':''}`} onClick={()=>setDrawer(false)} aria-hidden="true"/>
    <aside className={`ca-sidebar${drawer?' is-open':''}`} aria-label="Admin navigation">
      <div className="ca-brand"><span className="ca-brand-mark"><LayoutDashboard size={22}/></span><span><strong>Commerce<span className="ca-brand-period">.</span></strong><small>ADMIN CONSOLE</small></span><button className="ca-close" onClick={()=>setDrawer(false)} aria-label="Close menu"><X size={20}/></button></div>
      {visibleNavigation.map(group=><div key={group.group} className="ca-nav-group"><p className="ca-nav-label">{group.group}</p>{group.items.map(({path,label,icon:Icon})=><button key={path} className={`ca-nav-link${path==='/admin'?' is-active':''}`} onClick={()=>navigate(path)}><Icon size={17}/><span>{label}</span></button>)}</div>)}
      <div className="ca-sidebar-bottom"><div className="ca-env"><b><span className="ca-env-dot"/> {demoMode?'Demo workspace':'Protected admin workspace'}</b><small>{demoMode?'All values are illustrative sample data.':'Data is authorized by the server.'}</small></div><div className="ca-user"><span className="ca-avatar">AD</span><span><b>{staffName}</b><small>Staff account</small></span></div></div>
    </aside>
    <div className="ca-page">
      <header className="ca-topbar"><div className="ca-top-left"><button className="ca-icon-button ca-mobile-menu" aria-label="Open menu" onClick={()=>setDrawer(true)}><Menu size={18}/></button><span>Workspace</span><ChevronRight size={12}/><strong>Overview</strong></div><div className="ca-top-right"><label className="ca-search"><Search size={16}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search recent orders..." aria-label="Search recent orders"/></label><button className="ca-icon-button" onClick={()=>setRefreshKey(v=>v+1)} aria-label="Refresh dashboard" title={demoMode?'Reset demo data':'Refresh dashboard'}><RefreshCw size={17}/></button><span className="ca-avatar ca-avatar--small">AD</span></div></header>
      <main className="ca-main">
        <div className="ca-title-row"><div><div className="ca-overline">OPERATIONS / OVERVIEW</div><h1>Store overview <Sparkles size={21}/></h1><p>Keep every order, payment and shipment moving.</p></div><div className="ca-header-actions"><div className="ca-segment" role="group" aria-label="Report period">{(['7d','30d','90d'] as const).map(p=><button key={p} aria-pressed={period===p} className={period===p?'selected':''} onClick={()=>setPeriod(p)}>{p==='7d'?'7 days':p==='30d'?'30 days':'90 days'}</button>)}</div><Button variant="outline-secondary" className="ca-export" disabled title="Connect a secure backend export job before enabling"><Download size={15}/> Export</Button></div></div>
        {demoMode&&<div className="ca-banner"><span className="ca-banner-icon"><Sparkles size={18}/></span><div><b>Dashboard preview · {openCount} example work items</b><p>Operational metrics and names are fictional. Connect an authorized backend before production use.</p></div><span className="ca-demo-badge">DEMO</span></div>}
        {error&&<div className="ca-error" role="alert"><AlertTriangle size={19}/>{error}<Button onClick={()=>setRefreshKey(v=>v+1)} size="sm">Retry</Button></div>}
        {loading&&<div className="ca-loading" role="status">Refreshing authorized dashboard data…</div>}
        <div className="ca-metrics">{metrics.map(({label,icon:Icon,data},i)=><section key={label} className="ca-panel ca-metric"><div className="ca-metric-top"><span>{label}</span><span className={`ca-metric-icon color-${i}`}><Icon size={19}/></span></div><div className="ca-metric-value">{data.value}</div><div className={`ca-metric-note${data.positive?' is-positive':''}`}>{data.note}</div></section>)}</div>
        <div className="ca-content-grid"><section className="ca-panel ca-section"><div className="ca-section-head"><div><h2>Sales performance</h2><p>Gross merchandise value vs confirmed online captures · {snapshot.currency}</p></div>{mayNavigate('/admin/reports')&&<button className="ca-text-link" onClick={()=>navigate('/admin/reports')}>See reports <ArrowUpRight size={14}/></button>}</div><div className="ca-legend"><span><i/> Merchandise value</span><span><i className="blue"/> Online captures</span></div><SalesChart points={snapshot.series}/><div className="ca-chart-footer"><div><b>{snapshot.averageOrderValue}</b><span>Average order value</span></div><div><b>{snapshot.ordersPerDay}</b><span>Orders / day</span></div><div><b>{snapshot.currency}</b><span>Primary currency</span></div></div></section>
          <section className="ca-panel ca-section"><div className="ca-section-head"><div><h2>Needs your attention</h2><p>Operational tasks requiring review</p></div><Badge bg="warning" text="dark">{openCount} open</Badge></div><div className="ca-attention">{snapshot.attentionItems.map(item=>{const Icon=attentionIcons[item.tone];return <button key={item.id} className="ca-attention-row" disabled={!mayNavigate(item.targetPath)} onClick={()=>navigate(item.targetPath)}><span className={`ca-attention-icon tone-${item.tone}`}><Icon size={17}/></span><span className="ca-attention-label"><b>{item.title}</b><small>{item.description}</small></span><strong>{item.count}</strong><ChevronRight size={15}/></button>})}{snapshot.attentionItems.length===0&&<div className="ca-empty">No actionable items were returned for this role.</div>}</div></section>
        </div>
        <div className="ca-content-grid"><section className="ca-panel ca-section"><div className="ca-section-head"><div><h2>Recent orders</h2><p>Role-authorized purchases and payment states</p></div>{mayNavigate('/admin/orders')&&<button className="ca-text-link" onClick={()=>navigate('/admin/orders')}>View all orders <ArrowRight size={14}/></button>}</div><div className="ca-table-wrap"><table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>AMOUNT</th><th>PAYMENT</th><th>ORDER STATE</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td data-label="Order"><b>#{o.id}</b></td><td data-label="Customer">{o.customerDisplay}</td><td data-label="Amount"><strong>{o.amountFormatted}</strong></td><td data-label="Payment"><StatusLabel state={o.paymentState}/></td><td data-label="Order state">{o.orderState.replaceAll('_',' ')}</td></tr>)}{orders.length===0&&<tr><td colSpan={5} className="ca-empty">No authorized orders match this filter.</td></tr>}</tbody></table></div></section>
          <section className="ca-panel ca-section"><div className="ca-section-head"><div><h2>Inventory watchlist</h2><p>Available quantity after reservations</p></div>{mayNavigate('/admin/inventory')&&<button className="ca-text-link" onClick={()=>navigate('/admin/inventory')}>Manage stock <ArrowRight size={14}/></button>}</div><div className="ca-stock-list">{snapshot.inventoryWatchlist.map(item=><div key={item.sku} className="ca-stock-row"><span className="ca-stock-icon"><Package size={17}/></span><span><b>{item.name}</b><small>{item.sku} · Available</small></span><strong>{item.availableQuantity}<small>units left</small></strong></div>)}{snapshot.inventoryWatchlist.length===0&&<div className="ca-empty">No variants at the configured low-stock threshold.</div>}</div></section>
        </div>
        <div className="ca-shortcuts">{[
          {path:'/admin/products/new',icon:Plus,label:'New product'},
          {path:'/admin/fulfillment',icon:Truck,label:'Fulfillment queue'},
          {path:'/admin/tax',icon:ReceiptText,label:'Tax configuration'},
          {path:'/admin/reports',icon:BarChart3,label:'Finance reports'},
        ].filter(item=>mayNavigate(item.path)).map(({path,icon:Icon,label})=><button key={path} onClick={()=>navigate(path)}><Icon size={15}/>{label}</button>)}</div>
        {demoMode&&<div className="ca-readiness"><ShieldCheck size={18}/><div><strong>Production-readiness reminder</strong><p>Razorpay Test Mode verification, approved GST classifications, seller invoice details and a live carrier adapter remain release gates in the blueprint.</p></div></div>}
        <footer className="ca-footer"><span>Commerce Admin · Blueprint-aligned dashboard</span><span>{demoMode?'Illustrative data only':`Server snapshot: ${new Date(snapshot.asOf).toLocaleString()}`}</span></footer>
      </main>
    </div>
  </div>;
}
