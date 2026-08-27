import { useState, useContext, useEffect } from "react";
import { ProductContext } from "../../context/ProductContext";
import { AuthContext } from "../../context/AuthContext";
import { EmptyBottleContext } from "../../context/EmptyBottleContext";
import { OrderContext } from "../../context/OrderContext";
import { useToast } from "../../context/ToastContext";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./Stock.css";

export default function Stock() {
  const { user } = useContext(AuthContext);
  const { products, addStock, reduceStock, getStockMovements, movementTypes } = useContext(ProductContext);
  const { addEmptyBottleReport, getEmptyBottleRecords, getAllDebts } = useContext(EmptyBottleContext);
  const { orders } = useContext(OrderContext);
  const { users } = useContext(AuthContext);
  const { addToast } = useToast();
  
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [debts, setDebts] = useState([]);
  const [bottleHistory, setBottleHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 🔥 Paginación para historial de movimientos
  const [movementPage, setMovementPage] = useState(1);
  const MOVEMENTS_PER_PAGE = 10;

  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [comment, setComment] = useState("");
  const [movementType, setMovementType] = useState("ENTRADA_PRODUCCION");
  const [activeTab, setActiveTab] = useState("entrada");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterType, setFilterType] = useState("");
  const [selectedSeller, setSelectedSeller] = useState("");
  const [reportedQuantity, setReportedQuantity] = useState("");
  const [bottleComment, setBottleComment] = useState("");
  const [bottleDate, setBottleDate] = useState(new Date().toISOString().slice(0, 10));
  const [showBottleHistory, setShowBottleHistory] = useState(false);

  const sellers = users.filter((u) => u.role === "vendedor");
  const entradaTypes = ["ENTRADA_PRODUCCION", "ENTRADA_COMPRA"];
  const salidaTypes = ["SALIDA_DETERIORO", "SALIDA_AJUSTE"];

  useEffect(() => { loadMovements(); loadBottleHistory(); }, []);
  useEffect(() => { loadMovements(); }, [filterProduct, filterType]);
  useEffect(() => { if (showBottleHistory) loadBottleHistory(); }, [showBottleHistory]);

  useEffect(() => {
    if (getAllDebts && users && orders) {
      const debtsData = getAllDebts(users, orders);
      setDebts(debtsData);
    }
  }, [users, orders, getAllDebts]);

  const loadMovements = async () => {
    setLoadingMovements(true);
    setMovementPage(1); // 🔥 Reiniciar página al cargar
    const filters = {};
    if (filterProduct) filters.productId = filterProduct;
    if (filterType) filters.movementType = filterType;
    const data = await getStockMovements(filters);
    setMovements(data);
    setLoadingMovements(false);
  };

  const loadBottleHistory = async () => {
    setLoadingHistory(true);
    try { const history = await getEmptyBottleRecords(); setBottleHistory(history); } catch (error) { console.error("Error cargando historial:", error); }
    setLoadingHistory(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMovementType(tab === "entrada" ? "ENTRADA_PRODUCCION" : "SALIDA_DETERIORO");
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) { addToast("Selecciona un producto", "error"); return; }
    if (!quantity || quantity <= 0) { addToast("Ingresa una cantidad válida", "error"); return; }
    if (!comment || !comment.trim()) { addToast("El comentario es obligatorio", "error"); return; }

    let success = false;
    if (activeTab === "entrada") success = await addStock(selectedProduct, Number(quantity), movementType, comment, user);
    else success = await reduceStock(selectedProduct, Number(quantity), movementType, comment, user);

    if (success) {
      setQuantity(""); setComment(""); await loadMovements();
      addToast(activeTab === "entrada" ? "Stock agregado correctamente" : "Stock reducido correctamente", "success");
    }
  };

  const handleBottleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSeller) { addToast("Selecciona un vendedor", "error"); return; }
    if (!reportedQuantity || reportedQuantity <= 0) { addToast("Ingresa una cantidad válida", "error"); return; }

    const seller = sellers.find((s) => s.id === selectedSeller);
    if (!seller) { addToast("Vendedor no encontrado", "error"); return; }

    const success = await addEmptyBottleReport(seller.id, seller.name, Number(reportedQuantity), new Date(bottleDate), bottleComment);
    if (success) {
      setReportedQuantity(""); setBottleComment("");
      await loadBottleHistory();
      addToast(`Reporte de ${seller.name} guardado: ${reportedQuantity} botellones`, "success");
    }
  };

  const getMovementLabel = (mov) => {
    if (mov.movementType === "SALIDA_DETERIORO") return "Deterioro";
    if (mov.movementType === "SALIDA_VENTA") return "Venta";
    if (mov.movementType === "SALIDA_AJUSTE") return "Ajuste";
    if (mov.movementType === "ENTRADA_PRODUCCION") return "Producción";
    if (mov.movementType === "ENTRADA_COMPRA") return "Compra";
    if (mov.movementType === "ENTRADA_DEVOLUCION") return "Devolución";
    return mov.movementType || (mov.type === "entrada" ? "Entrada" : "Salida");
  };

  const esSalida = (mov) => {
    return mov.type === "salida" || mov.movementType === "SALIDA_DETERIORO" || mov.movementType === "SALIDA_VENTA" || mov.movementType === "SALIDA_AJUSTE";
  };

  if (user?.role !== "admin" && user?.role !== "planta") {
    return (<div style={{ padding: "20px", textAlign: "center" }}><p>No tienes acceso a esta sección</p></div>);
  }

  // 🔥 Calcular movimientos visibles según paginación
  const displayedMovements = movements.slice(0, movementPage * MOVEMENTS_PER_PAGE);
  const hasMoreMovements = movements.length > movementPage * MOVEMENTS_PER_PAGE;

  return (
    <div className="stock-page">
      <h1>Gestión de Stock</h1>

      <div className="stock-section">
        <h2><Icons.Package size={20} /> Productos</h2>
        <div className="stock-tabs">
          <button className={`stock-tab ${activeTab === "entrada" ? "active" : ""}`} onClick={() => handleTabChange("entrada")}>
            <Icons.Plus size={16} />
            Agregar stock
          </button>
          <button className={`stock-tab ${activeTab === "salida" ? "active" : ""}`} onClick={() => handleTabChange("salida")}>
            <Icons.X size={16} />
            Quitar stock
          </button>
        </div>
        <div className="stock-inner-card">
          <h3>{activeTab === "entrada" ? "Agregar stock" : "Quitar stock"}</h3>
          <form onSubmit={handleProductSubmit} className="stock-form">
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="stock-input" required>
              <option value="">Seleccionar producto</option>
              {products.map((p) => (<option key={p.id} value={p.id}>{p.name} - Stock: {p.stock || 0}</option>))}
            </select>
            <select value={movementType} onChange={(e) => setMovementType(e.target.value)} className="stock-input" required>
              {activeTab === "entrada" ? entradaTypes.map((t) => (<option key={t} value={t}>{movementTypes[t]?.label || t}</option>)) : salidaTypes.map((t) => (<option key={t} value={t}>{movementTypes[t]?.label || t}</option>))}
            </select>
            <input type="number" placeholder="Cantidad" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="stock-input" required min="1" />
            <textarea placeholder="Comentario (obligatorio)" value={comment} onChange={(e) => setComment(e.target.value)} className="stock-input full-width" required />
            <button type="submit" className="stock-btn-primary full-width">
              {activeTab === "entrada" ? "Agregar stock" : "Quitar stock"}
            </button>
          </form>
        </div>

        <h3>Inventario actual</h3>
        {products.length === 0 ? (
          <EmptyState icon={<Icons.Package size={32} />} title="Sin productos" description="No hay productos registrados en el sistema." />
        ) : (
          <div className="stock-grid">
            {products.map((product) => {
              const stock = product.stock || 0;
              let stockColorClass = "stock-high";
              if (stock <= 10) stockColorClass = "stock-low";
              else if (stock <= 20) stockColorClass = "stock-medium";
              return (
                <div key={product.id} className="stock-product-card">
                  <h4>{product.name}</h4>
                  <p className={`stock-qty ${stockColorClass}`}>{stock} uds</p>
                  <p className="stock-price">${(product.price || 0).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="stock-section bottles-section">
        <h2><Icons.Package size={20} /> Control de Botellones Vacíos</h2>
        <div className="stock-inner-card">
          <h3>Reportar devolución</h3>
          <form onSubmit={handleBottleSubmit} className="stock-form">
            <select value={selectedSeller} onChange={(e) => setSelectedSeller(e.target.value)} className="stock-input" required>
              <option value="">Seleccionar vendedor</option>
              {sellers.map((s) => {
                const sellerDebt = debts.find((d) => d.sellerId === s.id);
                return (<option key={s.id} value={s.id}>{s.name} - Vendidos: {sellerDebt?.totalSold || 0} | Reportados: {sellerDebt?.totalReported || 0} | Deuda: {sellerDebt?.debt || 0}</option>);
              })}
            </select>
            <input type="number" placeholder="Cant. botellones reportados" value={reportedQuantity} onChange={(e) => setReportedQuantity(e.target.value)} className="stock-input" required min="0" />
            <input type="date" value={bottleDate} onChange={(e) => setBottleDate(e.target.value)} className="stock-input" required />
            <textarea placeholder="Comentario (opcional)" value={bottleComment} onChange={(e) => setBottleComment(e.target.value)} className="stock-input full-width" />
            <button type="submit" className="stock-btn-primary full-width">Registrar devolución</button>
          </form>
        </div>

        <h3>Resumen de deudas por vendedor</h3>
        {debts.length === 0 ? (
          <EmptyState icon={<Icons.Info size={32} />} title="Sin deudas" description="No hay registros de botellones adeudados." />
        ) : (
          <div className="stock-grid">
            {debts.map((debt) => (
              <div key={debt.sellerId} className="debt-card">
                <h4>{debt.sellerName}</h4>
                <p>Vendidos: <strong>{debt.totalSold}</strong></p>
                <p>Reportados: <strong>{debt.totalReported}</strong></p>
                <p className={`debt-status ${debt.debt > 0 ? "debt-pending" : "debt-clear"}`}>
                  {debt.debt > 0 ? `Deuda: ${debt.debt}` : "Sin deuda"}
                </p>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "20px" }}>
          <button onClick={() => { setShowBottleHistory(!showBottleHistory); if (!showBottleHistory) loadBottleHistory(); }} className="stock-btn-secondary">
            {showBottleHistory ? "Ocultar historial" : "Ver historial de reportes"}
          </button>
        </div>

        {showBottleHistory && (
          <div style={{ marginTop: "20px" }}>
            <h3>Historial de reportes</h3>
            {loadingHistory && <p style={{ color: "#64748b" }}>Cargando historial...</p>}
            {!loadingHistory && bottleHistory.length === 0 && (<EmptyState icon={<Icons.Info size={32} />} title="Sin historial" description="Aún no se han reportado botellones." />)}
            {!loadingHistory && bottleHistory.map((record) => (
              <div key={record.id} className="movement-card movement-in">
                <div className="movement-header">
                  <strong>{record.sellerName}</strong>
                  <div className="movement-qty qty-in">{record.reportedQuantity} vacíos</div>
                </div>
                {record.comment && <div className="movement-comment">{record.comment}</div>}
                <div className="movement-meta">{record.date?.toDate ? record.date.toDate().toLocaleString() : new Date(record.date).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="stock-section history-section">
        <h2><Icons.Clock size={20} /> Historial de movimientos de productos</h2>
        
        {/* Contador de movimientos */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "12px",
          fontSize: "14px",
          color: "#64748b"
        }}>
          <span>
            Mostrando <strong>{displayedMovements.length}</strong> de <strong>{movements.length}</strong> movimientos
          </span>
          {movements.length > 0 && (
            <span style={{ fontSize: "12px", background: "#f1f5f9", padding: "4px 10px", borderRadius: "20px" }}>
              Página {Math.ceil(displayedMovements.length / MOVEMENTS_PER_PAGE)}
            </span>
          )}
        </div>

        <div className="stock-filters">
          <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="stock-filter-select">
            <option value="">Todos los productos</option>
            {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="stock-filter-select">
            <option value="">Todos los tipos</option>
            {Object.entries(movementTypes).map(([key, value]) => (<option key={key} value={key}>{value.label}</option>))}
          </select>
          <button onClick={loadMovements} className="stock-btn-secondary">
            <Icons.Refresh size={16} />
            Actualizar
          </button>
        </div>

        {loadingMovements && <p style={{ color: "#64748b" }}>Cargando movimientos...</p>}
        {!loadingMovements && movements.length === 0 && (
          <EmptyState icon={<Icons.Clock size={32} />} title="Sin movimientos" description="No se han registrado entradas ni salidas." />
        )}

        {/* 🔥 MOVIMIENTOS PAGINADOS */}
        {!loadingMovements && displayedMovements.map((mov) => {
          const label = getMovementLabel(mov);
          const salida = esSalida(mov);
          return (
            <div key={mov.id} className={`movement-card ${salida ? "movement-out" : "movement-in"}`}>
              <div className="movement-header">
                <div>
                  <span className="movement-product">{mov.productName}</span>
                  <span className={`movement-badge ${salida ? "badge-out" : "badge-in"}`}>{label}</span>
                </div>
                <div className={`movement-qty ${salida ? "qty-out" : "qty-in"}`}>{salida ? "-" : "+"}{mov.quantity} uds</div>
              </div>
              {mov.comment && <div className="movement-comment">{mov.comment}</div>}
              <div className="movement-meta">
                <span>{mov.userName || "Sistema"}</span>
                <span>{mov.date?.toDate ? mov.date.toDate().toLocaleString() : new Date(mov.date).toLocaleString()}</span>
              </div>
            </div>
          );
        })}

        {/* 🔥 BOTÓN VER MÁS EN MOVIMIENTOS */}
        {!loadingMovements && hasMoreMovements && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "24px" }}>
            <button
              onClick={() => setMovementPage(prev => prev + 1)}
              className="stock-btn-secondary"
              style={{ padding: "12px 28px", fontSize: "14px" }}
            >
              <Icons.Plus size={16} />
              Ver más ({movements.length - (movementPage * MOVEMENTS_PER_PAGE)} restantes)
            </button>
          </div>
        )}

        {/* 🔥 MENSAJE FINAL EN MOVIMIENTOS */}
        {!loadingMovements && movements.length > 0 && !hasMoreMovements && (
          <div style={{ 
            textAlign: "center", 
            marginTop: "16px",
            padding: "12px",
            background: "#f1f5f9",
            borderRadius: "10px",
            color: "#64748b",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}>
            <Icons.Check size={16} />
            Todos los movimientos cargados ({movements.length} en total)
          </div>
        )}
      </div>
    </div>
  );
}