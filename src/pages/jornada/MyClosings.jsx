import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { CashClosingContext } from "../../context/CashClosingContext";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./jornada.css";

export default function MyClosings() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { getClosingsBySeller } = useContext(CashClosingContext);

  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      const data = await getClosingsBySeller(user.id);
      setClosings(data);
      setLoading(false);
    };
    load();
  }, [user, getClosingsBySeller]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const getStatusBadge = (status) => {
    if (status === "pendiente_aprobacion")
      return { label: "⏳ Pendiente", className: "badge-pending" };
    if (status === "aprobado")
      return { label: "✅ Aprobado", className: "badge-approved" };
    if (status === "rechazado")
      return { label: "❌ Rechazado", className: "badge-rejected" };
    return { label: status, className: "badge-pending" };
  };

  return (
    <div className="jornada-page">
      <h1>📚 Mis Cuadres</h1>

      <div style={{ marginBottom: "20px" }}>
        <button
          className="jornada-btn jornada-btn-secondary"
          onClick={() => navigate("/mi-jornada")}
        >
          ← Volver a mi jornada
        </button>
      </div>

      {loading && (
        <div className="jornada-empty">
          <p>Cargando cuadres...</p>
        </div>
      )}

      {!loading && closings.length === 0 && (
        <EmptyState
          icon={<Icons.Clock size={32} />}
          title="Sin cuadres"
          description="Aún no has cerrado ninguna jornada."
        />
      )}

      {!loading &&
        closings.map((c) => {
          const badge = getStatusBadge(c.status);
          return (
            <div
              key={c.id}
              className="jornada-closing-card"
              onClick={() => navigate(`/cuadres/${c.id}`)}
            >
              <div className="jornada-closing-header">
                <strong>📅 {formatDate(c.date)}</strong>
                <span className={`jornada-closing-badge ${badge.className}`}>
                  {badge.label}
                </span>
              </div>

              <div className="jornada-closing-body">
                <span>
                  🛒 Pedidos: <strong>{c.ordersCount}</strong>
                </span>
                <span>
                  💵 Efectivo:{" "}
                  <strong>${(c.cashDelivered || 0).toLocaleString()}</strong>
                </span>
                <span>
                  💳 Créditos:{" "}
                  <strong>
                    $
                    {(
                      (c.creditSeller || 0) + (c.creditBoss || 0)
                    ).toLocaleString()}
                  </strong>
                </span>
                <span>
                  📊 Total:{" "}
                  <strong>${(c.totalSales || 0).toLocaleString()}</strong>
                </span>
              </div>

              {c.cashDifference !== 0 && (
                <div
                  style={{
                    marginTop: "10px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: c.cashDifference < 0 ? "#ef4444" : "#16a34a",
                  }}
                >
                  {c.cashDifference < 0
                    ? `⚠️ Faltó $${Math.abs(c.cashDifference).toLocaleString()}`
                    : `💡 Sobró $${c.cashDifference.toLocaleString()}`}
                </div>
              )}

              {c.status === "rechazado" && c.rejectReason && (
                <div
                  className="cuadre-comments reject"
                  style={{ marginTop: "10px", marginBottom: 0 }}
                >
                  <strong>❌ Motivo del rechazo:</strong>
                  <p>{c.rejectReason}</p>
                </div>
              )}

              {c.status === "aprobado" && c.approvedComment && (
                <div
                  className="cuadre-comments approve"
                  style={{ marginTop: "10px", marginBottom: 0 }}
                >
                  <strong>✅ Comentario de aprobación:</strong>
                  <p>{c.approvedComment}</p>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
