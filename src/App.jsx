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
import Board from "./pages/board/Board";
import MyJourney from "./pages/jornada/MyJourney";
import CloseJourney from "./pages/jornada/CloseJourney";
import MyClosings from "./pages/jornada/MyClosings";
import Closings from "./pages/cuadres/Closings";
import ClosingDetail from "./pages/cuadres/ClosingDetail";
import Cartera from "./pages/cartera/Cartera";
import ClientAccount from "./pages/cartera/ClientAccount";
import MyCredits from "./pages/cartera/MyCredits";
import Layout from "./components/Layout/Layout";

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

  const USUARIOS = ["gerencia"];
  const PEDIDOS = ["gerencia", "planta", "vendedor"];
  const GASTOS = ["gerencia", "planta", "vendedor"];
  const PRODUCTOS = ["gerencia", "planta"];
  const STOCK = ["gerencia", "planta", "produccion"];
  const CLIENTES = ["gerencia", "planta"];
  const TABLERO = ["gerencia", "planta", "vendedor"];
  const MI_JORNADA = ["vendedor"];
  const CUADRES = ["gerencia", "planta"];
  const CARTERA = ["gerencia", "planta"];
  const MI_CREDITOS = ["vendedor"];

  return (
    <ToastProvider>
      <BrowserRouter>
        {!user ? (
          <Login />
        ) : (
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />

              {/* Tablero */}
              <Route
                path="/tablero"
                element={
                  <ProtectedRoute allowedRoles={TABLERO}>
                    <Board />
                  </ProtectedRoute>
                }
              />

              {/* Cartera */}
              <Route
                path="/cartera"
                element={
                  <ProtectedRoute allowedRoles={CARTERA}>
                    <Cartera />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cartera/cliente/:id"
                element={
                  <ProtectedRoute allowedRoles={CARTERA}>
                    <ClientAccount />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mis-creditos"
                element={
                  <ProtectedRoute allowedRoles={MI_CREDITOS}>
                    <MyCredits />
                  </ProtectedRoute>
                }
              />

              {/* Jornada */}
              <Route
                path="/mi-jornada"
                element={
                  <ProtectedRoute allowedRoles={MI_JORNADA}>
                    <MyJourney />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cerrar-jornada"
                element={
                  <ProtectedRoute allowedRoles={MI_JORNADA}>
                    <CloseJourney />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mis-cuadres"
                element={
                  <ProtectedRoute allowedRoles={MI_JORNADA}>
                    <MyClosings />
                  </ProtectedRoute>
                }
              />

              {/* Cuadres */}
              <Route
                path="/cuadres"
                element={
                  <ProtectedRoute allowedRoles={CUADRES}>
                    <Closings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cuadres/:id"
                element={
                  <ProtectedRoute allowedRoles={CUADRES}>
                    <ClosingDetail />
                  </ProtectedRoute>
                }
              />

              {/* Resto */}
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
              <Route
                path="/productos"
                element={
                  <ProtectedRoute allowedRoles={PRODUCTOS}>
                    <Products />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/stock"
                element={
                  <ProtectedRoute allowedRoles={STOCK}>
                    <Stock />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clientes"
                element={
                  <ProtectedRoute allowedRoles={CLIENTES}>
                    <Clients />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/usuarios"
                element={
                  <ProtectedRoute allowedRoles={USUARIOS}>
                    <Users />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/gastos"
                element={
                  <ProtectedRoute allowedRoles={GASTOS}>
                    <Expenses />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        )}
      </BrowserRouter>
    </ToastProvider>
  );
}
