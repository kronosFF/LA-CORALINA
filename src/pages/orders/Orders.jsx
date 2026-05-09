import { useContext, useState } from "react";
import { OrderContext } from "../../context/OrderContext";
import { AuthContext } from "../../context/AuthContext";
import OrderCard from "../../components/ordercard/OrderCard";
import { useToast } from "../../context/ToastContext";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./Orders.css";

export default function Orders() {
  const { orders } = useContext(OrderContext);
  const { user, notifications, markNotificationAsRead } = useContext(AuthContext);
  const { addToast } = useToast();

  const [date, setDate] = useState(""); 
  const [hour, setHour] = useState(""); 
  const [filter, setFilter] = useState("todos"); 
  const [showNotifications, setShowNotifications] = useState(false);

  let visible = user?.role === "vendedor" ? orders.filter((o) => o.sellerId === user.id) : orders;

  if (date) {
    visible = visible.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        if (isNaN(orderDate.getTime())) return false;
        return orderDate.toISOString().slice(0, 10) === date;
      } catch (error) { return false; }
    });
  }

  if (hour) {
    visible = visible.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        if (isNaN(orderDate.getTime())) return false;
        const h = orderDate.getHours().toString().padStart(2, "0");
        return h === hour;
      } catch (error) { return false; }
    });
  }

  const filtered = visible.filter((o) => {
    if (filter === "todos") return true; 
    return o.status === filter; // Filca cancelados, preparacion, etc.
  });

  // 👇 NUEVA PESTAÑA DE CANCELADOS AGREGADA
  const tabs = [
    { key: "todos", label: "📋 Todos" },
    { key: "preparacion", label: "🏭 Preparación" },
    { key: "reparto", label: "🚚 Reparto" },
    { key: "entregado", label: "✅ Entregados" },
    { key: "cancelado", label: "❌ Cancelados" }, 
  ];

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  const handleNotificationClick = async (notifId) => {
    if (user?.id) await markNotificationAsRead(user.id, notifId);
    addToast("🔔 Notificación leída", "success");
  };

  const getPaymentMethodLabel = (method) => {
    const methods = { efectivo: "💵 Efectivo", nequi: "📱 Nequi", llave: "🔑 Llave", credito_empresa: "🏢 Crédito empresa", credito_vendedor: "👤 Crédito vendedor", cuenta_empresa: "🏦 Cuenta empresa", otros: "📌 Otros" };
    return methods[method] || method;
  };

  const clearFilters = () => {
    setDate("");
    setHour("");
  };

  return (
    <div className="orders-page">
      <div className="orders-header">
        <h1>Pedidos</h1>
        {user?.role === "vendedor" && (
          <div className="orders-notif-container">
            <button className="orders-notif-btn" onClick={() => setShowNotifications(!showNotifications)}>
              🔔 {unreadCount > 0 && <span className="orders-notif-badge">{unreadCount}</span>}
            </button>
            {showNotifications && (
              <div className="orders-notif-dropdown">
                <h4>Notificaciones</h4>
                {notifications?.length === 0 ? (
                  <EmptyState icon="🔔" title="Sin notificaciones" description="Estás al día." />
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className={`orders-notif-item ${!notif.read ? "unread" : ""}`} onClick={() => handleNotificationClick(notif.id)}>
                      <strong>{notif.title}</strong>
                      <p>{notif.message}</p>
                      <span className="orders-notif-date">{notif.createdAt?.toDate?.().toLocaleString() || new Date(notif.createdAt).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="orders-filters">
        <div className="filter-group">
          <label>📅 Fecha</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="orders-date-input" />
        </div>
        
        <div className="filter-group">
          <label>🕐 Hora pico</label>
          <select value={hour} onChange={(e) => setHour(e.target.value)} className="orders-date-input">
            <option value="">Todas</option>
            {[...Array(24)].map((_, i) => {
              const h = i.toString().padStart(2, "0");
              return <option key={h} value={h}>{h}:00</option>;
            })}
          </select>
        </div>

        <button 
          onClick={clearFilters} 
          style={{ padding: "10px 20px", background: "#f1f5f9", border: "1px solid #cbd5f5", borderRadius: "10px", cursor: "pointer", fontWeight: "600", color: "#475569", alignSelf: "flex-end" }}
        >
          Limpiar filtros
        </button>
      </div>

      <div className="orders-tabs">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setFilter(tab.key)} className={`orders-tab ${filter === tab.key ? "active" : ""}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState 
          icon="📦" 
          title="Sin pedidos" 
          description={date || hour ? "No hay pedidos para los filtros seleccionados." : "No hay pedidos en este estado actualmente."} 
        />
      )}

      {filtered.map((order) => (
        <div key={order.id} className="order-wrapper">
          <OrderCard order={order} />
          {order.paymentMethod && (
            <div className="payment-info">
              <span>💰 {getPaymentMethodLabel(order.paymentMethod)}</span>
              {order.paymentStatus === "pagado" && <span className="paid-badge">✅ Pagado</span>}
              {order.paymentStatus === "pendiente" && <span className="pending-badge">⏳ Pendiente</span>}
              {order.creditType && <span> • {order.creditType === "empresa" ? "🏢 Crédito empresa" : "👤 Crédito vendedor"}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}