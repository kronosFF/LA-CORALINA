import { useContext, useState, useEffect } from "react";
import { OrderContext } from "../../context/OrderContext";
import { AuthContext } from "../../context/AuthContext";
import OrderCard from "../../components/ordercard/OrderCard";
import { useToast } from "../../context/ToastContext";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./Orders.css";

export default function Orders() {
  const { orders, hasMoreOrders, loadingMore, loadMoreOrders } =
    useContext(OrderContext);
  const { user, notifications, markNotificationAsRead } =
    useContext(AuthContext);
  const { addToast } = useToast();

  // Estados de paginación visual
  const [visibleCount, setVisibleCount] = useState(10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hour, setHour] = useState("");
  const [filter, setFilter] = useState("todos");
  const [showNotifications, setShowNotifications] = useState(false);

  // ==========================================
  // FILTRADO
  // ==========================================
  let visible =
    user?.role === "vendedor"
      ? orders.filter((o) => o.sellerId === user.id)
      : orders;

  if (startDate && endDate) {
    visible = visible.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let orderDate = o.createdAt?.toDate
          ? o.createdAt.toDate()
          : new Date(o.createdAt);
        if (isNaN(orderDate.getTime())) return false;

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        return orderDate >= start && orderDate <= end;
      } catch {
        return false;
      }
    });
  } else if (startDate) {
    visible = visible.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let orderDate = o.createdAt?.toDate
          ? o.createdAt.toDate()
          : new Date(o.createdAt);
        if (isNaN(orderDate.getTime())) return false;
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        return orderDate >= start;
      } catch {
        return false;
      }
    });
  } else if (endDate) {
    visible = visible.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let orderDate = o.createdAt?.toDate
          ? o.createdAt.toDate()
          : new Date(o.createdAt);
        if (isNaN(orderDate.getTime())) return false;
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return orderDate <= end;
      } catch {
        return false;
      }
    });
  }

  if (hour) {
    visible = visible.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let orderDate = o.createdAt?.toDate
          ? o.createdAt.toDate()
          : new Date(o.createdAt);
        if (isNaN(orderDate.getTime())) return false;
        const h = orderDate.getHours().toString().padStart(2, "0");
        return h === hour;
      } catch {
        return false;
      }
    });
  }

  const filtered = visible.filter((o) => {
    if (filter === "todos") return true;
    return o.status === filter;
  });

  // Paginación visual
  const displayedOrders = filtered.slice(0, visibleCount);
  const hasMoreToShow = filtered.length > visibleCount;

  // 🆕 El botón "Ver más" tiene 2 comportamientos:
  // 1. Si hay más cargados en memoria pero no visibles → solo expande la vista
  // 2. Si ya se muestran todos los cargados pero hay más en Firestore → carga más de Firestore
  const canLoadMoreFromFirestore =
    hasMoreOrders && filter === "todos" && !startDate && !endDate && !hour;

  const handleShowMore = async () => {
    // Si aún hay ocultos en memoria → mostrar
    if (hasMoreToShow) {
      setVisibleCount((prev) => prev + 10);
      addToast(
        `Mostrando ${Math.min(visibleCount + 10, filtered.length)} de ${filtered.length} pedidos`,
        "success",
      );
      return;
    }

    // Si ya mostramos todo lo cargado y hay más en Firestore → cargar más
    if (canLoadMoreFromFirestore) {
      const ok = await loadMoreOrders();
      if (ok) {
        setVisibleCount((prev) => prev + 10);
        addToast("Cargando más pedidos...", "success");
      } else {
        addToast("No hay más pedidos", "info");
      }
    }
  };

  useEffect(() => {
    setVisibleCount(10);
  }, [filter, startDate, endDate, hour]);

  const tabs = [
    { key: "todos", label: "Todos" },
    { key: "preparacion", label: "Preparación" },
    { key: "reparto", label: "Reparto" },
    { key: "entregado", label: "Entregados" },
    { key: "cancelado", label: "Cancelados" },
  ];

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  const handleNotificationClick = async (notifId) => {
    if (user?.id) await markNotificationAsRead(user.id, notifId);
    addToast("Notificación leída", "success");
  };

  const getPaymentMethodLabel = (method) => {
    const methods = {
      efectivo: "Efectivo",
      nequi: "Nequi",
      llave: "Llave",
      credito_empresa: "Crédito empresa",
      credito_vendedor: "Crédito vendedor",
      cuenta_empresa: "Cuenta empresa",
      otros: "Otros",
    };
    return methods[method] || method;
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setHour("");
    setVisibleCount(10);
  };

  const tabIcons = {
    todos: <Icons.Orders size={16} />,
    preparacion: <Icons.Clock size={16} />,
    reparto: <Icons.Clock size={16} />,
    entregado: <Icons.Check size={16} />,
    cancelado: <Icons.X size={16} />,
  };

  return (
    <div className="orders-page">
      <div className="orders-header">
        <h1>Pedidos</h1>
        {user?.role === "vendedor" && (
          <div className="orders-notif-container">
            <button
              className="orders-notif-btn"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Icons.Bell size={22} />
              {unreadCount > 0 && (
                <span className="orders-notif-badge">{unreadCount}</span>
              )}
            </button>
            {showNotifications && (
              <div className="orders-notif-dropdown">
                <h4>Notificaciones</h4>
                {notifications?.length === 0 ? (
                  <EmptyState
                    icon={<Icons.Info size={32} />}
                    title="Sin notificaciones"
                    description="Estás al día."
                  />
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`orders-notif-item ${
                        !notif.read ? "unread" : ""
                      }`}
                      onClick={() => handleNotificationClick(notif.id)}
                    >
                      <strong>{notif.title}</strong>
                      <p>{notif.message}</p>
                      <span className="orders-notif-date">
                        {notif.createdAt?.toDate?.().toLocaleString() ||
                          new Date(notif.createdAt).toLocaleString()}
                      </span>
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
          <label>Desde</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="orders-date-input"
          />
        </div>
        <div className="filter-group">
          <label>Hasta</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="orders-date-input"
          />
        </div>
        <div className="filter-group">
          <label>Hora pico</label>
          <select
            value={hour}
            onChange={(e) => setHour(e.target.value)}
            className="orders-date-input"
          >
            <option value="">Todas</option>
            {[...Array(24)].map((_, i) => {
              const h = i.toString().padStart(2, "0");
              return (
                <option key={h} value={h}>
                  {h}:00
                </option>
              );
            })}
          </select>
        </div>
        <button onClick={clearFilters} className="orders-clear-btn">
          Limpiar filtros
        </button>
      </div>

      <div className="orders-counter">
        <span>
          Mostrando <strong>{displayedOrders.length}</strong> de{" "}
          <strong>{filtered.length}</strong> pedidos cargados
          {filter !== "todos" &&
            ` (${tabs.find((t) => t.key === filter)?.label})`}
        </span>
        {hasMoreOrders && (
          <span className="orders-page-badge">📦 Hay más en la nube</span>
        )}
      </div>

      <div className="orders-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`orders-tab ${filter === tab.key ? "active" : ""}`}
          >
            {tabIcons[tab.key]}
            {tab.label}
          </button>
        ))}
      </div>

      {displayedOrders.length === 0 && (
        <EmptyState
          icon={<Icons.Orders size={32} />}
          title="Sin pedidos"
          description={
            startDate || endDate || hour
              ? "No hay pedidos para los filtros seleccionados."
              : "No hay pedidos en este estado actualmente."
          }
        />
      )}

      {displayedOrders.map((order) => (
        <div key={order.id} className="order-wrapper">
          <OrderCard order={order} />
          {order.paymentMethod && (
            <div className="payment-info">
              <span>{getPaymentMethodLabel(order.paymentMethod)}</span>
              {order.paymentStatus === "pagado" && (
                <span className="paid-badge">Pagado</span>
              )}
              {order.paymentStatus === "pendiente" && (
                <span className="pending-badge">Pendiente</span>
              )}
              {order.creditType && (
                <span>
                  {" "}
                  •{" "}
                  {order.creditType === "empresa"
                    ? "Crédito empresa"
                    : "Crédito vendedor"}
                </span>
              )}
            </div>
          )}
        </div>
      ))}

      {/* 🆕 BOTÓN ÚNICO: maneja tanto la expansión local como la carga desde Firestore */}
      {(hasMoreToShow || canLoadMoreFromFirestore) && (
        <div className="orders-load-more">
          <button
            onClick={handleShowMore}
            className="orders-load-more-btn"
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Icons.Clock size={18} />
                Cargando...
              </>
            ) : (
              <>
                <Icons.Plus size={18} />
                {hasMoreToShow
                  ? `Ver más (${filtered.length - displayedOrders.length} restantes)`
                  : "Cargar más pedidos antiguos"}
              </>
            )}
          </button>
        </div>
      )}

      {!hasMoreToShow && !canLoadMoreFromFirestore && filtered.length > 0 && (
        <div className="orders-all-loaded">
          <Icons.Check size={18} />
          Todos los pedidos cargados ({filtered.length} en total)
        </div>
      )}
    </div>
  );
}
