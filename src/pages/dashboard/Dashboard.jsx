import { useContext, useState } from "react";
import { OrderContext } from "../../context/OrderContext";
import { ProductContext } from "../../context/ProductContext";
import { AuthContext } from "../../context/AuthContext";
import { EmptyBottleContext } from "../../context/EmptyBottleContext";
import { ClientContext } from "../../context/ClientContext";
import { useToast } from "../../context/ToastContext";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./Dashboard.css";

export default function Dashboard() {
  const { orders, getAllExpensesGrouped } = useContext(OrderContext);
  const { products } = useContext(ProductContext);
  const { user, users } = useContext(AuthContext);
  const { getAllDebts } = useContext(EmptyBottleContext);
  const { getInactiveClients } = useContext(ClientContext);
  const { addToast } = useToast();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hour, setHour] = useState("");

  // Filtrado base
  let filtered = [...orders];

  if (startDate && endDate) {
    filtered = filtered.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        if (isNaN(orderDate.getTime())) return false;
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return orderDate >= start && orderDate <= end;
      } catch (error) { return false; }
    });
  } else if (startDate) {
    filtered = filtered.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        if (isNaN(orderDate.getTime())) return false;
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        return orderDate >= start;
      } catch (error) { return false; }
    });
  } else if (endDate) {
    filtered = filtered.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        if (isNaN(orderDate.getTime())) return false;
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return orderDate <= end;
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
  const cancelled = filtered.filter((o) => o.status === "cancelado");
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
  filtered.forEach((o) => {
    const c = getOrderColor(o);
    if (c === "success") verdes++;
    if (c === "warning") amarillos++;
    if (c === "danger") rojos++;
  });
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
  finishedOrders.forEach((o) => {
    const color = getHistoricalColor(o);
    if (color === "success") histVerdes++;
    if (color === "warning") histAmarillos++;
    if (color === "danger") histRojos++;
  });
  const totalHistorico = finishedOrders.length || 1;
  const pctHist = (n) => Math.round((n / totalHistorico) * 100);

  // Rankings y otros
  const salesBySeller = {};
  delivered.forEach((o) => {
    if (!salesBySeller[o.sellerName]) salesBySeller[o.sellerName] = 0;
    salesBySeller[o.sellerName] += o.total || 0;
  });
  const ranking = Object.entries(salesBySeller).map(([seller, total]) => ({ seller, total })).sort((a, b) => b.total - a.total);
  const bottleDebts = getAllDebts(users, orders);
  const inactiveClients = getInactiveClients();
  const groupedExpenses = getAllExpensesGrouped();
  const expenseCategories = { gasolina: "Gasolina", reparacion: "Reparación", alimentacion: "Alimentación", peajes: "Peajes", otros: "Otros" };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setHour("");
    addToast("Filtros limpiados", "success");
  };

  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>

      <div className="dash-section">
        <h3>Filtros</h3>
        <div className="dash-filters">
          <div className="filter-group">
            <label>Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="dash-input"
            />
          </div>
          <div className="filter-group">
            <label>Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="dash-input"
            />
          </div>
          <div className="filter-group">
            <label>Hora pico</label>
            <select value={hour} onChange={(e) => setHour(e.target.value)} className="dash-input">
              <option value="">Todas</option>
              {[...Array(24)].map((_, i) => {
                const h = i.toString().padStart(2, "0");
                return <option key={h} value={h}>{h}:00</option>;
              })}
            </select>
          </div>
          <button onClick={clearFilters} className="dash-btn-clear">Limpiar filtros</button>
        </div>
        {(startDate || endDate) && (
          <div style={{ marginTop: "12px", fontSize: "13px", color: "#64748b" }}>
            Rango: {startDate ? new Date(startDate).toLocaleDateString() : "Desde siempre"}
            {" → "}
            {endDate ? new Date(endDate).toLocaleDateString() : "Hoy"}
          </div>
        )}
      </div>

      <div className="dash-section accent-success">
        <h3><Icons.Money size={18} /> Ventas y tiempos</h3>
        <div className="dash-grid">
          <MetricCard
            title="Ventas"
            value={`$${totalSales.toLocaleString()}`}
            accent="primary"
            icon={<Icons.Money size={20} />}
          />
          <MetricCard
            title="Pedidos"
            value={totalOrders}
            accent="primary"
            icon={<Icons.Package size={20} />}
          />
          <MetricCard
            title="Prep Promedio"
            value={avgPreparacion}
            icon={<Icons.Clock size={20} />}
          />
          <MetricCard
            title="Reparto Promedio"
            value={avgReparto}
            icon={<Icons.Clock size={20} />}
          />
          <MetricCard
            title="Total Promedio"
            value={avgTotal}
            icon={<Icons.Clock size={20} />}
          />
        </div>
      </div>

      <div className="dash-section accent-warning">
        <h3><Icons.Clock size={18} /> Estado actual de pedidos (En curso)</h3>
        <div className="dash-grid">
          <MetricCard
            title="En tiempo"
            value={`${verdes} (${pct(verdes)}%)`}
            accent="success"
            icon={<Icons.Check size={20} />}
          />
          <MetricCard
            title="En riesgo"
            value={`${amarillos} (${pct(amarillos)}%)`}
            accent="warning"
            icon={<Icons.Warning size={20} />}
          />
          <MetricCard
            title="Críticos"
            value={`${rojos} (${pct(rojos)}%)`}
            accent="danger"
            icon={<Icons.Error size={20} />}
          />
        </div>
      </div>

      <div className="dash-section accent-purple">
        <h3><Icons.Check size={18} /> Historial de Eficiencia (Finalizados)</h3>
        <p style={{ fontSize: "13px", color: "#64748b", marginTop: "-10px", marginBottom: "15px" }}>
          Evalúa si los pedidos entregados cumplieron los tiempos límite durante su proceso.
        </p>
        {finishedOrders.length === 0 ? (
          <EmptyState icon={<Icons.Info size={32} />} title="Sin datos" description="No hay pedidos finalizados para evaluar en este período." />
        ) : (
          <div className="dash-grid">
            <MetricCard
              title="A tiempo"
              value={`${histVerdes} (${pctHist(histVerdes)}%)`}
              accent="success"
              icon={<Icons.Check size={20} />}
            />
            <MetricCard
              title="En riesgo"
              value={`${histAmarillos} (${pctHist(histAmarillos)}%)`}
              accent="warning"
              icon={<Icons.Warning size={20} />}
            />
            <MetricCard
              title="Críticos"
              value={`${histRojos} (${pctHist(histRojos)}%)`}
              accent="danger"
              icon={<Icons.Error size={20} />}
            />
          </div>
        )}
      </div>

      <div className="dash-section accent-purple">
        <h3><Icons.Users size={18} /> Ranking de vendedores</h3>
        {ranking.length === 0 && <EmptyState icon={<Icons.Users size={32} />} title="Sin ventas" description="No hay ventas en este filtro." />}
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
          <h3><Icons.Money size={18} /> Gastos por vendedor</h3>
          <div className="dash-expenses-grid">
            {Object.entries(groupedExpenses).map(([sellerId, data]) => (
              <div key={sellerId} className="dash-expense-card">
                <h4>{data.sellerName}</h4>
                <div className="dash-expense-total">Total: ${data.total.toLocaleString()}</div>
                <div className="dash-expense-detail">
                  {Object.entries(data.expenses.reduce((acc, e) => {
                    acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
                    return acc;
                  }, {})).map(([cat, total]) => (
                    <div key={cat} className="dash-expense-cat">
                      <span>{expenseCategories[cat] || cat}</span>
                      <strong>${total.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
                <details>
                  <summary className="dash-expense-details-summary">Ver gastos recientes</summary>
                  {data.expenses.slice(0, 5).map(exp => (
                    <div key={exp.id} className="dash-expense-item">
                      <span>{exp.concept}</span>
                      <span>-${exp.amount?.toLocaleString()}</span>
                    </div>
                  ))}
                  {data.expenses.length > 5 && (
                    <div className="dash-expense-more">+ {data.expenses.length - 5} más</div>
                  )}
                </details>
              </div>
            ))}
          </div>
        </div>
      )}

      {(user?.role === "admin" || user?.role === "planta") && inactiveClients.length > 0 && (
        <div className="dash-section accent-danger">
          <h3><Icons.User size={18} /> Clientes inactivos</h3>
          <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "15px" }}>
            Estos clientes han superado el tiempo límite sin realizar pedidos.
          </p>
          {inactiveClients.map(client => {
            const lastOrder = orders.filter(o => o.clientId === client.id || o.clientData?.id === client.id)
              .sort((a, b) => {
                let dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                let dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return dB - dA;
              })[0];
            return (
              <div key={client.id} className="dash-inactive-card">
                <div className="dash-inactive-info">
                  <strong>{client.name}</strong>
                  <div className="dash-inactive-sub">
                    📞 {client.phone} {lastOrder?.sellerName && `• Último: ${lastOrder.sellerName}`}
                  </div>
                  <div className="dash-inactive-sub">
                    Último pedido: {client.lastOrderDate?.toDate?.().toLocaleDateString() || (client.lastOrderDate ? new Date(client.lastOrderDate).toLocaleDateString() : "Nunca")}
                  </div>
                </div>
                <div className="dash-inactive-days">
                  <span className="dash-days-count">{client.daysInactive} días</span>
                  <span className="dash-days-label">Alerta cada {client.expectedDays}d</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(user?.role === "admin" || user?.role === "planta") && (
        <div className="dash-section accent-cyan">
          <h3><Icons.Package size={18} /> Stock actual de productos</h3>
          {products.length === 0 ? (
            <EmptyState icon={<Icons.Package size={32} />} title="Sin stock" description="No hay productos registrados." />
          ) : (
            <div className="dash-grid-small">
              {products.map((product) => {
                const stock = product.stock || 0;
                const colorClass = stock <= 10 ? "text-danger" : stock <= 20 ? "text-warning" : "text-success";
                return (
                  <div key={product.id} className="dash-stock-card">
                    <h4>{product.name}</h4>
                    <p className={`dash-qty ${colorClass}`}>{stock} uds</p>
                    <p className="dash-price">${(product.price || 0).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {(user?.role === "admin" || user?.role === "planta") && (
        <div className="dash-section accent-cyan">
          <h3><Icons.Package size={18} /> Deudas de botellones vacíos</h3>
          {bottleDebts.length === 0 ? (
            <EmptyState icon={<Icons.Info size={32} />} title="Sin deudas" description="No hay deudas de botellones." />
          ) : (
            <div className="dash-grid-small">
              {bottleDebts.map((debt) => (
                <div key={debt.sellerId} className="dash-debt-card">
                  <h4>{debt.sellerName}</h4>
                  <p style={{ fontSize: "13px", color: "#475569" }}>Vendidos: <strong>{debt.totalSold}</strong></p>
                  <p style={{ fontSize: "13px", color: "#475569" }}>Reportados: <strong>{debt.totalReported}</strong></p>
                  <p className={`dash-debt-status ${debt.debt > 0 ? "text-danger" : "text-success"}`}>
                    {debt.debt > 0 ? `Debe: ${debt.debt}` : "Sin deuda"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, accent, icon }) {
  return (
    <div className={`dash-card ${accent ? `border-${accent}` : ""}`}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        {icon && <span style={{ color: accent === "success" ? "#16a34a" : accent === "warning" ? "#f59e0b" : accent === "danger" ? "#ef4444" : "#2563eb" }}>{icon}</span>}
        <h4 className="dash-card-title">{title}</h4>
      </div>
      <h2 className="dash-card-value">{value}</h2>
    </div>
  );
}