import { createContext, useState, useContext } from "react";

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Contenedor de los toasts - CAMBIADO A ARRIBA A LA DERECHA */}
      <div style={{
        position: "fixed", 
        top: "20px",       // 👈 ANTES ERA bottom: "20px"
        right: "20px", 
        zIndex: 9999,
        display: "flex", 
        flexDirection: "column", 
        gap: "10px"
      }}>
        {toasts.map((toast) => (
          <div key={toast.id} style={{
            padding: "14px 20px", 
            borderRadius: "12px", 
            color: "#fff",
            fontFamily: "inherit", 
            fontWeight: 600, 
            fontSize: "14px",
            boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
            animation: "slideDown 0.3s ease-out", // 👈 CAMBIAMOS LA ANIMACIÓN
            backgroundColor: toast.type === "success" ? "#16a34a" : toast.type === "error" ? "#ef4444" : "#2563eb"
          }}>
            {toast.message}
          </div>
        ))}
      </div>
      {/* ANIMACIÓN CAMBIADA PARA QUE BAJE DESDE ARRIBA */}
      <style>{`
        @keyframes slideDown { 
          from { transform: translateY(-100%); opacity: 0; } 
          to { transform: translateY(0); opacity: 1; } 
        }
      `}</style>
    </ToastContext.Provider>
  );
}