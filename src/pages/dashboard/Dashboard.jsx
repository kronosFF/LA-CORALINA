import { useContext, useState, useEffect } from "react";
import { OrderContext } from "../../context/OrderContext";
import { ProductContext } from "../../context/ProductContext";
import { AuthContext } from "../../context/AuthContext";
import { EmptyBottleContext } from "../../context/EmptyBottleContext";
import { ClientContext } from "../../context/ClientContext";
import { useToast } from "../../context/ToastContext";
import EmptyState from "../../components/EmptyState/EmptyState";
import LiveMap from "../../components/LiveMap/LiveMap";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";
import "./Dashboard.css";

export default function Dashboard() {
  const { orders, getAllExpensesGrouped } = useContext(OrderContext);
  const { products } = useContext(ProductContext);
  const { user, users } = useContext(AuthContext);
  const { getAllDebts } = useContext(EmptyBottleContext);
  const { getInactiveClients } = useContext(ClientContext);
  const { addToast } = useToast();

  const [date, setDate] = useState("");
  const [hour, setHour] = useState("");
  const [sellersLiveLocation, setSellersLiveLocation] = useState([]);

  // ==========================================
  // LECTOR DE UBICACIÓN EN TIEMPO REAL (MAPA)
  // ==========================================
  useEffect(() => {
    if (user?.role !== "admin" && user?.role !== "planta") return;

    const unsubscribe = onSnapshot(collection(db, "userLocations"), (snapshot) => {
      const locations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSellersLiveLocation(locations);
    });

    return () => unsubscribe();
  }, [user?.role]);

  // Filtrado base
  let filtered = [...orders];

  if (date) {
    filtered = filtered.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        if (isNaN(orderDate.getTime())) return false;
        return orderDate.toISOString().slice(0, 10) === date;
      } catch (error) { return false; }
    });
  }

  if (hour) {
    filtered = filtered.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        if (isNaN(orderDate.getTime())) return false;
        return orderDate.getHours().toString().padStart(2, "0") === hour;
      } catch (error) { return false; }
    });
  }

  const delivered = filtered.filter((o) => o.status === "entregado");
  const totalSales = delivered.reduce((acc, o) => acc + (o.total || 0), 0);
  const totalOrders = filtered.length;

  const calculateAverageTime = (getTimeFunction) => {
    const times = delivered.map(getTimeFunction).filter(t => t && t > 0);
    if (times.length === 0) return "0m 00s";
    const avgSeconds = times.reduce((acc, t) => acc + t, 0) / times.length / 1000;
    return `${Math.floor(avgSeconds / 60)}m ${Math.floor(avgSeconds % 60).toString().padStart(2, "0")}s`;
  };

  const getTimeDiff = (order, startKey, endKey) => {
    if (!order.timestamps || !order.timestamps[startKey] || !order.timestamps[endKey]) return null;
    const start = order.timestamps[startKey].toDate ? order.timestamps[startKey].toDate() : new Date(order.timestamps[startKey]);
    const end = order.timestamps[endKey].toDate ? order.timestamps[endKey].toDate() : new Date(order.timestamps[endKey]);
    return (isNaN(start) || isNaN(end)) ? null : end - start;
  };

  const avgPreparacion = calculateAverageTime((o) => getTimeDiff(o, "preparacion", "reparto"));
  const avgReparto = calculateAverageTime((o) => getTimeDiff(o, "reparto", "entregado"));
  const avgTotal = calculateAverageTime((o) => getTimeDiff(o, "preparacion", "entregado"));

  // SEMÁFORO EN TIEMPO REAL
  const now = new Date();
  const getOrderColor = (order) => {
    if (order.status === "entregado" || order.status === "cancelado") return "success";
    let seconds = 0, limit = 0;
    if (order.status === "preparacion" && order.timestamps?.preparacion) {
      const start = order.timestamps.preparacion.toDate ? order.timestamps.preparacion.toDate() : new Date(order.timestamps.preparacion);
      seconds = (now - start) / 1000; limit = (order.clientData?.prepMinutes || 15) * 60;
    } else if (order.status === "reparto" && order.timestamps?.reparto) {
      const start = order.timestamps.reparto.toDate ? order.timestamps.reparto.toDate() : new Date(order.timestamps.reparto);
      seconds = (now - start) / 1000; limit = (order.clientData?.deliveryMinutes || 30) * 60;
    } else return "success";
    if (seconds < limit * 0.8) return "success";
    if (seconds < limit) return "warning";
    return "danger";
  };

  let verdes = 0, amarillos = 0, rojos = 0;
  filtered.forEach((o) => { const c = getOrderColor(o); if (c === "success") verdes++; if (c === "warning") amarillos++; if (c === "danger") rojos++; });
  const totalSemaforo = filtered.length || 1;
  const pct = (n) => Math.round((n / totalSemaforo) * 100);

  // SEMÁFORO HISTÓRICO
  const getHistoricalColor = (order) => {
    if (order.status !== "entregado" && order.status !== "cancelado") return null;
    let worstState = "success";
    const evaluatePhase = (startKey, endKey, limitMinutes) => {
      if (!order.timestamps || !order.timestamps[startKey] || !order.timestamps[endKey]) return;
      const start = order.timestamps[startKey].toDate ? order.timestamps[startKey].toDate() : new Date(order.timestamps[startKey]);
      const end = order.timestamps[endKey].toDate ? order.timestamps[endKey].toDate() : new Date(order.timestamps[endKey]);
      if (!isNaN(start) && !isNaN(end)) {
        const timeTakenSeconds = (end - start) / 1000;
        const limitSeconds = (limitMinutes || 15) * 60;
        if (timeTakenSeconds >= limitSeconds) worstState = "danger";
        else if (timeTakenSeconds >= limitSeconds * 0.8 && worstState !== "danger") worstState = "warning";
      }
    };
    evaluatePhase("preparacion", "reparto", order.clientData?.prepMinutes || 15);
    evaluatePhase("reparto", "entregado", order.clientData?.deliveryMinutes || 30);
    return worstState;
  };

  let histVerdes = 0, histAmarillos = 0, histRojos = 0;
  const finishedOrders = filtered.filter(o => o.status === "entregado" || o.status === "cancelado");
  finishedOrders.forEach((o) => { const color = getHistoricalColor(o); if (color === "success") histVerdes++; if (color === "warning") histAmarillos++; if (color === "danger") histRojos++; });
  const totalHistorico = finishedOrders.length || 1;
  const pctHist = (n) => Math.round((n / totalHistorico) * 100);

  // Rankings y otros
  const salesBySeller = {};
  delivered.forEach((o) => { if (!salesBySeller[o.sellerName]) salesBySeller[o.sellerName] = 0; salesBySeller[o.sellerName] += o.total || 0; });
  const ranking = Object.entries(salesBySeller).map(([seller, total]) => ({ seller, total })).sort((a, b) => b.total - a.total);
  const bottleDebts = getAllDebts(users, orders);
  const inactiveClients = getInactiveClients();
  const groupedExpenses = getAllExpensesGrouped();
  const expenseCategories = { gasolina: "⛽ Gasolina", reparacion: "🔧 Reparación", alimentacion: "🍔 Alimentación", peajes: "🛣️ Peajes", otros: "📌 Otros" };

  const clearFilters = () => { setDate(""); setHour(""); addToast("Filtros limpiados", "success"); };

  return (
    <div className="dashboard-page">
      <h1>📊 Dashboard</h1>

      <div className="dash-section">
        <h3>🔍 Filtros</h3>
        <div className="dash-filters">
          <div className="filter-group"><label>Fecha</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="dash-input" /></div>
          <div className="filter-group"><label>Hora</label><select value={hour} onChange={(e) => setHour(e.target.value)} className="dash-input"><option value="">Todas</option>{[...Array(24)].map((_, i) => { const h = i.toString().padStart(2, "0"); return <option key={h} value={h}>{h}:00</option>; })}</select></div>
          <button onClick={clearFilters} className="dash-btn-clear">Limpiar filtros</button>
        </div>
      </div>

      {/* MAPA EN VIVO - SOLO ADMIN */}
      {(user?.role === "admin" || user?.role === "planta") && (
        <div className="dash-section accent-success">
          <h3>📍 Vendedores en Vivo</h3>
          <p style={{fontSize: "13px", color: "#64748b", marginBottom: "15px"}}>
            Ubicación en tiempo real de los vendedores activos en sus dispositivos móviles.
          </p>
          {sellersLiveLocation.length === 0 ? (
            <EmptyState icon="📍" title="Sin vendedores activos" description="Ningún vendedor tiene su aplicación abierta o no han otorgado permisos de ubicación." />
          ) : (
            <LiveMap sellersLocation={sellersLiveLocation} />
          )}
        </div>
      )}

      <div className="dash-section accent-success">
        <h3>💰 Ventas y tiempos</h3>
        <div className="dash-grid">
          <MetricCard title="Ventas (entregados)" value={`$${totalSales.toLocaleString()}`} accent="primary" />
          <MetricCard title="Pedidos (total)" value={totalOrders} accent="primary" />
          <MetricCard title="Prep Promedio" value={avgPreparacion} />
          <MetricCard title="Reparto Promedio" value={avgReparto} />
          <MetricCard title="Total Promedio" value={avgTotal} />
        </div>
      </div>

      <div className="dash-section accent-warning">
        <h3>🚦 Estado actual de pedidos (En curso)</h3>
        <div className="dash-grid">
          <MetricCard title="🟢 En tiempo" value={`${verdes} (${pct(verdes)}%)`} accent="success" />
          <MetricCard title="🟡 En riesgo" value={`${amarillos} (${pct(amarillos)}%)`} accent="warning" />
          <MetricCard title="🔴 Críticos" value={`${rojos} (${pct(rojos)}%)`} accent="danger" />
        </div>
      </div>

      <div className="dash-section accent-purple">
        <h3>📊 Historial de Eficiencia (Finalizados)</h3>
        <p style={{fontSize: "13px", color: "#64748b", marginTop: "-10px", marginBottom: "15px"}}>Evalúa si los pedidos entregados cumplieron los tiempos límite durante su proceso.</p>
        {finishedOrders.length === 0 ? (
          <EmptyState icon="📊" title="Sin datos" description="No hay pedidos finalizados para evaluar en este período." />
        ) : (
          <div className="dash-grid">
            <MetricCard title="🟢 A tiempo" value={`${histVerdes} (${pctHist(histVerdes)}%)`} accent="success" />
            <MetricCard title="🟡 En riesgo" value={`${histAmarillos} (${pctHist(histAmarillos)}%)`} accent="warning" />
            <MetricCard title="🔴 Críticos" value={`${histRojos} (${pctHist(histRojos)}%)`} accent="danger" />
          </div>
        )}
      </div>

      <div className="dash-section accent-purple">
        <h3>🥇 Ranking de vendedores</h3>
        {ranking.length === 0 && <EmptyState icon="🥇" title="Sin ventas" description="No hay ventas en este filtro." />}
        {ranking.map((item, index) => (
          <div key={item.seller} className="dash-ranking-item">
            <span className="dash-medal">{index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}</span>
            <span className="dash-seller-name">{item.seller}</span>
            <span className="dash-seller-amount">${item.total.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {(user?.role === "admin" || user?.role === "planta") && Object.keys(groupedExpenses).length > 0 && (
        <div className="dash-section accent-danger">
          <h3>💰 Gastos por vendedor</h3>
          <div className="dash-expenses-grid">
            {Object.entries(groupedExpenses).map(([sellerId, data]) => (
              <div key={sellerId} className="dash-expense-card">
                <h4>{data.sellerName}</h4>
                <div className="dash-expense-total">Total: ${data.total.toLocaleString()}</div>
                <div className="dash-expense-detail">
                  {Object.entries(data.expenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + (e.amount || 0); return acc; }, {})).map(([cat, total]) => (
                    <div key={cat} className="dash-expense-cat"><span>{expenseCategories[cat] || cat}</span><strong>${total.toLocaleString()}</strong></div>
                  ))}
                </div>
                <details>
                  <summary className="dash-expense-details-summary">Ver gastos recientes</summary>
                  {data.expenses.slice(0, 5).map(exp => (<div key={exp.id} className="dash-expense-item"><span>{exp.concept}</span><span>-${exp.amount?.toLocaleString()}</span></div>))}
                  {data.expenses.length > 5 && (<div className="dash-expense-more">+ {data.expenses.length - 5} más</div>)}
                </details>
              </div>
            ))}
          </div>
        </div>
      )}

      {(user?.role === "admin" || user?.role === "planta") && inactiveClients.length > 0 && (
        <div className="dash-section accent-danger">
          <h3>⚠️ Clientes inactivos</h3>
          <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "15px" }}>Estos clientes han superado el tiempo límite sin realizar pedidos.</p>
          {inactiveClients.map(client => {
            const lastOrder = orders.filter(o => o.clientId === client.id || o.clientData?.id === client.id).sort((a, b) => { let dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt); let dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt); return dB - dA; })[0];
            return (
              <div key={client.id} className="dash-inactive-card">
                <div className="dash-inactive-info"><strong>{client.name}</strong><div className="dash-inactive-sub">📞 {client.phone} {lastOrder?.sellerName && `• Último: ${lastOrder.sellerName}`}</div><div className="dash-inactive-sub">📅 Último pedido: {client.lastOrderDate?.toDate?.().toLocaleDateString() || (client.lastOrderDate ? new Date(client.lastOrderDate).toLocaleDateString() : "Nunca")}</div></div>
                <div className="dash-inactive-days"><span className="dash-days-count">{client.daysInactive} días</span><span className="dash-days-label">Alerta cada {client.expectedDays}d</span></div>
              </div>
            );
          })}
        </div>
      )}

      {(user?.role === "admin" || user?.role === "planta") && (
        <div className="dash-section accent-cyan">
          <h3>📦 Stock actual de productos</h3>
          {products.length === 0 ? (
            <EmptyState icon="📦" title="Sin stock" description="No hay productos registrados." />
          ) : (
            <div className="dash-grid-small">
              {products.map((product) => {
                const stock = product.stock || 0;
                const colorClass = stock <= 10 ? "text-danger" : stock <= 20 ? "text-warning" : "text-success";
                return (<div key={product.id} className="dash-stock-card"><h4>{product.name}</h4><p className={`dash-qty ${colorClass}`}>{stock} uds</p><p className="dash-price">💰 ${(product.price || 0).toLocaleString()}</p></div>);
              })}
            </div>
          )}
        </div>
      )}

      {(user?.role === "admin" || user?.role === "planta") && (
        <div className="dash-section accent-cyan">
          <h3>🫙 Deudas de botellones vacíos</h3>
          {bottleDebts.length === 0 ? (
            <EmptyState icon="🫙" title="Sin deudas" description="No hay deudas de botellones." />
          ) : (
            <div className="dash-grid-small">
              {bottleDebts.map((debt) => (
                <div key={debt.sellerId} className="dash-debt-card">
                  <h4>{debt.sellerName}</h4>
                  <p style={{ fontSize: "13px", color: "#475569" }}>🛒 Vendidos: <strong>{debt.totalSold}</strong></p>
                  <p style={{ fontSize: "13px", color: "#475569" }}>📦 Reportados: <strong>{debt.totalReported}</strong></p>
                  <p className={`dash-debt-status ${debt.debt > 0 ? "text-danger" : "text-success"}`}>{debt.debt > 0 ? `⚠️ Debe: ${debt.debt}` : "✅ Sin deuda"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, accent }) {
  return (
    <div className={`dash-card ${accent ? `border-${accent}` : ""}`}>
      <h4 className="dash-card-title">{title}</h4>
      <h2 className="dash-card-value">{value}</h2>
    </div>
  );
}