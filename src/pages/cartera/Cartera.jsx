import { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReceivableContext } from "../../context/ReceivableContext";
import { AuthContext } from "../../context/AuthContext";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./cartera.css";

export default function Cartera() {
  const navigate = useNavigate();
  const { user, users } = useContext(AuthContext);
  const { getAllClientsWithBalance, getNoveltyClients, getTotals, loading } =
    useContext(ReceivableContext);

  const [tab, setTab] = useState("todos");
  const [filterSeller, setFilterSeller] = useState("");

  const allClients = useMemo(
    () => getAllClientsWithBalance(),
    [getAllClientsWithBalance],
  );
  const noveltyClients = useMemo(
    () => getNoveltyClients(),
    [getNoveltyClients],
  );
  const totals = useMemo(() => getTotals(), [getTotals]);

  const filtered = useMemo(() => {
    let list = tab === "novedad" ? noveltyClients : allClients;

    if (filterSeller) {
      list = list.filter((c) =>
        c.receivables.some((r) => r.sellerId === filterSeller),
      );
    }

    return list.sort((a, b) => b.totalBalance - a.totalBalance);
  }, [tab, allClients, noveltyClients, filterSeller]);

  const sellers = users.filter((u) => u.role === "vendedor");

  const getStatusBadge = (client) => {
    if (client.overdueCount > 0)
      return {
        label: `Vencido ${client.overdueCount}`,
        className: "badge-overdue",
      };
    if (client.oldestDays >= 25)
      return { label: "Próximo a vencer", className: "badge-warning" };
    return { label: "Al día", className: "badge-normal" };
  };

  return (
    <div className="cartera-page">
      <h1>💰 Cartera</h1>

      {/* RESUMEN */}
      <div className="cartera-summary">
        <h3>📊 Resumen general</h3>
        <div className="cartera-summary-grid">
          <div className="cartera-stat">
            <span className="cartera-stat-label">Total por cobrar</span>
            <span className="cartera-stat-value">
              ${totals.totalBalance.toLocaleString()}
            </span>
          </div>
          <div className="cartera-stat">
            <span className="cartera-stat-label">Clientes con deuda</span>
            <span className="cartera-stat-value">{allClients.length}</span>
          </div>
          <div className="cartera-stat">
            <span className="cartera-stat-label">Vencidos</span>
            <span className="cartera-stat-value danger">
              ${totals.overdueAmount.toLocaleString()}
            </span>
          </div>
          <div className="cartera-stat">
            <span className="cartera-stat-label">Total cobrado</span>
            <span className="cartera-stat-value">
              ${totals.totalPaid.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="cartera-filters">
        <div className="cartera-filter-group">
          <label>Vendedor</label>
          <select
            value={filterSeller}
            onChange={(e) => setFilterSeller(e.target.value)}
            className="cartera-input"
          >
            <option value="">Todos</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {filterSeller && (
          <button
            className="cartera-clear-btn"
            onClick={() => setFilterSeller("")}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* TABS */}
      <div className="cartera-tabs">
        <button
          className={`cartera-tab ${tab === "todos" ? "active" : ""}`}
          onClick={() => setTab("todos")}
        >
          Todos los clientes
          <span className="cartera-tab-count">{allClients.length}</span>
        </button>
        <button
          className={`cartera-tab ${tab === "novedad" ? "active" : ""}`}
          onClick={() => setTab("novedad")}
        >
          🚨 Con novedad
          <span className="cartera-tab-count">{noveltyClients.length}</span>
        </button>
      </div>

      {/* LISTA */}
      {loading && (
        <div className="jornada-empty">
          <p>Cargando cartera...</p>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={<Icons.Money size={32} />}
          title={tab === "novedad" ? "Sin novedades" : "Sin deudas"}
          description={
            tab === "novedad"
              ? "Ningún cliente tiene deuda vencida."
              : "No hay clientes con saldo pendiente."
          }
        />
      )}

      <div className="cartera-list">
        {filtered.map((client) => {
          const badge = getStatusBadge(client);
          return (
            <div
              key={client.clientId}
              className={`cartera-client-card ${
                client.overdueCount > 0 ? "overdue" : ""
              }`}
              onClick={() => navigate(`/cartera/cliente/${client.clientId}`)}
            >
              <div className="cartera-client-left">
                <div className="cartera-client-name">
                  {client.clientName}
                  <span className={`cartera-badge ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="cartera-client-sellers">
                  👤 Vendedores: {client.sellers.join(", ")}
                  {client.clientPhone && ` • 📞 ${client.clientPhone}`}
                </div>
              </div>

              <div className="cartera-client-right">
                <div className="cartera-client-stat">
                  <span className="cartera-client-stat-label">Original</span>
                  <span className="cartera-client-stat-value">
                    ${client.totalOriginal.toLocaleString()}
                  </span>
                </div>
                <div className="cartera-client-stat">
                  <span className="cartera-client-stat-label">Pagado</span>
                  <span className="cartera-client-stat-value">
                    ${client.totalPaid.toLocaleString()}
                  </span>
                </div>
                <div className="cartera-client-stat">
                  <span className="cartera-client-stat-label">Saldo</span>
                  <span className="cartera-client-balance">
                    ${client.totalBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
