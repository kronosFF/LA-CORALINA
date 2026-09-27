import { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { AuthContext } from "../../context/AuthContext";
import { CashClosingContext } from "../../context/CashClosingContext";
import { useToast } from "../../context/ToastContext";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./cuadres.css";

export default function ClosingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { approveClosing, rejectClosing, editClosing } =
    useContext(CashClosingContext);
  const { addToast } = useToast();

  const [closing, setClosing] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modales
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editCash, setEditCash] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  // ==========================================
  // Cargar cuadre
  // ==========================================
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const ref = doc(db, "cashClosings", id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setClosing({ id: snap.id, ...snap.data() });
        }
      } catch (error) {
        console.error("Error al cargar cuadre:", error);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const formatDateTime = (ts) => {
    if (!ts) return "—";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  };

  const getPaymentMethodLabel = (method) => {
    const methods = {
      efectivo: "Efectivo",
      nequi: "Nequi",
      llave: "Llave",
      transferencia: "Transferencia",
      otros: "Otros",
      credito_vendedor: "Crédito vendedor",
      credito_empresa: "Crédito empresa",
    };
    return methods[method] || method;
  };

  // ==========================================
  // Aprobar
  // ==========================================
  const handleApprove = async () => {
    if (processing) return;
    const comment = prompt("Comentario de aprobación (opcional):");
    if (comment === null) return; // canceló

    setProcessing(true);
    const ok = await approveClosing(closing.id, user, comment || "");
    setProcessing(false);

    if (ok) {
      addToast("✅ Cuadre aprobado", "success");
      navigate("/cuadres");
    }
  };

  // ==========================================
  // Rechazar
  // ==========================================
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      addToast("Debes escribir el motivo del rechazo", "error");
      return;
    }
    setProcessing(true);
    const ok = await rejectClosing(closing.id, user, rejectReason);
    setProcessing(false);

    if (ok) {
      addToast("❌ Cuadre rechazado", "success");
      setShowRejectModal(false);
      navigate("/cuadres");
    }
  };

  // ==========================================
  // Editar
  // ==========================================
  const handleEdit = async () => {
    if (!editReason.trim()) {
      addToast("Debes escribir el motivo del ajuste", "error");
      return;
    }

    const changes = {};
    if (editCash !== "" && Number(editCash) !== closing.cashDelivered) {
      changes.cashDelivered = Number(editCash);
      changes.cashDifference = Number(editCash) - closing.cashExpected;
    }
    if (editNotes !== closing.sellerNotes) {
      changes.sellerNotes = editNotes;
    }

    if (Object.keys(changes).length === 0) {
      addToast("No hay cambios para guardar", "error");
      return;
    }

    setProcessing(true);
    const ok = await editClosing(closing.id, changes, editReason, user);
    setProcessing(false);

    if (ok) {
      addToast("✅ Cuadre editado correctamente", "success");
      setShowEditModal(false);
      // Recargar
      const ref = doc(db, "cashClosings", id);
      const snap = await getDoc(ref);
      if (snap.exists()) setClosing({ id: snap.id, ...snap.data() });
    }
  };

  const openEditModal = () => {
    setEditCash(String(closing.cashDelivered || 0));
    setEditNotes(closing.sellerNotes || "");
    setEditReason("");
    setShowEditModal(true);
  };

  // ==========================================
  // Render
  // ==========================================
  if (loading) {
    return (
      <div className="cuadre-detail-page">
        <div className="jornada-empty">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!closing) {
    return (
      <div className="cuadre-detail-page">
        <EmptyState
          icon={<Icons.Error size={32} />}
          title="Cuadre no encontrado"
          description="El cuadre que buscas no existe o fue eliminado."
        />
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <button
            className="cuadre-back-btn"
            onClick={() => navigate("/cuadres")}
          >
            ← Volver a cuadres
          </button>
        </div>
      </div>
    );
  }

  const hasDiff = closing.cashDifference !== 0;
  const isPending = closing.status === "pendiente_aprobacion";

  return (
    <div className="cuadre-detail-page">
      {/* HEADER */}
      <div className="cuadre-detail-header">
        <div>
          <h1>Cuadre de {closing.sellerName}</h1>
          <div className="cuadre-detail-meta">
            📅 {formatDate(closing.date)} • Enviado:{" "}
            {formatDateTime(closing.submittedAt)}
          </div>
        </div>
        <button
          className="cuadre-back-btn"
          onClick={() => navigate("/cuadres")}
        >
          ← Volver
        </button>
      </div>

      {/* ESTADO ACTUAL */}
      {closing.status === "aprobado" && (
        <div className="cuadre-comments approve">
          <strong>✅ Aprobado por {closing.approvedBy?.name}</strong>
          <p>
            El {formatDateTime(closing.approvedAt)}
            {closing.approvedComment && ` — ${closing.approvedComment}`}
          </p>
        </div>
      )}

      {closing.status === "rechazado" && (
        <div className="cuadre-comments reject">
          <strong>❌ Rechazado por {closing.rejectedBy?.name}</strong>
          <p>
            El {formatDateTime(closing.rejectedAt)} — Motivo:{" "}
            <strong>{closing.rejectReason}</strong>
          </p>
        </div>
      )}

      {/* COMENTARIOS DEL VENDEDOR */}
      {closing.sellerNotes && (
        <div className="cuadre-comments">
          <strong>📝 Comentario del vendedor:</strong>
          <p>{closing.sellerNotes}</p>
        </div>
      )}

      {closing.sellerDifferenceReason && (
        <div className="cuadre-comments">
          <strong>💡 Explicación de la diferencia:</strong>
          <p>{closing.sellerDifferenceReason}</p>
        </div>
      )}

      {/* PRODUCTOS */}
      <div className="cuadre-section">
        <h3>
          <Icons.Package size={18} /> Comparación de productos
        </h3>
        {closing.products?.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: "13px" }}>
            Sin productos registrados.
          </p>
        ) : (
          <table className="cuadre-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Tablero</th>
                <th>Vendidos</th>
                <th>Devueltos</th>
                <th>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {closing.products.map((p) => {
                const ok = p.difference === 0;
                return (
                  <tr key={p.productId} className={!ok ? "row-diff" : ""}>
                    <td>{p.name}</td>
                    <td>{p.assignedQty}</td>
                    <td>{p.soldQty}</td>
                    <td>{p.returnedQty}</td>
                    <td
                      className={ok ? "cuadre-diff-ok" : "cuadre-diff-danger"}
                    >
                      {ok
                        ? "✅"
                        : `${p.difference > 0 ? "+" : ""}${p.difference}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* DINERO */}
      <div className="cuadre-section">
        <h3>
          <Icons.Money size={18} /> Cuadre de dinero
        </h3>
        <div className="cuadre-money">
          <div className="cuadre-money-row">
            <span>💵 Efectivo esperado</span>
            <strong>${(closing.cashExpected || 0).toLocaleString()}</strong>
          </div>
          <div className="cuadre-money-row">
            <span>💵 Efectivo entregado</span>
            <strong>${(closing.cashDelivered || 0).toLocaleString()}</strong>
          </div>
          <div className="cuadre-money-row">
            <span>📱 Transferencias esperadas</span>
            <strong>${(closing.transferExpected || 0).toLocaleString()}</strong>
          </div>
          <div className="cuadre-money-row">
            <span>💳 Créditos (vendedor)</span>
            <strong>${(closing.creditSeller || 0).toLocaleString()}</strong>
          </div>
          <div className="cuadre-money-row">
            <span>💳 Créditos (gerencia)</span>
            <strong>${(closing.creditBoss || 0).toLocaleString()}</strong>
          </div>
          <div className="cuadre-money-row highlight">
            <span>Total del día</span>
            <strong>${(closing.totalSales || 0).toLocaleString()}</strong>
          </div>
        </div>

        <div className={`cuadre-difference-box ${hasDiff ? "bad" : "ok"}`}>
          <div className="icon">{hasDiff ? "⚠️" : "✅"}</div>
          <div className="content">
            <strong>
              {hasDiff
                ? `Diferencia: $${closing.cashDifference.toLocaleString()}`
                : "Cuadre exacto"}
            </strong>
            <p>
              {hasDiff
                ? closing.cashDifference > 0
                  ? "El vendedor entregó más efectivo del esperado."
                  : "El vendedor entregó menos efectivo del esperado."
                : "El efectivo entregado coincide con lo esperado."}
            </p>
          </div>
        </div>
      </div>

      {/* PEDIDOS DEL DÍA */}
      <div className="cuadre-section">
        <h3>
          <Icons.Orders size={18} /> Clientes atendidos (
          {closing.clientBreakdown?.length || 0})
        </h3>
        {!closing.clientBreakdown || closing.clientBreakdown.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: "13px" }}>
            Sin clientes registrados.
          </p>
        ) : (
          <div className="cuadre-orders-list">
            {closing.clientBreakdown.map((c, i) => (
              <div key={i} className="cuadre-order-row">
                <span className="cuadre-order-client">
                  <strong>{c.clientName}</strong>
                </span>
                <span className="cuadre-order-total">
                  ${(c.total || 0).toLocaleString()}
                </span>
                <span className="cuadre-order-method">
                  {getPaymentMethodLabel(c.paymentType)}
                  {c.ordersCount > 1 && ` • ${c.ordersCount} pedidos`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AJUSTES (si los hay) */}
      {closing.adjustments?.length > 0 && (
        <div className="cuadre-section">
          <h3>
            <Icons.Edit size={18} /> Ajustes realizados
          </h3>
          {closing.adjustments.map((a, i) => (
            <div
              key={i}
              className="cuadre-comments"
              style={{ marginBottom: "8px" }}
            >
              <strong>
                {a.field}: $
                {a.originalValue?.toLocaleString?.() || a.originalValue} → $
                {a.newValue?.toLocaleString?.() || a.newValue}
              </strong>
              <p>
                Motivo: {a.reason}
                <br />
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Por {a.adjustedBy?.name} el {formatDateTime(a.adjustedAt)}
                </span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ACCIONES */}
      {isPending && (
        <div className="cuadre-actions">
          <button
            className="cuadre-btn-approve"
            onClick={handleApprove}
            disabled={processing}
          >
            ✅ Aprobar
          </button>
          <button
            className="cuadre-btn-edit"
            onClick={openEditModal}
            disabled={processing}
          >
            ✏️ Editar
          </button>
          <button
            className="cuadre-btn-reject"
            onClick={() => setShowRejectModal(true)}
            disabled={processing}
          >
            ❌ Rechazar
          </button>
        </div>
      )}

      {/* MODAL RECHAZAR */}
      {showRejectModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowRejectModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">❌ Rechazar cuadre</h3>
            <div className="modal-field">
              <label>Motivo del rechazo *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explica por qué se rechaza el cuadre..."
                autoFocus
              />
            </div>
            <div className="modal-buttons">
              <button
                className="cuadre-btn-cancel"
                onClick={() => setShowRejectModal(false)}
                disabled={processing}
              >
                Cancelar
              </button>
              <button
                className="cuadre-btn-reject"
                onClick={handleReject}
                disabled={processing || !rejectReason.trim()}
              >
                {processing ? "Procesando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">✏️ Editar cuadre</h3>

            <div className="modal-field">
              <label>Efectivo entregado</label>
              <input
                type="number"
                value={editCash}
                onChange={(e) => setEditCash(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="modal-field">
              <label>Comentario del vendedor</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Ajustar comentario del vendedor..."
              />
            </div>

            <div className="modal-field">
              <label>Motivo del ajuste *</label>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Ej: Conté el efectivo con el vendedor y era $400.000"
              />
            </div>

            <div className="modal-buttons">
              <button
                className="cuadre-btn-cancel"
                onClick={() => setShowEditModal(false)}
                disabled={processing}
              >
                Cancelar
              </button>
              <button
                className="cuadre-btn-edit"
                onClick={handleEdit}
                disabled={processing || !editReason.trim()}
              >
                {processing ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
