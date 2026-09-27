import { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { CashClosingContext } from "../../context/CashClosingContext";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./cuadres.css";

export default function Closings() {
  const navigate = useNavigate();
  const { user, users } = useContext(AuthContext);
  const { pendingClosings, recentClosings, loading } =
    useContext(CashClosingContext);

  const [tab, setTab] = useState("pendientes");
  const [filterDate, setFilterDate] = useState("");
  const [filterSeller, setFilterSeller] = useState("");

  // ==========================================
  // Combinar y filtrar
  // ==========================================
  const allClosings = useMemo(() => {
    // Unir ambas listas sin duplicados
    const seen = new Set();
    const combined = [];
    [...pendingClosings, ...recentClosings].forEach((c) => {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        combined.push(c);
      }
    });
    return combined;
  }, [pendingClosings, recentClosings]);

  const filtered = useMemo(() => {
    let list = allClosings;

    // Filtro por tab
    if (tab === "pendientes")
      list = list.filter((c) => c.status === "pendiente_aprobacion");
    else if (tab === "aprobados")
      list = list.filter((c) => c.status === "aprobado");
    else if (tab === "rechazados")
      list = list.filter((c) => c.status === "rechazado");
    else if (tab === "todos") {
      // todos
    }

    // Filtro por fecha
    if (filterDate) {
      list = list.filter((c) => c.date === filterDate);
    }

    // Filtro por vendedor
    if (filterSeller) {
      list = list.filter((c) => c.sellerId === filterSeller);
    }

    // Ordenar por fecha de envío (más recientes primero)
    return list.sort((a, b) => {
      const da = a.submittedAt?.toDate
        ? a.submittedAt.toDate()
        : new Date(a.submittedAt || 0);
      const db_ = b.submittedAt?.toDate
        ? b.submittedAt.toDate()
        : new Date(b.submittedAt || 0);
      return db_ - da;
    });
  }, [allClosings, tab, filterDate, filterSeller]);

  // Contadores para las tabs
  const counts = useMemo(() => {
    const base =
      filterDate || filterSeller
        ? allClosings.filter((c) => {
            if (filterDate && c.date !== filterDate) return false;
            if (filterSeller && c.sellerId !== filterSeller) return false;
            return true;
          })
        : allClosings;

    return {
      pendientes: base.filter((c) => c.status === "pendiente_aprobacion")
        .length,
      aprobados: base.filter((c) => c.status === "aprobado").length,
      rechazados: base.filter((c) => c.status === "rechazado").length,
      todos: base.length,
    };
  }, [allClosings, filterDate, filterSeller]);

  const sellers = users.filter((u) => u.role === "vendedor");

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const getStatusBadge = (status) => {
    if (status === "pendiente_aprobacion")
      return { label: "Pendiente", className: "badge-pending" };
    if (status === "aprobado")
      return { label: "Aprobado", className: "badge-approved" };
    if (status === "rechazado")
      return { label: "Rechazado", className: "badge-rejected" };
    return { label: status, className: "badge-pending" };
  };

  const clearFilters = () => {
    setFilterDate("");
    setFilterSeller("");
  };

  return (
    <div className="cuadres-page">
      <h1>📋 Cuadres de Jornada</h1>

      {/* ==========================================
          FILTROS
          ========================================== */}
      <div className="cuadres-filters">
        <div className="cuadres-filter-group">
          <label>Fecha</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="cuadres-input"
          />
        </div>
        <div className="cuadres-filter-group">
          <label>Vendedor</label>
          <select
            value={filterSeller}
            onChange={(e) => setFilterSeller(e.target.value)}
            className="cuadres-input"
          >
            <option value="">Todos</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {(filterDate || filterSeller) && (
          <button className="cuadres-clear-btn" onClick={clearFilters}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* ==========================================
          TABS
          ========================================== */}
      <div className="cuadres-tabs">
        <button
          className={`cuadres-tab ${tab === "pendientes" ? "active" : ""}`}
          onClick={() => setTab("pendientes")}
        >
          ⏳ Pendientes
          {counts.pendientes > 0 && (
            <span className="cuadres-tab-count">{counts.pendientes}</span>
          )}
        </button>
        <button
          className={`cuadres-tab ${tab === "aprobados" ? "active" : ""}`}
          onClick={() => setTab("aprobados")}
        >
          ✅ Aprobados
          {counts.aprobados > 0 && (
            <span className="cuadres-tab-count">{counts.aprobados}</span>
          )}
        </button>
        <button
          className={`cuadres-tab ${tab === "rechazados" ? "active" : ""}`}
          onClick={() => setTab("rechazados")}
        >
          ❌ Rechazados
          {counts.rechazados > 0 && (
            <span className="cuadres-tab-count">{counts.rechazados}</span>
          )}
        </button>
        <button
          className={`cuadres-tab ${tab === "todos" ? "active" : ""}`}
          onClick={() => setTab("todos")}
        >
          📚 Todos
          <span className="cuadres-tab-count">{counts.todos}</span>
        </button>
      </div>

      {/* ==========================================
          CONTADOR
          ========================================== */}
      <div className="cuadres-counter">
        <span>
          Mostrando <strong>{filtered.length}</strong> cuadre(s)
          {filterDate && ` del ${formatDate(filterDate)}`}
          {filterSeller &&
            ` de ${sellers.find((s) => s.id === filterSeller)?.name || ""}`}
        </span>
      </div>

      {/* ==========================================
          LISTA
          ========================================== */}
      {loading && (
        <div className="jornada-empty">
          <p>Cargando cuadres...</p>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={<Icons.Info size={32} />}
          title="Sin cuadres"
          description={
            tab === "pendientes"
              ? "No hay cuadres pendientes de aprobar."
              : "No hay cuadres con estos filtros."
          }
        />
      )}

      <div className="cuadres-list">
        {filtered.map((c) => {
          const badge = getStatusBadge(c.status);
          const hasDiff = c.cashDifference !== 0;

          return (
            <div
              key={c.id}
              className="cuadre-card"
              onClick={() => navigate(`/cuadres/${c.id}`)}
            >
              <div className="cuadre-card-left">
                <div className="cuadre-card-seller">{c.sellerName}</div>
                <div className="cuadre-card-date">
                  📅 {formatDate(c.date)} • {c.ordersCount} pedido(s)
                </div>
              </div>

              <div className="cuadre-card-right">
                <div className="cuadre-card-stat">
                  <span className="cuadre-card-stat-label">Efectivo</span>
                  <span className="cuadre-card-stat-value">
                    ${(c.cashDelivered || 0).toLocaleString()}
                  </span>
                </div>
                <div className="cuadre-card-stat">
                  <span className="cuadre-card-stat-label">Diferencia</span>
                  <span
                    className={`cuadre-card-difference ${
                      hasDiff ? "bad" : "ok"
                    }`}
                  >
                    {hasDiff
                      ? `${c.cashDifference > 0 ? "+" : ""}$${c.cashDifference.toLocaleString()}`
                      : "✅ OK"}
                  </span>
                </div>
                <span className={`cuadre-card-badge ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
