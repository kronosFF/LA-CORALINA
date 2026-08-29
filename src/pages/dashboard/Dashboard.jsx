import { useContext, useState } from "react";
import { OrderContext } from "../../context/OrderContext";
import { ProductContext } from "../../context/ProductContext";
import { AuthContext } from "../../context/AuthContext";
import { EmptyBottleContext } from "../../context/EmptyBottleContext";
import { ClientContext } from "../../context/ClientContext";
import { useToast } from "../../context/ToastContext";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import { formatDuration } from "../../hooks/formatTime";
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
  const totalSales = delivered.reduce((acc, o) => acc + (o.total || 0), 0);
  const totalOrders = filtered.length;

  // Calcular tiempos en segundos
  const getTimeDiff = (order, startKey, endKey) => {
    if (!order.timestamps || !order.timestamps[startKey] || !order.timestamps[endKey]) return null;
    const start = order.timestamps[startKey].toDate ? order.timestamps[startKey].toDate() : new Date(order.timestamps[startKey]);
    const end = order.timestamps[endKey].toDate ? order.timestamps[endKey].toDate() : new Date(order.timestamps[endKey]);
    return (isNaN(start) || isNaN(end)) ? null : end - start;
  };

  const calculateAverageTimeSeconds = (getTimeFunction) => {
    const times = delivered.map(getTimeFunction).filter(t => t && t > 0);
    if (times.length === 0) return 0;
    const avgMs = times.reduce((acc, t) => acc + t, 0) / times.length;
    return Math.floor(avgMs / 1000);
  };

  const avgPrepSeconds = calculateAverageTimeSeconds((o) => getTimeDiff(o, "preparacion", "reparto"));
  const avgRepartoSecs = calculateAverageTimeSeconds((o) => getTimeDiff(o, "reparto", "entregado"));
  const avgTotalSecs = calculateAverageTimeSeconds((o) => getTimeDiff(o, "preparacion", "entregado"));

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

      {/* SECCIÓN FILTROS */}
      <div className="dash-section">
        <h3>Filtros</h3>
        <div className="dash-filters">
          <div className="filter-group">
            <label>Desde</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="dash-input" />
          </div>
          <div className="filter-group">
            <label>Hasta</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="dash-input" />
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
            Rango: {startDate ? new Date(startDate).toLocaleDateString() : "Desde siempre"} → {endDate ? new Date(endDate).toLocaleDateString() : "Hoy"}
          </div>
        )}
      </div>

      {/* ============================================
          SECCIÓN 1: KPI - VENTAS Y TIEMPOS
          ESTILO: GRADIENTES DE COLOR (BONITOS)
          ============================================ */}
      <div className="dash-section">
        <h3><Icons.Money size={18} /> Ventas y tiempos</h3>
        <div className="dash-grid">
          <KPICard
            title="Ventas"
            value={`$${totalSales.toLocaleString()}`}
            gradient="gradient-blue"
            icon={<Icons.Money size={22} />}
          />
          <KPICard
            title="Pedidos"
            value={totalOrders}
            gradient="gradient-purple"
            icon={<Icons.Package size={22} />}
          />
          <KPICard
            title="Prep Promedio"
            value={formatDuration(avgPrepSeconds)}
            gradient="gradient-green"
            icon={<Icons.Clock size={22} />}
          />
          <KPICard
            title="Reparto Promedio"
            value={formatDuration(avgRepartoSecs)}
            gradient="gradient-orange"
            icon={<Icons.Clock size={22} />}
          />
          <KPICard
            title="Total Promedio"
            value={formatDuration(avgTotalSecs)}
            gradient="gradient-pink"
            icon={<Icons.Clock size={22} />}
          />
        </div>
      </div>

      {/* ============================================
          SECCIÓN 2: SEMÁFORO ESTADO ACTUAL
          ESTILO: OPCIÓN 3 - PUNTO DE COLOR LATERAL
          ============================================ */}
      <div className="dash-section">
        <h3><Icons.Clock size={18} /> Estado actual de pedidos (En curso)</h3>
        <div className="dash-grid">
          <CardDot
            title="En tiempo"
            value={`${verdes} (${pct(verdes)}%)`}
            color="success"
            icon={<Icons.Check size={20} />}
          />
          <CardDot
            title="En riesgo"
            value={`${amarillos} (${pct(amarillos)}%)`}
            color="warning"
            icon={<Icons.Warning size={20} />}
          />
          <CardDot
            title="Críticos"
            value={`${rojos} (${pct(rojos)}%)`}
            color="danger"
            icon={<Icons.Error size={20} />}
          />
        </div>
      </div>

      {/* ============================================
          SECCIÓN 3: HISTORIAL DE EFICIENCIA
          ESTILO: OPCIÓN 1 - BORDE COMPLETO + GLOW
          ============================================ */}
      <div className="dash-section">
        <h3><Icons.Check size={18} /> Historial de Eficiencia (Finalizados)</h3>
        <p style={{ fontSize: "13px", color: "#64748b", marginTop: "-10px", marginBottom: "15px" }}>
          Evalúa si los pedidos entregados cumplieron los tiempos límite durante su proceso.
        </p>
        {finishedOrders.length === 0 ? (
          <EmptyState icon={<Icons.Info size={32} />} title="Sin datos" description="No hay pedidos finalizados para evaluar en este período." />
        ) : (
          <div className="dash-grid">
            <CardGlow
              title="A tiempo"
              value={`${histVerdes} (${pctHist(histVerdes)}%)`}
              color="success"
              icon={<Icons.Check size={20} />}
            />
            <CardGlow
              title="En riesgo"
              value={`${histAmarillos} (${pctHist(histAmarillos)}%)`}
              color="warning"
              icon={<Icons.Warning size={20} />}
            />
            <CardGlow
              title="Críticos"
              value={`${histRojos} (${pctHist(histRojos)}%)`}
              color="danger"
              icon={<Icons.Error size={20} />}
            />
          </div>
        )}
      </div>

      {/* ============================================
          SECCIÓN 4: RANKING DE VENDEDORES
          ESTILO: NUEVO - SIN REPETIR INFORMACIÓN
          ============================================ */}
      <div className="dash-section">
        <h3><Icons.Users size={18} /> Ranking de vendedores</h3>
        {ranking.length === 0 && <EmptyState icon={<Icons.Users size={32} />} title="Sin ventas" description="No hay ventas en este filtro." />}
        {ranking.map((item, index) => (
          <RankingCard
            key={item.seller}
            seller={item.seller}
            total={item.total}
            index={index}
          />
        ))}
      </div>

      {/* ============================================
          SECCIÓN 5: GASTOS POR VENDEDOR
          ESTILO: GRADIENTE AZUL/CORAL (LOGO) + EXPANSIÓN
          ============================================ */}
      {(user?.role === "admin" || user?.role === "planta") && Object.keys(groupedExpenses).length > 0 && (
        <div className="dash-section">
          <h3><Icons.Money size={18} /> Gastos por vendedor</h3>
          <div className="dash-expenses-grid">
            {Object.entries(groupedExpenses).map(([sellerId, data]) => (
              <ExpenseCard
                key={sellerId}
                name={data.sellerName}
                total={data.total}
                expenses={data.expenses}
                categories={expenseCategories}
              />
            ))}
          </div>
        </div>
      )}

      {/* ============================================
          SECCIÓN 6: CLIENTES INACTIVOS
          ESTILO: OPCIÓN 1 - BORDE COMPLETO + GLOW
          ============================================ */}
      {(user?.role === "admin" || user?.role === "planta") && inactiveClients.length > 0 && (
        <div className="dash-section">
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
              <ClientInactiveCard
                key={client.id}
                client={client}
                lastOrder={lastOrder}
              />
            );
          })}
        </div>
      )}

      {/* ============================================
          SECCIÓN 7: STOCK
          ESTILO: OPCIÓN 4 - SOMBRA ELEVADA
          ============================================ */}
      {(user?.role === "admin" || user?.role === "planta") && (
        <div className="dash-section">
          <h3><Icons.Package size={18} /> Stock actual de productos</h3>
          {products.length === 0 ? (
            <EmptyState icon={<Icons.Package size={32} />} title="Sin stock" description="No hay productos registrados." />
          ) : (
            <div className="dash-grid-small">
              {products.map((product) => (
                <StockCard
                  key={product.id}
                  name={product.name}
                  stock={product.stock || 0}
                  price={product.price}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================
          SECCIÓN 8: DEUDAS BOTELLONES
          ESTILO: OPCIÓN 3 - PUNTO DE COLOR LATERAL
          ============================================ */}
      {(user?.role === "admin" || user?.role === "planta") && (
        <div className="dash-section">
          <h3><Icons.Package size={18} /> Deudas de botellones vacíos</h3>
          {bottleDebts.length === 0 ? (
            <EmptyState icon={<Icons.Info size={32} />} title="Sin deudas" description="No hay deudas de botellones." />
          ) : (
            <div className="dash-grid-small">
              {bottleDebts.map((debt) => (
                <DebtCardDot
                  key={debt.sellerId}
                  sellerName={debt.sellerName}
                  totalSold={debt.totalSold}
                  totalReported={debt.totalReported}
                  debt={debt.debt}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// 🎨 KPI - TARJETAS CON GRADIENTE (BONITAS)
// ============================================
function KPICard({ title, value, gradient, icon }) {
  return (
    <div className={`dash-card-gradient-kpi ${gradient}`}>
      <div className="kpi-icon">{icon}</div>
      <h4 className="kpi-title">{title}</h4>
      <h2 className="kpi-value">{value}</h2>
    </div>
  );
}

// ============================================
// 🎨 OPCIÓN 1: BORDE COMPLETO + GLOW
// ============================================
function CardGlow({ title, value, icon, color = "success" }) {
  const colors = {
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  };

  return (
    <div className="dash-card-glow" style={{ borderColor: colors[color] || colors.success }}>
      <div className="card-icon" style={{ color: colors[color] }}>{icon}</div>
      <h4 className="card-title">{title}</h4>
      <h2 className="card-value">{value}</h2>
    </div>
  );
}

// ============================================
// 🎨 OPCIÓN 3: PUNTO DE COLOR LATERAL
// ============================================
function CardDot({ title, value, icon, color = "blue" }) {
  const colors = {
    success: 'dot-success',
    warning: 'dot-warning',
    danger: 'dot-danger',
    blue: 'dot-blue',
    purple: 'dot-purple',
    coral: 'dot-coral',
  };

  return (
    <div className={`dash-card-dot ${colors[color] || 'dot-blue'}`}>
      <div className="card-icon">{icon}</div>
      <h4 className="card-title">{title}</h4>
      <h2 className="card-value">{value}</h2>
    </div>
  );
}

// ============================================
// 🎨 RANKING DE VENDEDORES - NUEVO DISEÑO
// ============================================
function RankingCard({ seller, total, index }) {
  const medals = ['🥇', '🥈', '🥉'];
  const avatarColors = ['blue', 'green', 'orange', 'purple', 'pink', 'teal'];
  const color = avatarColors[index % avatarColors.length];
  const initials = seller.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getRankClass = (idx) => {
    if (idx === 0) return 'gold';
    if (idx === 1) return 'silver';
    if (idx === 2) return 'bronze';
    return 'normal';
  };

  return (
    <div className="dash-ranking-card">
      <div className={`rank-number ${getRankClass(index)}`}>
        {index < 3 ? medals[index] : `#${index + 1}`}
      </div>
      <div className="rank-info">
        <div className={`rank-avatar ${color}`}>{initials}</div>
        <div className="rank-detail">
          <div className="seller">{seller}</div>
          <div className="seller-amount">${total.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 🎨 GASTOS POR VENDEDOR (COLORES CORALINA) + EXPANSIÓN
// ============================================
function ExpenseCard({ name, total, expenses, categories }) {
  const [expanded, setExpanded] = useState(false);
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const catSummary = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
    return acc;
  }, {});

  const entries = Object.entries(catSummary);
  const mainCategories = entries.slice(0, 3);
  const hasMore = entries.length > 3;

  // Últimos 5 gastos
  const recentExpenses = expenses
    .sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return dateB - dateA;
    })
    .slice(0, 5);

  return (
    <div className="dash-expense-card">
      <div className="expense-header" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <div className="seller-initials">{initials}</div>
        <span className="seller-name">{name}</span>
        <span className="total-amount">${total.toLocaleString()}</span>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '18px', marginLeft: '8px' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>
      <div className="expense-body">
        <div className="expense-tags">
          {mainCategories.map(([cat, amt]) => (
            <span key={cat} className="expense-tag">
              {categories[cat] || cat}: ${amt.toLocaleString()}
            </span>
          ))}
          {hasMore && <span className="expense-more">+{entries.length - 3} más</span>}
        </div>

        {/* EXPANSIÓN - HISTORIAL DE GASTOS RECIENTES */}
        {expanded && (
          <div className="expense-history" style={{ marginTop: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
            <h5 style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>
              Últimos gastos
            </h5>
            {recentExpenses.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>No hay gastos registrados</p>
            ) : (
              recentExpenses.map((exp, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: idx < recentExpenses.length - 1 ? '1px solid #f1f5f9' : 'none',
                  fontSize: '13px'
                }}>
                  <span style={{ color: '#475569' }}>
                    {exp.concept}
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>
                      {categories[exp.category] || exp.category}
                    </span>
                  </span>
                  <span style={{ fontWeight: '600', color: '#ef4444' }}>
                    -${exp.amount?.toLocaleString()}
                  </span>
                </div>
              ))
            )}
            <div style={{
              fontSize: '11px',
              color: '#94a3b8',
              marginTop: '8px',
              textAlign: 'right'
            }}>
              Total gastos: <strong style={{ color: '#ef4444' }}>${total.toLocaleString()}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// 🎨 CLIENTES INACTIVOS (Opción 1: Glow)
// ============================================
function ClientInactiveCard({ client, lastOrder }) {
  return (
    <div className="dash-inactive-glow">
      <div className="info">
        <strong>{client.name}</strong>
        <div className="sub">📞 {client.phone} {lastOrder?.sellerName && `• Último: ${lastOrder.sellerName}`}</div>
        <div className="sub">📅 Último pedido: {client.lastOrderDate?.toDate?.().toLocaleDateString() || (client.lastOrderDate ? new Date(client.lastOrderDate).toLocaleDateString() : "Nunca")}</div>
      </div>
      <div className="days">
        <span className="count">{client.daysInactive} días</span>
        <span className="label">Alerta cada {client.expectedDays}d</span>
      </div>
    </div>
  );
}

// ============================================
// 🎨 STOCK (Opción 4: Sombra elevada)
// ============================================
function StockCard({ name, stock, price }) {
  const colorClass = stock <= 10 ? "text-danger" : stock <= 20 ? "text-warning" : "text-success";

  return (
    <div className="dash-stock-elevated">
      <h4>{name}</h4>
      <p className={`qty ${colorClass}`}>{stock} uds</p>
      <p className="price">${(price || 0).toLocaleString()}</p>
    </div>
  );
}

// ============================================
// 🎨 DEUDAS BOTELLONES (Opción 3: Punto lateral)
// ============================================
function DebtCardDot({ sellerName, totalSold, totalReported, debt }) {
  return (
    <div className={`dash-debt-dot ${debt > 0 ? 'dot-danger' : 'dot-success'}`}>
      <div className="content">
        <h4>{sellerName}</h4>
        <p>Vendidos: <strong>{totalSold}</strong></p>
        <p>Reportados: <strong>{totalReported}</strong></p>
        <p className={`status ${debt > 0 ? 'text-danger' : 'text-success'}`}>
          {debt > 0 ? `Debe: ${debt}` : "Sin deuda"}
        </p>
      </div>
    </div>
  );
}