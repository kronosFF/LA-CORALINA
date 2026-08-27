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
          ESTILO: GRADIENTES DIFERENTES POR TARJETA
          ============================================ */}
      <div className="dash-section accent-success">
        <h3><Icons.Money size={18} /> Ventas y tiempos</h3>
        <div className="dash-grid">
          <MetricCardGradient 
            title="Ventas" 
            value={`$${totalSales.toLocaleString()}`} 
            gradient="blue"
            icon={<Icons.Money size={22} />}
          />
          <MetricCardGradient 
            title="Pedidos" 
            value={totalOrders} 
            gradient="purple"
            icon={<Icons.Package size={22} />}
          />
          <MetricCardGradient 
            title="Prep Promedio" 
            value={formatDuration(avgPrepSeconds)} 
            gradient="green"
            icon={<Icons.Clock size={22} />}
          />
          <MetricCardGradient 
            title="Reparto Promedio" 
            value={formatDuration(avgRepartoSecs)} 
            gradient="orange"
            icon={<Icons.Clock size={22} />}
          />
          <MetricCardGradient 
            title="Total Promedio" 
            value={formatDuration(avgTotalSecs)} 
            gradient="pink"
            icon={<Icons.Clock size={22} />}
          />
        </div>
      </div>

      {/* ============================================
          SECCIÓN 2: SEMÁFORO ESTADO ACTUAL
          ESTILO: BORDE IZQUIERDO + ICONO DE ESTADO
          ============================================ */}
      <div className="dash-section accent-warning">
        <h3><Icons.Clock size={18} /> Estado actual de pedidos (En curso)</h3>
        <div className="dash-grid">
          <MetricCardLeftBorder 
            title="En tiempo" 
            value={`${verdes} (${pct(verdes)}%)`} 
            color="success"
            icon={<Icons.Check size={20} />}
          />
          <MetricCardLeftBorder 
            title="En riesgo" 
            value={`${amarillos} (${pct(amarillos)}%)`} 
            color="warning"
            icon={<Icons.Warning size={20} />}
          />
          <MetricCardLeftBorder 
            title="Críticos" 
            value={`${rojos} (${pct(rojos)}%)`} 
            color="danger"
            icon={<Icons.Error size={20} />}
          />
        </div>
      </div>

      {/* ============================================
          SECCIÓN 3: HISTORIAL DE EFICIENCIA
          ESTILO: MARCO COMPLETO + SOMBRA ELEVADA
          ============================================ */}
      <div className="dash-section accent-purple">
        <h3><Icons.Check size={18} /> Historial de Eficiencia (Finalizados)</h3>
        <p style={{fontSize: "13px", color: "#64748b", marginTop: "-10px", marginBottom: "15px"}}>
          Evalúa si los pedidos entregados cumplieron los tiempos límite durante su proceso.
        </p>
        {finishedOrders.length === 0 ? (
          <EmptyState icon={<Icons.Info size={32} />} title="Sin datos" description="No hay pedidos finalizados para evaluar en este período." />
        ) : (
          <div className="dash-grid">
            <MetricCardElevated 
              title="A tiempo" 
              value={`${histVerdes} (${pctHist(histVerdes)}%)`} 
              color="success"
              icon={<Icons.Check size={20} />}
            />
            <MetricCardElevated 
              title="En riesgo" 
              value={`${histAmarillos} (${pctHist(histAmarillos)}%)`} 
              color="warning"
              icon={<Icons.Warning size={20} />}
            />
            <MetricCardElevated 
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
          ESTILO: TARJETA CON AVATAR + BADGE FLOTANTE
          ============================================ */}
      <div className="dash-section accent-purple">
        <h3><Icons.Users size={18} /> Ranking de vendedores</h3>
        {ranking.length === 0 && <EmptyState icon={<Icons.Users size={32} />} title="Sin ventas" description="No hay ventas en este filtro." />}
        {ranking.map((item, index) => (
          <RankingCardAvatar 
            key={item.seller}
            seller={item.seller}
            total={item.total}
            index={index}
          />
        ))}
      </div>

      {/* ============================================
          SECCIÓN 5: GASTOS POR VENDEDOR
          ESTILO: AVATAR + BADGE (ya está)
          ============================================ */}
      {(user?.role === "admin" || user?.role === "planta") && Object.keys(groupedExpenses).length > 0 && (
        <div className="dash-section accent-danger">
          <h3><Icons.Money size={18} /> Gastos por vendedor</h3>
          <div className="dash-expenses-grid">
            {Object.entries(groupedExpenses).map(([sellerId, data]) => (
              <ExpenseCardAvatar 
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
          ESTILO: BORDE COMPLETO + GLOW
          ============================================ */}
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
          ESTILO: MARCO COMPLETO + SOMBRA
          ============================================ */}
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
                  <StockCard 
                    key={product.id}
                    name={product.name}
                    stock={stock}
                    price={product.price}
                    colorClass={colorClass}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================
          SECCIÓN 8: DEUDAS BOTELLONES
          ESTILO: FOTO DE FONDO (BLUR)
          ============================================ */}
      {(user?.role === "admin" || user?.role === "planta") && (
        <div className="dash-section accent-cyan">
          <h3><Icons.Package size={18} /> Deudas de botellones vacíos</h3>
          {bottleDebts.length === 0 ? (
            <EmptyState icon={<Icons.Info size={32} />} title="Sin deudas" description="No hay deudas de botellones." />
          ) : (
            <div className="dash-grid-small">
              {bottleDebts.map((debt) => (
                <DebtCardBlur 
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
// 🎨 COMPONENTES DE TARJETAS CON DIFERENTES ESTILOS
// ============================================

// -------------------------------------------
// ESTILO 1: TARJETA CON GRADIENTE (KPI)
// -------------------------------------------
function MetricCardGradient({ title, value, gradient, icon }) {
  const gradients = {
    blue: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    purple: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    green: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
    orange: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    pink: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
  };

  return (
    <div className="dash-card-gradient" style={{ background: gradients[gradient] || gradients.blue }}>
      <div className="dash-card-gradient-icon">{icon}</div>
      <h4 className="dash-card-gradient-title">{title}</h4>
      <h2 className="dash-card-gradient-value">{value}</h2>
    </div>
  );
}

// -------------------------------------------
// ESTILO 2: TARJETA CON BORDE IZQUIERDO (SEMÁFORO)
// -------------------------------------------
function MetricCardLeftBorder({ title, value, color, icon }) {
  const colors = {
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  };

  return (
    <div className="dash-card-left-border" style={{ borderLeftColor: colors[color] || colors.success }}>
      <div className="dash-card-left-border-icon" style={{ color: colors[color] }}>{icon}</div>
      <h4 className="dash-card-left-border-title">{title}</h4>
      <h2 className="dash-card-left-border-value">{value}</h2>
    </div>
  );
}

// -------------------------------------------
// ESTILO 3: TARJETA CON SOMBRA ELEVADA (HISTORIAL)
// -------------------------------------------
function MetricCardElevated({ title, value, color, icon }) {
  const colors = {
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  };

  return (
    <div className="dash-card-elevated" style={{ borderTop: `4px solid ${colors[color] || colors.success}` }}>
      <div className="dash-card-elevated-icon" style={{ color: colors[color] }}>{icon}</div>
      <h4 className="dash-card-elevated-title">{title}</h4>
      <h2 className="dash-card-elevated-value">{value}</h2>
    </div>
  );
}

// -------------------------------------------
// ESTILO 4: RANKING CON AVATAR + BADGE FLOTANTE
// -------------------------------------------
function RankingCardAvatar({ seller, total, index }) {
  const initials = seller.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="dash-ranking-avatar">
      {index < 3 && <span className="dash-ranking-medal">{medals[index]}</span>}
      <div className="dash-ranking-avatar-circle" style={{ 
        background: index === 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' :
                   index === 1 ? 'linear-gradient(135deg, #94a3b8, #64748b)' :
                   index === 2 ? 'linear-gradient(135deg, #cd7f32, #b8860b)' :
                   'linear-gradient(135deg, #2563eb, #1d4ed8)'
      }}>
        {initials}
      </div>
      <div className="dash-ranking-avatar-info">
        <span className="dash-ranking-avatar-name">{seller}</span>
        <span className="dash-ranking-avatar-amount">${total.toLocaleString()}</span>
      </div>
    </div>
  );
}

// -------------------------------------------
// ESTILO 5: TARJETA AVATAR + BADGE (GASTOS)
// -------------------------------------------
function ExpenseCardAvatar({ name, total, expenses, categories }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="dash-expense-card-avatar">
      <div className="dash-expense-avatar">{initials}</div>
      <div className="dash-expense-avatar-info">
        <h4>{name}</h4>
        <div className="dash-expense-avatar-total">Total: ${total.toLocaleString()}</div>
        <div className="dash-expense-avatar-detail">
          {Object.entries(expenses.reduce((acc, e) => { 
            acc[e.category] = (acc[e.category] || 0) + (e.amount || 0); 
            return acc; 
          }, {})).slice(0, 3).map(([cat, total]) => (
            <span key={cat} className="dash-expense-avatar-cat">
              {categories[cat] || cat}: ${total.toLocaleString()}
            </span>
          ))}
          {Object.keys(expenses.reduce((acc, e) => { 
            acc[e.category] = (acc[e.category] || 0) + (e.amount || 0); 
            return acc; 
          }, {})).length > 3 && (
            <span className="dash-expense-avatar-more">+ más</span>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------
// ESTILO 6: TARJETA BORDE COMPLETO + GLOW (CLIENTES INACTIVOS)
// -------------------------------------------
function ClientInactiveCard({ client, lastOrder }) {
  return (
    <div className="dash-inactive-card-glow">
      <div className="dash-inactive-info">
        <strong>{client.name}</strong>
        <div className="dash-inactive-sub">📞 {client.phone} {lastOrder?.sellerName && `• Último: ${lastOrder.sellerName}`}</div>
        <div className="dash-inactive-sub">📅 Último pedido: {client.lastOrderDate?.toDate?.().toLocaleDateString() || (client.lastOrderDate ? new Date(client.lastOrderDate).toLocaleDateString() : "Nunca")}</div>
      </div>
      <div className="dash-inactive-days">
        <span className="dash-days-count">{client.daysInactive} días</span>
        <span className="dash-days-label">Alerta cada {client.expectedDays}d</span>
      </div>
    </div>
  );
}

// -------------------------------------------
// ESTILO 7: TARJETA MARCO COMPLETO (STOCK)
// -------------------------------------------
function StockCard({ name, stock, price, colorClass }) {
  return (
    <div className="dash-stock-card-elevated">
      <h4>{name}</h4>
      <p className={`dash-qty ${colorClass}`}>{stock} uds</p>
      <p className="dash-price">${(price || 0).toLocaleString()}</p>
    </div>
  );
}

// -------------------------------------------
// ESTILO 8: TARJETA FONDO BLUR (DEUDAS BOTELLONES)
// -------------------------------------------
function DebtCardBlur({ sellerName, totalSold, totalReported, debt }) {
  return (
    <div className="dash-debt-card-blur">
      <div className="dash-debt-blur-bg"></div>
      <div className="dash-debt-blur-overlay"></div>
      <div className="dash-debt-blur-content">
        <h4>{sellerName}</h4>
        <p>Vendidos: <strong>{totalSold}</strong></p>
        <p>Reportados: <strong>{totalReported}</strong></p>
        <p className={`dash-debt-status ${debt > 0 ? "text-danger" : "text-success"}`}>
          {debt > 0 ? `Debe: ${debt}` : "Sin deuda"}
        </p>
      </div>
    </div>
  );
}