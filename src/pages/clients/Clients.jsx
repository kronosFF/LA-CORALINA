import { useState, useContext, useRef, useMemo } from "react";
import { ClientContext } from "../../context/ClientContext";
import { AuthContext } from "../../context/AuthContext";
import { OrderContext } from "../../context/OrderContext";
import { useToast } from "../../context/ToastContext";
import { useDebounce } from "../../hooks/useDebounce";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./Clients.css";

export default function Clients() {
  const { user } = useContext(AuthContext);
  const { clients, addClient, updateClient, deleteClient, updateClientPhoto } = useContext(ClientContext);
  const { orders, registerPayment } = useContext(OrderContext);
  const { addToast } = useToast();

  // Estado del formulario
  const [form, setForm] = useState({
    id: null, name: "", phone: "", address: "", location: "", notes: "", email: "", alertDays: "", prepMinutes: "15", deliveryMinutes: "30", photo: null,
  });
  const [editing, setEditing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const fileInputRef = useRef(null);

  // Estados de búsqueda y expansión
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [expandedClientId, setExpandedClientId] = useState(null);

  // Estados para el modal de abonos rápidos
  const [payingClient, setPayingClient] = useState(null);
  const [clientPayAmount, setClientPayAmount] = useState("");
  const [clientPayMethod, setClientPayMethod] = useState("efectivo");

  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedPhotoName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => { setSelectedPhoto(reader.result); setForm({ ...form, photo: reader.result }); };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setForm({ id: null, name: "", phone: "", address: "", location: "", notes: "", email: "", alertDays: "", prepMinutes: "15", deliveryMinutes: "30", photo: null });
    setSelectedPhoto(null); setSelectedPhotoName(""); setEditing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) { addToast("Nombre y teléfono son requeridos", "error"); return; }
    let success;
    if (editing) {
      success = await updateClient(form);
      if (success && selectedPhoto && form.id) await updateClientPhoto(form.id, selectedPhoto);
    } else { success = await addClient(form); }
    if (success) {
      resetForm();
      addToast(editing ? "Cliente actualizado" : "Cliente creado", "success");
    }
  };

  const handleEdit = (client) => {
    setForm({ id: client.id, name: client.name, phone: client.phone, address: client.address || "", location: client.location || "", notes: client.notes || "", email: client.email || "", alertDays: client.alertDays || "", prepMinutes: client.prepMinutes || "15", deliveryMinutes: client.deliveryMinutes || "30", photo: client.photo || null });
    setSelectedPhoto(client.photo || null); setEditing(true);
    setExpandedClientId(null);
  };

  const handleDelete = (id) => { deleteClient(id); addToast("Cliente eliminado", "success"); };

  const getInactiveStatus = (client) => {
    if (!client.alertDays || client.alertDays <= 0) return null;
    if (!client.lastOrderDate) return null;
    let lastDate;
    if (client.lastOrderDate?.toDate) { lastDate = client.lastOrderDate.toDate(); } else { lastDate = new Date(client.lastOrderDate); }
    const today = new Date();
    const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    if (daysDiff >= client.alertDays) return { daysDiff, isInactive: true };
    return { daysDiff, isInactive: false };
  };

  const getClientDebt = (clientId) => {
    const clientOrders = orders.filter(o =>
      (o.clientId === clientId || o.clientData?.id === clientId) &&
      (o.paymentStatus === "credito" || o.paymentStatus === "pendiente")
    );
    return clientOrders.reduce((sum, o) => sum + ((o.total || 0) - (o.totalPaid || 0)), 0);
  };

  const handleClientPayment = async () => {
    if (!clientPayAmount || clientPayAmount <= 0) { addToast("Ingresa un monto válido", "error"); return; }

    const unpaidOrders = orders.filter(o =>
      (o.clientId === payingClient.id || o.clientData?.id === payingClient.id) &&
      (o.paymentStatus === "credito" || o.paymentStatus === "pendiente")
    ).sort((a, b) => {
      let dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      let dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dA - dB;
    });

    if (unpaidOrders.length === 0) { addToast("Este cliente no tiene deudas", "error"); return; }

    const oldestOrder = unpaidOrders[0];
    const remainingDebt = (oldestOrder.total || 0) - (oldestOrder.totalPaid || 0);

    if (Number(clientPayAmount) > remainingDebt) {
      addToast(`El monto supera la deuda del pedido #${oldestOrder.numericId || oldestOrder.id.slice(-6)} ($${remainingDebt.toLocaleString()})`, "error");
      return;
    }

    const success = await registerPayment(oldestOrder.id, Number(clientPayAmount), clientPayMethod, null, "Abono rápido desde módulo clientes");
    if (success) {
      addToast(`Abono de $${Number(clientPayAmount).toLocaleString()} registrado`, "success");
      setPayingClient(null);
      setClientPayAmount("");
      setClientPayMethod("efectivo");
    }
  };

  if (user?.role !== "admin" && user?.role !== "planta") {
    return (<div style={{ padding: "20px", textAlign: "center" }}><p>No tienes acceso a esta sección</p></div>);
  }

  const paymentMethods = [
    { value: "efectivo", label: "Efectivo" },
    { value: "nequi", label: "Nequi" },
    { value: "llave", label: "Llave" },
    { value: "transferencia", label: "Transferencia" },
  ];

  const filteredClients = useMemo(() => {
    if (!debouncedSearch.trim()) return clients;
    const term = debouncedSearch.toLowerCase().trim();
    return clients.filter(c =>
      c.name?.toLowerCase().includes(term) ||
      c.phone?.includes(term) ||
      c.address?.toLowerCase().includes(term)
    );
  }, [clients, debouncedSearch]);

  const toggleExpand = (clientId) => {
    setExpandedClientId(expandedClientId === clientId ? null : clientId);
  };

  return (
    <div className="clients-page">
      <h1>Clientes</h1>

      <div className="clients-form-card">
        <h3>{editing ? "Editar cliente" : "Nuevo cliente"}</h3>
        <form onSubmit={handleSubmit} className="clients-form">
          <input name="name" placeholder="Nombre completo *" value={form.name} onChange={handleChange} className="clients-input" />
          <input name="phone" placeholder="Teléfono *" value={form.phone} onChange={handleChange} className="clients-input" />
          <input name="address" placeholder="Dirección" value={form.address} onChange={handleChange} className="clients-input" />
          <input name="location" placeholder="Referencia / Ubicación" value={form.location} onChange={handleChange} className="clients-input" />
          <textarea name="notes" placeholder="Notas (horario de entrega, indicaciones...)" value={form.notes} onChange={handleChange} className="clients-input" style={{ minHeight: "60px" }} />
          <input name="email" type="email" placeholder="Correo electrónico" value={form.email} onChange={handleChange} className="clients-input" />
          <div className="clients-row">
            <div className="clients-small-group">
              <input name="alertDays" type="number" placeholder="Días para alerta" value={form.alertDays} onChange={handleChange} className="clients-input" min="0" />
              <span className="clients-help-text">Alerta si no pide en X días</span>
            </div>
            <div className="clients-small-group">
              <input name="prepMinutes" type="number" placeholder="Minutos preparación" value={form.prepMinutes} onChange={handleChange} className="clients-input" min="1" max="180" />
              <span className="clients-help-text">Tiempo de preparación</span>
            </div>
            <div className="clients-small-group">
              <input name="deliveryMinutes" type="number" placeholder="Minutos reparto" value={form.deliveryMinutes} onChange={handleChange} className="clients-input" min="1" max="240" />
              <span className="clients-help-text">Tiempo de reparto</span>
            </div>
          </div>
          <div className="clients-photo-container">
            <label className="clients-photo-label"><Icons.Image size={18} /> Foto de la casa / fachada</label>
            <div className="clients-file-wrapper">
              <label className="clients-file-label">
                <Icons.Upload size={16} />
                Seleccionar archivo
                <input type="file" accept="image/*" onChange={handlePhotoUpload} ref={fileInputRef} className="clients-file-hidden" />
              </label>
              {selectedPhotoName && <span className="clients-file-name">{selectedPhotoName}</span>}
            </div>
            {(selectedPhoto || form.photo) && (
              <div className="clients-preview">
                <img src={selectedPhoto || form.photo} alt="Preview" className="clients-preview-image" />
                <button type="button" onClick={() => { setSelectedPhoto(null); setSelectedPhotoName(""); setForm({ ...form, photo: null }); }} className="clients-remove-btn">
                  <Icons.X size={14} />
                  Eliminar
                </button>
              </div>
            )}
          </div>
          <div className="clients-btn-group">
            <button type="submit" className="clients-btn-primary">{editing ? "Actualizar" : "Crear"}</button>
            {editing && (<button type="button" onClick={resetForm} className="clients-btn-secondary">Cancelar</button>)}
          </div>
        </form>
      </div>

      <div className="clients-list-header">
        <h3 className="clients-subtitle">Lista de clientes</h3>
        <span className="clients-count">{filteredClients.length} clientes</span>
      </div>

      <div className="clients-search-container">
        <div className="clients-search-box">
          <Icons.Search size={18} />
          <input
            type="text"
            placeholder="Buscar cliente por nombre, teléfono o dirección..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="clients-search-input"
          />
          {searchTerm && (
            <button className="clients-search-clear" onClick={() => setSearchTerm("")}>
              <Icons.X size={16} />
            </button>
          )}
        </div>
      </div>

      {filteredClients.length === 0 && (
        <EmptyState
          icon={<Icons.Clients size={32} />}
          title={searchTerm ? "No se encontraron clientes" : "Sin clientes registrados"}
          description={searchTerm ? "Prueba con otros términos de búsqueda" : "Agrega tu primer cliente usando el formulario de arriba."}
        />
      )}

      {/* GRID DE CLIENTES - NUEVO DISEÑO OPCIÓN 4 */}
      <div className="clients-grid">
        {filteredClients.map((client) => {
          const isExpanded = expandedClientId === client.id;
          const inactiveStatus = getInactiveStatus(client);
          const clientDebt = getClientDebt(client.id);

          return (
            <ClientCard
              key={client.id}
              client={client}
              isExpanded={isExpanded}
              inactiveStatus={inactiveStatus}
              clientDebt={clientDebt}
              onToggleExpand={toggleExpand}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPay={() => { setPayingClient(client); setClientPayAmount(""); }}
            />
          );
        })}
      </div>

      {/* Modal para registrar abono rápido */}
      {payingClient && (
        <div className="modal-overlay" onClick={() => setPayingClient(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title"><Icons.Money size={20} /> Abono a cuenta</h3>
            <p style={{ fontWeight: "bold", marginBottom: "5px" }}>{payingClient.name}</p>
            <p style={{ color: "#ef4444", fontWeight: "800", fontSize: "18px", marginBottom: "20px" }}>
              Deuda total: ${getClientDebt(payingClient.id).toLocaleString()}
            </p>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Monto a abonar</label>
              <input type="number" value={clientPayAmount} onChange={(e) => setClientPayAmount(e.target.value)} placeholder="Ej: 50000" className="clients-input" />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Método de pago</label>
              <select value={clientPayMethod} onChange={(e) => setClientPayMethod(e.target.value)} className="clients-input">
                {paymentMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleClientPayment} className="btn-save">Registrar Abono</button>
              <button onClick={() => setPayingClient(null)} className="btn-cancel">Cancelar</button>
            </div>
            <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "12px", textAlign: "center" }}>
              * Se abonará al pedido más antiguo pendiente de este cliente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// 🎨 TARJETA DE CLIENTE - OPCIÓN 4 (SOMBRA ELEVADA)
// ============================================
function ClientCard({ client, isExpanded, inactiveStatus, clientDebt, onToggleExpand, onEdit, onDelete, onPay }) {
  return (
    <div
      className={`client-card-elevated ${isExpanded ? "expanded" : ""} ${inactiveStatus?.isInactive ? "inactive" : ""}`}
      onClick={() => onToggleExpand(client.id)}
    >
      {/* Vista compacta */}
      <div className="client-compact-view">
        <div className="client-compact-info">
          {client.photo && (
            <img src={client.photo} alt={client.name} className="client-compact-avatar" />
          )}
          <div className="client-compact-name">
            <strong>{client.name}</strong>
            {inactiveStatus?.isInactive && (
              <span className="client-badge">{inactiveStatus.daysDiff}d sin pedir</span>
            )}
            {clientDebt > 0 && (
              <span className="client-badge debt-badge">Debe: ${clientDebt.toLocaleString()}</span>
            )}
          </div>
        </div>
        <div className="client-compact-actions">
          <button
            className="client-btn-edit"
            onClick={(e) => { e.stopPropagation(); onEdit(client); }}
          >
            <Icons.Edit size={16} />
          </button>
          <button
            className="client-btn-delete"
            onClick={(e) => { e.stopPropagation(); onDelete(client.id); }}
          >
            <Icons.Trash size={16} />
          </button>
          {clientDebt > 0 && (
            <button
              className="client-btn-pay"
              onClick={(e) => { e.stopPropagation(); onPay(); }}
            >
              <Icons.Money size={16} />
            </button>
          )}
          <span className="client-expand-icon">
            {isExpanded ? <Icons.Cancel size={16} /> : <Icons.Plus size={16} />}
          </span>
        </div>
      </div>

      {/* Vista expandida */}
      {isExpanded && (
        <div className="client-expanded-view" onClick={(e) => e.stopPropagation()}>
          {client.photo && (
            <div className="client-expanded-photo">
              <img src={client.photo} alt={client.name} className="client-expanded-image" />
            </div>
          )}

          <div className="client-expanded-details">
            <div className="client-expanded-row">
              <span><strong>Teléfono:</strong> {client.phone}</span>
              {client.email && <span><strong>Email:</strong> {client.email}</span>}
            </div>
            {client.address && (
              <div className="client-expanded-row">
                <span><strong>Dirección:</strong> {client.address}</span>
              </div>
            )}
            {client.location && (
              <div className="client-expanded-row">
                <span><strong>Ubicación:</strong> {client.location}</span>
              </div>
            )}
            <div className="client-expanded-row">
              <span><strong>Prep:</strong> {client.prepMinutes || 15} min</span>
              <span><strong>Reparto:</strong> {client.deliveryMinutes || 30} min</span>
              {client.alertDays > 0 && (
                <span><strong>Alerta:</strong> cada {client.alertDays} días</span>
              )}
            </div>
            {client.notes && (
              <div className="client-expanded-row client-expanded-notes">
                <span><strong>Notas:</strong> {client.notes}</span>
              </div>
            )}
            {client.lastOrderDate && (
              <div className="client-expanded-row client-expanded-last-order">
                <span><strong>Último pedido:</strong> {
                  client.lastOrderDate?.toDate ?
                    client.lastOrderDate.toDate().toLocaleDateString() :
                    new Date(client.lastOrderDate).toLocaleDateString()
                }</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}