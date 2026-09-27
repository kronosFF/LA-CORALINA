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

  const isGerencia = user?.role === "gerencia";
  const isPlanta = user?.role === "planta";
  const isVendedor = user?.role === "vendedor";
  const isProduccion = user?.role === "produccion";

  const canSeeTablero = isGerencia || isPlanta || isVendedor;
  const canSeePedidos = isGerencia || isPlanta || isVendedor;
  const canSeeGastos = isGerencia || isPlanta || isVendedor;
  const canSeeProductos = isGerencia || isPlanta;
  const canSeeStock = isGerencia || isPlanta || isProduccion;
  const canSeeClientes = isGerencia || isPlanta;
  const canSeeUsuarios = isGerencia;

  const canSeeMiJornada = isVendedor;
  const canSeeCuadres = isGerencia || isPlanta;
  const canSeeCartera = isGerencia || isPlanta;
  const canSeeMisCreditos = isVendedor;

  return (
    <div className="sidebar">
      <div className="sidebar-inner">
        <div className="sidebar-logo-container">
          <img src={logo} alt="La Coralina" className="sidebar-logo-image" />
          <h2 className="sidebar-logo-text">Coralina</h2>
          <p className="sidebar-user-info">
            {user?.name} ({user?.role})
          </p>
        </div>

        <nav className="sidebar-nav">
          <button className="sidebar-nav-btn" onClick={() => go("/")}>
            <Icons.Dashboard />
            Dashboard
          </button>

          {canSeeTablero && (
            <button className="sidebar-nav-btn" onClick={() => go("/tablero")}>
              <Icons.Package />
              Tablero
            </button>
          )}

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

          {canSeeGastos && (
            <button className="sidebar-nav-btn" onClick={() => go("/gastos")}>
              <Icons.Expenses />
              Gastos
            </button>
          )}

          {canSeeProductos && (
            <button
              className="sidebar-nav-btn"
              onClick={() => go("/productos")}
            >
              <Icons.Products />
              Productos
            </button>
          )}

          {canSeeClientes && (
            <button className="sidebar-nav-btn" onClick={() => go("/clientes")}>
              <Icons.Clients />
              Clientes
            </button>
          )}

          {canSeeStock && (
            <button className="sidebar-nav-btn" onClick={() => go("/stock")}>
              <Icons.Stock />
              Stock
            </button>
          )}

          {canSeeUsuarios && (
            <button className="sidebar-nav-btn" onClick={() => go("/usuarios")}>
              <Icons.Users />
              Usuarios
            </button>
          )}

          {canSeeMiJornada && (
            <button
              className="sidebar-nav-btn"
              onClick={() => go("/mi-jornada")}
            >
              <Icons.Money />
              Mi Jornada
            </button>
          )}

          {canSeeMisCreditos && (
            <button
              className="sidebar-nav-btn"
              onClick={() => go("/mis-creditos")}
            >
              <Icons.Money />
              Mis Créditos
            </button>
          )}

          {canSeeMiJornada && (
            <button
              className="sidebar-nav-btn"
              onClick={() => go("/mis-cuadres")}
            >
              <Icons.Clock />
              Mis Cuadres
            </button>
          )}

          {canSeeCuadres && (
            <button className="sidebar-nav-btn" onClick={() => go("/cuadres")}>
              <Icons.Money />
              Cuadres
            </button>
          )}

          {canSeeCartera && (
            <button className="sidebar-nav-btn" onClick={() => go("/cartera")}>
              <Icons.Money />
              Cartera
            </button>
          )}
        </nav>

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
