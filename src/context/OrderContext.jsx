import React, { createContext, useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  where,
  limit
} from "firebase/firestore";
import { db } from "../config/firebase";

export const OrderContext = createContext();

const getNextNumericId = async () => {
  const q = query(collection(db, "orders"), orderBy("numericId", "desc"));
  const snap = await getDocs(q);
  let max = 0;
  snap.forEach(d => { if (d.data().numericId > max) max = d.data().numericId; });
  return max + 1;
};

export function OrderProvider({ children }) {
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const locks = useRef(new Set());

  // Suscripción a pedidos
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setOrders(list);
    });
    return () => unsub();
  }, []);

  // Suscripción a gastos
  useEffect(() => {
    const q = query(collection(db, "expenses"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setExpenses(list);
    });
    return () => unsub();
  }, []);

  // Suscripción a pagos
  useEffect(() => {
    const q = query(collection(db, "payments"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setPayments(list);
    });
    return () => unsub();
  }, []);

  const addOrder = async (order) => {
    const numericId = await getNextNumericId();
    await addDoc(collection(db, "orders"), {
      ...order,
      numericId,
      createdAt: new Date(),
      timestamps: { preparacion: new Date() },
      paymentStatus: order.paymentMethod?.includes("credito") ? "credito" : "pendiente",
      paymentMethod: order.paymentMethod || null,
      totalPaid: 0,
      paymentProof: null,
      creditType: order.creditType || null,
    });
    return true;
  };

  // Registrar un abono/pago
  const registerPayment = async (orderId, amount, paymentMethod, paymentProof, comment) => {
    if (!amount || amount <= 0) {
      alert("❌ Ingresa un monto válido");
      return false;
    }

    const order = orders.find(o => o.id === orderId);
    if (!order) return false;

    const newTotalPaid = (order.totalPaid || 0) + amount;
    const isFullyPaid = newTotalPaid >= order.total;

    try {
      await addDoc(collection(db, "payments"), {
        orderId,
        orderNumericId: order.numericId,
        amount: Number(amount),
        paymentMethod,
        paymentProof: paymentProof || null,
        comment: comment || "",
        date: new Date(),
        previousTotalPaid: order.totalPaid || 0,
        newTotalPaid,
      });

      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        totalPaid: newTotalPaid,
        paymentStatus: isFullyPaid ? "pagado" : "credito",
        lastPaymentDate: new Date(),
      });

      alert(isFullyPaid ? "✅ Pedido pagado completamente" : `✅ Abono de $${amount.toLocaleString()} registrado. Saldo pendiente: $${(order.total - newTotalPaid).toLocaleString()}`);
      return true;
    } catch (error) {
      console.error("Error al registrar pago:", error);
      alert("❌ Error al registrar pago");
      return false;
    }
  };

  const getPaymentsByOrder = (orderId) => {
    return payments.filter(p => p.orderId === orderId).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const getActiveCredits = () => {
    return orders.filter(o =>
      o.paymentStatus === "credito" &&
      (o.totalPaid || 0) < (o.total || 0)
    ).sort((a, b) => (b.createdAt?.toDate?.() || new Date(b.createdAt)) - (a.createdAt?.toDate?.() || new Date(a.createdAt)));
  };

  const getCreditSummaryBySeller = () => {
    const summary = {};
    orders.forEach(order => {
      if (order.paymentStatus === "credito" && (order.totalPaid || 0) < (order.total || 0)) {
        const sellerName = order.sellerName;
        if (!summary[sellerName]) {
          summary[sellerName] = { totalDebt: 0, credits: [] };
        }
        const remaining = (order.total || 0) - (order.totalPaid || 0);
        summary[sellerName].totalDebt += remaining;
        summary[sellerName].credits.push({ ...order, remainingDebt: remaining });
      }
    });
    return summary;
  };

  // ✅ REGISTRAR GASTO
  const addExpense = async (sellerId, sellerName, concept, amount, category, comment, receipt) => {
    console.log("📝 Registrando gasto:", { sellerId, sellerName, concept, amount, category });

    if (!concept || !amount || !category) {
      alert("❌ Completa los campos requeridos");
      return false;
    }

    try {
      const expenseData = {
        sellerId: sellerId,
        sellerName: sellerName || "Desconocido",
        concept: concept,
        amount: Number(amount),
        category: category,
        comment: comment || "",
        receipt: receipt || null,
        date: new Date(),
      };

      await addDoc(collection(db, "expenses"), expenseData);
      alert("✅ Gasto registrado");
      return true;
    } catch (error) {
      console.error("Error al registrar gasto:", error);
      alert("❌ Error al registrar gasto");
      return false;
    }
  };

  // ✅ OBTENER GASTOS - SIN NECESIDAD DE ÍNDICES
  const getExpenses = async (filters = {}) => {
    try {
      let q;

      if (filters.sellerId) {
        q = query(collection(db, "expenses"), where("sellerId", "==", filters.sellerId));
      } else {
        q = query(collection(db, "expenses"), orderBy("date", "desc"));
      }

      if (filters.startDate) {
        q = query(q, where("date", ">=", filters.startDate));
      }
      if (filters.endDate) {
        q = query(q, where("date", "<=", filters.endDate));
      }

      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });

      if (filters.sellerId) {
        list.sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          return dateB - dateA;
        });
      }

      console.log("📋 Gastos encontrados:", list.length);
      return list;
    } catch (error) {
      console.error("Error al obtener gastos:", error);
      return [];
    }
  };

  const getAllExpensesGrouped = () => {
    const grouped = {};
    expenses.forEach(expense => {
      if (!grouped[expense.sellerId]) {
        grouped[expense.sellerId] = {
          sellerName: expense.sellerName,
          total: 0,
          expenses: []
        };
      }
      grouped[expense.sellerId].total += expense.amount || 0;
      grouped[expense.sellerId].expenses.push(expense);
    });
    return grouped;
  };

  const updatePayment = async (orderId, paymentStatus, paymentMethod, paymentProof, creditType) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        paymentStatus,
        paymentMethod,
        paymentProof: paymentProof || null,
        creditType: creditType || null,
      });
      alert("✅ Estado de pago actualizado");
      return true;
    } catch (error) {
      console.error("Error al actualizar pago:", error);
      alert("❌ Error al actualizar pago");
      return false;
    }
  };

  const updateStatus = async (id, newStatus, role) => {
    if (locks.current.has(id)) return;
    locks.current.add(id);
    const order = orders.find(o => o.id === id);
    if (!order) return;
    const current = order.status;
    const ts = order.timestamps || {};
    let update = {};

    if (current === "preparacion" && newStatus === "reparto") update = { status: "reparto", timestamps: { ...ts, reparto: new Date() } };
    else if (current === "reparto" && newStatus === "entregado") update = { status: "entregado", timestamps: { ...ts, entregado: new Date() } };
    else if (role !== "vendedor") {
      if (current === "reparto" && newStatus === "preparacion") { const { reparto, entregado, ...rest } = ts; update = { status: "preparacion", timestamps: rest }; }
      else if (current === "entregado" && newStatus === "reparto") { const { entregado, ...rest } = ts; update = { status: "reparto", timestamps: rest }; }
    }
    if (Object.keys(update).length) await updateDoc(doc(db, "orders", id), update);
    setTimeout(() => locks.current.delete(id), 300);
  };

  // 🔥 CORREGIDO: Ahora CANCELA (cambia estado) en lugar de ELIMINAR
  const cancelOrder = async (id, user, productCtx) => {
    const order = orders.find(o => o.id === id);
    if (!order) {
      alert("❌ Pedido no encontrado");
      return;
    }

    if (order.status === "entregado") {
      alert("❌ No se puede cancelar un pedido ya entregado");
      return;
    }

    if (order.status === "cancelado") {
      alert("❌ Este pedido ya está cancelado");
      return;
    }

    if (!confirm(`¿Cancelar pedido #${order.numericId || order.id.slice(-6)}? Se devolverá el stock.`)) {
      return;
    }

    try {
      // Devolver stock si tiene productos
      if (order.items && productCtx) {
        await productCtx.returnStockFromOrder(order.items, user);
      }

      // 🔥 NUEVO: En lugar de eliminar, CAMBIAMOS el estado a "cancelado"
      const orderRef = doc(db, "orders", id);
      await updateDoc(orderRef, {
        status: "cancelado",
        timestamps: {
          ...(order.timestamps || {}),
          cancelado: new Date()
        }
      });

      alert("✅ Pedido cancelado correctamente");
    } catch (error) {
      console.error("Error al cancelar pedido:", error);
      alert("❌ Error al cancelar pedido");
    }
  };

  return (
    <OrderContext.Provider value={{
      orders,
      expenses,
      payments,
      addOrder,
      updateStatus,
      cancelOrder,
      updatePayment,
      addExpense,
      getExpenses,
      getAllExpensesGrouped,
      registerPayment,
      getPaymentsByOrder,
      getActiveCredits,
      getCreditSummaryBySeller,
    }}>
      {children}
    </OrderContext.Provider>
  );
}