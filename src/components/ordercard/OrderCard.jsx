import { useContext, useState } from "react";
import { OrderContext } from "../../context/OrderContext";
import { AuthContext } from "../../context/AuthContext";
import { ProductContext } from "../../context/ProductContext";
import { useElapsedTime, formatTime, getStatusColor } from "../../hooks/useElapsedTime";
import './OrderCard.css'; // <-- Asegúrate de que la ruta sea correcta

export default function OrderCard({ order }) {
  const { updateStatus, cancelOrder, registerPayment, getPaymentsByOrder } = useContext(OrderContext);
  const { user } = useContext(AuthContext);
  const productContext = useContext(ProductContext);
  const [busy, setBusy] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentComment, setPaymentComment] = useState("");
  const [paymentProof, setPaymentProof] = useState(null);
  const [paymentProofName, setPaymentProofName] = useState("");
  const [paymentProofPreview, setPaymentProofPreview] = useState(null);

  const displayId = order.numericId || order.id.slice(-6);
  const remainingDebt = (order.total || 0) - (order.totalPaid || 0);
  const paymentsHistory = getPaymentsByOrder(order.id);

  const getCurrentTimestamp = () => {
    const status = order.status;
    let timestamp = null;

    if (status === "preparacion" && order.timestamps?.preparacion) {
      timestamp = order.timestamps.preparacion;
    } else if (status === "reparto" && order.timestamps?.reparto) {
      timestamp = order.timestamps.reparto;
    } else if (status === "entregado" && order.timestamps?.entregado) {
      timestamp = order.timestamps.entregado;
    }

    if (timestamp && timestamp.toDate) {
      return timestamp.toDate();
    }
    return timestamp ? new Date(timestamp) : null;
  };

  const startTime = getCurrentTimestamp();
  const elapsedSeconds = useElapsedTime(startTime);
  const elapsedFormatted = formatTime(elapsedSeconds);

  const getLimit = () => {
    if (order.status === "preparacion") {
      return order.clientData?.prepMinutes || 15;
    }
    if (order.status === "reparto") {
      return order.clientData?.deliveryMinutes || 30;
    }
    return null;
  };

  const limitMinutes = getLimit();
  const statusColor = limitMinutes ? getStatusColor(elapsedSeconds, limitMinutes) : "#64748b";
  const percentRemaining = limitMinutes
    ? Math.min(100, (elapsedSeconds / (limitMinutes * 60)) * 100)
    : 0;

  const go = (next) => {
    if (busy) return;
    setBusy(true);
    updateStatus(order.id, next, user.role);
    setTimeout(() => setBusy(false), 350);
  };

  const handleCancel = () => {
    if (busy) return;
    if (confirm(`¿Cancelar pedido #${displayId}? Se devolverá el stock.`)) {
      setBusy(true);
      cancelOrder(order.id, user, productContext);
      setTimeout(() => setBusy(false), 350);
    }
  };

  const handlePaymentProofUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPaymentProofName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentProof(reader.result);
        setPaymentProofPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegisterPayment = async () => {
    if (!paymentAmount || paymentAmount <= 0) {
      alert("❌ Ingresa un monto válido");
      return;
    }
    if (paymentAmount > remainingDebt) {
      alert(`❌ El monto no puede superar el saldo pendiente ($${remainingDebt.toLocaleString()})`);
      return;
    }
    if (!paymentMethod) {
      alert("❌ Selecciona un método de pago");
      return;
    }

    setBusy(true);
    await registerPayment(order.id, Number(paymentAmount), paymentMethod, paymentProof, paymentComment);
    setBusy(false);
    setShowPaymentModal(false);
    setPaymentAmount("");
    setPaymentMethod("");
    setPaymentComment("");
    setPaymentProof(null);
    setPaymentProofName("");
    setPaymentProofPreview(null);
  };

  const paymentMethods = [
    { value: "efectivo", label: "💵 Efectivo" },
    { value: "nequi", label: "📱 Nequi" },
    { value: "llave", label: "🔑 Llave" },
    { value: "transferencia", label: "🏦 Transferencia" },
    { value: "otros", label: "📌 Otros" },
  ];

  const getPaymentMethodLabel = (method) => {
    const methods = {
      efectivo: "💵 Efectivo",
      nequi: "📱 Nequi",
      llave: "🔑 Llave",
      transferencia: "🏦 Transferencia",
      otros: "📌 Otros",
      credito_empresa: "🏢 Crédito empresa",
      credito_vendedor: "👤 Crédito vendedor",
    };
    return methods[method] || method;
  };

  return (
    <>
      <div className="order-card">
        <div onClick={() => setShowProducts(!showProducts)}>
          <div className="card-header">
            <h3>Pedido #{displayId}</h3>
            <span className="chevron">{showProducts ? "▲" : "▼"}</span>
          </div>

          <p><strong>Cliente:</strong> {order.clientData?.name}</p>
          <p><strong>Teléfono:</strong> {order.clientData?.phone}</p>
          <p><strong>Dirección:</strong> {order.clientData?.address}</p>
          {order.clientData?.location && <p><strong>📍 Ubicación:</strong> {order.clientData.location}</p>}
          {order.clientData?.notes && <p><strong>📝 Notas:</strong> {order.clientData.notes}</p>}
          <p><strong>Vendedor:</strong> {order.sellerName}</p>
          <p><strong>Total:</strong> ${order.total?.toLocaleString()}</p>
          <p><strong>⏰ Tiempo de entrega:</strong> {order.clientData?.deliveryHours || 2} horas</p>

          <div className="payment-status-container">
            <span>💰 {getPaymentMethodLabel(order.paymentMethod)}</span>
            {order.paymentStatus === "pagado" && <span className="badge badge-paid">✅ Pagado</span>}
            {order.paymentStatus === "credito" && <span className="badge badge-credit">⏳ Crédito - Debe: ${remainingDebt.toLocaleString()}</span>}
            {order.paymentStatus === "pendiente" && <span className="badge badge-pending">⏳ Pendiente</span>}
            {order.creditType && <span> • {order.creditType === "empresa" ? "🏢 Crédito empresa" : "👤 Crédito vendedor"}</span>}
          </div>

          {paymentsHistory.length > 0 && (
            <details className="payments-details">
              <summary className="payments-summary">📋 Historial de abonos ({paymentsHistory.length})</summary>
              {paymentsHistory.map(p => (
                <div key={p.id} className="payment-history-item">
                  <span>💰 ${p.amount.toLocaleString()}</span>
                  <span>{getPaymentMethodLabel(p.paymentMethod)}</span>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>{p.date?.toDate?.().toLocaleString() || new Date(p.date).toLocaleString()}</span>
                </div>
              ))}
            </details>
          )}

          <div className="timer-container">
            <div className="timer-header">
              <span style={{ fontWeight: "bold", color: statusColor }}>
                ⏱️ {order.status === "preparacion" && "En preparación:"}
                {order.status === "reparto" && "En reparto:"}
                {order.status === "entregado" && "Entregado:"}
              </span>
              <span style={{ fontWeight: "bold", color: statusColor }}>
                {order.status === "entregado" ? "✅ Completado" : elapsedFormatted}
              </span>
            </div>

            {order.status !== "entregado" && limitMinutes && (
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.min(100, percentRemaining)}%`,
                    backgroundColor: statusColor,
                  }}
                />
              </div>
            )}

            {order.status !== "entregado" && elapsedSeconds >= (limitMinutes * 60) && (
              <div className="warning-text">
                ⚠️ Tiempo límite superado
              </div>
            )}
          </div>
        </div>

        {showProducts && (
          <div className="products-container">
            <h4 className="products-title">📦 Productos del pedido:</h4>
            {order.items && order.items.length > 0 ? (
              order.items.map((item, idx) => (
                <div key={idx} className="product-item">
                  <span>{item.name}</span>
                  <span>Cantidad: {item.qty}</span>
                  <span>${(item.price * item.qty).toLocaleString()}</span>
                </div>
              ))
            ) : (
              <p style={{ color: "#64748b" }}>No hay productos registrados</p>
            )}
            <div className="product-total">
              <strong>Total: ${order.total?.toLocaleString()}</strong>
            </div>
          </div>
        )}

        <div className="actions-container">
          {order.status === "preparacion" && (
            <button
              className="btn-base"
              style={{ background: "#2563eb", color: "#fff" }}
              disabled={busy}
              onClick={() => go("reparto")}
            >
              🚚 A reparto
            </button>
          )}

          {order.status === "reparto" && (
            <button
              className="btn-base"
              style={{ background: "#16a34a", color: "#fff" }}
              disabled={busy}
              onClick={() => go("entregado")}
            >
              ✅ Entregado
            </button>
          )}

          {(order.paymentStatus === "credito" || order.paymentStatus === "pendiente") && (
            <button
              className="btn-base"
              style={{ background: "#8b5cf6", color: "#fff" }}
              disabled={busy}
              onClick={() => setShowPaymentModal(true)}
            >
              💰 {order.paymentStatus === "credito" ? `Abonar (debe: $${remainingDebt.toLocaleString()})` : "Registrar pago"}
            </button>
          )}

          {user.role !== "vendedor" && order.status === "reparto" && (
            <button
              className="btn-base"
              style={{ background: "#94a3b8", color: "#fff" }}
              disabled={busy}
              onClick={() => go("preparacion")}
            >
              ⬅ Volver a preparación
            </button>
          )}

          {user.role !== "vendedor" && order.status === "entregado" && (
            <button
              className="btn-base"
              style={{ background: "#94a3b8", color: "#fff" }}
              disabled={busy}
              onClick={() => go("reparto")}
            >
              ⬅ Volver a reparto
            </button>
          )}

          {user.role !== "vendedor" && order.status !== "entregado" && (
            <button
              className="btn-base"
              style={{ background: "#dc2626", color: "#fff" }}
              disabled={busy}
              onClick={handleCancel}
            >
              ❌ Cancelar pedido
            </button>
          )}
        </div>
      </div>

      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">💰 {order.paymentStatus === "credito" ? "Registrar abono" : "Registrar pago"}</h3>

            <div className="debt-info">
              <strong>Total del pedido:</strong> ${order.total?.toLocaleString()}<br />
              <strong>Pagado hasta ahora:</strong> ${(order.totalPaid || 0).toLocaleString()}<br />
              <strong>Saldo pendiente:</strong> <span style={{ color: "#ef4444" }}>${remainingDebt.toLocaleString()}</span>
            </div>

            <div className="form-group">
              <label className="form-label">💰 Monto a pagar</label>
              <input
                type="number"
                placeholder="Ingresa el monto"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="form-input"
                min="1"
                max={remainingDebt}
              />
            </div>

            <div className="form-group">
              <label className="form-label">💳 Método de pago</label>
              <div className="payment-methods-grid">
                {paymentMethods.map((method) => (
                  <div
                    key={method.value}
                    className={`payment-method-item ${paymentMethod === method.value ? "selected" : ""}`}
                    onClick={() => setPaymentMethod(method.value)}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.value}
                      checked={paymentMethod === method.value}
                      onChange={() => { }}
                    />
                    <span>{method.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {(paymentMethod === "nequi" || paymentMethod === "llave" || paymentMethod === "transferencia") && (
              <div className="file-upload-container">
                <div className="file-upload-wrapper">
                  <label className="file-upload-label">
                    📎 Subir comprobante
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePaymentProofUpload}
                      className="file-input-hidden"
                    />
                  </label>
                  {paymentProofName && <span className="file-name">{paymentProofName}</span>}
                </div>
                {paymentProofPreview && (
                  <div className="preview-container">
                    <img src={paymentProofPreview} alt="Preview" className="preview-image" />
                    <button onClick={() => { setPaymentProof(null); setPaymentProofName(""); setPaymentProofPreview(null); }} className="btn-remove">✖</button>
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">📝 Comentario (opcional)</label>
              <textarea
                placeholder="Ej: Abono por $50,000, queda pendiente $30,000"
                value={paymentComment}
                onChange={(e) => setPaymentComment(e.target.value)}
                className="form-input textarea"
              />
            </div>

            <div className="modal-buttons">
              <button onClick={handleRegisterPayment} className="btn-save" disabled={busy}>
                {busy ? "Procesando..." : "Registrar pago"}
              </button>
              <button onClick={() => setShowPaymentModal(false)} className="btn-cancel">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}