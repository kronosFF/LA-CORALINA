import React, { createContext, useState, useEffect, useMemo } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  where,
  limit,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { db } from "../config/firebase";

export const ReceivableContext = createContext();

// Días por defecto para vencimiento
const DEFAULT_DUE_DAYS = 30;

// Utilidad fecha YYYY-MM-DD
const getDateKey = (dateObj = new Date()) => {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Calcular días entre dos fechas
const daysBetween = (date1, date2) => {
  const d1 = date1 instanceof Date ? date1 : new Date(date1);
  const d2 = date2 instanceof Date ? date2 : new Date(date2);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
};

export function ReceivableProvider({ children }) {
  const [receivables, setReceivables] = useState([]);
  const [loading, setLoading] = useState(true);

  // ==========================================
  // Suscripción a receivables
  // Límite 200 para no gastar lecturas
  // ==========================================
  useEffect(() => {
    const q = query(
      collection(db, "receivables"),
      orderBy("createdAt", "desc"),
      limit(200),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setReceivables(list);
        setLoading(false);
      },
      (err) => {
        console.warn("Error suscribiendo receivables:", err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  // ==========================================
  // Crear receivable automáticamente al crear pedido a crédito
  // ==========================================
  const createReceivable = async (order, seller, origin = "vendedor") => {
    const total = order.total || 0;
    const paid = order.totalPaid || 0;
    const balance = total - paid;

    if (balance <= 0) return null;

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + DEFAULT_DUE_DAYS);

    const data = {
      // Cliente
      clientId: order.clientId || order.clientData?.id || null,
      clientName: order.clientData?.name || order.client || "—",
      clientPhone: order.clientData?.phone || "",

      // Vendedor
      sellerId: seller?.id || order.sellerId || null,
      sellerName: seller?.name || order.sellerName || "—",

      // Origen del crédito
      origin: origin, // "vendedor" | "gerencia"

      // Referencia al pedido
      orderId: order.id || null,
      orderNumericId: order.numericId || null,
      orderDate: order.createdAt?.toDate
        ? getDateKey(order.createdAt.toDate())
        : getDateKey(order.createdAt || now),

      // Montos
      totalOriginal: total,
      totalPaid: paid,
      balance: balance,

      // Estado
      status: "pendiente", // pendiente | pagado | vencido
      dueDate: dueDate,
      dueDateKey: getDateKey(dueDate),

      // Historial de pagos
      paymentHistory: [],

      // Metadata
      createdAt: now,
      updatedAt: now,
    };

    try {
      const ref = await addDoc(collection(db, "receivables"), data);
      return { id: ref.id, ...data };
    } catch (error) {
      console.error("Error al crear receivable:", error);
      return null;
    }
  };

  // ==========================================
  // Registrar abono a un receivable
  // ==========================================
  const registerPaymentOnReceivable = async (
    receivableId,
    amount,
    method,
    user,
    notes = "",
  ) => {
    if (!amount || amount <= 0) {
      alert("❌ Monto inválido");
      return false;
    }

    const rec = receivables.find((r) => r.id === receivableId);
    if (!rec) {
      alert("❌ Cuenta por cobrar no encontrada");
      return false;
    }

    if (amount > rec.balance) {
      alert(
        `❌ El abono supera el saldo pendiente ($${rec.balance.toLocaleString()})`,
      );
      return false;
    }

    const newPaid = (rec.totalPaid || 0) + amount;
    const newBalance = (rec.totalOriginal || 0) - newPaid;

    const paymentEntry = {
      amount: Number(amount),
      method: method || "efectivo",
      receivedBy: user?.name || "—",
      receivedById: user?.id || null,
      notes: notes || "",
      date: new Date(),
    };

    try {
      const ref = doc(db, "receivables", receivableId);
      await updateDoc(ref, {
        totalPaid: newPaid,
        balance: newBalance,
        status: newBalance <= 0 ? "pagado" : "pendiente",
        paymentHistory: arrayUnion(paymentEntry),
        updatedAt: new Date(),
      });
      return true;
    } catch (error) {
      console.error("Error al abonar:", error);
      alert("❌ Error al registrar el abono");
      return false;
    }
  };

  // ==========================================
  // Aplicar pago FIFO al cliente (pedido más antiguo primero)
  // ==========================================
  const applyFifoPayment = async (
    clientId,
    amount,
    method,
    user,
    notes = "",
  ) => {
    if (!amount || amount <= 0) {
      alert("❌ Monto inválido");
      return false;
    }

    // Cuentas pendientes del cliente ordenadas por fecha (más antiguas primero)
    const clientReceivables = receivables
      .filter((r) => r.clientId === clientId && r.balance > 0)
      .sort((a, b) => {
        const da = a.createdAt?.toDate
          ? a.createdAt.toDate()
          : new Date(a.createdAt);
        const db_ = b.createdAt?.toDate
          ? b.createdAt.toDate()
          : new Date(b.createdAt);
        return da - db_;
      });

    if (clientReceivables.length === 0) {
      alert("❌ Este cliente no tiene cuentas pendientes");
      return false;
    }

    let remaining = amount;
    const applied = [];

    for (const rec of clientReceivables) {
      if (remaining <= 0) break;

      const toApply = Math.min(remaining, rec.balance);
      const newPaid = (rec.totalPaid || 0) + toApply;
      const newBalance = rec.totalOriginal - newPaid;

      const paymentEntry = {
        amount: toApply,
        method: method || "efectivo",
        receivedBy: user?.name || "—",
        receivedById: user?.id || null,
        notes: notes ? `${notes} (FIFO)` : "Abono FIFO",
        date: new Date(),
      };

      try {
        const ref = doc(db, "receivables", rec.id);
        await updateDoc(ref, {
          totalPaid: newPaid,
          balance: newBalance,
          status: newBalance <= 0 ? "pagado" : "pendiente",
          paymentHistory: arrayUnion(paymentEntry),
          updatedAt: new Date(),
        });
        applied.push({ orderNumericId: rec.orderNumericId, amount: toApply });
        remaining -= toApply;
      } catch (error) {
        console.error("Error al aplicar pago:", error);
      }
    }

    if (remaining > 0) {
      alert(
        `⚠️ Se aplicaron $${(amount - remaining).toLocaleString()}. Sobraron $${remaining.toLocaleString()} que no se pudieron aplicar.`,
      );
    }

    return applied;
  };

  // ==========================================
  // Filtros y agregaciones
  // ==========================================
  const getClientSummary = (clientId) => {
    const clientReceivables = receivables.filter(
      (r) => r.clientId === clientId,
    );

    if (clientReceivables.length === 0) return null;

    const totalOriginal = clientReceivables.reduce(
      (a, r) => a + (r.totalOriginal || 0),
      0,
    );
    const totalPaid = clientReceivables.reduce(
      (a, r) => a + (r.totalPaid || 0),
      0,
    );
    const totalBalance = clientReceivables.reduce(
      (a, r) => a + (r.balance || 0),
      0,
    );

    // Vencidos
    const today = new Date();
    const overdue = clientReceivables.filter((r) => {
      if (r.balance <= 0) return false;
      const due = r.dueDate?.toDate ? r.dueDate.toDate() : new Date(r.dueDate);
      return due < today;
    });

    const overdueAmount = overdue.reduce((a, r) => a + (r.balance || 0), 0);

    // Días de la deuda más antigua pendiente
    const oldestPending = clientReceivables
      .filter((r) => r.balance > 0)
      .sort((a, b) => {
        const da = a.createdAt?.toDate
          ? a.createdAt.toDate()
          : new Date(a.createdAt);
        const db_ = b.createdAt?.toDate
          ? b.createdAt.toDate()
          : new Date(b.createdAt);
        return da - db_;
      })[0];

    const oldestDays = oldestPending
      ? daysBetween(
          oldestPending.createdAt?.toDate
            ? oldestPending.createdAt.toDate()
            : new Date(oldestPending.createdAt),
          today,
        )
      : 0;

    // Vendedores involucrados
    const sellers = [...new Set(clientReceivables.map((r) => r.sellerName))];

    const first = clientReceivables[0];

    return {
      clientId,
      clientName: first.clientName,
      clientPhone: first.clientPhone,
      totalOriginal,
      totalPaid,
      totalBalance,
      overdueCount: overdue.length,
      overdueAmount,
      oldestDays,
      sellers,
      receivables: clientReceivables,
      hasNovelty: overdue.length > 0, // vencido = tiene novedad
    };
  };

  const getAllClientsWithBalance = () => {
    const clientMap = {};
    receivables.forEach((r) => {
      if (r.balance <= 0) return;
      if (!clientMap[r.clientId]) clientMap[r.clientId] = true;
    });

    return Object.keys(clientMap)
      .map((cid) => getClientSummary(cid))
      .filter(Boolean);
  };

  const getNoveltyClients = () => {
    return getAllClientsWithBalance()
      .filter((c) => c.hasNovelty)
      .sort((a, b) => b.overdueAmount - a.overdueAmount);
  };

  const getReceivablesBySeller = (sellerId) => {
    return receivables.filter((r) => r.sellerId === sellerId && r.balance > 0);
  };

  const getTotals = () => {
    const pending = receivables.filter((r) => r.balance > 0);
    const today = new Date();

    const overdue = pending.filter((r) => {
      const due = r.dueDate?.toDate ? r.dueDate.toDate() : new Date(r.dueDate);
      return due < today;
    });

    return {
      totalOriginal: receivables.reduce(
        (a, r) => a + (r.totalOriginal || 0),
        0,
      ),
      totalPaid: receivables.reduce((a, r) => a + (r.totalPaid || 0), 0),
      totalBalance: pending.reduce((a, r) => a + (r.balance || 0), 0),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((a, r) => a + (r.balance || 0), 0),
      pendingCount: pending.length,
    };
  };

  // ==========================================
  // Sincronizar con pedidos (recalcular estado vencido)
  // ==========================================
  const getStatusInfo = (receivable) => {
    if (receivable.balance <= 0)
      return { label: "Pagado", color: "#16a34a", bg: "#dcfce7" };

    const today = new Date();
    const due = receivable.dueDate?.toDate
      ? receivable.dueDate.toDate()
      : new Date(receivable.dueDate);
    const daysToDue = daysBetween(today, due);

    if (daysToDue < 0)
      return {
        label: `Vencido hace ${Math.abs(daysToDue)}d`,
        color: "#b91c1c",
        bg: "#fee2e2",
      };

    if (daysToDue <= 3)
      return {
        label: `Vence en ${daysToDue}d`,
        color: "#b45309",
        bg: "#fef3c7",
      };

    return {
      label: `Vence en ${daysToDue}d`,
      color: "#0369a1",
      bg: "#e0f2fe",
    };
  };

  return (
    <ReceivableContext.Provider
      value={{
        receivables,
        loading,
        createReceivable,
        registerPaymentOnReceivable,
        applyFifoPayment,
        getClientSummary,
        getAllClientsWithBalance,
        getNoveltyClients,
        getReceivablesBySeller,
        getTotals,
        getStatusInfo,
        daysBetween,
      }}
    >
      {children}
    </ReceivableContext.Provider>
  );
}
