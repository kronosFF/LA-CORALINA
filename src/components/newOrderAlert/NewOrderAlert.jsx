import { useEffect, useState } from "react";
import './NewOrderAlert.css'; // <-- Importamos el CSS

export default function NewOrderAlert({ visible, onClose, lastOrder }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const i = setInterval(() => setPulse((p) => !p), 600);
    return () => clearInterval(i);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="alert-overlay">
      {/* Si pulse es true, se le añade la clase "pulse", si no, queda vacío */}
      <div className={`alert-box ${pulse ? "pulse" : ""}`}>
        <h3 className="alert-title">🆕 Nuevo pedido</h3>
        <p><strong>Cliente:</strong> {lastOrder?.clientData?.name}</p>
        <p><strong>Total:</strong> ${lastOrder?.total}</p>

        <button className="alert-btn" onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>
  );
}