import React, { createContext, useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";

export const AssignmentContext = createContext();

// Utilidad: devuelve la fecha en formato YYYY-MM-DD (local)
const getTodayKey = (dateObj = new Date()) => {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function AssignmentProvider({ children }) {
  // 🗓️ Fecha activa — por defecto hoy
  const [activeDate, setActiveDate] = useState(getTodayKey());

  // 📦 Cache de días consultados: { "2026-09-26": [loads...] }
  const [loadsByDate, setLoadsByDate] = useState({});

  const [loading, setLoading] = useState(true);

  // Referencia para evitar que la suscripción se re-dispare innecesariamente
  const unsubscribeRef = useRef(null);

  // ============================================================
  // 🔥 Suscripción dinámica: solo al día activo.
  // - Filtra por `date` en el query (Firestore, no cliente).
  // - NO usa orderBy para evitar índice compuesto.
  // - Ordena en cliente sobre los pocos documentos del día.
  // - Cachea el resultado del día para no volver a suscribirse si
  //   el usuario regresa al mismo día en la misma sesión.
  // ============================================================
  useEffect(() => {
    // Si ya tenemos cache de este día, no re-suscribimos
    if (loadsByDate[activeDate]) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Limpiar suscripción previa
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    const q = query(
      collection(db, "dailyLoads"),
      where("date", "==", activeDate),
    );

    unsubscribeRef.current = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));

        // Ordenar en cliente por createdAt desc (pocos documentos)
        list.sort((a, b) => {
          const da = a.createdAt?.toDate
            ? a.createdAt.toDate()
            : new Date(a.createdAt || 0);
          const db_ = b.createdAt?.toDate
            ? b.createdAt.toDate()
            : new Date(b.createdAt || 0);
          return db_ - da;
        });

        // Guardar en cache por fecha
        setLoadsByDate((prev) => ({
          ...prev,
          [activeDate]: list,
        }));
        setLoading(false);
      },
      (error) => {
        console.error("Error suscribiendo dailyLoads:", error);
        setLoading(false);
      },
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDate]);

  // Cargas del día activo (desde cache)
  const dailyLoads = loadsByDate[activeDate] || [];

  /**
   * Cambia el día activo. La suscripción se ajusta automáticamente.
   */
  const changeActiveDate = (dateKey) => {
    if (dateKey && dateKey !== activeDate) {
      setActiveDate(dateKey);
    }
  };

  /**
   * Fuerza un refresh: borra el cache del día activo y re-suscribe.
   * Útil si necesitas garantizar datos frescos.
   */
  const refreshActiveDate = () => {
    setLoadsByDate((prev) => {
      const copy = { ...prev };
      delete copy[activeDate];
      return copy;
    });
  };

  /**
   * Crea una nueva asignación de tablero para un vendedor.
   * items: [{ productId, name, price, assignedQty }]
   */
  const createDailyLoad = async (seller, items) => {
    if (!seller || !seller.id) {
      alert("❌ Vendedor requerido");
      return false;
    }
    if (!items || items.length === 0) {
      alert("❌ Agrega al menos un producto");
      return false;
    }

    for (const item of items) {
      if (!item.assignedQty || item.assignedQty <= 0) {
        alert(`❌ Cantidad inválida para ${item.name}`);
        return false;
      }
    }

    const totalAssignedValue = items.reduce(
      (acc, i) => acc + (i.price || 0) * i.assignedQty,
      0,
    );

    const dailyLoadData = {
      sellerId: seller.id,
      sellerName: seller.name,
      date: getTodayKey(), // Siempre se crea con la fecha de HOY
      status: "abierta",
      items: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        assignedQty: i.assignedQty,
        returnedQty: 0,
      })),
      totalAssignedValue,
      totalSoldValue: 0,
      createdAt: new Date(),
      closedAt: null,
      closedBy: null,
    };

    try {
      const docRef = await addDoc(collection(db, "dailyLoads"), dailyLoadData);
      return { id: docRef.id, ...dailyLoadData };
    } catch (error) {
      console.error("Error al crear asignación:", error);
      alert("❌ Error al crear asignación");
      return false;
    }
  };

  /**
   * Cierra una dailyLoad: registra cantidades devueltas y actualiza status.
   * returnedItems: [{ productId, returnedQty }]
   */
  const closeDailyLoad = async (dailyLoadId, returnedItems, user) => {
    const load = dailyLoads.find((l) => l.id === dailyLoadId);
    if (!load) {
      alert("❌ Asignación no encontrada");
      return false;
    }

    if (load.status === "cerrada") {
      alert("❌ Esta asignación ya está cerrada");
      return false;
    }

    const updatedItems = load.items.map((item) => {
      const returned = returnedItems.find(
        (r) => r.productId === item.productId,
      );
      return {
        ...item,
        returnedQty: returned ? Number(returned.returnedQty) || 0 : 0,
      };
    });

    for (const item of updatedItems) {
      if (item.returnedQty > item.assignedQty) {
        alert(
          `❌ ${item.name}: no puedes devolver más de lo asignado (${item.assignedQty})`,
        );
        return false;
      }
    }

    const totalSoldValue = updatedItems.reduce(
      (acc, i) => acc + (i.price || 0) * (i.assignedQty - i.returnedQty),
      0,
    );

    try {
      const loadRef = doc(db, "dailyLoads", dailyLoadId);
      await updateDoc(loadRef, {
        status: "cerrada",
        items: updatedItems,
        totalSoldValue,
        closedAt: new Date(),
        closedBy: user ? { id: user.id, name: user.name } : null,
      });
      return {
        ...load,
        items: updatedItems,
        totalSoldValue,
        status: "cerrada",
      };
    } catch (error) {
      console.error("Error al cerrar asignación:", error);
      alert("❌ Error al cerrar asignación");
      return false;
    }
  };

  /**
   * Filtra las dailyLoads del día activo por vendedor.
   * (Se ejecuta sobre el array ya cacheado del día — muy liviano)
   */
  const getLoadsBySeller = (sellerId, dateKey = null) => {
    const key = dateKey || activeDate;
    const source = key === activeDate ? dailyLoads : loadsByDate[key] || [];
    return source.filter((l) => l.sellerId === sellerId);
  };

  /**
   * Resumen del día para un vendedor (en tiempo real).
   */
  const getDailySummaryBySeller = (sellerId, dateKey = null) => {
    const loads = getLoadsBySeller(sellerId, dateKey);

    const productSummary = {};

    loads.forEach((load) => {
      load.items.forEach((item) => {
        if (!productSummary[item.productId]) {
          productSummary[item.productId] = {
            productId: item.productId,
            name: item.name,
            price: item.price,
            assigned: 0,
            returned: 0,
            sold: 0,
          };
        }
        productSummary[item.productId].assigned += item.assignedQty || 0;
        productSummary[item.productId].returned += item.returnedQty || 0;
      });
    });

    Object.values(productSummary).forEach((p) => {
      p.sold = p.assigned - p.returned;
    });

    return Object.values(productSummary).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  };

  /**
   * Resumen global de todos los vendedores para el día activo.
   */
  const getGlobalDailySummary = (dateKey = null) => {
    const key = dateKey || activeDate;
    const loadsToday = key === activeDate ? dailyLoads : loadsByDate[key] || [];

    const bySeller = {};

    loadsToday.forEach((load) => {
      if (!bySeller[load.sellerId]) {
        bySeller[load.sellerId] = {
          sellerId: load.sellerId,
          sellerName: load.sellerName,
          products: {},
          totalSoldValue: 0,
          hasOpenLoad: false,
        };
      }

      if (load.status === "abierta") {
        bySeller[load.sellerId].hasOpenLoad = true;
      }

      load.items.forEach((item) => {
        if (!bySeller[load.sellerId].products[item.productId]) {
          bySeller[load.sellerId].products[item.productId] = {
            productId: item.productId,
            name: item.name,
            price: item.price,
            assigned: 0,
            returned: 0,
            sold: 0,
          };
        }
        const p = bySeller[load.sellerId].products[item.productId];
        p.assigned += item.assignedQty || 0;
        p.returned += item.returnedQty || 0;
      });
    });

    Object.values(bySeller).forEach((seller) => {
      let totalValue = 0;
      Object.values(seller.products).forEach((p) => {
        p.sold = p.assigned - p.returned;
        totalValue += p.sold * (p.price || 0);
      });
      seller.products = Object.values(seller.products).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      seller.totalSoldValue = totalValue;
    });

    return Object.values(bySeller).sort((a, b) =>
      a.sellerName.localeCompare(b.sellerName),
    );
  };

  return (
    <AssignmentContext.Provider
      value={{
        dailyLoads,
        loading,
        activeDate,
        changeActiveDate,
        refreshActiveDate,
        createDailyLoad,
        closeDailyLoad,
        getLoadsBySeller,
        getDailySummaryBySeller,
        getGlobalDailySummary,
        getTodayKey,
      }}
    >
      {children}
    </AssignmentContext.Provider>
  );
}
