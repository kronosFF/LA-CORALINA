import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { AuthProvider } from "./context/AuthContext";
import { ProductProvider } from "./context/ProductContext";
import { ClientProvider } from "./context/ClientContext";
import { OrderProvider } from "./context/OrderContext";
import { EmptyBottleProvider } from "./context/EmptyBottleContext";
import { AssignmentProvider } from "./context/AssignmentContext";
import { CashClosingProvider } from "./context/CashClosingContext";
import { ReceivableProvider } from "./context/ReceivableContext";

const migrateExistingOrders = () => {
  const savedOrders = localStorage.getItem("orders");
  const savedUsers = localStorage.getItem("users");

  if (savedOrders && savedUsers) {
    const orders = JSON.parse(savedOrders);
    const users = JSON.parse(savedUsers);

    let needsUpdate = false;
    const updatedOrders = orders.map((order) => {
      if (order.sellerId) return order;

      const seller = users.find(
        (u) => u.name === order.sellerName && u.role === "vendedor",
      );
      if (seller) {
        needsUpdate = true;
        return { ...order, sellerId: seller.id };
      }
      return order;
    });

    if (needsUpdate) {
      localStorage.setItem("orders", JSON.stringify(updatedOrders));
    }
  }
};

migrateExistingOrders();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ProductProvider>
        <ClientProvider>
          <OrderProvider>
            <EmptyBottleProvider>
              <AssignmentProvider>
                <CashClosingProvider>
                  <ReceivableProvider>
                    <App />
                  </ReceivableProvider>
                </CashClosingProvider>
              </AssignmentProvider>
            </EmptyBottleProvider>
          </OrderProvider>
        </ClientProvider>
      </ProductProvider>
    </AuthProvider>
  </React.StrictMode>,
);
