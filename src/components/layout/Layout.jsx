import { useState, useContext } from "react";
import Sidebar from "../sidebar/Sidebar";
import NotificationBell from "../notificationBell/NotificationBell";
import { AuthContext } from "../../context/AuthContext";
import "./Layout.css";

export default function Layout({ children }) {
  const { user } = useContext(AuthContext);
  const [open, setOpen] = useState(false);

  return (
    <div className="layout-container">
      {open && <div className="layout-overlay" onClick={() => setOpen(false)} />}

      <div className={`layout-sidebar ${open ? "open" : ""}`}>
        <Sidebar closeSidebar={() => setOpen(false)} />
      </div>

      <div className="layout-main">
        <div className="layout-header">
          <button onClick={() => setOpen(!open)} className="layout-hamburger-btn">
            ☰
          </button>
          <h3 className="layout-header-title">Panel de Control</h3>
          <div className="layout-header-right">
            <NotificationBell />
          </div>
        </div>

        <div className="layout-scroll-area">
          <div className="layout-content">{children}</div>
        </div>
      </div>
    </div>
  );
}