import { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { OrderContext } from "../../context/OrderContext";
import { AssignmentContext } from "../../context/AssignmentContext";
import { CashClosingContext } from "../../context/CashClosingContext";
import { useToast } from "../../context/ToastContext";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./jornada.css";

export default function CloseJourney() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { orders } = useContext(OrderContext);
  const { dailyLoads } = useContext(AssignmentContext);
  const { computeClosingPreview, createClosing, hasClosedToday } =
    useContext(CashClosingContext);
  const { addToast } = useToast();

  const [step, setStep] = useState(1);
  const [cashDelivered, setCashDelivered] = useState("");
  const [differenceReason, setDifferenceReason] = useState("");
  const [sellerNotes, setSellerNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ==========================================
  // Calcular preview del cuadre
  // ==========================================
  const preview = useMemo(() => {
    if (!user) return null;
    return computeClosingPreview(user, orders, dailyLoads);
  }, [user, orders, dailyLoads, computeClosingPreview]);

  // Si ya cerró hoy → redirigir
  if (hasClosedToday(user?.id)) {
    return (
      <div className="jornada-page">
        <div className="jornada-alert jornada-alert-success">
          <Icons.Check size={20} />
          <div>
            <strong>Ya cerraste tu jornada de hoy.</strong>
            <p style={{ margin: "4px 0 0 0" }}>
              Puedes ver tus cuadres anteriores en el historial.
            </p>
          </div>
        </div>
        <button
          className="jornada-btn jornada-btn-primary"
          onClick={() => navigate("/mis-cuadres")}
        >
          Ver mis cuadres
        </button>
      </div>
    );
  }

  // Sin pedidos → no se puede cerrar
  if (!preview || preview.ordersCount === 0) {
    return (
      <div className="jornada-page">
        <h1>Cerrar Jornada</h1>
        <EmptyState
          icon={<Icons.Info size={32} />}
          title="Sin pedidos para cerrar"
          description="No tienes pedidos entregados hoy. No hay nada que cuadrar todavía."
        />
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <button
            className="jornada-btn jornada-btn-secondary"
            onClick={() => navigate("/mi-jornada")}
          >
            ← Volver a mi jornada
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // Diferencia de dinero
  // ==========================================
  const delivered = Number(cashDelivered) || 0;
  const difference = delivered - preview.cashExpected;
  const hasDifference = difference !== 0;
  const isSurplus = difference > 0;
  const isShortage = difference < 0;

  // ==========================================
  // Navegación entre pasos
  // ==========================================
  const goNext = () => {
    if (step === 2) {
      // Validar si hay diferencia → requiere comentario
      if (hasDifference && !differenceReason.trim()) {
        addToast("Debes explicar la diferencia antes de continuar", "error");
        return;
      }
    }
    setStep(step + 1);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    const result = await createClosing(
      preview,
      user,
      delivered,
      sellerNotes,
      differenceReason,
    );

    setSubmitting(false);

    if (result) {
      addToast("✅ Cuadre enviado. La contadora lo revisará.", "success");
      navigate("/mi-jornada");
    } else {
      addToast("❌ Error al enviar el cuadre", "error");
    }
  };

  return (
    <div className="jornada-page">
      <h1>🔒 Cerrar Jornada</h1>

      {/* ==========================================
          INDICADOR DE PASOS
          ========================================== */}
      <div className="wizard-steps">
        <div
          className={`wizard-step ${step === 1 ? "active" : step > 1 ? "done" : ""}`}
        >
          1. Productos
        </div>
        <div
          className={`wizard-step ${step === 2 ? "active" : step > 2 ? "done" : ""}`}
        >
          2. Dinero
        </div>
        <div className={`wizard-step ${step === 3 ? "active" : ""}`}>
          3. Confirmar
        </div>
      </div>

      {/* ==========================================
          PASO 1 — PRODUCTOS
          ========================================== */}
      {step === 1 && (
        <div className="jornada-section">
          <h3>
            <Icons.Package size={18} /> Comparación de productos
          </h3>

          {preview.products.length === 0 ? (
            <EmptyState
              icon={<Icons.Package size={32} />}
              title="Sin productos"
              description="No hay productos registrados en tu tablero ni en tus pedidos de hoy."
            />
          ) : (
            <table className="jornada-table">
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
                {preview.products.map((p) => {
                  const ok = p.difference === 0;
                  return (
                    <tr key={p.productId}>
                      <td>{p.name}</td>
                      <td>{p.assignedQty}</td>
                      <td>{p.soldQty}</td>
                      <td>{p.returnedQty}</td>
                      <td className={ok ? "jornada-ok" : "jornada-danger"}>
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

          {!preview.productsValid && (
            <div
              className="jornada-alert jornada-alert-warning"
              style={{ marginTop: "16px" }}
            >
              <Icons.Warning size={20} />
              <div>
                <strong>⚠️ Hay diferencias en los productos.</strong>
                <p style={{ margin: "4px 0 0 0" }}>
                  Puedes continuar, pero la contadora verá estas diferencias al
                  revisar tu cuadre.
                </p>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
            <button
              className="jornada-btn jornada-btn-secondary"
              onClick={() => navigate("/mi-jornada")}
              style={{ flex: 1 }}
            >
              ← Cancelar
            </button>
            <button
              className="jornada-btn jornada-btn-primary"
              onClick={goNext}
              style={{ flex: 1 }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* ==========================================
          PASO 2 — DINERO
          ========================================== */}
      {step === 2 && (
        <div className="jornada-section">
          <h3>
            <Icons.Money size={18} /> Cuadre de dinero
          </h3>

          <div className="jornada-money-list" style={{ marginBottom: "20px" }}>
            <div className="jornada-money-row">
              <span>💵 Efectivo esperado</span>
              <strong>${preview.cashExpected.toLocaleString()}</strong>
            </div>
            <div className="jornada-money-row">
              <span>📱 Nequi / Llave / Transferencia</span>
              <strong>${preview.transferExpected.toLocaleString()}</strong>
            </div>
            <div className="jornada-money-row">
              <span>💳 Créditos (no entra dinero)</span>
              <strong>
                ${(preview.creditSeller + preview.creditBoss).toLocaleString()}
              </strong>
            </div>
          </div>

          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: 700,
              marginBottom: "8px",
              color: "#1e293b",
            }}
          >
            ¿Cuánto efectivo entregas físicamente?
          </label>
          <input
            type="number"
            value={cashDelivered}
            onChange={(e) => setCashDelivered(e.target.value)}
            placeholder="0"
            className="jornada-input jornada-input-big"
            min={0}
          />

          {/* Diferencia */}
          {cashDelivered !== "" && (
            <>
              {difference === 0 && (
                <div className="jornada-difference zero">
                  <div className="jornada-difference-icon">✅</div>
                  <div className="jornada-difference-content">
                    <strong>Cuadre exacto</strong>
                    <p>El efectivo entregado coincide con lo esperado.</p>
                  </div>
                </div>
              )}

              {isSurplus && (
                <div className="jornada-difference positive">
                  <div className="jornada-difference-icon">💡</div>
                  <div className="jornada-difference-content">
                    <strong>Sobra ${difference.toLocaleString()}</strong>
                    <p>
                      Estás entregando más de lo esperado. Esto suele pasar
                      cuando un cliente pagó un crédito anterior. Verifica tus
                      créditos antes de continuar y explica el motivo abajo.
                    </p>
                  </div>
                </div>
              )}

              {isShortage && (
                <div className="jornada-difference negative">
                  <div className="jornada-difference-icon">⚠️</div>
                  <div className="jornada-difference-content">
                    <strong>
                      Falta ${Math.abs(difference).toLocaleString()}
                    </strong>
                    <p>
                      Estás entregando menos de lo esperado. Revisa que todos
                      los pedidos en efectivo estén marcados como pagados.
                      Explica el motivo abajo.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Comentario obligatorio si hay diferencia */}
          {hasDifference && (
            <div style={{ marginTop: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 700,
                  marginBottom: "8px",
                  color: "#1e293b",
                }}
              >
                Explica la diferencia *
              </label>
              <textarea
                value={differenceReason}
                onChange={(e) => setDifferenceReason(e.target.value)}
                placeholder="Ej: El cliente Juan Perez pagó un crédito de $5.000"
                className="jornada-input"
                required
              />
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
            <button
              className="jornada-btn jornada-btn-secondary"
              onClick={goBack}
              style={{ flex: 1 }}
            >
              ← Atrás
            </button>
            <button
              className="jornada-btn jornada-btn-primary"
              onClick={goNext}
              disabled={
                cashDelivered === "" ||
                (hasDifference && !differenceReason.trim())
              }
              style={{ flex: 1 }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* ==========================================
          PASO 3 — CONFIRMAR
          ========================================== */}
      {step === 3 && (
        <div className="jornada-section">
          <h3>
            <Icons.Check size={18} /> Confirmar cuadre
          </h3>

          <div className="jornada-money-list" style={{ marginBottom: "20px" }}>
            <div className="jornada-money-row">
              <span>📦 Productos vendidos</span>
              <strong>
                {preview.products.reduce((a, p) => a + p.soldQty, 0)} unidades
              </strong>
            </div>
            <div className="jornada-money-row">
              <span>🛒 Pedidos entregados</span>
              <strong>{preview.ordersCount}</strong>
            </div>
            <div className="jornada-money-row">
              <span>💵 Efectivo esperado</span>
              <strong>${preview.cashExpected.toLocaleString()}</strong>
            </div>
            <div className="jornada-money-row">
              <span>💵 Efectivo a entregar</span>
              <strong>${delivered.toLocaleString()}</strong>
            </div>
            <div className="jornada-money-row">
              <span>📊 Diferencia</span>
              <strong
                style={{ color: difference === 0 ? "#16a34a" : "#ef4444" }}
              >
                {difference === 0
                  ? "✅ Exacto"
                  : `$${difference.toLocaleString()}`}
              </strong>
            </div>
            <div className="jornada-money-row">
              <span>💳 Créditos generados</span>
              <strong>
                ${(preview.creditSeller + preview.creditBoss).toLocaleString()}
              </strong>
            </div>
            <div className="jornada-money-total">
              <span>Total del día</span>
              <strong>${preview.totalSales.toLocaleString()}</strong>
            </div>
          </div>

          {/* Comentario general opcional */}
          <div style={{ marginTop: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 700,
                marginBottom: "8px",
                color: "#1e293b",
              }}
            >
              Comentario general (opcional)
            </label>
            <textarea
              value={sellerNotes}
              onChange={(e) => setSellerNotes(e.target.value)}
              placeholder="Cualquier observación que quieras dejarle a la contadora"
              className="jornada-input"
            />
          </div>

          <div
            className="jornada-alert jornada-alert-info"
            style={{ marginTop: "20px" }}
          >
            <Icons.Info size={20} />
            <div>
              <strong>Una vez envíes el cuadre, no podrás modificarlo.</strong>
              <p style={{ margin: "4px 0 0 0" }}>
                La contadora lo revisará y te notificará si está aprobado o
                requiere ajustes.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
            <button
              className="jornada-btn jornada-btn-secondary"
              onClick={goBack}
              disabled={submitting}
              style={{ flex: 1 }}
            >
              ← Atrás
            </button>
            <button
              className="jornada-btn jornada-btn-success"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ flex: 2 }}
            >
              {submitting ? "Enviando..." : "✅ Confirmar y enviar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
