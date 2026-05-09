import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import logo from "../../assets/logoCoralina.png";
import './Sidebar.css'; // <-- Importamos el CSS

export default function Sidebar({ closeSidebar }) {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);

  const go = (path) => {
    navigate(path);
    if (closeSidebar) closeSidebar();
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
    if (closeSidebar) closeSidebar();
  };

  const isAdminOrPlanta = user?.role === "admin" || user?.role === "planta";
  const isVendedor = user?.role === "vendedor";

  return (
    <div className="sidebar">
      <div className="sidebar-inner">
        {/* LOGO */}
        <div className="sidebar-logo-container">
          <img src={logo} alt="La Coralina" className="sidebar-logo-image" />
          <h2 className="sidebar-logo-text">Coralina</h2>
          <p className="sidebar-user-info">
            {user?.name} ({user?.role})
          </p>
        </div>

        {/* NAVEGACIÓN */}
        <nav className="sidebar-nav">
          <button className="sidebar-nav-btn" onClick={() => go("/")}>
            📊 Dashboard
          </button>

          <button className="sidebar-nav-btn" onClick={() => go("/pedidos")}>
            📦 Pedidos
          </button>

          <button className="sidebar-nav-btn" onClick={() => go("/crear")}>
            ➕ Crear Pedido
          </button>

          {/* Gastos - solo para vendedores */}
          {isVendedor && (
            <button className="sidebar-nav-btn" onClick={() => go("/gastos")}>
              💰 Mis Gastos
            </button>
          )}

          {/* Solo para admin y planta */}
          {isAdminOrPlanta && (
            <>
              <button className="sidebar-nav-btn" onClick={() => go("/productos")}>
                🏷️ Productos
              </button>

              <button className="sidebar-nav-btn" onClick={() => go("/clientes")}>
                👥 Clientes
              </button>

              <button className="sidebar-nav-btn" onClick={() => go("/stock")}>
                🏭 Stock
              </button>

              <button className="sidebar-nav-btn" onClick={() => go("/usuarios")}>
                👤 Usuarios
              </button>
            </>
          )}
        </nav>

        {/* LOGOUT */}
        <div className="sidebar-logout-container">
          <button onClick={handleLogout} className="sidebar-logout-btn">
            🚪 Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}