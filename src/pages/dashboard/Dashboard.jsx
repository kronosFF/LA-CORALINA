import { useContext, useState, useMemo } from "react";
import { OrderContext } from "../../context/OrderContext";
import { ProductContext } from "../../context/ProductContext";
import { AuthContext } from "../../context/AuthContext";
import { EmptyBottleContext } from "../../context/EmptyBottleContext";
import { ClientContext } from "../../context/ClientContext";
import { AssignmentContext } from "../../context/AssignmentContext";
import { CashClosingContext } from "../../context/CashClosingContext";
import { ReceivableContext } from "../../context/ReceivableContext";
import { useToast } from "../../context/ToastContext";
import { useNavigate } from "react-router-dom";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import { formatDuration } from "../../hooks/formatTime";
import "./Dashboard.css";

export default function Dashboard() {
  const { orders, getAllExpensesGrouped } = useContext(OrderContext);
  const { products, getStockMovements } = useContext(ProductContext);
  const { user, users } = useContext(AuthContext);
  const { getAllDebts } = useContext(EmptyBottleContext);
  const { getInactiveClients } = useContext(ClientContext);
  const { getGlobalDailySummary, getTodayKey } = useContext(AssignmentContext);
  const { pendingClosings, recentClosings } = useContext(CashClosingContext);
  const { getNoveltyClients, getTotals: getReceivableTotals } =
    useContext(ReceivableContext);
  const { addToast } = useToast();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hour, setHour] = useState("");
  const [filterSeller, setFilterSeller] = useState("");

  const [modal, setModal] = useState(null);

  const isGerencia = user?.role === "gerencia";
  const isPlanta = user?.role === "planta";
  const isVendedor = user?.role === "vendedor";
  const isProduccion = user?.role === "produccion";

  const canSeeAdminSections = isGerencia || isPlanta;
  const canSeeInventory = isGerencia || isPlanta || isProduccion;
  const canSeeBoard = isGerencia || isPlanta || isVendedor;

  // ==========================================
  // FILTRADO
  // ==========================================
  let filtered = [...orders];

  if (isVendedor) {
    filtered = filtered.filter((o) => o.sellerId === user.id);
  }

  if (filterSeller && !isVendedor) {
    filtered = filtered.filter((o) => o.sellerId === filterSeller);
  }

  if (startDate && endDate) {
    filtered = filtered.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let d = o.createdAt?.toDate
          ? o.createdAt.toDate()
          : new Date(o.createdAt);
        if (isNaN(d.getTime())) return false;
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        return d >= s && d <= e;
      } catch {
        return false;
      }
    });
  } else if (startDate) {
    filtered = filtered.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let d = o.createdAt?.toDate
          ? o.createdAt.toDate()
          : new Date(o.createdAt);
        if (isNaN(d.getTime())) return false;
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        return d >= s;
      } catch {
        return false;
      }
    });
  } else if (endDate) {
    filtered = filtered.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let d = o.createdAt?.toDate
          ? o.createdAt.toDate()
          : new Date(o.createdAt);
        if (isNaN(d.getTime())) return false;
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        return d <= e;
      } catch {
        return false;
      }
    });
  }

  if (hour) {
    filtered = filtered.filter((o) => {
      if (!o.createdAt) return false;
      try {
        let d = o.createdAt?.toDate
          ? o.createdAt.toDate()
          : new Date(o.createdAt);
        if (isNaN(d.getTime())) return false;
        return d.getHours().toString().padStart(2, "0") === hour;
      } catch {
        return false;
      }
    });
  }

  // ==========================================
  // MÉTRICAS
  // ==========================================
  const delivered = filtered.filter((o) => o.status === "entregado");
  const totalSales = delivered.reduce((acc, o) => acc + (o.total || 0), 0);
  const totalOrders = filtered.length;

  const getTimeDiff = (order, startKey, endKey) => {
    if (!order.timestamps?.[startKey] || !order.timestamps?.[endKey])
      return null;
    const s = order.timestamps[startKey].toDate
      ? order.timestamps[startKey].toDate()
      : new Date(order.timestamps[startKey]);
    const e = order.timestamps[endKey].toDate
      ? order.timestamps[endKey].toDate()
      : new Date(order.timestamps[endKey]);
    return isNaN(s) || isNaN(e) ? null : e - s;
  };

  const calculateAverageTimeSeconds = (fn) => {
    const times = delivered.map(fn).filter((t) => t && t > 0);
    if (times.length === 0) return 0;
    return Math.floor(times.reduce((a, t) => a + t, 0) / times.length / 1000);
  };

  const avgPrepSeconds = calculateAverageTimeSeconds((o) =>
    getTimeDiff(o, "preparacion", "reparto"),
  );
  const avgRepartoSecs = calculateAverageTimeSeconds((o) =>
    getTimeDiff(o, "reparto", "entregado"),
  );
  const avgTotalSecs = calculateAverageTimeSeconds((o) =>
    getTimeDiff(o, "preparacion", "entregado"),
  );

  // ==========================================
  // SEMÁFORO
  // ==========================================
  const now = new Date();
  const getOrderColor = (order) => {
    if (order.status === "entregado" || order.status === "cancelado")
      return "success";
    let seconds = 0;
    let limit = 0;
    if (order.status === "preparacion" && order.timestamps?.preparacion) {
      const start = order.timestamps.preparacion.toDate
        ? order.timestamps.preparacion.toDate()
        : new Date(order.timestamps.preparacion);
      seconds = (now - start) / 1000;
      limit = (order.clientData?.prepMinutes || 15) * 60;
    } else if (order.status === "reparto" && order.timestamps?.reparto) {
      const start = order.timestamps.reparto.toDate
        ? order.timestamps.reparto.toDate()
        : new Date(order.timestamps.reparto);
      seconds = (now - start) / 1000;
      limit = (order.clientData?.deliveryMinutes || 30) * 60;
    } else return "success";
    if (seconds < limit * 0.8) return "success";
    if (seconds < limit) return "warning";
    return "danger";
  };

  const getOrderElapsedSeconds = (order) => {
    if (order.status === "preparacion" && order.timestamps?.preparacion) {
      const s = order.timestamps.preparacion.toDate
        ? order.timestamps.preparacion.toDate()
        : new Date(order.timestamps.preparacion);
      return Math.max(0, Math.floor((now - s) / 1000));
    }
    if (order.status === "reparto" && order.timestamps?.reparto) {
      const s = order.timestamps.reparto.toDate
        ? order.timestamps.reparto.toDate()
        : new Date(order.timestamps.reparto);
      return Math.max(0, Math.floor((now - s) / 1000));
    }
    return 0;
  };

  const getOrderLimitSeconds = (order) => {
    if (order.status === "preparacion")
      return (order.clientData?.prepMinutes || 15) * 60;
    if (order.status === "reparto")
      return (order.clientData?.deliveryMinutes || 30) * 60;
    return 0;
  };

  const verdes = filtered.filter(
    (o) =>
      getOrderColor(o) === "success" &&
      o.status !== "entregado" &&
      o.status !== "cancelado",
  );
  const amarillos = filtered.filter((o) => getOrderColor(o) === "warning");
  const rojos = filtered.filter((o) => getOrderColor(o) === "danger");

  const totalSemaforo = verdes.length + amarillos.length + rojos.length || 1;
  const pct = (n) => Math.round((n / totalSemaforo) * 100);

  // ==========================================
  // HISTÓRICO
  // ==========================================
  const getHistoricalColor = (order) => {
    if (order.status !== "entregado" && order.status !== "cancelado")
      return null;
    let worstState = "success";
    const evaluatePhase = (startKey, endKey, limitMinutes) => {
      if (!order.timestamps?.[startKey] || !order.timestamps?.[endKey]) return;
      const s = order.timestamps[startKey].toDate
        ? order.timestamps[startKey].toDate()
        : new Date(order.timestamps[startKey]);
      const e = order.timestamps[endKey].toDate
        ? order.timestamps[endKey].toDate()
        : new Date(order.timestamps[endKey]);
      if (!isNaN(s) && !isNaN(e)) {
        const timeSec = (e - s) / 1000;
        const limitSec = (limitMinutes || 15) * 60;
        if (timeSec >= limitSec) worstState = "danger";
        else if (timeSec >= limitSec * 0.8 && worstState !== "danger")
          worstState = "warning";
      }
    };
    evaluatePhase(
      "preparacion",
      "reparto",
      order.clientData?.prepMinutes || 15,
    );
    evaluatePhase(
      "reparto",
      "entregado",
      order.clientData?.deliveryMinutes || 30,
    );
    return worstState;
  };

  const finishedOrders = filtered.filter(
    (o) => o.status === "entregado" || o.status === "cancelado",
  );
  const histVerdes = finishedOrders.filter(
    (o) => getHistoricalColor(o) === "success",
  );
  const histAmarillos = finishedOrders.filter(
    (o) => getHistoricalColor(o) === "warning",
  );
  const histRojos = finishedOrders.filter(
    (o) => getHistoricalColor(o) === "danger",
  );
  const totalHistorico = finishedOrders.length || 1;
  const pctHist = (n) => Math.round((n / totalHistorico) * 100);

  // ==========================================
  // RANKING
  // ==========================================
  const salesBySeller = {};
  delivered.forEach((o) => {
    if (!salesBySeller[o.sellerName])
      salesBySeller[o.sellerName] = { total: 0, orders: [] };
    salesBySeller[o.sellerName].total += o.total || 0;
    salesBySeller[o.sellerName].orders.push(o);
  });
  const ranking = Object.entries(salesBySeller)
    .map(([seller, data]) => ({
      seller,
      total: data.total,
      orders: data.orders,
    }))
    .sort((a, b) => b.total - a.total);

  const bottleDebts = getAllDebts(users, orders);
  const inactiveClients = getInactiveClients();
  const groupedExpenses = getAllExpensesGrouped();
  const expenseCategories = {
    gasolina: "Gasolina",
    reparacion: "Reparación",
    alimentacion: "Alimentación",
    peajes: "Peajes",
    otros: "Otros",
  };

  const boardSummary = canSeeBoard ? getGlobalDailySummary(getTodayKey()) : [];

  const noveltyClients = canSeeAdminSections ? getNoveltyClients() : [];
  const receivableTotals = canSeeAdminSections
    ? getReceivableTotals()
    : { totalBalance: 0, overdueAmount: 0 };

  // ==========================================
  // HELPERS
  // ==========================================
  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setHour("");
    setFilterSeller("");
    addToast("Filtros limpiados", "success");
  };

  const shortId = (order) => order.numericId || order.id.slice(-6);
  const sellerName = (order) => order.sellerName || "Sin asignar";
  const clientName = (order) => order.clientData?.name || order.client || "—";

  const openOrderListModal = (
    title,
    subtitle,
    ordersList,
    extraColumns = [],
  ) => {
    setModal({
      title,
      subtitle,
      columns: [
        { key: "id", label: "Pedido" },
        { key: "client", label: "Cliente" },
        { key: "seller", label: "Vendedor" },
        { key: "total", label: "Total" },
        { key: "status", label: "Estado" },
        ...extraColumns,
      ],
      rows: ordersList.map((o) => {
        const row = {
          id: `#${shortId(o)}`,
          client: clientName(o),
          seller: sellerName(o),
          total: `$${(o.total || 0).toLocaleString()}`,
          status: o.status,
        };
        if (extraColumns.find((c) => c.key === "elapsed"))
          row.elapsed = formatDuration(getOrderElapsedSeconds(o));
        if (extraColumns.find((c) => c.key === "limit"))
          row.limit = formatDuration(getOrderLimitSeconds(o));
        if (extraColumns.find((c) => c.key === "delay")) {
          const elapsed = getOrderElapsedSeconds(o);
          const limit = getOrderLimitSeconds(o);
          row.delay =
            elapsed > limit ? `+${formatDuration(elapsed - limit)}` : "—";
        }
        if (extraColumns.find((c) => c.key === "prepTime")) {
          const t = getTimeDiff(o, "preparacion", "reparto");
          row.prepTime = t ? formatDuration(Math.floor(t / 1000)) : "—";
        }
        if (extraColumns.find((c) => c.key === "deliveryTime")) {
          const t = getTimeDiff(o, "reparto", "entregado");
          row.deliveryTime = t ? formatDuration(Math.floor(t / 1000)) : "—";
        }
        if (extraColumns.find((c) => c.key === "totalTime")) {
          const t = getTimeDiff(o, "preparacion", "entregado");
          row.totalTime = t ? formatDuration(Math.floor(t / 1000)) : "—";
        }
        return row;
      }),
      searchable: true,
    });
  };

  // ==========================================
  // MODALES
  // ==========================================
  const handleKPISales = () => {
    setModal({
      title: "Ventas del período",
      subtitle: `Total: $${totalSales.toLocaleString()} en ${delivered.length} pedidos entregados`,
      columns: [
        { key: "id", label: "Pedido" },
        { key: "client", label: "Cliente" },
        { key: "seller", label: "Vendedor" },
        { key: "total", label: "Total" },
      ],
      rows: delivered.map((o) => ({
        id: `#${shortId(o)}`,
        client: clientName(o),
        seller: sellerName(o),
        total: `$${(o.total || 0).toLocaleString()}`,
      })),
      searchable: true,
    });
  };

  const handleKPITotalOrders = () => {
    openOrderListModal(
      "Todos los pedidos del período",
      `${filtered.length} pedidos en total`,
      filtered,
    );
  };

  const handleKPIPrep = () => {
    const sorted = [...delivered].sort((a, b) => {
      const ta = getTimeDiff(a, "preparacion", "reparto") || 0;
      const tb = getTimeDiff(b, "preparacion", "reparto") || 0;
      return tb - ta;
    });
    openOrderListModal(
      "Tiempos de preparación",
      `Promedio: ${formatDuration(avgPrepSeconds)} — ordenados del peor al mejor`,
      sorted,
      [{ key: "prepTime", label: "Tiempo Prep" }],
    );
  };

  const handleKPIDelivery = () => {
    const sorted = [...delivered].sort((a, b) => {
      const ta = getTimeDiff(a, "reparto", "entregado") || 0;
      const tb = getTimeDiff(b, "reparto", "entregado") || 0;
      return tb - ta;
    });
    openOrderListModal(
      "Tiempos de reparto",
      `Promedio: ${formatDuration(avgRepartoSecs)} — ordenados del peor al mejor`,
      sorted,
      [{ key: "deliveryTime", label: "Tiempo Reparto" }],
    );
  };

  const handleKPITotal = () => {
    const sorted = [...delivered].sort((a, b) => {
      const ta = getTimeDiff(a, "preparacion", "entregado") || 0;
      const tb = getTimeDiff(b, "preparacion", "entregado") || 0;
      return tb - ta;
    });
    openOrderListModal(
      "Tiempos totales (ciclo completo)",
      `Promedio: ${formatDuration(avgTotalSecs)} — ordenados del peor al mejor`,
      sorted,
      [{ key: "totalTime", label: "Tiempo Total" }],
    );
  };

  const handleSemaphoreGreen = () => {
    openOrderListModal(
      "🟢 Pedidos en tiempo",
      `${verdes.length} pedidos dentro del límite`,
      verdes,
      [
        { key: "elapsed", label: "Transcurrido" },
        { key: "limit", label: "Límite" },
      ],
    );
  };

  const handleSemaphoreYellow = () => {
    openOrderListModal(
      "🟡 Pedidos en riesgo",
      `${amarillos.length} pedidos cerca del límite (80%-100%)`,
      amarillos,
      [
        { key: "elapsed", label: "Transcurrido" },
        { key: "limit", label: "Límite" },
      ],
    );
  };

  const handleSemaphoreRed = () => {
    const sorted = [...rojos].sort((a, b) => {
      return (
        getOrderElapsedSeconds(b) -
        getOrderLimitSeconds(b) -
        (getOrderElapsedSeconds(a) - getOrderLimitSeconds(a))
      );
    });
    openOrderListModal(
      "🔴 Pedidos críticos",
      `${rojos.length} pedidos superaron el límite — ordenados por retraso`,
      sorted,
      [
        { key: "elapsed", label: "Transcurrido" },
        { key: "limit", label: "Límite" },
        { key: "delay", label: "Retraso" },
      ],
    );
  };

  const handleHistGreen = () => {
    openOrderListModal(
      "🟢 Histórico a tiempo",
      `${histVerdes.length} pedidos finalizados sin superar límites`,
      histVerdes,
      [{ key: "totalTime", label: "Tiempo Total" }],
    );
  };

  const handleHistYellow = () => {
    openOrderListModal(
      "🟡 Histórico en riesgo",
      `${histAmarillos.length} pedidos finalizados al 80%-100% del límite`,
      histAmarillos,
      [{ key: "totalTime", label: "Tiempo Total" }],
    );
  };

  const handleHistRed = () => {
    openOrderListModal(
      "🔴 Histórico críticos",
      `${histRojos.length} pedidos finalizados que superaron el límite`,
      histRojos,
      [{ key: "totalTime", label: "Tiempo Total" }],
    );
  };

  const handleRankingClick = (seller, ordersList) => {
    const productMap = {};
    ordersList.forEach((o) => {
      (o.items || []).forEach((item) => {
        productMap[item.name] = (productMap[item.name] || 0) + item.qty;
      });
    });
    const productsTop = Object.entries(productMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const clients = new Set(ordersList.map((o) => clientName(o)));

    setModal({
      title: `📊 Detalle de ${seller}`,
      subtitle: `${ordersList.length} pedidos — Clientes únicos: ${clients.size}`,
      columns: [
        { key: "id", label: "Pedido" },
        { key: "client", label: "Cliente" },
        { key: "total", label: "Total" },
        { key: "totalTime", label: "Tiempo Total" },
      ],
      rows: ordersList.map((o) => {
        const t = getTimeDiff(o, "preparacion", "entregado");
        return {
          id: `#${shortId(o)}`,
          client: clientName(o),
          total: `$${(o.total || 0).toLocaleString()}`,
          totalTime: t ? formatDuration(Math.floor(t / 1000)) : "—",
        };
      }),
      searchable: true,
      extraContent:
        productsTop.length > 0 ? (
          <div className="modal-top-products">
            <strong>🏆 Top productos:</strong>
            <div className="modal-top-products-list">
              {productsTop.map(([name, qty]) => (
                <span key={name} className="modal-top-product-tag">
                  {name} × {qty}
                </span>
              ))}
            </div>
          </div>
        ) : null,
    });
  };

  const handleExpenseCategory = (sellerName, categoryKey, expensesList) => {
    setModal({
      title: `💰 ${expenseCategories[categoryKey] || categoryKey} — ${sellerName}`,
      subtitle: `${expensesList.length} gastos — Total: $${expensesList
        .reduce((a, e) => a + (e.amount || 0), 0)
        .toLocaleString()}`,
      columns: [
        { key: "concept", label: "Concepto" },
        { key: "amount", label: "Monto" },
        { key: "date", label: "Fecha" },
        { key: "comment", label: "Comentario" },
      ],
      rows: expensesList.map((e) => ({
        concept: e.concept,
        amount: `$${(e.amount || 0).toLocaleString()}`,
        date:
          e.date?.toDate?.().toLocaleDateString() ||
          new Date(e.date).toLocaleDateString(),
        comment: e.comment || "—",
      })),
      searchable: true,
    });
  };

  const handleInactiveClient = (client, lastOrder) => {
    setModal({
      title: `😴 ${client.name}`,
      subtitle: `Lleva ${client.daysInactive} días sin pedir (alerta configurada: cada ${client.expectedDays} días)`,
      columns: [
        { key: "field", label: "Dato" },
        { key: "value", label: "Valor" },
      ],
      rows: [
        { field: "📞 Teléfono", value: client.phone || "—" },
        { field: "📧 Email", value: client.email || "—" },
        { field: "📍 Dirección", value: client.address || "—" },
        {
          field: "📅 Último pedido",
          value:
            client.lastOrderDate?.toDate?.().toLocaleDateString() ||
            (client.lastOrderDate
              ? new Date(client.lastOrderDate).toLocaleDateString()
              : "Nunca"),
        },
        { field: "👤 Último vendedor", value: lastOrder?.sellerName || "—" },
        {
          field: "💵 Último monto",
          value: lastOrder
            ? `$${(lastOrder.total || 0).toLocaleString()}`
            : "—",
        },
        { field: "⏱️ Días inactivo", value: `${client.daysInactive} días` },
      ],
      actions: [
        {
          label: "🛒 Crear pedido",
          onClick: () => {
            navigate("/crear");
            setModal(null);
          },
        },
        {
          label: "👥 Ver clientes",
          onClick: () => {
            navigate("/clientes");
            setModal(null);
          },
        },
      ],
    });
  };

  const handleStockProduct = async (product) => {
    const movements = await getStockMovements({ productId: product.id });
    const recent = movements.slice(0, 10);

    setModal({
      title: `📦 ${product.name}`,
      subtitle: `Stock actual: ${product.stock || 0} unidades · Precio: $${(product.price || 0).toLocaleString()}`,
      columns: [
        { key: "type", label: "Tipo" },
        { key: "qty", label: "Cantidad" },
        { key: "user", label: "Usuario" },
        { key: "date", label: "Fecha" },
        { key: "comment", label: "Comentario" },
      ],
      rows:
        recent.length === 0
          ? [
              {
                type: "—",
                qty: "—",
                user: "—",
                date: "Sin movimientos",
                comment: "—",
              },
            ]
          : recent.map((m) => ({
              type: m.type === "entrada" ? "📥 Entrada" : "📤 Salida",
              qty: `${m.type === "entrada" ? "+" : "-"}${m.quantity}`,
              user: m.userName || "—",
              date:
                m.date?.toDate?.().toLocaleString() ||
                new Date(m.date).toLocaleString(),
              comment: m.comment || "—",
            })),
      actions: [
        {
          label: "📦 Ir a Stock",
          onClick: () => {
            navigate("/stock");
            setModal(null);
          },
        },
      ],
      searchable: false,
    });
  };

  const handleBottleDebt = (debt) => {
    setModal({
      title: `🥤 Deuda de botellones — ${debt.sellerName}`,
      subtitle: `Vendidos: ${debt.totalSold} · Reportados: ${debt.totalReported} · Debe: ${debt.debt}`,
      columns: [
        { key: "field", label: "Dato" },
        { key: "value", label: "Valor" },
      ],
      rows: [
        { field: "🛒 Total vendidos", value: debt.totalSold },
        { field: "↩️ Total reportados", value: debt.totalReported },
        { field: "⚠️ Deuda actual", value: debt.debt },
      ],
      actions: [
        {
          label: "📦 Ir a Stock",
          onClick: () => {
            navigate("/stock");
            setModal(null);
          },
        },
      ],
      searchable: false,
    });
  };

  const handleBoardSeller = (seller) => {
    setModal({
      title: `📋 Tablero de ${seller.sellerName}`,
      subtitle: `${seller.products.length} productos · Valor vendido hoy: $${(seller.totalSoldValue || 0).toLocaleString()}`,
      columns: [
        { key: "product", label: "Producto" },
        { key: "assigned", label: "Asignado" },
        { key: "returned", label: "Devuelto" },
        { key: "sold", label: "Vendido" },
        { key: "value", label: "Valor" },
      ],
      rows: seller.products.map((p) => ({
        product: p.name,
        assigned: p.assigned,
        returned: p.returned,
        sold: p.sold,
        value: `$${(p.sold * (p.price || 0)).toLocaleString()}`,
      })),
      actions: [
        {
          label: "📋 Ir al tablero",
          onClick: () => {
            navigate("/tablero");
            setModal(null);
          },
        },
      ],
      searchable: false,
    });
  };

  const handlePendingCreditsClick = () => {
    const credits = filtered.filter(
      (o) =>
        (o.paymentStatus === "credito" || o.paymentStatus === "pendiente") &&
        (o.totalPaid || 0) < (o.total || 0),
    );
    setModal({
      title: "💳 Créditos pendientes",
      subtitle: `${credits.length} pedidos con saldo pendiente — Total: $${credits
        .reduce((a, o) => a + ((o.total || 0) - (o.totalPaid || 0)), 0)
        .toLocaleString()}`,
      columns: [
        { key: "id", label: "Pedido" },
        { key: "client", label: "Cliente" },
        { key: "seller", label: "Vendedor" },
        { key: "total", label: "Total" },
        { key: "paid", label: "Pagado" },
        { key: "debt", label: "Debe" },
      ],
      rows: credits.map((o) => ({
        id: `#${shortId(o)}`,
        client: clientName(o),
        seller: sellerName(o),
        total: `$${(o.total || 0).toLocaleString()}`,
        paid: `$${(o.totalPaid || 0).toLocaleString()}`,
        debt: `$${((o.total || 0) - (o.totalPaid || 0)).toLocaleString()}`,
      })),
      searchable: true,
    });
  };

  const handleLowStockClick = () => {
    const lowStock = products.filter((p) => (p.stock || 0) <= 15);
    setModal({
      title: "⚠️ Productos con stock bajo",
      subtitle: `${lowStock.length} productos requieren reposición`,
      columns: [
        { key: "product", label: "Producto" },
        { key: "stock", label: "Stock" },
        { key: "price", label: "Precio" },
        { key: "severity", label: "Severidad" },
      ],
      rows: lowStock.map((p) => ({
        product: p.name,
        stock: p.stock || 0,
        price: `$${(p.price || 0).toLocaleString()}`,
        severity: (p.stock || 0) <= 5 ? "🔴 Crítico" : "🟡 Bajo",
      })),
      actions: [
        {
          label: "📦 Ir a Stock",
          onClick: () => {
            navigate("/stock");
            setModal(null);
          },
        },
      ],
      searchable: true,
    });
  };

  const handleOpenClosings = () => {
    navigate("/cuadres");
  };

  const handleOpenCartera = () => {
    navigate("/cartera");
  };

  const pendingCreditsCount = filtered.filter(
    (o) =>
      (o.paymentStatus === "credito" || o.paymentStatus === "pendiente") &&
      (o.totalPaid || 0) < (o.total || 0),
  ).length;

  const lowStockProducts = products.filter((p) => (p.stock || 0) <= 15);

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>

      {/* BANNER DE ALERTAS */}
      {canSeeAdminSections &&
        (rojos.length > 0 ||
          lowStockProducts.length > 0 ||
          pendingClosings.length > 0 ||
          noveltyClients.length > 0) && (
          <div className="dash-alert-banner">
            <div className="dash-alert-icon">🚨</div>
            <div className="dash-alert-content">
              <strong>¡Atención requerida!</strong>
              <ul>
                {rojos.length > 0 && (
                  <li>
                    <button
                      className="dash-alert-link"
                      onClick={handleSemaphoreRed}
                    >
                      {rojos.length} pedido(s) crítico(s) superaron el tiempo
                      límite
                    </button>
                  </li>
                )}
                {noveltyClients.length > 0 && (
                  <li>
                    <button
                      className="dash-alert-link"
                      onClick={handleOpenCartera}
                    >
                      {noveltyClients.length} cliente(s) con deuda vencida en
                      cartera
                    </button>
                  </li>
                )}
                {pendingClosings.length > 0 && (
                  <li>
                    <button
                      className="dash-alert-link"
                      onClick={handleOpenClosings}
                    >
                      {pendingClosings.length} cuadre(s) pendiente(s) de aprobar
                    </button>
                  </li>
                )}
                {lowStockProducts.length > 0 && (
                  <li>
                    <button
                      className="dash-alert-link"
                      onClick={handleLowStockClick}
                    >
                      {lowStockProducts.length} producto(s) con stock bajo
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

      {/* TABLERO EN VIVO */}
      {canSeeBoard && (
        <div className="dash-section">
          <div className="dash-section-header">
            <h3>📋 Tablero en vivo — {new Date().toLocaleDateString()}</h3>
            <button
              className="dash-section-link"
              onClick={() => navigate("/tablero")}
            >
              Ver tablero completo →
            </button>
          </div>

          {boardSummary.length === 0 ? (
            <EmptyState
              icon={<Icons.Package size={32} />}
              title="Sin asignaciones hoy"
              description="Crea una nueva asignación en el Tablero para empezar."
            />
          ) : (
            <div className="board-live-grid">
              {boardSummary
                .filter((s) => !isVendedor || s.sellerId === user.id)
                .map((seller) => {
                  const totalAssigned = seller.products.reduce(
                    (a, p) => a + p.assigned,
                    0,
                  );
                  const totalSold = seller.products.reduce(
                    (a, p) => a + p.sold,
                    0,
                  );
                  const progress =
                    totalAssigned > 0
                      ? Math.round((totalSold / totalAssigned) * 100)
                      : 0;

                  return (
                    <div
                      key={seller.sellerId}
                      className="board-live-card"
                      onClick={() => handleBoardSeller(seller)}
                    >
                      <div className="board-live-header">
                        <strong>{seller.sellerName}</strong>
                        {seller.hasOpenLoad && (
                          <span className="board-live-badge">🟢 Abierta</span>
                        )}
                      </div>

                      <div className="board-live-progress">
                        <div
                          className="board-live-progress-fill"
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>

                      <div className="board-live-stats">
                        <span>
                          {totalSold} / {totalAssigned} productos
                        </span>
                        <span className="board-live-value">
                          ${(seller.totalSoldValue || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* FILTROS */}
      <div className="dash-section">
        <h3>🔍 Filtros</h3>
        <div className="dash-filters">
          <div className="filter-group">
            <label>Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="dash-input"
            />
          </div>
          <div className="filter-group">
            <label>Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="dash-input"
            />
          </div>
          <div className="filter-group">
            <label>Hora pico</label>
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className="dash-input"
            >
              <option value="">Todas</option>
              {[...Array(24)].map((_, i) => {
                const h = i.toString().padStart(2, "0");
                return (
                  <option key={h} value={h}>
                    {h}:00
                  </option>
                );
              })}
            </select>
          </div>
          {!isVendedor && (
            <div className="filter-group">
              <label>Vendedor</label>
              <select
                value={filterSeller}
                onChange={(e) => setFilterSeller(e.target.value)}
                className="dash-input"
              >
                <option value="">Todos</option>
                {users
                  .filter((u) => u.role === "vendedor")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <button onClick={clearFilters} className="dash-btn-clear">
            Limpiar filtros
          </button>
        </div>
        {(startDate || endDate) && (
          <div className="dash-filter-summary">
            Rango:{" "}
            {startDate
              ? new Date(startDate).toLocaleDateString()
              : "Desde siempre"}{" "}
            → {endDate ? new Date(endDate).toLocaleDateString() : "Hoy"}
          </div>
        )}
      </div>

      {/* KPI VENTAS */}
      <div className="dash-section">
        <h3>
          <Icons.Money size={18} /> Ventas y tiempos
          <span className="dash-section-hint">
            (clic en cada tarjeta para ver detalle)
          </span>
        </h3>
        <div className="dash-grid">
          <KPICard
            title="Ventas"
            value={`$${totalSales.toLocaleString()}`}
            gradient="gradient-blue"
            icon={<Icons.Money size={22} />}
            onClick={handleKPISales}
          />
          <KPICard
            title="Pedidos"
            value={totalOrders}
            gradient="gradient-purple"
            icon={<Icons.Package size={22} />}
            onClick={handleKPITotalOrders}
          />
          <KPICard
            title="Prep Promedio"
            value={formatDuration(avgPrepSeconds)}
            gradient="gradient-green"
            icon={<Icons.Clock size={22} />}
            onClick={handleKPIPrep}
          />
          <KPICard
            title="Reparto Promedio"
            value={formatDuration(avgRepartoSecs)}
            gradient="gradient-orange"
            icon={<Icons.Clock size={22} />}
            onClick={handleKPIDelivery}
          />
          <KPICard
            title="Total Promedio"
            value={formatDuration(avgTotalSecs)}
            gradient="gradient-pink"
            icon={<Icons.Clock size={22} />}
            onClick={handleKPITotal}
          />
        </div>
      </div>

      {/* SEMÁFORO ACTUAL */}
      <div className="dash-section">
        <h3>
          <Icons.Clock size={18} /> Estado actual de pedidos (En curso)
          <span className="dash-section-hint">(clic para ver la lista)</span>
        </h3>
        <div className="dash-grid">
          <CardDot
            title="En tiempo"
            value={`${verdes.length} (${pct(verdes.length)}%)`}
            color="success"
            icon={<Icons.Check size={20} />}
            onClick={handleSemaphoreGreen}
          />
          <CardDot
            title="En riesgo"
            value={`${amarillos.length} (${pct(amarillos.length)}%)`}
            color="warning"
            icon={<Icons.Warning size={20} />}
            onClick={handleSemaphoreYellow}
          />
          <CardDot
            title="Críticos"
            value={`${rojos.length} (${pct(rojos.length)}%)`}
            color="danger"
            icon={<Icons.Error size={20} />}
            onClick={handleSemaphoreRed}
            pulse={rojos.length > 0}
          />
        </div>
      </div>

      {/* HISTORIAL EFICIENCIA */}
      <div className="dash-section">
        <h3>
          <Icons.Check size={18} /> Historial de Eficiencia (Finalizados)
          <span className="dash-section-hint">(clic para ver la lista)</span>
        </h3>
        <p className="dash-section-desc">
          Evalúa si los pedidos entregados cumplieron los tiempos límite durante
          su proceso.
        </p>
        {finishedOrders.length === 0 ? (
          <EmptyState
            icon={<Icons.Info size={32} />}
            title="Sin datos"
            description="No hay pedidos finalizados para evaluar en este período."
          />
        ) : (
          <div className="dash-grid">
            <CardGlow
              title="A tiempo"
              value={`${histVerdes.length} (${pctHist(histVerdes.length)}%)`}
              color="success"
              icon={<Icons.Check size={20} />}
              onClick={handleHistGreen}
            />
            <CardGlow
              title="En riesgo"
              value={`${histAmarillos.length} (${pctHist(histAmarillos.length)}%)`}
              color="warning"
              icon={<Icons.Warning size={20} />}
              onClick={handleHistYellow}
            />
            <CardGlow
              title="Críticos"
              value={`${histRojos.length} (${pctHist(histRojos.length)}%)`}
              color="danger"
              icon={<Icons.Error size={20} />}
              onClick={handleHistRed}
            />
          </div>
        )}
      </div>

      {/* CLIENTES CON NOVEDAD EN CARTERA */}
      {canSeeAdminSections && noveltyClients.length > 0 && (
        <div className="dash-section">
          <h3>
            <Icons.Money size={18} /> 🚨 Clientes con novedad en cartera
            <span className="dash-section-hint">(clic para ver detalle)</span>
          </h3>

          <button
            className="dash-big-alert"
            onClick={handleOpenCartera}
            style={{ marginBottom: "16px" }}
          >
            <div className="dash-big-alert-icon">💳</div>
            <div className="dash-big-alert-text">
              <strong>
                {noveltyClients.length} cliente(s) con deuda vencida — $
                {receivableTotals.overdueAmount.toLocaleString()}
              </strong>
              <span>
                Total cartera: ${receivableTotals.totalBalance.toLocaleString()}
              </span>
            </div>
          </button>

          <div className="dash-grid-small">
            {noveltyClients.slice(0, 6).map((client) => (
              <div
                key={client.clientId}
                className="dash-inactive-glow clickable"
                onClick={() => navigate(`/cartera/cliente/${client.clientId}`)}
                style={{ cursor: "pointer" }}
              >
                <div className="info">
                  <strong>{client.clientName}</strong>
                  <div className="sub">
                    👤 {client.sellers.join(", ")}
                    {client.clientPhone && ` • 📞 ${client.clientPhone}`}
                  </div>
                  <div className="sub">
                    💵 Saldo: ${client.totalBalance.toLocaleString()}
                  </div>
                </div>
                <div className="days">
                  <span className="count">{client.oldestDays}d</span>
                  <span className="label">Deuda más antigua</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "14px", textAlign: "right" }}>
            <button className="dash-section-link" onClick={handleOpenCartera}>
              Ver toda la cartera →
            </button>
          </div>
        </div>
      )}

      {/* CUADRES DE JORNADA */}
      {canSeeAdminSections && (
        <div className="dash-section">
          <h3>
            <Icons.Money size={18} /> Cuadres de jornada
            <span className="dash-section-hint">(clic para ver detalle)</span>
          </h3>

          {pendingClosings.length > 0 ? (
            <button
              className="dash-big-alert"
              onClick={handleOpenClosings}
              style={{ marginBottom: "16px" }}
            >
              <div className="dash-big-alert-icon">⏳</div>
              <div className="dash-big-alert-text">
                <strong>
                  {pendingClosings.length} cuadre(s) pendientes de aprobar
                </strong>
                <span>Clic para revisarlos</span>
              </div>
            </button>
          ) : (
            <div
              style={{
                padding: "16px 20px",
                background: "#f0fdf4",
                border: "1.5px solid #86efac",
                borderRadius: "12px",
                color: "#15803d",
                fontSize: "13px",
                fontWeight: 600,
                marginBottom: "16px",
              }}
            >
              ✅ No hay cuadres pendientes de aprobar
            </div>
          )}

          {recentClosings.length > 0 && (
            <>
              <h4
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#475569",
                  marginTop: "16px",
                  marginBottom: "10px",
                }}
              >
                Últimos cuadres
              </h4>
              <div className="dash-grid-small">
                {recentClosings.slice(0, 6).map((c) => {
                  const isApproved = c.status === "aprobado";
                  const isRejected = c.status === "rechazado";
                  const hasDiff = c.cashDifference !== 0;

                  return (
                    <div
                      key={c.id}
                      className="dash-stock-elevated clickable"
                      onClick={() => navigate(`/cuadres/${c.id}`)}
                      style={{ cursor: "pointer", textAlign: "left" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "6px",
                        }}
                      >
                        <strong style={{ fontSize: "13px" }}>
                          {c.sellerName}
                        </strong>
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontWeight: 700,
                            background: isApproved
                              ? "#dcfce7"
                              : isRejected
                                ? "#fee2e2"
                                : "#fef3c7",
                            color: isApproved
                              ? "#15803d"
                              : isRejected
                                ? "#b91c1c"
                                : "#92400e",
                          }}
                        >
                          {isApproved ? "✅" : isRejected ? "❌" : "⏳"}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          marginBottom: "4px",
                        }}
                      >
                        📅 {c.date}
                      </div>
                      <div style={{ fontSize: "12px", color: "#475569" }}>
                        💵 ${(c.cashDelivered || 0).toLocaleString()}
                      </div>
                      {hasDiff && (
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            marginTop: "4px",
                            color: c.cashDifference < 0 ? "#ef4444" : "#16a34a",
                          }}
                        >
                          {c.cashDifference < 0 ? "Faltó" : "Sobró"} $
                          {Math.abs(c.cashDifference).toLocaleString()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: "14px", textAlign: "right" }}>
                <button
                  className="dash-section-link"
                  onClick={handleOpenClosings}
                >
                  Ver todos los cuadres →
                </button>
              </div>
            </>
          )}

          {pendingClosings.length === 0 && recentClosings.length === 0 && (
            <EmptyState
              icon={<Icons.Info size={32} />}
              title="Sin cuadres registrados"
              description="Cuando los vendedores cierren jornada, aparecerán aquí."
            />
          )}
        </div>
      )}

      {/* CRÉDITOS PENDIENTES */}
      {pendingCreditsCount > 0 && canSeeAdminSections && (
        <div className="dash-section">
          <h3>
            <Icons.Money size={18} /> Créditos pendientes (pedidos)
            <span className="dash-section-hint">(clic para ver la lista)</span>
          </h3>
          <button
            className="dash-big-alert"
            onClick={handlePendingCreditsClick}
          >
            <div className="dash-big-alert-icon">💳</div>
            <div className="dash-big-alert-text">
              <strong>
                {pendingCreditsCount} pedido(s) con saldo pendiente
              </strong>
              <span>Clic para ver el detalle y gestionar cobros</span>
            </div>
          </button>
        </div>
      )}

      {/* RANKING */}
      {canSeeAdminSections && (
        <div className="dash-section">
          <h3>
            <Icons.Users size={18} /> Ranking de vendedores
            <span className="dash-section-hint">(clic para ver detalle)</span>
          </h3>
          {ranking.length === 0 && (
            <EmptyState
              icon={<Icons.Users size={32} />}
              title="Sin ventas"
              description="No hay ventas en este filtro."
            />
          )}
          {ranking.map((item, index) => (
            <RankingCard
              key={item.seller}
              seller={item.seller}
              total={item.total}
              index={index}
              onClick={() => handleRankingClick(item.seller, item.orders)}
            />
          ))}
        </div>
      )}

      {/* GASTOS */}
      {canSeeAdminSections && Object.keys(groupedExpenses).length > 0 && (
        <div className="dash-section">
          <h3>
            <Icons.Money size={18} /> Gastos por vendedor
            <span className="dash-section-hint">
              (clic en una categoría para ver gastos)
            </span>
          </h3>
          <div className="dash-expenses-grid">
            {Object.entries(groupedExpenses).map(([sellerId, data]) => (
              <ExpenseCard
                key={sellerId}
                name={data.sellerName}
                total={data.total}
                expenses={data.expenses}
                categories={expenseCategories}
                onCategoryClick={(catKey, list) =>
                  handleExpenseCategory(data.sellerName, catKey, list)
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* CLIENTES INACTIVOS */}
      {canSeeAdminSections && inactiveClients.length > 0 && (
        <div className="dash-section">
          <h3>
            <Icons.User size={18} /> Clientes inactivos
            <span className="dash-section-hint">(clic para ver detalle)</span>
          </h3>
          {inactiveClients.map((client) => {
            const lastOrder = orders
              .filter(
                (o) =>
                  o.clientId === client.id || o.clientData?.id === client.id,
              )
              .sort((a, b) => {
                let dA = a.createdAt?.toDate
                  ? a.createdAt.toDate()
                  : new Date(a.createdAt);
                let dB = b.createdAt?.toDate
                  ? b.createdAt.toDate()
                  : new Date(b.createdAt);
                return dB - dA;
              })[0];
            return (
              <ClientInactiveCard
                key={client.id}
                client={client}
                lastOrder={lastOrder}
                onClick={() => handleInactiveClient(client, lastOrder)}
              />
            );
          })}
        </div>
      )}

      {/* STOCK */}
      {canSeeInventory && (
        <div className="dash-section">
          <h3>
            <Icons.Package size={18} /> Stock actual
            <span className="dash-section-hint">
              (clic en un producto para ver movimientos)
            </span>
          </h3>
          {products.length === 0 ? (
            <EmptyState
              icon={<Icons.Package size={32} />}
              title="Sin stock"
              description="No hay productos registrados."
            />
          ) : (
            <div className="dash-grid-small">
              {products.map((product) => (
                <StockCard
                  key={product.id}
                  name={product.name}
                  stock={product.stock || 0}
                  price={product.price}
                  onClick={() => handleStockProduct(product)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* DEUDAS BOTELLONES */}
      {canSeeInventory && (
        <div className="dash-section">
          <h3>
            <Icons.Package size={18} /> Deudas de botellones vacíos
            <span className="dash-section-hint">(clic para ver detalle)</span>
          </h3>
          {bottleDebts.length === 0 ? (
            <EmptyState
              icon={<Icons.Info size={32} />}
              title="Sin deudas"
              description="No hay deudas de botellones."
            />
          ) : (
            <div className="dash-grid-small">
              {bottleDebts.map((debt) => (
                <DebtCardDot
                  key={debt.sellerId}
                  sellerName={debt.sellerName}
                  totalSold={debt.totalSold}
                  totalReported={debt.totalReported}
                  debt={debt.debt}
                  onClick={() => handleBottleDebt(debt)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL */}
      {modal && <UnifiedModal data={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

// ============================================
// COMPONENTES AUXILIARES
// ============================================

function KPICard({ title, value, gradient, icon, onClick }) {
  return (
    <div
      className={`dash-card-gradient-kpi ${gradient} ${
        onClick ? "clickable" : ""
      }`}
      onClick={onClick}
    >
      <div className="kpi-icon">{icon}</div>
      <h4 className="kpi-title">{title}</h4>
      <h2 className="kpi-value">{value}</h2>
      {onClick && <div className="kpi-hint">Clic para ver detalle</div>}
    </div>
  );
}

function CardGlow({ title, value, icon, color = "success", onClick }) {
  const colors = {
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#ef4444",
  };
  return (
    <div
      className={`dash-card-glow ${onClick ? "clickable" : ""}`}
      style={{ borderColor: colors[color] || colors.success }}
      onClick={onClick}
    >
      <div className="card-icon" style={{ color: colors[color] }}>
        {icon}
      </div>
      <h4 className="card-title">{title}</h4>
      <h2 className="card-value">{value}</h2>
    </div>
  );
}

function CardDot({ title, value, icon, color = "blue", onClick, pulse }) {
  const colors = {
    success: "dot-success",
    warning: "dot-warning",
    danger: "dot-danger",
    blue: "dot-blue",
    purple: "dot-purple",
    coral: "dot-coral",
  };
  return (
    <div
      className={`dash-card-dot ${colors[color] || "dot-blue"} ${
        onClick ? "clickable" : ""
      } ${pulse ? "pulse" : ""}`}
      onClick={onClick}
    >
      <div className="card-icon">{icon}</div>
      <h4 className="card-title">{title}</h4>
      <h2 className="card-value">{value}</h2>
    </div>
  );
}

function RankingCard({ seller, total, index, onClick }) {
  const medals = ["🥇", "🥈", "🥉"];
  const avatarColors = ["blue", "green", "orange", "purple", "pink", "teal"];
  const color = avatarColors[index % avatarColors.length];
  const initials = seller
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const getRankClass = (idx) => {
    if (idx === 0) return "gold";
    if (idx === 1) return "silver";
    if (idx === 2) return "bronze";
    return "normal";
  };

  return (
    <div
      className="dash-ranking-card clickable"
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      <div className={`rank-number ${getRankClass(index)}`}>
        {index < 3 ? medals[index] : `#${index + 1}`}
      </div>
      <div className="rank-info">
        <div className={`rank-avatar ${color}`}>{initials}</div>
        <div className="rank-detail">
          <div className="seller">{seller}</div>
          <div className="seller-amount">${total.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

function ExpenseCard({ name, total, expenses, categories, onCategoryClick }) {
  const [expanded, setExpanded] = useState(false);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const catSummary = expenses.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = { total: 0, expenses: [] };
    acc[e.category].total += e.amount || 0;
    acc[e.category].expenses.push(e);
    return acc;
  }, {});

  const entries = Object.entries(catSummary);
  const mainCategories = entries.slice(0, 3);
  const hasMore = entries.length > 3;

  const recentExpenses = [...expenses]
    .sort((a, b) => {
      const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const db_ = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return db_ - da;
    })
    .slice(0, 5);

  return (
    <div className="dash-expense-card">
      <div
        className="expense-header"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: "pointer" }}
      >
        <div className="seller-initials">{initials}</div>
        <span className="seller-name">{name}</span>
        <span className="total-amount">${total.toLocaleString()}</span>
        <span
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: "18px",
            marginLeft: "8px",
          }}
        >
          {expanded ? "▲" : "▼"}
        </span>
      </div>
      <div className="expense-body">
        <div className="expense-tags">
          {mainCategories.map(([cat, data]) => (
            <button
              key={cat}
              className="expense-tag clickable-tag"
              onClick={(e) => {
                e.stopPropagation();
                onCategoryClick(cat, data.expenses);
              }}
            >
              {categories[cat] || cat}: ${data.total.toLocaleString()} →
            </button>
          ))}
          {hasMore && (
            <span className="expense-more">+{entries.length - 3} más</span>
          )}
        </div>

        {expanded && (
          <div className="expense-history">
            <h5>Últimos gastos</h5>
            {recentExpenses.length === 0 ? (
              <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                No hay gastos registrados
              </p>
            ) : (
              recentExpenses.map((exp, idx) => (
                <div key={idx} className="expense-history-row">
                  <span style={{ color: "#475569" }}>
                    {exp.concept}
                    <span className="expense-history-cat">
                      {categories[exp.category] || exp.category}
                    </span>
                  </span>
                  <span className="expense-history-amount">
                    -${exp.amount?.toLocaleString()}
                  </span>
                </div>
              ))
            )}
            <div className="expense-history-total">
              Total: <strong>${total.toLocaleString()}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientInactiveCard({ client, lastOrder, onClick }) {
  return (
    <div className="dash-inactive-glow clickable" onClick={onClick}>
      <div className="info">
        <strong>{client.name}</strong>
        <div className="sub">
          📞 {client.phone}
          {lastOrder?.sellerName && ` • Último: ${lastOrder.sellerName}`}
        </div>
        <div className="sub">
          📅 Último pedido:{" "}
          {client.lastOrderDate?.toDate?.().toLocaleDateString() ||
            (client.lastOrderDate
              ? new Date(client.lastOrderDate).toLocaleDateString()
              : "Nunca")}
        </div>
      </div>
      <div className="days">
        <span className="count">{client.daysInactive} días</span>
        <span className="label">Alerta cada {client.expectedDays}d</span>
      </div>
    </div>
  );
}

function StockCard({ name, stock, price, onClick }) {
  const colorClass =
    stock <= 5 ? "text-danger" : stock <= 15 ? "text-warning" : "text-success";
  return (
    <div
      className="dash-stock-elevated clickable"
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      <h4>{name}</h4>
      <p className={`qty ${colorClass}`}>{stock} uds</p>
      <p className="price">${(price || 0).toLocaleString()}</p>
    </div>
  );
}

function DebtCardDot({ sellerName, totalSold, totalReported, debt, onClick }) {
  return (
    <div
      className={`dash-debt-dot ${debt > 0 ? "dot-danger" : "dot-success"} ${
        onClick ? "clickable" : ""
      }`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      <div className="content">
        <h4>{sellerName}</h4>
        <p>
          Vendidos: <strong>{totalSold}</strong>
        </p>
        <p>
          Reportados: <strong>{totalReported}</strong>
        </p>
        <p className={`status ${debt > 0 ? "text-danger" : "text-success"}`}>
          {debt > 0 ? `Debe: ${debt}` : "Sin deuda"}
        </p>
      </div>
    </div>
  );
}

function UnifiedModal({ data, onClose }) {
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    if (!data.searchable || !search.trim()) return data.rows;
    const term = search.toLowerCase().trim();
    return data.rows.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [data.rows, data.searchable, search]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content dash-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dash-modal-header">
          <div>
            <h3 className="modal-title">{data.title}</h3>
            {data.subtitle && (
              <p className="dash-modal-subtitle">{data.subtitle}</p>
            )}
          </div>
          <button className="dash-modal-close" onClick={onClose}>
            ✖
          </button>
        </div>

        {data.searchable && (
          <div className="dash-modal-search">
            <input
              type="text"
              placeholder="🔍 Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
            />
            {search && (
              <span className="dash-modal-search-count">
                {filteredRows.length} resultado(s)
              </span>
            )}
          </div>
        )}

        {data.extraContent}

        <div className="dash-modal-table-wrapper">
          {filteredRows.length === 0 ? (
            <EmptyState
              icon={<Icons.Info size={32} />}
              title="Sin resultados"
              description="No hay datos para mostrar."
            />
          ) : (
            <table className="dash-modal-table">
              <thead>
                <tr>
                  {data.columns.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr key={idx}>
                    {data.columns.map((c) => (
                      <td key={c.key}>{row[c.key] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data.actions && data.actions.length > 0 && (
          <div className="dash-modal-actions">
            {data.actions.map((a, i) => (
              <button key={i} className="btn-save" onClick={a.onClick}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
