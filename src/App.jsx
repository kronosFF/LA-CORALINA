import { useContext } from "react";
import { ToastProvider } from "./context/ToastContext";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthContext } from "./context/AuthContext";
import Login from "./pages/login/login";
import Dashboard from "./pages/dashboard/Dashboard";
import Orders from "./pages/orders/Orders";
import CreateOrder from "./pages/createOrder/CreateOrder";
import Users from "./pages/users/Users";
import Products from "./pages/products/Products";
import Clients from "./pages/clients/Clients";
import Stock from "./pages/stock/Stock";
import Expenses from "./pages/expenses/Expenses";
import Layout from "./components/Layout/Layout";

// 🛡️ Guard de rutas por rol
function ProtectedRoute({ allowedRoles, children }) {
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const { user } = useContext(AuthContext);

  // 🎭 Grupos de roles por módulo
  const USUARIOS = ["gerencia"]; // Solo gerencia ve usuarios
  const PEDIDOS = ["gerencia", "planta", "vendedor"]; // No produccion
  const GASTOS = ["gerencia", "planta", "vendedor"]; // No produccion
  const INVENTARIO = ["gerencia", "planta", "produccion"]; // Productos y Stock
  const CLIENTES = ["gerencia", "planta"]; // No produccion, no vendedor

  return (
    <ToastProvider>
      <BrowserRouter>
        {!user ? (
          <Login />
        ) : (
          <Layout>
            <Routes>
              {/* Todos pueden ver Dashboard */}
              <Route path="/" element={<Dashboard />} />

              {/* Pedidos y Crear Pedido */}
              <Route
                path="/pedidos"
                element={
                  <ProtectedRoute allowedRoles={PEDIDOS}>
                    <Orders />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/crear"
                element={
                  <ProtectedRoute allowedRoles={PEDIDOS}>
                    <CreateOrder />
                  </ProtectedRoute>
                }
              />

              {/* Productos */}
              <Route
                path="/productos"
                element={
                  <ProtectedRoute allowedRoles={INVENTARIO}>
                    <Products />
                  </ProtectedRoute>
                }
              />

              {/* Stock */}
              <Route
                path="/stock"
                element={
                  <ProtectedRoute allowedRoles={INVENTARIO}>
                    <Stock />
                  </ProtectedRoute>
                }
              />

              {/* Clientes */}
              <Route
                path="/clientes"
                element={
                  <ProtectedRoute allowedRoles={CLIENTES}>
                    <Clients />
                  </ProtectedRoute>
                }
              />

              {/* Usuarios: SOLO gerencia */}
              <Route
                path="/usuarios"
                element={
                  <ProtectedRoute allowedRoles={USUARIOS}>
                    <Users />
                  </ProtectedRoute>
                }
              />

              {/* Gastos */}
              <Route
                path="/gastos"
                element={
                  <ProtectedRoute allowedRoles={GASTOS}>
                    <Expenses />
                  </ProtectedRoute>
                }
              />

              {/* Cualquier otra ruta → Dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        )}
      </BrowserRouter>
    </ToastProvider>
  );
}
