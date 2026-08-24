import { useState, useContext } from "react";
import { OrderContext } from "../../context/OrderContext";
import { ProductContext } from "../../context/ProductContext";
import { AuthContext } from "../../context/AuthContext";
import { ClientContext } from "../../context/ClientContext";
import { useToast } from "../../context/ToastContext";
import { useDebounce } from "../../hooks/useDebounce";
import Icons from "../../components/icons/Icons";
import "./CreateOrder.css";

export default function CreateOrder() {
  const { addOrder } = useContext(OrderContext);
  const { products, reduceStockForOrder } = useContext(ProductContext);
  const { user, users, sendNotification } = useContext(AuthContext);
  const { clients, addClient, updateLastOrderDate } = useContext(ClientContext);
  const { addToast } = useToast();

  const [clientSearch, setClientSearch] = useState("");
  const [client, setClient] = useState({ id: null, name: "", phone: "", address: "", location: "", notes: "", prepMinutes: 15, deliveryMinutes: 30 });
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [items, setItems] = useState([]);
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentProof, setPaymentProof] = useState(null);
  const [paymentProofName, setPaymentProofName] = useState("");
  const [creditType, setCreditType] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("pendiente");

  const sellers = users.filter(u => u.role === "vendedor" && u.active !== false);

  // Debounce: Optimización de búsqueda
  const debouncedClientSearch = useDebounce(clientSearch, 300);
  const debouncedProductSearch = useDebounce(search, 300);

  const selectClient = (c) => {
    setClient({ id: c.id || null, name: c.name || "", phone: c.phone || "", address: c.address || "", location: c.location || "", notes: c.notes || "", prepMinutes: c.prepMinutes || 15, deliveryMinutes: c.deliveryMinutes || 30 });
    setClientSearch(`${c.name} - ${c.phone}`);
  };

  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(debouncedProductSearch.toLowerCase()));

  const selectProduct = (p) => { setSelectedProduct(p); setSearch(p.name); };

  const addItem = () => {
    if (!selectedProduct) return;
    setItems([...items, { ...selectedProduct, qty }]);
    setSelectedProduct(null); setSearch(""); setQty(1);
  };

  const removeItem = (i) => { const copy = [...items]; copy.splice(i, 1); setItems(copy); };

  const handlePaymentProofUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPaymentProofName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => { setPaymentProof(reader.result); };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!client.name || !client.phone || !client.address) { addToast("Selecciona o crea un cliente", "error"); return; }
    if (items.length === 0) { addToast("Agrega productos al pedido", "error"); return; }

    for (const item of items) {
      const product = products.find((p) => p.id === item.id);
      if (!product) { addToast(`Producto ${item.name} no encontrado`, "error"); return; }
      if (product.stock < item.qty) { addToast(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}`, "error"); return; }
    }

    let sellerId, sellerName;
    if (user?.role === "vendedor") { sellerId = user.id; sellerName = user.name; }
    else {
      if (!selectedSellerId) { addToast("Debes seleccionar un vendedor", "error"); return; }
      const selectedSeller = users.find(s => s.id === selectedSellerId);
      if (!selectedSeller) { addToast("Vendedor no válido", "error"); return; }
      sellerId = selectedSeller.id; sellerName = selectedSeller.name;
    }

    if (paymentMethod && paymentMethod.includes("credito") && !creditType) { addToast("Selecciona el tipo de crédito", "error"); return; }
    if (paymentMethod && (paymentMethod === "nequi" || paymentMethod === "llave" || paymentMethod === "transferencia") && !paymentProof) { addToast("Debes subir el comprobante de pago", "error"); return; }

    let clientId = client.id;
    if (!clientId) {
      const exists = clients.some((c) => c.phone === client.phone);
      if (!exists) {
        await addClient({ name: client.name, phone: client.phone, address: client.address || "", location: client.location || "", notes: client.notes || "", email: "", alertDays: 0, prepMinutes: client.prepMinutes || 15, deliveryMinutes: client.deliveryMinutes || 30 });
        const createdClient = clients.find(c => c.phone === client.phone);
        if (createdClient) clientId = createdClient.id;
      } else { const existingClient = clients.find(c => c.phone === client.phone); clientId = existingClient.id; }
    }

    const total = items.reduce((acc, i) => acc + i.price * i.qty, 0);
    const stockReduced = await reduceStockForOrder(items, user);
    if (!stockReduced) return;

    await addOrder({
      client: client.name, clientData: { id: clientId, name: client.name || "", phone: client.phone || "", address: client.address || "", location: client.location || "", notes: client.notes || "", prepMinutes: client.prepMinutes || 15, deliveryMinutes: client.deliveryMinutes || 30 },
      clientId: clientId, sellerName: sellerName, sellerId: sellerId,
      items: items.map(item => ({ id: item.id, name: item.name, price: item.price, qty: item.qty })),
      total: total, status: "preparacion", createdAt: new Date(), timestamps: { preparacion: new Date() },
      paymentMethod: paymentMethod || null, paymentProof: paymentProof || null, creditType: creditType || null,
      paymentStatus: paymentStatus, totalPaid: 0,
    });

    if (clientId) await updateLastOrderDate(clientId, new Date());
    if (user?.role !== "vendedor" && sellerId) { await sendNotification(sellerId, "Nuevo pedido asignado", `Tienes un nuevo pedido para ${client.name} por $${total.toLocaleString()}`, null); }

    addToast(`Pedido creado. Vendedor: ${sellerName}`, "success");

    setClient({ id: null, name: "", phone: "", address: "", location: "", notes: "", prepMinutes: 15, deliveryMinutes: 30 });
    setClientSearch(""); setItems([]); setSelectedSellerId(""); setPaymentMethod(""); setPaymentProof(null);
    setPaymentProofName(""); setCreditType(""); setPaymentStatus("pendiente");
  };

  const paymentMethods = [
    { value: "efectivo", label: "Efectivo" },
    { value: "nequi", label: "Nequi" },
    { value: "llave", label: "Llave" },
    { value: "transferencia", label: "Transferencia" },
    { value: "credito_empresa", label: "Crédito empresa" },
    { value: "credito_vendedor", label: "Crédito vendedor" },
    { value: "otros", label: "Otros" },
  ];
  const creditTypes = [{ value: "empresa", label: "Crédito empresa" }, { value: "vendedor", label: "Crédito vendedor" }];

  return (
    <div className="create-order-page">
      <h1>Crear Pedido</h1>
      <div className="create-order-layout">
        <>
          {user?.role !== "vendedor" && (
            <div className="co-card">
              <h3><Icons.User size={18} /> Asignar a vendedor</h3>
              <select value={selectedSellerId} onChange={(e) => setSelectedSellerId(e.target.value)} className="co-input" required>
                <option value="">Seleccionar vendedor</option>
                {sellers.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </div>
          )}

          <div className="co-card">
            <h3><Icons.Clients size={18} /> Cliente</h3>
            <input placeholder="Buscar cliente por nombre o teléfono..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="co-input" />
            {debouncedClientSearch && (
              <div className="co-dropdown">
                {clients.filter((c) => { const term = debouncedClientSearch.toLowerCase(); return (c.name || "").toLowerCase().includes(term) || (c.phone || "").includes(debouncedClientSearch); }).length === 0 ? (
                  <div className="co-dropdown-item" style={{ color: "#94a3b8" }}>Creando nuevo cliente...</div>
                ) : (
                  clients.filter((c) => { const term = debouncedClientSearch.toLowerCase(); return (c.name || "").toLowerCase().includes(term) || (c.phone || "").includes(debouncedClientSearch); }).map((c) => (
                    <div key={c.id} className="co-dropdown-item" onClick={() => selectClient(c)}>
                      <span>{c.name} - {c.phone}</span>
                      <span className="co-dropdown-meta">{c.prepMinutes || 15}m • {c.deliveryMinutes || 30}m</span>
                    </div>
                  ))
                )}
              </div>
            )}
            {client.name && (
              <div className="co-client-box">
                <strong>{client.name}</strong>
                <div>{client.phone}</div>
                <div>{client.address}</div>
                {client.location && <div>{client.location}</div>}
                {client.notes && <div className="co-client-notes">{client.notes}</div>}
                <div className="co-client-meta">Prep: {client.prepMinutes || 15} min • Rep: {client.deliveryMinutes || 30} min</div>
              </div>
            )}
          </div>

          <div className="co-card">
            <h3><Icons.Money size={18} /> Forma de pago</h3>
            <div className="co-payment-grid">
              {paymentMethods.map((method) => (
                <label key={method.value} className={`co-payment-label ${paymentMethod === method.value ? "selected" : ""}`}>
                  <input type="radio" name="paymentMethod" value={method.value} checked={paymentMethod === method.value}
                    onChange={(e) => { setPaymentMethod(e.target.value); if (!e.target.value.includes("credito")) setCreditType(""); }} />
                  {method.label}
                </label>
              ))}
            </div>
            {paymentMethod && paymentMethod.includes("credito") && (
              <div className="co-sub-group">
                <label className="co-label-small">Tipo de crédito</label>
                <select value={creditType} onChange={(e) => setCreditType(e.target.value)} className="co-input">
                  <option value="">Seleccionar</option>
                  {creditTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                </select>
              </div>
            )}
            <div className="co-sub-group">
              <label className="co-label-small">Estado del pago</label>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="co-input">
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>
            {(paymentMethod === "nequi" || paymentMethod === "llave" || paymentMethod === "transferencia") && (
              <div className="co-sub-group">
                <label className="co-label-small">Comprobante de pago</label>
                <div className="co-file-wrapper">
                  <label className="co-file-label">
                    Seleccionar archivo
                    <input type="file" accept="image/*" onChange={handlePaymentProofUpload} className="co-file-hidden" />
                  </label>
                  {paymentProofName && <span className="co-file-name">{paymentProofName}</span>}
                </div>
                {paymentProof && (
                  <div className="co-preview">
                    <img src={paymentProof} alt="Comprobante" className="co-preview-img" />
                    <button type="button" onClick={() => { setPaymentProof(null); setPaymentProofName(""); }} className="co-btn-remove-proof">Eliminar</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>

        <>
          <div className="co-card">
            <h3><Icons.Package size={18} /> Productos</h3>
            <input placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} className="co-input" />
            {debouncedProductSearch && !selectedProduct && (
              <div className="co-dropdown">
                {filteredProducts.length === 0 ? (
                  <div className="co-dropdown-item" style={{ color: "#94a3b8" }}>Sin resultados...</div>
                ) : (
                  filteredProducts.map((p) => (
                    <div key={p.id} className="co-dropdown-item" onClick={() => selectProduct(p)}>
                      <span>{p.name} - ${p.price.toLocaleString()}</span>
                      <span className="co-dropdown-meta">Stock: {p.stock}</span>
                    </div>
                  ))
                )}
              </div>
            )}
            {selectedProduct && (
              <div className="co-product-add-row">
                <span style={{ flex: 1, fontWeight: 600 }}>{selectedProduct.name}</span>
                <input type="number" value={qty} min={1} max={selectedProduct.stock} onChange={(e) => setQty(Number(e.target.value))} className="co-input co-qty-input" />
                <button onClick={addItem} className="co-btn-add">Agregar</button>
              </div>
            )}
            <div className="co-items-list">
              {items.map((item, i) => (
                <div key={i} className="co-item">
                  <span>{item.name} <strong>x{item.qty}</strong></span>
                  <span className="co-item-price">${(item.price * item.qty).toLocaleString()}</span>
                  <button onClick={() => removeItem(i)} className="co-btn-remove">✖</button>
                </div>
              ))}
            </div>
          </div>

          <div className="co-card co-summary-card co-col-summary">
            <h3>Total: ${items.reduce((acc, i) => acc + i.price * i.qty, 0).toLocaleString()}</h3>
            <button onClick={handleSubmit} className="co-btn-submit">Guardar Pedido</button>
          </div>
        </>
      </div>
    </div>
  );
}