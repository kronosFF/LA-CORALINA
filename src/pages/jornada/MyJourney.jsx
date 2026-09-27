import { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { OrderContext } from "../../context/OrderContext";
import { AssignmentContext } from "../../context/AssignmentContext";
import { CashClosingContext } from "../../context/CashClosingContext";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./jornada.css";

export default function MyJourney() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { orders } = useContext(OrderContext);
  const { dailyLoads, getTodayKey } = useContext(AssignmentContext);
  const { hasClosedToday, getDateKey } = useContext(CashClosingContext);

  const todayKey = getDateKey();

  // ==========================================
  // Pedidos entregados hoy por este vendedor
  // ==========================================
  const ordersToday = useMemo(() => {
    if (!user?.id) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return orders.filter((o) => {
      if (o.sellerId !== user.id) return false;
      if (o.status !== "entregado") return false;

      const refDate = o.timestamps?.entregado || o.createdAt;
      if (!refDate) return false;
      const d = refDate?.toDate ? refDate.toDate() : new Date(refDate);
      if (isNaN(d.getTime())) return false;

      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      return dayStart.getTime() === today.getTime();
    });
  }, [orders, user]);

  // ==========================================
  // Totales del día
  // ==========================================
  const totals = useMemo(() => {
    let cash = 0;
    let transfer = 0;
    let credit = 0;
    let other = 0;
    let total = 0;

    ordersToday.forEach((o) => {
      const t = o.total || 0;
      const paid = o.totalPaid || 0;
      total += t;

      if (o.paymentStatus === "pagado") {
        if (o.paymentMethod === "efectivo") cash += t;
        else if (["nequi", "llave", "transferencia"].includes(o.paymentMethod))
          transfer += t;
        else other += t;
      } else if (o.paymentStatus === "credito") {
        if (paid > 0) {
          if (o.paymentMethod === "efectivo") cash += paid;
          else if (
            ["nequi", "llave", "transferencia"].includes(o.paymentMethod)
          )
            transfer += paid;
          else other += paid;
        }
        credit += t - paid;
      } else if (o.paymentStatus === "pendiente") {
        if (o.paymentMethod === "efectivo") cash += t;
        else if (["nequi", "llave", "transferencia"].includes(o.paymentMethod))
          transfer += t;
        else other += t;
      }
    });

    return { cash, transfer, credit, other, total };
  }, [ordersToday]);

  // ==========================================
  // Tablero del día (cargas activas)
  // ==========================================
  const loadsToday = useMemo(() => {
    if (!user?.id) return [];
    return (dailyLoads || []).filter(
      (l) => l.sellerId === user.id && l.date === todayKey,
    );
  }, [dailyLoads, user, todayKey]);

  const boardProducts = useMemo(() => {
    const map = {};
    loadsToday.forEach((load) => {
      load.items.forEach((item) => {
        if (!map[item.productId]) {
          map[item.productId] = {
            productId: item.productId,
            name: item.name,
            assigned: 0,
            returned: 0,
          };
        }
        map[item.productId].assigned += item.assignedQty || 0;
        map[item.productId].returned += item.returnedQty || 0;
      });
    });
    return Object.values(map);
  }, [loadsToday]);

  const closedToday = hasClosedToday(user?.id);
  const hasOrdersToday = ordersToday.length > 0;

  return (
    <div className="jornada-page">
      <h1>📋 Mi Jornada</h1>

      {/* Alerta si ya cerró */}
      {closedToday && (
        <div className="jornada-alert jornada-alert-success">
          <Icons.Check size={20} />
          <div>
            <strong>✅ Ya cerraste tu jornada de hoy.</strong>
            <p style={{ margin: "4px 0 0 0" }}>
              La contadora revisará tu cuadre y te notificará cuando esté
              aprobado o si requiere ajustes.
            </p>
          </div>
        </div>
      )}

      {/* Alerta si no hay pedidos */}
      {!closedToday && !hasOrdersToday && (
        <div className="jornada-alert jornada-alert-info">
          <Icons.Info size={20} />
          <div>
            <strong>Aún no tienes pedidos entregados hoy.</strong>
            <p style={{ margin: "4px 0 0 0" }}>
              Cuando entregues tu primer pedido, aquí aparecerá el resumen de tu
              jornada.
            </p>
          </div>
        </div>
      )}

      {/* ==========================================
          RESUMEN DEL DÍA
          ========================================== */}
      <div className="jornada-summary-grid">
        <div className="jornada-summary-card gradient-blue">
          <span className="js-label">Pedidos entregados</span>
          <span className="js-value">{ordersToday.length}</span>
          <span className="js-sub">Hoy</span>
        </div>
        <div className="jornada-summary-card gradient-green">
          <span className="js-label">Total vendido</span>
          <span className="js-value">${totals.total.toLocaleString()}</span>
          <span className="js-sub">Valor total</span>
        </div>
        <div className="jornada-summary-card gradient-purple">
          <span className="js-label">Efectivo esperado</span>
          <span className="js-value">${totals.cash.toLocaleString()}</span>
          <span className="js-sub">Debes entregar</span>
        </div>
        <div className="jornada-summary-card gradient-orange">
          <span className="js-label">A crédito</span>
          <span className="js-value">${totals.credit.toLocaleString()}</span>
          <span className="js-sub">Saldo pendiente</span>
        </div>
      </div>

      {/* ==========================================
          DESGLOSE DE DINERO
          ========================================== */}
      {hasOrdersToday && (
        <div className="jornada-section">
          <h3>
            <Icons.Money size={18} /> Desglose del día
          </h3>
          <div className="jornada-money-list">
            <div className="jornada-money-row">
              <span>💵 Efectivo</span>
              <strong>${totals.cash.toLocaleString()}</strong>
            </div>
            <div className="jornada-money-row">
              <span>📱 Nequi / Llave / Transferencia</span>
              <strong>${totals.transfer.toLocaleString()}</strong>
            </div>
            <div className="jornada-money-row">
              <span>💳 Créditos</span>
              <strong>${totals.credit.toLocaleString()}</strong>
            </div>
            {totals.other > 0 && (
              <div className="jornada-money-row">
                <span>📌 Otros métodos</span>
                <strong>${totals.other.toLocaleString()}</strong>
              </div>
            )}
            <div className="jornada-money-total">
              <span>Total del día</span>
              <strong>${totals.total.toLocaleString()}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TABLERO ACTUAL (solo lectura)
          ========================================== */}
      <div className="jornada-section">
        <h3>
          <Icons.Package size={18} /> Tablero actual
        </h3>
        {boardProducts.length === 0 ? (
          <EmptyState
            icon={<Icons.Package size={32} />}
            title="Sin productos asignados"
            description="Aún no te han asignado productos al tablero hoy."
          />
        ) : (
          <table className="jornada-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Asignado</th>
                <th>Devuelto</th>
                <th>En tu poder</th>
              </tr>
            </thead>
            <tbody>
              {boardProducts.map((p) => {
                const enPoder = p.assigned - p.returned;
                return (
                  <tr key={p.productId}>
                    <td>{p.name}</td>
                    <td>{p.assigned}</td>
                    <td>{p.returned}</td>
                    <td className={enPoder > 0 ? "jornada-warn" : "jornada-ok"}>
                      {enPoder}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p
          style={{
            fontSize: "12px",
            color: "#94a3b8",
            marginTop: "12px",
            marginBottom: 0,
          }}
        >
          ℹ️ El tablero lo gestiona planta o gerencia. Tú solo puedes verlo.
        </p>
      </div>

      {/* ==========================================
          BOTÓN DE CIERRE
          ========================================== */}
      {!closedToday && hasOrdersToday && (
        <div className="jornada-section">
          <button
            className="jornada-btn jornada-btn-success jornada-btn-big"
            onClick={() => navigate("/cerrar-jornada")}
          >
            <Icons.Lock size={20} />
            Cerrar jornada
          </button>
          <p
            style={{
              fontSize: "12px",
              color: "#94a3b8",
              textAlign: "center",
              marginTop: "12px",
            }}
          >
            Al cerrar, tu cuadre queda bloqueado y pasa a revisión de la
            contadora.
          </p>
        </div>
      )}

      {/* ==========================================
          BOTÓN PARA VER HISTORIAL
          ========================================== */}
      <div className="jornada-section">
        <button
          className="jornada-btn jornada-btn-secondary jornada-btn-big"
          onClick={() => navigate("/mis-cuadres")}
        >
          <Icons.Clock size={18} />
          Ver mis cuadres anteriores
        </button>
      </div>
    </div>
  );
}
