import { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ReceivableContext } from "../../context/ReceivableContext";
import { AuthContext } from "../../context/AuthContext";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./cartera.css";

export default function MyCredits() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { getReceivablesBySeller, getStatusInfo } =
    useContext(ReceivableContext);

  const myReceivables = useMemo(
    () => (user?.id ? getReceivablesBySeller(user.id) : []),
    [getReceivablesBySeller, user],
  );

  const totalPending = myReceivables.reduce((a, r) => a + (r.balance || 0), 0);
  const totalOverdue = myReceivables
    .filter((r) => {
      const due = r.dueDate?.toDate ? r.dueDate.toDate() : new Date(r.dueDate);
      return due < new Date();
    })
    .reduce((a, r) => a + (r.balance || 0), 0);

  return (
    <div className="cartera-page">
      <h1>💳 Mis Créditos</h1>

      <div className="cartera-summary">
        <h3>📊 Resumen</h3>
        <div className="cartera-summary-grid">
          <div className="cartera-stat">
            <span className="cartera-stat-label">Créditos activos</span>
            <span className="cartera-stat-value">{myReceivables.length}</span>
          </div>
          <div className="cartera-stat">
            <span className="cartera-stat-label">Total por cobrar</span>
            <span className="cartera-stat-value">
              ${totalPending.toLocaleString()}
            </span>
          </div>
          <div className="cartera-stat">
            <span className="cartera-stat-label">Vencidos</span>
            <span className="cartera-stat-value danger">
              ${totalOverdue.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {myReceivables.length === 0 ? (
        <EmptyState
          icon={<Icons.Money size={32} />}
          title="Sin créditos activos"
          description="No tienes créditos otorgados pendientes de pago."
        />
      ) : (
        <div className="cartera-list">
          {myReceivables.map((rec) => {
            const info = getStatusInfo(rec);
            return (
              <div
                key={rec.id}
                className={`cartera-client-card ${
                  info.label.includes("Vencido") ? "overdue" : ""
                }`}
                onClick={() =>
                  rec.clientId && navigate(`/cartera/cliente/${rec.clientId}`)
                }
              >
                <div className="cartera-client-left">
                  <div className="cartera-client-name">
                    {rec.clientName}
                    <span
                      className="cartera-badge"
                      style={{ background: info.bg, color: info.color }}
                    >
                      {info.label}
                    </span>
                  </div>
                  <div className="cartera-client-sellers">
                    Pedido #{rec.orderNumericId} • 📅 {rec.orderDate}
                  </div>
                </div>
                <div className="cartera-client-right">
                  <div className="cartera-client-stat">
                    <span className="cartera-client-stat-label">Original</span>
                    <span className="cartera-client-stat-value">
                      ${(rec.totalOriginal || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="cartera-client-stat">
                    <span className="cartera-client-stat-label">Pagado</span>
                    <span className="cartera-client-stat-value">
                      ${(rec.totalPaid || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="cartera-client-stat">
                    <span className="cartera-client-stat-label">Saldo</span>
                    <span className="cartera-client-balance">
                      ${(rec.balance || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
