import { useContext } from "react";
import { ToastProvider } from "./context/ToastContext";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Layout from "./components/Layout/Layout"; // 👈 Asumiendo que Layout.jsx está dentro de su carpeta


export default function App() {
  const { user } = useContext(AuthContext);

  return (
    <ToastProvider>
      <BrowserRouter>
        {!user ? (
          <Login />
        ) : (
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pedidos" element={<Orders />} />
              <Route path="/crear" element={<CreateOrder />} />
              <Route path="/usuarios" element={<Users />} />
              <Route path="/productos" element={<Products />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/stock" element={<Stock />} />
              <Route path="/gastos" element={<Expenses />} />
            </Routes>
          </Layout>
        )}
      </BrowserRouter>
    </ToastProvider>
  );
}