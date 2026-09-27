import { useContext, useState } from "react";
import { AssignmentContext } from "../../context/AssignmentContext";
import { ProductContext } from "../../context/ProductContext";
import { AuthContext } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./Board.css";

export default function Board() {
  const { user, users } = useContext(AuthContext);
  const { products, reduceStockForBoard, returnStockFromBoard } =
    useContext(ProductContext);
  const {
    dailyLoads,
    loading,
    activeDate,
    changeActiveDate,
    createDailyLoad,
    closeDailyLoad,
    getLoadsBySeller,
    getGlobalDailySummary,
    getTodayKey,
  } = useContext(AssignmentContext);
  const { addToast } = useToast();

  const isVendedor = user?.role === "vendedor";
  const isGerencia = user?.role === "gerencia";
  const isPlanta = user?.role === "planta";

  const sellers = users.filter(
    (u) => u.role === "vendedor" && u.active !== false,
  );

  // 🎭 VENDEDOR: solo lectura de su propio tablero
  if (isVendedor) {
    return (
      <SellerBoardView
        user={user}
        activeDate={activeDate}
        changeActiveDate={changeActiveDate}
      />
    );
  }

  // 🎭 GERENCIA / PLANTA: gestión completa
  if (isGerencia || isPlanta) {
    return (
      <ManagerBoardView
        user={user}
        sellers={sellers}
        products={products}
        dailyLoads={dailyLoads}
        loading={loading}
        activeDate={activeDate}
        changeActiveDate={changeActiveDate}
        createDailyLoad={createDailyLoad}
        closeDailyLoad={closeDailyLoad}
        getGlobalDailySummary={getGlobalDailySummary}
        getTodayKey={getTodayKey}
        reduceStockForBoard={reduceStockForBoard}
        returnStockFromBoard={returnStockFromBoard}
        addToast={addToast}
      />
    );
  }

  // Rol no autorizado (no debería llegar aquí por ProtectedRoute)
  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <p>No tienes acceso a esta sección</p>
    </div>
  );
}

