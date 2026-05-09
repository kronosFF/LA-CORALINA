import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { AuthProvider } from "./context/AuthContext";
import { ProductProvider } from "./context/ProductContext";
import { ClientProvider } from "./context/ClientContext";
import { OrderProvider } from "./context/OrderContext";
import { EmptyBottleProvider } from "./context/EmptyBottleContext";

// 🔄 MIGRACIÓN AUTOMÁTICA de pedidos antiguos
const migrateExistingOrders = () => {
  const savedOrders = localStorage.getItem("orders");
  const savedUsers = localStorage.getItem("users");
  
  if (savedOrders && savedUsers) {
    const orders = JSON.parse(savedOrders);
    const users = JSON.parse(savedUsers);
    
    let needsUpdate = false;
    const updatedOrders = orders.map(order => {
      // Si el pedido ya tiene sellerId, no hacer nada
      if (order.sellerId) return order;
      
      // Buscar vendedor por nombre (solo si el nombre coincide con un vendedor)
      const seller = users.find(u => u.name === order.sellerName && u.role === "vendedor");
      if (seller) {
        console.log(`🔄 Migrando pedido ${order.id}: ${order.sellerName} → sellerId: ${seller.id}`);
        needsUpdate = true;
        return { ...order, sellerId: seller.id };
      }
      return order;
    });
    
    if (needsUpdate) {
      localStorage.setItem("orders", JSON.stringify(updatedOrders));
      console.log("✅ Pedidos migrados correctamente");
    }
  }
};

// Ejecutar migración antes de renderizar
migrateExistingOrders();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ProductProvider>
        <ClientProvider>
          <OrderProvider>
            <EmptyBottleProvider>
              <App />
            </EmptyBottleProvider>
          </OrderProvider>
        </ClientProvider>
      </ProductProvider>
    </AuthProvider>
  </React.StrictMode>
);