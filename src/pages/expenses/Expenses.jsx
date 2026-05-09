import { useState, useContext, useEffect } from "react";
import { OrderContext } from "../../context/OrderContext";
import { AuthContext } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./Expenses.css";

export default function Expenses() {
  const { user } = useContext(AuthContext);
  const { addExpense, getExpenses } = useContext(OrderContext);
  const { addToast } = useToast();
  
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [receiptName, setReceiptName] = useState("");
  const [expensesList, setExpensesList] = useState([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState("");

  const categories = [
    { value: "gasolina", label: "Gasolina", icon: "⛽" },
    { value: "reparacion", label: "Reparación", icon: "🔧" },
    { value: "alimentacion", label: "Alimentación", icon: "🍔" },
    { value: "peajes", label: "Peajes", icon: "🛣️" },
    { value: "otros", label: "Otros", icon: "📌" },
  ];

  const getCategoryLabel = (cat) => categories.find(c => c.value === cat)?.label || cat;
  const getCategoryIcon = (cat) => categories.find(c => c.value === cat)?.icon || "📌";

  const handleReceiptUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReceiptName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => { setReceipt(reader.result); };
      reader.readAsDataURL(file);
    }
  };

  const loadExpenses = async () => {
    if (!user?.id) return;
    try {
      const filters = { sellerId: user.id };
      if (filterDate) {
        const start = new Date(filterDate);
        const end = new Date(filterDate);
        end.setDate(end.getDate() + 1);
        filters.startDate = start;
        filters.endDate = end;
      }
      const data = await getExpenses(filters);
      setExpensesList(data);
      setTotalExpenses(data.reduce((acc, e) => acc + (e.amount || 0), 0));
    } catch (error) { console.error("Error cargando gastos:", error); }
  };

  useEffect(() => { loadExpenses(); }, [filterDate, user?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!concept || !amount || !category) { addToast("❌ Completa los campos requeridos", "error"); return; }
    setLoading(true);
    const success = await addExpense(user.id, user.name, concept, amount, category, comment, receipt);
    setLoading(false);
    if (success) {
      setConcept(""); setAmount(""); setCategory(""); setComment(""); setReceipt(null); setReceiptName("");
      await loadExpenses();
      addToast("✅ Gasto registrado correctamente", "success");
    }
  };

  const expensesByCategory = {};
  expensesList.forEach(exp => {
    if (!expensesByCategory[exp.category]) expensesByCategory[exp.category] = { total: 0, count: 0, label: getCategoryLabel(exp.category), icon: getCategoryIcon(exp.category) };
    expensesByCategory[exp.category].total += exp.amount || 0;
    expensesByCategory[exp.category].count++;
  });

  if (user?.role !== "vendedor" && user?.role !== "admin" && user?.role !== "planta") {
    return (<div style={{ padding: "20px", textAlign: "center" }}><p>🚫 No tienes acceso a esta sección</p></div>);
  }

  return (
    <div className="expenses-page">
      <h1>💰 Mis Gastos</h1>

      <div className="expenses-summary">
        <h3>📊 Resumen del período</h3>
        <div className="expenses-stats">
          <div className="expense-stat-item">
            <span className="expense-stat-label">Total gastos:</span>
            <span className="expense-stat-value">${totalExpenses.toLocaleString()}</span>
          </div>
          <div className="expense-stat-item">
            <span className="expense-stat-label">Número de gastos:</span>
            <span className="expense-stat-value">{expensesList.length}</span>
          </div>
        </div>
        {Object.keys(expensesByCategory).length > 0 && (
          <div className="expenses-category-summary">
            <div className="expenses-category-title">Por categoría:</div>
            <div className="expenses-category-list">
              {Object.entries(expensesByCategory).map(([cat, data]) => (
                <div key={cat} className="expenses-category-pill"><span>{data.icon} {data.label}</span><strong>${data.total.toLocaleString()}</strong></div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="expenses-filters">
        <span className="expenses-filter-label">📅 Filtrar por fecha:</span>
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="expenses-date-input" />
        {filterDate && (<button onClick={() => setFilterDate("")} className="expenses-clear-btn">Limpiar filtro</button>)}
      </div>

      <div className="expenses-card">
        <h3>➕ Registrar nuevo gasto</h3>
        <form onSubmit={handleSubmit} className="expenses-form">
          <input placeholder="Concepto (ej: Combustible...)" value={concept} onChange={(e) => setConcept(e.target.value)} className="expenses-input" required />
          <input type="number" placeholder="Valor del gasto" value={amount} onChange={(e) => setAmount(e.target.value)} className="expenses-input" required />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="expenses-input" required>
            <option value="">Seleccionar categoría</option>
            {categories.map(c => (<option key={c.value} value={c.value}>{c.icon} {c.label}</option>))}
          </select>
          <textarea placeholder="Comentario o detalle (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} className="expenses-input" />
          <div className="receipt-container full-width">
            <label className="receipt-label">📎 Comprobante (opcional)</label>
            <div className="file-upload-wrapper">
              <label className="file-upload-label">📎 Seleccionar archivo<input type="file" accept="image/*" onChange={handleReceiptUpload} className="file-input-hidden" /></label>
              {receiptName && <span className="file-name">{receiptName}</span>}
            </div>
            {receipt && (
              <div className="receipt-preview">
                <img src={receipt} alt="Comprobante" className="receipt-preview-img" />
                <button type="button" onClick={() => { setReceipt(null); setReceiptName(""); }} className="btn-remove-receipt">✖ Eliminar</button>
              </div>
            )}
          </div>
          <button type="submit" className="btn-save-expense full-width" disabled={loading}>{loading ? "Registrando..." : "🚀 Registrar gasto"}</button>
        </form>
      </div>

      <div className="expenses-card">
        <div className="expenses-list-header">
          <h3>📋 Historial de gastos</h3>
          <button onClick={loadExpenses} className="btn-refresh">🔄 Actualizar</button>
        </div>
        {expensesList.length === 0 && (
          <EmptyState icon="💰" title="Sin gastos registrados" description={filterDate ? `No hay gastos para el ${new Date(filterDate).toLocaleDateString()}` : "Registra tu primer gasto usando el formulario."} />
        )}
        {expensesList.map(exp => (
          <div key={exp.id} className="expense-item">
            <div className="expense-icon-box">{getCategoryIcon(exp.category)}</div>
            <div className="expense-info">
              <div className="expense-concept"><strong>{exp.concept}</strong><span className="expense-category-badge">{getCategoryLabel(exp.category)}</span></div>
              {exp.comment && <div className="expense-comment">📝 {exp.comment}</div>}
              <div className="expense-date">📅 {exp.date?.toDate?.().toLocaleString() || new Date(exp.date).toLocaleString()}</div>
            </div>
            <div className="expense-amount">-${exp.amount?.toLocaleString()}</div>
            {exp.receipt && <div className="expense-receipt-indicator" title="Tiene comprobante">📎</div>}
          </div>
        ))}
        {expensesList.length > 0 && (
          <div className="expenses-total-box"><strong>Total gastos:</strong> <span className="expenses-total-amount">${totalExpenses.toLocaleString()}</span></div>
        )}
      </div>
    </div>
  );
}