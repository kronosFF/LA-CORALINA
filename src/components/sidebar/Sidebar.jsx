import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import Icons from "../icons/Icons";
import logo from "../../assets/logoCoralina.png";
import "./Sidebar.css";

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

  // 🎭 Flags de rol
  const isGerencia = user?.role === "gerencia";
  const isPlanta = user?.role === "planta";
  const isVendedor = user?.role === "vendedor";
  const isProduccion = user?.role === "produccion";

  // Agrupadores
  const canSeePedidos = isGerencia || isPlanta || isVendedor;
  const canSeeGastos = isGerencia || isPlanta || isVendedor;
  const canSeeInventario = isGerencia || isPlanta || isProduccion; // Productos y Stock
  const canSeeClientes = isGerencia || isPlanta;
  const canSeeUsuarios = isGerencia; // SOLO gerencia

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
          {/* Dashboard: todos */}
          <button className="sidebar-nav-btn" onClick={() => go("/")}>
            <Icons.Dashboard />
            Dashboard
          </button>

          {/* Pedidos y Crear Pedido */}
          {canSeePedidos && (
            <>
              <button
                className="sidebar-nav-btn"
                onClick={() => go("/pedidos")}
              >
                <Icons.Orders />
                Pedidos
              </button>

              <button className="sidebar-nav-btn" onClick={() => go("/crear")}>
                <Icons.CreateOrder />
                Crear Pedido
              </button>
            </>
          )}

          {/* Gastos */}
          {canSeeGastos && (
            <button className="sidebar-nav-btn" onClick={() => go("/gastos")}>
              <Icons.Expenses />
              Gastos
            </button>
          )}

          {/* Productos */}
          {canSeeInventario && (
            <button
              className="sidebar-nav-btn"
              onClick={() => go("/productos")}
            >
              <Icons.Products />
              Productos
            </button>
          )}

          {/* Clientes */}
          {canSeeClientes && (
            <button className="sidebar-nav-btn" onClick={() => go("/clientes")}>
              <Icons.Clients />
              Clientes
            </button>
          )}

          {/* Stock */}
          {canSeeInventario && (
            <button className="sidebar-nav-btn" onClick={() => go("/stock")}>
              <Icons.Stock />
              Stock
            </button>
          )}

          {/* Usuarios: SOLO gerencia */}
          {canSeeUsuarios && (
            <button className="sidebar-nav-btn" onClick={() => go("/usuarios")}>
              <Icons.Users />
              Usuarios
            </button>
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
