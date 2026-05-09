import { useState, useContext, useEffect } from "react"; // 👈 useContext y useEffect añadidos aquí
import Sidebar from "../sidebar/Sidebar";
import NotificationBell from "../notificationBell/NotificationBell";
import { AuthContext } from "../../context/AuthContext"; // 👈 Importamos el contexto
import { useLocationTracker } from "../../hooks/useLocationTracker"; // 👈 Importamos el hook del mapa
import "./Layout.css";

export default function Layout({ children }) {
  const { user } = useContext(AuthContext); // 👈 Obtenemos el usuario logueado
  const [open, setOpen] = useState(false);

  // 👇 Esto hace que, si el usuario es vendedor, mande su ubicación GPS al Dashboard del Admin
  useLocationTracker(user);

  return (
    <div className="layout-container">
      {/* Overlay oscuro al abrir el menú en celular */}
      {open && <div className="layout-overlay" onClick={() => setOpen(false)} />}
      
      {/* Menú Lateral (Sidebar) con animación de deslizamiento */}
      <div className={`layout-sidebar ${open ? "open" : ""}`}>
        <Sidebar closeSidebar={() => setOpen(false)} />
      </div>

      {/* Contenido Principal */}
      <div className="layout-main">
        {/* Barra Superior (Header) */}
        <div className="layout-header">
          <button onClick={() => setOpen(!open)} className="layout-hamburger-btn">
            ☰
          </button>
          <h3 className="layout-header-title">Panel de Control</h3>
          <div className="layout-header-right">
            <NotificationBell />
          </div>
        </div>

        {/* Área de Scroll donde se renderizan las páginas (children) */}
        <div className="layout-scroll-area">
          <div className="layout-content">{children}</div>
        </div>
      </div>
    </div>
  );
}