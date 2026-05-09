import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import './Header.css'; // <-- Importamos los estilos

export default function Header() {
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="header">
      <h3>Panel</h3>

      <div>
        <span className="header-user">
          {user?.name} ({user?.role})
        </span>

        <button onClick={logout} className="header-btn">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}