// ============================================
// 🟢 VISTA DEL VENDEDOR (solo lectura)
// ============================================
function SellerBoardView({ user, activeDate, changeActiveDate }) {
  const { getDailySummaryBySeller, getLoadsBySeller, getTodayKey } =
    useContext(AssignmentContext);

  const summary = getDailySummaryBySeller(user.id, activeDate);
  const loadsOfDay = getLoadsBySeller(user.id, activeDate);
  const openLoads = loadsOfDay.filter((l) => l.status === "abierta");

  const totalSoldValue = summary.reduce(
    (acc, p) => acc + p.sold * (p.price || 0),
    0,
  );

  return (
    <div className="board-page">
      <h1>📋 Mi Tablero</h1>

      <div className="board-filters">
        <label className="board-filter-label">📅 Fecha:</label>
        <input
          type="date"
          value={activeDate}
          max={getTodayKey()}
          onChange={(e) => changeActiveDate(e.target.value)}
          className="board-date-input"
        />
      </div>

      {openLoads.length > 0 && (
        <div className="board-alert-open">
          <Icons.Warning size={18} />
          <span>
            Tienes {openLoads.length} carga(s) pendiente(s) de cerrar. La
            jornada se cierra cuando planta/gerencia registre tus devoluciones.
          </span>
        </div>
      )}

      <div className="board-summary-card">
        <h3>📊 Resumen del día</h3>
        <div className="board-summary-stats">
          <div className="board-summary-item">
            <span className="board-summary-label">Productos asignados:</span>
            <span className="board-summary-value">{summary.length}</span>
          </div>
          <div className="board-summary-item">
            <span className="board-summary-label">Valor vendido:</span>
            <span className="board-summary-value">
              ${totalSoldValue.toLocaleString()}
            </span>
          </div>
          <div className="board-summary-item">
            <span className="board-summary-label">Cargas del día:</span>
            <span className="board-summary-value">{loadsOfDay.length}</span>
          </div>
        </div>
      </div>

      {summary.length === 0 ? (
        <EmptyState
          icon={<Icons.Package size={32} />}
          title="Sin productos asignados"
          description="No tienes productos asignados para esta fecha."
        />
      ) : (
        <div className="board-table-card">
          <h3>🛒 Productos del día</h3>
          <table className="board-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Asignado</th>
                <th>Devuelto</th>
                <th>Vendido</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((p) => (
                <tr key={p.productId}>
                  <td>{p.name}</td>
                  <td>{p.assigned}</td>
                  <td>{p.returned}</td>
                  <td className="board-sold">{p.sold}</td>
                  <td className="board-value">
                    ${(p.sold * (p.price || 0)).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="board-history-card">
        <h3>📚 Historial de cargas del día</h3>
        {loadsOfDay.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: "13px" }}>
            Sin cargas registradas.
          </p>
        ) : (
          loadsOfDay.map((load) => (
            <div key={load.id} className="board-load-item">
              <div className="board-load-header">
                <strong>
                  {load.status === "abierta"
                    ? "🟢 Carga abierta"
                    : "🔒 Carga cerrada"}
                </strong>
                <span className="board-load-time">
                  {load.createdAt?.toDate
                    ? load.createdAt.toDate().toLocaleTimeString()
                    : new Date(load.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="board-load-items">
                {load.items.map((item, i) => (
                  <span key={i} className="board-load-tag">
                    {item.name} × {item.assignedQty}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================
// 🟠 VISTA DE GERENCIA / PLANTA (gestión)
// ============================================
function ManagerBoardView({
  user,
  sellers,
  products,
  dailyLoads,
  loading,
  activeDate,
  changeActiveDate,
  createDailyLoad,
  closeDailyLoad,
  getGlobalDailySummary,
  getTodayKey,
  reduceStockForBoard,
  returnStockFromBoard,
  addToast,
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingLoad, setClosingLoad] = useState(null);

  const [newSellerId, setNewSellerId] = useState("");
  const [newItems, setNewItems] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);

  const [returnedQtys, setReturnedQtys] = useState({});

  const globalSummary = getGlobalDailySummary(activeDate);
  const loadsOfDay = dailyLoads; // Ya viene filtrado del contexto

  const totalGlobalSoldValue = globalSummary.reduce(
    (acc, s) => acc + (s.totalSoldValue || 0),
    0,
  );

  // ---------- Crear asignación ----------
  const handleAddItem = () => {
    if (!selectedProductId) {
      addToast("Selecciona un producto", "error");
      return;
    }
    if (!selectedQty || selectedQty <= 0) {
      addToast("Cantidad inválida", "error");
      return;
    }

    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    if (newItems.some((i) => i.productId === product.id)) {
      addToast("Ese producto ya está en la lista", "error");
      return;
    }

    if (product.stock < selectedQty) {
      addToast(
        `Stock insuficiente de ${product.name}. Disponible: ${product.stock}`,
        "error",
      );
      return;
    }

    setNewItems([
      ...newItems,
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        assignedQty: Number(selectedQty),
      },
    ]);
    setSelectedProductId("");
    setSelectedQty(1);
  };

  const handleRemoveItem = (productId) => {
    setNewItems(newItems.filter((i) => i.productId !== productId));
  };

  const handleCreateLoad = async () => {
    if (!newSellerId) {
      addToast("Selecciona un vendedor", "error");
      return;
    }
    if (newItems.length === 0) {
      addToast("Agrega al menos un producto", "error");
      return;
    }

    const seller = sellers.find((s) => s.id === newSellerId);
    if (!seller) return;

    const loadResult = await createDailyLoad(seller, newItems);
    if (!loadResult) return;

    const stockOk = await reduceStockForBoard(
      newItems,
      seller,
      user,
      loadResult.id,
    );
    if (!stockOk) {
      addToast("⚠️ Asignación creada pero hubo problema con stock", "error");
      return;
    }

    addToast(`✅ Carga asignada a ${seller.name}`, "success");

    setNewSellerId("");
    setNewItems([]);
    setShowCreateModal(false);
  };

  // ---------- Cerrar asignación ----------
  const handleOpenCloseModal = (load) => {
    setClosingLoad(load);
    const initial = {};
    load.items.forEach((item) => {
      initial[item.productId] = item.returnedQty || 0;
    });
    setReturnedQtys(initial);
    setShowCloseModal(true);
  };

  const handleCloseLoad = async () => {
    if (!closingLoad) return;

    const returnedItems = Object.entries(returnedQtys).map(
      ([productId, qty]) => ({
        productId,
        returnedQty: Number(qty) || 0,
      }),
    );

    for (const item of closingLoad.items) {
      const r = returnedQtys[item.productId] || 0;
      if (r > item.assignedQty) {
        addToast(
          `${item.name}: no puedes devolver más de ${item.assignedQty}`,
          "error",
        );
        return;
      }
      if (r < 0) {
        addToast(`Cantidad negativa no permitida en ${item.name}`, "error");
        return;
      }
    }

    const result = await closeDailyLoad(closingLoad.id, returnedItems, user);
    if (!result) return;

    const seller = { id: closingLoad.sellerId, name: closingLoad.sellerName };
    const returnItems = closingLoad.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      returnedQty: Number(returnedQtys[item.productId]) || 0,
    }));
    await returnStockFromBoard(returnItems, seller, user, closingLoad.id);

    addToast(`✅ Jornada cerrada para ${seller.name}`, "success");
    setShowCloseModal(false);
    setClosingLoad(null);
    setReturnedQtys({});
  };

  return (
    <div className="board-page">
      <h1>📋 Tablero de Distribución</h1>

      <div className="board-filters">
        <label className="board-filter-label">📅 Fecha:</label>
        <input
          type="date"
          value={activeDate}
          max={getTodayKey()}
          onChange={(e) => changeActiveDate(e.target.value)}
          className="board-date-input"
        />
        <button
          onClick={() => setShowCreateModal(true)}
          className="board-btn-primary"
        >
          <Icons.Plus size={16} /> Nueva asignación
        </button>
      </div>

      <div className="board-summary-card">
        <h3>📊 Resumen del día</h3>
        <div className="board-summary-stats">
          <div className="board-summary-item">
            <span className="board-summary-label">Vendedores activos:</span>
            <span className="board-summary-value">{globalSummary.length}</span>
          </div>
          <div className="board-summary-item">
            <span className="board-summary-label">Cargas del día:</span>
            <span className="board-summary-value">{loadsOfDay.length}</span>
          </div>
          <div className="board-summary-item">
            <span className="board-summary-label">Valor vendido:</span>
            <span className="board-summary-value">
              ${totalGlobalSoldValue.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <h2 className="board-section-title">🛒 Resumen por vendedor</h2>
      {loading ? (
        <p style={{ color: "#94a3b8", fontSize: "13px" }}>Cargando...</p>
      ) : globalSummary.length === 0 ? (
        <EmptyState
          icon={<Icons.Package size={32} />}
          title="Sin asignaciones para este día"
          description="Crea una nueva asignación para empezar."
        />
      ) : (
        globalSummary.map((seller) => (
          <SellerSummaryCard
            key={seller.sellerId}
            seller={seller}
            onClose={() => {
              const openLoad = loadsOfDay.find(
                (l) => l.sellerId === seller.sellerId && l.status === "abierta",
              );
              if (!openLoad) {
                addToast("Este vendedor no tiene cargas abiertas", "error");
                return;
              }
              handleOpenCloseModal(openLoad);
            }}
          />
        ))
      )}

      <h2 className="board-section-title">📚 Historial de cargas del día</h2>
      {loadsOfDay.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: "13px" }}>Sin cargas.</p>
      ) : (
        loadsOfDay.map((load) => (
          <div key={load.id} className="board-load-item">
            <div className="board-load-header">
              <strong>
                {load.sellerName} —{" "}
                {load.status === "abierta" ? "🟢 Abierta" : "🔒 Cerrada"}
              </strong>
              <span className="board-load-time">
                {load.createdAt?.toDate
                  ? load.createdAt.toDate().toLocaleTimeString()
                  : new Date(load.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <div className="board-load-items">
              {load.items.map((item, i) => (
                <span key={i} className="board-load-tag">
                  {item.name} × {item.assignedQty}
                  {load.status === "cerrada" && ` (dev: ${item.returnedQty})`}
                </span>
              ))}
            </div>
            {load.status === "abierta" && (
              <button
                className="board-load-close-btn"
                onClick={() => handleOpenCloseModal(load)}
              >
                Cerrar jornada
              </button>
            )}
          </div>
        ))
      )}

      {/* MODAL: NUEVA ASIGNACIÓN */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              <Icons.Plus size={18} /> Nueva asignación
            </h3>

            <div className="form-group">
              <label className="form-label">Vendedor</label>
              <select
                value={newSellerId}
                onChange={(e) => setNewSellerId(e.target.value)}
                className="form-input"
              >
                <option value="">Seleccionar vendedor</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Agregar producto</label>
              <div className="board-add-row">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="form-input"
                >
                  <option value="">Producto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — Stock: {p.stock}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={selectedQty}
                  min={1}
                  onChange={(e) => setSelectedQty(Number(e.target.value))}
                  className="form-input board-qty-input"
                />
                <button onClick={handleAddItem} className="board-btn-add">
                  Agregar
                </button>
              </div>
            </div>

            {newItems.length > 0 && (
              <div className="board-items-preview">
                {newItems.map((item) => (
                  <div key={item.productId} className="board-item-preview">
                    <span>
                      {item.name} × {item.assignedQty}
                    </span>
                    <button
                      onClick={() => handleRemoveItem(item.productId)}
                      className="board-btn-remove"
                    >
                      ✖
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-buttons">
              <button
                onClick={handleCreateLoad}
                className="btn-save"
                disabled={newItems.length === 0 || !newSellerId}
              >
                Asignar
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-cancel"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CERRAR JORNADA */}
      {showCloseModal && closingLoad && (
        <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              <Icons.Check size={18} /> Cerrar jornada de{" "}
              {closingLoad.sellerName}
            </h3>
            <p className="board-close-hint">
              Ingresa la cantidad de cada producto que el vendedor devolvió.
            </p>

            {closingLoad.items.map((item) => (
              <div key={item.productId} className="board-return-row">
                <div className="board-return-info">
                  <strong>{item.name}</strong>
                  <span>Asignado: {item.assignedQty}</span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={item.assignedQty}
                  value={returnedQtys[item.productId] || 0}
                  onChange={(e) =>
                    setReturnedQtys({
                      ...returnedQtys,
                      [item.productId]: Number(e.target.value),
                    })
                  }
                  className="form-input board-return-input"
                />
                <span className="board-sold-hint">
                  Vendido:{" "}
                  {item.assignedQty - (returnedQtys[item.productId] || 0)}
                </span>
              </div>
            ))}

            <div className="modal-buttons">
              <button onClick={handleCloseLoad} className="btn-save">
                Confirmar cierre
              </button>
              <button
                onClick={() => setShowCloseModal(false)}
                className="btn-cancel"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 🎨 Tarjeta resumen por vendedor
// ============================================
function SellerSummaryCard({ seller, onClose }) {
  return (
    <div className="board-seller-card">
      <div className="board-seller-header">
        <strong>{seller.sellerName}</strong>
        {seller.hasOpenLoad && (
          <span className="board-open-badge">🟢 Jornada abierta</span>
        )}
      </div>
      <div className="board-seller-products">
        {seller.products.map((p) => (
          <div key={p.productId} className="board-seller-product">
            <span>{p.name}</span>
            <span className="board-seller-stat">
              Asig: <strong>{p.assigned}</strong> • Dev:{" "}
              <strong>{p.returned}</strong> • Vend:{" "}
              <strong className="board-sold">{p.sold}</strong>
            </span>
          </div>
        ))}
      </div>
      <div className="board-seller-footer">
        <span>
          Valor vendido:{" "}
          <strong>${seller.totalSoldValue.toLocaleString()}</strong>
        </span>
        {seller.hasOpenLoad && (
          <button onClick={onClose} className="board-btn-close-load">
            Cerrar jornada
          </button>
        )}
      </div>
    </div>
  );
}
