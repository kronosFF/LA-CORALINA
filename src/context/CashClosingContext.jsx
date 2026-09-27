import React, { createContext, useState, useEffect } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../config/firebase";

export const CashClosingContext = createContext();

// Utilidad: fecha en formato YYYY-MM-DD (local)
const getDateKey = (dateObj = new Date()) => {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function CashClosingProvider({ children }) {
  const [pendingClosings, setPendingClosings] = useState([]);
  const [recentClosings, setRecentClosings] = useState([]);
  const [loading, setLoading] = useState(true);

  // ==========================================
  // Suscripción a cuadres pendientes
  // ✅ FIX: sin orderBy para evitar índice compuesto.
  //    El ordenamiento se hace en cliente.
  // ==========================================
  useEffect(() => {
    const q = query(
      collection(db, "cashClosings"),
      where("status", "==", "pendiente_aprobacion"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        // Ordenar en cliente por submittedAt desc
        list.sort((a, b) => {
          const da = a.submittedAt?.toDate
            ? a.submittedAt.toDate()
            : new Date(a.submittedAt || 0);
          const db_ = b.submittedAt?.toDate
            ? b.submittedAt.toDate()
            : new Date(b.submittedAt || 0);
          return db_ - da;
        });
        setPendingClosings(list);
        setLoading(false);
      },
      (err) => {
        console.warn("Error suscribiendo cuadres pendientes:", err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  // ==========================================
  // Suscripción a cuadres recientes (aprobados y rechazados)
  // ✅ orderBy + limit sobre un solo campo: no requiere índice compuesto.
  // ==========================================
  useEffect(() => {
    const q = query(
      collection(db, "cashClosings"),
      orderBy("submittedAt", "desc"),
      limit(50),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setRecentClosings(list);
      },
      (err) => {
        console.warn("Error suscribiendo cuadres recientes:", err);
        // Fallback sin orderBy si por alguna razón falla
        const fallbackQ = query(collection(db, "cashClosings"), limit(50));
        onSnapshot(fallbackQ, (snap) => {
          const list = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
          list.sort((a, b) => {
            const da = a.submittedAt?.toDate
              ? a.submittedAt.toDate()
              : new Date(a.submittedAt || 0);
            const db_ = b.submittedAt?.toDate
              ? b.submittedAt.toDate()
              : new Date(b.submittedAt || 0);
            return db_ - da;
          });
          setRecentClosings(list);
        });
      },
    );

    return () => unsub();
  }, []);

  // ==========================================
  // Calcular cuadre del día para un vendedor (SIN guardar aún)
  // ==========================================
  const computeClosingPreview = (
    seller,
    orders,
    dailyLoads,
    returnedQtys = {},
  ) => {
    if (!seller || !seller.id) return null;

    const todayKey = getDateKey();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Pedidos del vendedor entregados hoy
    const sellerOrdersToday = (orders || []).filter((o) => {
      if (o.sellerId !== seller.id) return false;
      if (o.status !== "entregado") return false;
      if (!o.createdAt && !o.timestamps?.entregado) return false;

      const refDate = o.timestamps?.entregado || o.createdAt;
      const d = refDate?.toDate ? refDate.toDate() : new Date(refDate);
      if (isNaN(d.getTime())) return false;

      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      return dayStart.getTime() === today.getTime();
    });

    // 2. Productos vendidos hoy
    const soldByProduct = {};
    sellerOrdersToday.forEach((o) => {
      (o.items || []).forEach((item) => {
        if (!soldByProduct[item.id]) {
          soldByProduct[item.id] = {
            productId: item.id,
            name: item.name,
            qty: 0,
          };
        }
        soldByProduct[item.id].qty += item.qty || 0;
      });
    });

    // 3. Cargas del tablero del vendedor hoy
    const sellerLoadsToday = (dailyLoads || []).filter(
      (l) => l.sellerId === seller.id && l.date === todayKey,
    );

    // 4. Consolidar productos
    const productMap = {};

    sellerLoadsToday.forEach((load) => {
      load.items.forEach((item) => {
        if (!productMap[item.productId]) {
          productMap[item.productId] = {
            productId: item.productId,
            name: item.name,
            assignedQty: 0,
            soldQty: 0,
            returnedQty: 0,
            difference: 0,
          };
        }
        productMap[item.productId].assignedQty += item.assignedQty || 0;
        productMap[item.productId].returnedQty += item.returnedQty || 0;
      });
    });

    Object.values(soldByProduct).forEach((p) => {
      if (!productMap[p.productId]) {
        productMap[p.productId] = {
          productId: p.productId,
          name: p.name,
          assignedQty: 0,
          soldQty: 0,
          returnedQty: 0,
          difference: 0,
        };
      }
      productMap[p.productId].soldQty = p.qty;
    });

    const products = Object.values(productMap).map((p) => ({
      ...p,
      difference: p.assignedQty - p.soldQty - p.returnedQty,
    }));

    const productsValid = products.every((p) => p.difference === 0);

    // 5. Cuadre de dinero
    let cashExpected = 0;
    let transferExpected = 0;
    let creditSeller = 0;
    let creditBoss = 0;
    let otherExpected = 0;
    let totalSales = 0;

    sellerOrdersToday.forEach((o) => {
      const total = o.total || 0;
      const paid = o.totalPaid || 0;
      const remaining = total - paid;

      totalSales += total;

      const method = o.paymentMethod || "otros";

      if (o.paymentStatus === "pagado") {
        if (method === "efectivo") cashExpected += total;
        else if (["nequi", "llave", "transferencia"].includes(method))
          transferExpected += total;
        else otherExpected += total;
      } else if (o.paymentStatus === "credito") {
        if (paid > 0) {
          if (method === "efectivo") cashExpected += paid;
          else if (["nequi", "llave", "transferencia"].includes(method))
            transferExpected += paid;
          else otherExpected += paid;
        }
        if (o.creditType === "empresa") creditBoss += remaining;
        else creditSeller += remaining;
      } else if (o.paymentStatus === "pendiente") {
        if (method === "efectivo") cashExpected += total;
        else if (["nequi", "llave", "transferencia"].includes(method))
          transferExpected += total;
        else otherExpected += total;
      }
    });

    // 6. Clientes atendidos hoy
    const clientMap = {};
    sellerOrdersToday.forEach((o) => {
      const cid = o.clientId || o.clientData?.id || o.clientData?.name;
      if (!cid) return;
      if (!clientMap[cid]) {
        clientMap[cid] = {
          clientId: o.clientId || null,
          clientName: o.clientData?.name || o.client || "—",
          total: 0,
          paymentType: o.paymentMethod || "otros",
          ordersCount: 0,
        };
      }
      clientMap[cid].total += o.total || 0;
      clientMap[cid].ordersCount += 1;
    });

    return {
      date: todayKey,
      sellerId: seller.id,
      sellerName: seller.name,
      products,
      productsValid,
      cashExpected,
      transferExpected,
      creditSeller,
      creditBoss,
      otherExpected,
      totalSales,
      ordersCount: sellerOrdersToday.length,
      ordersIncluded: sellerOrdersToday.map((o) => o.id),
      clientBreakdown: Object.values(clientMap),
    };
  };

  // ==========================================
  // Crear cuadre
  // ==========================================
  const createClosing = async (
    preview,
    seller,
    cashDelivered,
    sellerNotes,
    differenceReason,
  ) => {
    if (!preview || !seller) {
      alert("❌ Datos incompletos para crear el cuadre");
      return false;
    }

    if (preview.ordersCount === 0) {
      alert("❌ No hay pedidos entregados hoy. No se puede cerrar la jornada.");
      return false;
    }

    const difference = Number(cashDelivered) - preview.cashExpected;

    const closingData = {
      ...preview,
      cashDelivered: Number(cashDelivered),
      cashDifference: difference,
      sellerNotes: sellerNotes || "",
      sellerDifferenceReason: differenceReason || "",
      status: "pendiente_aprobacion",
      submittedAt: new Date(),
      submittedBy: { id: seller.id, name: seller.name },
      rejectedAt: null,
      rejectedBy: null,
      rejectReason: "",
      approvedAt: null,
      approvedBy: null,
      approvedComment: "",
      adjustments: [],
    };

    try {
      const docRef = await addDoc(collection(db, "cashClosings"), closingData);
      return { id: docRef.id, ...closingData };
    } catch (error) {
      console.error("Error al crear cuadre:", error);
      alert("❌ Error al crear cuadre");
      return false;
    }
  };

  // ==========================================
  // Aprobar
  // ==========================================
  const approveClosing = async (closingId, user, comment = "") => {
    try {
      const ref = doc(db, "cashClosings", closingId);
      await updateDoc(ref, {
        status: "aprobado",
        approvedAt: new Date(),
        approvedBy: { id: user.id, name: user.name },
        approvedComment: comment || "",
      });
      return true;
    } catch (error) {
      console.error("Error al aprobar cuadre:", error);
      alert("❌ Error al aprobar cuadre");
      return false;
    }
  };

  // ==========================================
  // Rechazar
  // ==========================================
  const rejectClosing = async (closingId, user, reason) => {
    if (!reason || !reason.trim()) {
      alert("❌ El motivo del rechazo es obligatorio");
      return false;
    }

    try {
      const ref = doc(db, "cashClosings", closingId);
      await updateDoc(ref, {
        status: "rechazado",
        rejectedAt: new Date(),
        rejectedBy: { id: user.id, name: user.name },
        rejectReason: reason,
      });
      return true;
    } catch (error) {
      console.error("Error al rechazar cuadre:", error);
      alert("❌ Error al rechazar cuadre");
      return false;
    }
  };

  // ==========================================
  // Editar
  // ==========================================
  const editClosing = async (closingId, changes, reason, user) => {
    if (!reason || !reason.trim()) {
      alert("❌ El motivo del ajuste es obligatorio");
      return false;
    }

    const closing = recentClosings.find((c) => c.id === closingId);
    if (!closing) {
      alert("❌ Cuadre no encontrado");
      return false;
    }

    const adjustments = [...(closing.adjustments || [])];

    Object.entries(changes).forEach(([field, newValue]) => {
      const originalValue = closing[field];
      if (originalValue !== newValue) {
        adjustments.push({
          field,
          originalValue,
          newValue,
          reason,
          adjustedBy: { id: user.id, name: user.name },
          adjustedAt: new Date(),
        });
      }
    });

    try {
      const ref = doc(db, "cashClosings", closingId);
      await updateDoc(ref, {
        ...changes,
        adjustments,
      });
      return true;
    } catch (error) {
      console.error("Error al editar cuadre:", error);
      alert("❌ Error al editar cuadre");
      return false;
    }
  };

  // ==========================================
  // Consultar cuadres por vendedor/fecha
  // ==========================================
  const getClosingsBySeller = async (sellerId, dateKey = null) => {
    try {
      let q;
      if (dateKey) {
        q = query(
          collection(db, "cashClosings"),
          where("sellerId", "==", sellerId),
          where("date", "==", dateKey),
        );
      } else {
        q = query(
          collection(db, "cashClosings"),
          where("sellerId", "==", sellerId),
        );
      }

      const snap = await getDocs(q);
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));

      list.sort((a, b) => {
        const da = a.submittedAt?.toDate
          ? a.submittedAt.toDate()
          : new Date(a.submittedAt || 0);
        const db_ = b.submittedAt?.toDate
          ? b.submittedAt.toDate()
          : new Date(b.submittedAt || 0);
        return db_ - da;
      });

      return list;
    } catch (error) {
      console.error("Error al obtener cuadres del vendedor:", error);
      return [];
    }
  };

  // ==========================================
  // Verificar si ya cerró hoy
  // ==========================================
  const hasClosedToday = (sellerId) => {
    const todayKey = getDateKey();
    return recentClosings.some(
      (c) => c.sellerId === sellerId && c.date === todayKey,
    );
  };

  return (
    <CashClosingContext.Provider
      value={{
        pendingClosings,
        recentClosings,
        loading,
        computeClosingPreview,
        createClosing,
        approveClosing,
        rejectClosing,
        editClosing,
        getClosingsBySeller,
        hasClosedToday,
        getDateKey,
      }}
    >
      {children}
    </CashClosingContext.Provider>
  );
}
