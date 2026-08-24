import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import Icons from "../icons/Icons"; // 🆕 Importamos el componente central
import logo from "../../assets/logoCoralina.png";
import './Sidebar.css';

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
            <Icons.Dashboard />
            Dashboard
          </button>

          <button className="sidebar-nav-btn" onClick={() => go("/pedidos")}>
            <Icons.Orders />
            Pedidos
          </button>

          <button className="sidebar-nav-btn" onClick={() => go("/crear")}>
            <Icons.CreateOrder />
            Crear Pedido
          </button>

          {/* Gastos - solo para vendedores */}
          {isVendedor && (
            <button className="sidebar-nav-btn" onClick={() => go("/gastos")}>
              <Icons.Expenses />
              Mis Gastos
            </button>
          )}

          {/* Solo para admin y planta */}
          {isAdminOrPlanta && (
            <>
              <button className="sidebar-nav-btn" onClick={() => go("/productos")}>
                <Icons.Products />
                Productos
              </button>

              <button className="sidebar-nav-btn" onClick={() => go("/clientes")}>
                <Icons.Clients />
                Clientes
              </button>

              <button className="sidebar-nav-btn" onClick={() => go("/stock")}>
                <Icons.Stock />
                Stock
              </button>

              <button className="sidebar-nav-btn" onClick={() => go("/usuarios")}>
                <Icons.Users />
                Usuarios
              </button>
            </>
          )}
        </nav>

        {/* LOGOUT */}
        <div className="sidebar-logout-container">
          <button onClick={handleLogout} className="sidebar-logout-btn">
            <Icons.Logout />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}