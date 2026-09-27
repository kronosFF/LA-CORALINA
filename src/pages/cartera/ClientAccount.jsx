import { useContext, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ReceivableContext } from "../../context/ReceivableContext";
import { AuthContext } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./cartera.css";

export default function ClientAccount() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const {
    getClientSummary,
    registerPaymentOnReceivable,
    applyFifoPayment,
    getStatusInfo,
  } = useContext(ReceivableContext);
  const { addToast } = useToast();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState("fifo"); // fifo | specific
  const [selectedReceivableId, setSelectedReceivableId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const client = useMemo(() => getClientSummary(id), [getClientSummary, id]);

  if (!client) {
    return (
      <div className="cartera-detail-page">
        <EmptyState
          icon={<Icons.Info size={32} />}
          title="Sin deudas"
          description="Este cliente no tiene cuentas por cobrar."
        />
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <button
            className="cartera-back-btn"
            onClick={() => navigate("/cartera")}
          >
            ← Volver a cartera
          </button>
        </div>
      </div>
    );
  }

  const openPaymentModal = (receivableId = null) => {
    if (receivableId) {
      setPaymentMode("specific");
      setSelectedReceivableId(receivableId);
      const rec = client.receivables.find((r) => r.id === receivableId);
      setAmount(String(rec?.balance || ""));
    } else {
      setPaymentMode("fifo");
      setSelectedReceivableId("");
      setAmount(String(client.totalBalance));
    }
    setMethod("efectivo");
    setNotes("");
    setShowPaymentModal(true);
  };

  const handlePayment = async () => {
    if (!amount || Number(amount) <= 0) {
      addToast("Ingresa un monto válido", "error");
      return;
    }

    setProcessing(true);
    let ok = false;

    if (paymentMode === "fifo") {
      ok = await applyFifoPayment(
        client.clientId,
        Number(amount),
        method,
        user,
        notes,
      );
    } else {
      if (!selectedReceivableId) {
        addToast("Selecciona el pedido", "error");
        setProcessing(false);
        return;
      }
      ok = await registerPaymentOnReceivable(
        selectedReceivableId,
        Number(amount),
        method,
        user,
        notes,
      );
    }

    setProcessing(false);

    if (ok) {
      addToast("✅ Abono registrado", "success");
      setShowPaymentModal(false);
    }
  };

  return (
    <div className="cartera-detail-page">
      {/* HEADER */}
      <div className="cartera-detail-header">
        <div>
          <h1>{client.clientName}</h1>
          <div className="cartera-detail-meta">
            {client.clientPhone && `📞 ${client.clientPhone} • `}
            👤 {client.sellers.join(", ")}
          </div>
        </div>
        <button
          className="cartera-back-btn"
          onClick={() => navigate("/cartera")}
        >
          ← Volver
        </button>
      </div>

      {/* RESUMEN */}
      <div className="cartera-section">
        <h3>
          <Icons.Money size={18} /> Resumen
        </h3>
        <div className="cartera-client-summary">
          <div className="cartera-client-summary-item">
            <span className="cartera-client-summary-label">Total original</span>
            <span className="cartera-client-summary-value">
              ${client.totalOriginal.toLocaleString()}
            </span>
          </div>
          <div className="cartera-client-summary-item">
            <span className="cartera-client-summary-label">Total pagado</span>
            <span className="cartera-client-summary-value success">
              ${client.totalPaid.toLocaleString()}
            </span>
          </div>
          <div className="cartera-client-summary-item">
            <span className="cartera-client-summary-label">
              Saldo pendiente
            </span>
            <span className="cartera-client-summary-value danger">
              ${client.totalBalance.toLocaleString()}
            </span>
          </div>
          <div className="cartera-client-summary-item">
            <span className="cartera-client-summary-label">Vencido</span>
            <span className="cartera-client-summary-value danger">
              ${client.overdueAmount.toLocaleString()}
            </span>
          </div>
          <div className="cartera-client-summary-item">
            <span className="cartera-client-summary-label">
              Deuda más antigua
            </span>
            <span className="cartera-client-summary-value">
              {client.oldestDays} días
            </span>
          </div>
        </div>
      </div>

      {/* BOTÓN REGISTRAR ABONO */}
      {client.totalBalance > 0 && (
        <div className="cartera-section">
          <button
            className="cartera-btn cartera-btn-success cartera-btn-big"
            onClick={() => openPaymentModal()}
          >
            <Icons.Money size={20} /> Registrar abono
          </button>
        </div>
      )}

      {/* LISTA DE CUENTAS POR COBRAR */}
      <div className="cartera-section">
        <h3>
          <Icons.Package size={18} /> Cuentas por cobrar (
          {client.receivables.length})
        </h3>
        <div className="cartera-receivables-list">
          {client.receivables
            .sort((a, b) => {
              const da = a.createdAt?.toDate
                ? a.createdAt.toDate()
                : new Date(a.createdAt);
              const db_ = b.createdAt?.toDate
                ? b.createdAt.toDate()
                : new Date(b.createdAt);
              return db_ - da;
            })
            .map((rec) => {
              const isPaid = rec.balance <= 0;
              const info = getStatusInfo(rec);
              return (
                <div
                  key={rec.id}
                  className={`cartera-receivable-card ${isPaid ? "paid" : ""} ${
                    !isPaid && info.label.includes("Vencido") ? "overdue" : ""
                  }`}
                >
                  <div className="cartera-receivable-header">
                    <span className="cartera-receivable-order">
                      Pedido #{rec.orderNumericId || "—"}
                    </span>
                    <span
                      className="cartera-badge"
                      style={{
                        background: info.bg,
                        color: info.color,
                      }}
                    >
                      {info.label}
                    </span>
                  </div>

                  <div className="cartera-receivable-amounts">
                    <span>📅 {rec.orderDate}</span>
                    <span>👤 {rec.sellerName}</span>
                    <span>
                      🏷️{" "}
                      {rec.origin === "gerencia"
                        ? "Crédito gerencia"
                        : "Crédito vendedor"}
                    </span>
                  </div>

                  <div className="cartera-receivable-amounts">
                    <span>
                      Original:{" "}
                      <strong>
                        ${(rec.totalOriginal || 0).toLocaleString()}
                      </strong>
                    </span>
                    <span>
                      Pagado:{" "}
                      <strong>${(rec.totalPaid || 0).toLocaleString()}</strong>
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "8px",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className={`cartera-receivable-balance ${
                        isPaid ? "paid" : ""
                      }`}
                    >
                      {isPaid
                        ? "✅ Pagado"
                        : `Saldo: $${rec.balance.toLocaleString()}`}
                    </span>
                    {!isPaid && (
                      <button
                        className="cartera-btn cartera-btn-primary"
                        style={{ padding: "8px 16px", fontSize: "12px" }}
                        onClick={() => openPaymentModal(rec.id)}
                      >
                        Abonar
                      </button>
                    )}
                  </div>

                  {rec.paymentHistory && rec.paymentHistory.length > 0 && (
                    <details style={{ marginTop: "10px" }}>
                      <summary
                        style={{
                          fontSize: "12px",
                          color: "#2563eb",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Historial de abonos ({rec.paymentHistory.length})
                      </summary>
                      <div style={{ marginTop: "8px" }}>
                        {rec.paymentHistory.map((p, i) => (
                          <div key={i} className="cartera-payment-row">
                            <span>
                              💵 {p.method} — {p.receivedBy}
                              {p.notes && ` • ${p.notes}`}
                            </span>
                            <span className="cartera-payment-amount">
                              ${(p.amount || 0).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* MODAL ABONO */}
      {showPaymentModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowPaymentModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              <Icons.Money size={18} /> Registrar abono
            </h3>

            <div className="modal-field">
              <label>Tipo de abono</label>
              <select
                value={paymentMode}
                onChange={(e) => {
                  setPaymentMode(e.target.value);
                  if (e.target.value === "fifo") {
                    setAmount(String(client.totalBalance));
                  }
                }}
              >
                <option value="fifo">
                  FIFO (aplicar al pedido más antiguo)
                </option>
                <option value="specific">A un pedido específico</option>
              </select>
            </div>

            {paymentMode === "specific" && (
              <div className="modal-field">
                <label>Pedido</label>
                <select
                  value={selectedReceivableId}
                  onChange={(e) => {
                    setSelectedReceivableId(e.target.value);
                    const rec = client.receivables.find(
                      (r) => r.id === e.target.value,
                    );
                    if (rec) setAmount(String(rec.balance));
                  }}
                >
                  <option value="">Seleccionar</option>
                  {client.receivables
                    .filter((r) => r.balance > 0)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        #{r.orderNumericId} — ${r.balance.toLocaleString()}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="modal-field">
              <label>Monto a abonar</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                min="1"
              />
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                Saldo total del cliente: ${client.totalBalance.toLocaleString()}
              </span>
            </div>

            <div className="modal-field">
              <label>Método de pago</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="efectivo">Efectivo</option>
                <option value="nequi">Nequi</option>
                <option value="llave">Llave</option>
                <option value="transferencia">Transferencia</option>
                <option value="otros">Otros</option>
              </select>
            </div>

            <div className="modal-field">
              <label>Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Abono parcial acordado con el cliente"
              />
            </div>

            <div className="modal-buttons">
              <button
                className="cartera-btn cartera-btn-secondary"
                onClick={() => setShowPaymentModal(false)}
                disabled={processing}
              >
                Cancelar
              </button>
              <button
                className="cartera-btn cartera-btn-success"
                onClick={handlePayment}
                disabled={processing || !amount}
              >
                {processing ? "Procesando..." : "Registrar abono"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
