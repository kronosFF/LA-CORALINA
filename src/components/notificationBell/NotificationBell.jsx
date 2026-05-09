import { useState, useContext, useEffect, useRef } from "react";
import { AuthContext } from "../../context/AuthContext";
import './NotificationBell.css'; // <-- Importamos el CSS

export default function NotificationBell() {
  const { user, notifications, unreadCount, markNotificationAsRead } = useContext(AuthContext);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Solo visible para vendedores
  if (user?.role !== "vendedor") return null;

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (notifId) => {
    await markNotificationAsRead(user.id, notifId);
  };

  const formatDate = (date) => {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleString();
  };

  return (
    <div className="bell-container" ref={dropdownRef}>
      <button className="bell-button" onClick={() => setIsOpen(!isOpen)}>
        🔔
        {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="bell-dropdown">
          <div className="bell-dropdown-header">
            <strong>Notificaciones</strong>
            {unreadCount > 0 && <span className="bell-unread-badge">{unreadCount} no leídas</span>}
          </div>
          <div className="bell-dropdown-list">
            {notifications.length === 0 ? (
              <p className="bell-empty-state">No hay notificaciones</p>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`bell-notification-item ${!notif.read ? "unread" : ""}`}
                  onClick={() => handleNotificationClick(notif.id)}
                >
                  <div className="bell-notification-title">{notif.title}</div>
                  <div className="bell-notification-message">{notif.message}</div>
                  <div className="bell-notification-date">{formatDate(notif.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}