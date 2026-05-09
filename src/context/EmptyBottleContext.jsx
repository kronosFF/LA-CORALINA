import React, { createContext, useState, useEffect } from "react";
import { 
  collection, 
  getDocs, 
  addDoc, 
  query,
  orderBy,
  where,
  onSnapshot
} from "firebase/firestore";
import { db } from "../config/firebase";

export const EmptyBottleContext = createContext();

export function EmptyBottleProvider({ children }) {
  const [emptyBottleRecords, setEmptyBottleRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "emptyBottleRecords"), orderBy("date", "desc"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const records = [];
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });
      setEmptyBottleRecords(records);
      setLoading(false);
    }, (error) => {
      console.error("Error al cargar reportes:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const addEmptyBottleReport = async (sellerId, sellerName, reportedQuantity, date, comment) => {
    if (reportedQuantity === undefined || reportedQuantity < 0) {
      alert("❌ La cantidad debe ser mayor o igual a 0");
      return false;
    }

    try {
      await addDoc(collection(db, "emptyBottleRecords"), {
        sellerId: sellerId || null,
        sellerName: sellerName,
        reportedQuantity: Number(reportedQuantity),
        date: date || new Date(),
        comment: comment || "",
        createdAt: new Date(),
      });
      alert(`✅ Reporte de ${sellerName} guardado: ${reportedQuantity} botellones vacíos`);
      return true;
    } catch (error) {
      console.error("Error al guardar reporte:", error);
      alert("❌ Error al guardar reporte");
      return false;
    }
  };

  const getEmptyBottleRecords = async (filters = {}) => {
    try {
      let q = query(collection(db, "emptyBottleRecords"), orderBy("date", "desc"));
      
      if (filters.sellerId) {
        q = query(q, where("sellerId", "==", filters.sellerId));
      }
      if (filters.sellerName) {
        q = query(q, where("sellerName", "==", filters.sellerName));
      }
      
      const querySnapshot = await getDocs(q);
      const records = [];
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });
      return records;
    } catch (error) {
      console.error("Error al obtener reportes:", error);
      return [];
    }
  };

  const isBottleProduct = (productName) => {
    const name = productName.toLowerCase();
    return name.includes("botellón") || 
           name.includes("botellon") || 
           name.includes("20l") || 
           name.includes("20 l") ||
           name.includes("retornable");
  };

  const getDebtBySeller = (seller, orders) => {
    const sellerId = seller.id;
    const sellerName = seller.name;

    const sellerOrders = orders.filter((o) => {
      if (o.sellerId && o.sellerId === sellerId) return true;
      if (!o.sellerId && o.sellerName === sellerName) return true;
      return false;
    }).filter((o) => o.status === "entregado");

    let totalSold = 0;
    sellerOrders.forEach((order) => {
      if (order.items && order.items.length > 0) {
        order.items.forEach((item) => {
          if (isBottleProduct(item.name)) {
            totalSold += item.qty;
          }
        });
      }
    });

    const sellerReports = emptyBottleRecords.filter(
      (r) => (r.sellerId === sellerId || r.sellerName === sellerName)
    );
    const totalReported = sellerReports.reduce((acc, r) => acc + (r.reportedQuantity || 0), 0);

    const debt = totalSold - totalReported;

    return {
      sellerId,
      sellerName,
      totalSold,
      totalReported,
      debt: debt > 0 ? debt : 0,
    };
  };

  const getAllDebts = (users, orders) => {
    const sellers = users.filter((u) => u.role === "vendedor");
    return sellers.map((seller) => getDebtBySeller(seller, orders));
  };

  return (
    <EmptyBottleContext.Provider
      value={{
        emptyBottleRecords,
        loading,
        addEmptyBottleReport,
        getEmptyBottleRecords,
        getDebtBySeller,
        getAllDebts,
        isBottleProduct,
      }}
    >
      {children}
    </EmptyBottleContext.Provider>
  );
}