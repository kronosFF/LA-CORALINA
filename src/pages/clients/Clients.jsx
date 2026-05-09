import { useState, useContext, useRef } from "react";
import { ClientContext } from "../../context/ClientContext";
import { AuthContext } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./Clients.css";

export default function Clients() {
  const { user } = useContext(AuthContext);
  const { clients, addClient, updateClient, deleteClient, updateClientPhoto } = useContext(ClientContext);
  const { addToast } = useToast();
  
  const [form, setForm] = useState({
    id: null, name: "", phone: "", address: "", location: "", notes: "", email: "", alertDays: "", prepMinutes: "15", deliveryMinutes: "30", photo: null,
  });
  const [editing, setEditing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const fileInputRef = useRef(null);

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
    if (!form.name || !form.phone) { addToast("❌ Nombre y teléfono son requeridos", "error"); return; }
    let success;
    if (editing) {
      success = await updateClient(form);
      if (success && selectedPhoto && form.id) await updateClientPhoto(form.id, selectedPhoto);
    } else { success = await addClient(form); }
    if (success) {
      resetForm();
      addToast(editing ? "✅ Cliente actualizado" : "✅ Cliente creado", "success");
    }
  };

  const handleEdit = (client) => {
    setForm({ id: client.id, name: client.name, phone: client.phone, address: client.address || "", location: client.location || "", notes: client.notes || "", email: client.email || "", alertDays: client.alertDays || "", prepMinutes: client.prepMinutes || "15", deliveryMinutes: client.deliveryMinutes || "30", photo: client.photo || null });
    setSelectedPhoto(client.photo || null); setEditing(true);
  };

  const handleDelete = (id) => { deleteClient(id); addToast("🗑️ Cliente eliminado", "success"); };

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

  if (user?.role !== "admin" && user?.role !== "planta") {
    return (<div style={{ padding: "20px", textAlign: "center" }}><p>🚫 No tienes acceso a esta sección</p></div>);
  }

  return (
    <div className="clients-page">
      <h1>👥 Clientes</h1>
      <div className="clients-form-card">
        <h3>{editing ? "✏️ Editar cliente" : "➕ Nuevo cliente"}</h3>
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
              <span className="clients-help-text">⚠️ Alerta si no pide en X días</span>
            </div>
            <div className="clients-small-group">
              <input name="prepMinutes" type="number" placeholder="Minutos preparación" value={form.prepMinutes} onChange={handleChange} className="clients-input" min="1" max="180" />
              <span className="clients-help-text">⏱️ Tiempo de preparación</span>
            </div>
            <div className="clients-small-group">
              <input name="deliveryMinutes" type="number" placeholder="Minutos reparto" value={form.deliveryMinutes} onChange={handleChange} className="clients-input" min="1" max="240" />
              <span className="clients-help-text">🚚 Tiempo de reparto</span>
            </div>
          </div>
          <div className="clients-photo-container">
            <label className="clients-photo-label">📷 Foto de la casa / fachada</label>
            <div className="clients-file-wrapper">
              <label className="clients-file-label">📎 Seleccionar archivo<input type="file" accept="image/*" onChange={handlePhotoUpload} ref={fileInputRef} className="clients-file-hidden" /></label>
              {selectedPhotoName && <span className="clients-file-name">{selectedPhotoName}</span>}
            </div>
            {(selectedPhoto || form.photo) && (
              <div className="clients-preview">
                <img src={selectedPhoto || form.photo} alt="Preview" className="clients-preview-image" />
                <button type="button" onClick={() => { setSelectedPhoto(null); setSelectedPhotoName(""); setForm({ ...form, photo: null }); }} className="clients-remove-btn">✖ Eliminar</button>
              </div>
            )}
          </div>
          <div className="clients-btn-group">
            <button type="submit" className="clients-btn-primary">{editing ? "Actualizar" : "Crear"}</button>
            {editing && (<button type="button" onClick={resetForm} className="clients-btn-secondary">Cancelar</button>)}
          </div>
        </form>
      </div>

      <h3 className="clients-subtitle">📋 Lista de clientes</h3>
      {clients.length === 0 && (<EmptyState icon="👥" title="Sin clientes registrados" description="Agrega tu primer cliente usando el formulario de arriba." />)}

      <div className="clients-grid">
        {clients.map((client) => {
          const inactiveStatus = getInactiveStatus(client);
          return (
            <div key={client.id} className={`clients-card ${inactiveStatus?.isInactive ? "inactive" : ""}`}>
              {client.photo && (<div className="clients-photo-small"><img src={client.photo} alt={client.name} className="clients-small-image" /></div>)}
              <div className="clients-info">
                <div className="clients-header">
                  <span className="clients-name">{client.name}</span>
                  {inactiveStatus?.isInactive && (<span className="clients-badge">⚠️ {inactiveStatus.daysDiff} días sin pedir</span>)}
                </div>
                <div className="clients-contact">
                  <span className="clients-phone">📞 {client.phone}</span>
                  {client.address && <span className="clients-address">📍 {client.address}</span>}
                  {client.location && <span className="clients-location">🏠 {client.location}</span>}
                </div>
                <div className="clients-times">
                  <span className="clients-prep">⏱️ Prep: {client.prepMinutes || 15} min</span>
                  <span className="clients-delivery">🚚 Reparto: {client.deliveryMinutes || 30} min</span>
                  {client.alertDays > 0 && (<span className="clients-alert">🔔 Alerta cada {client.alertDays} días</span>)}
                </div>
                {client.notes && (<div className="clients-notes"><span>📝</span><span>{client.notes}</span></div>)}
              </div>
              <div className="clients-action-buttons">
                <button className="clients-btn-edit" onClick={() => handleEdit(client)}>✏️</button>
                <button className="clients-btn-delete" onClick={() => handleDelete(client.id)}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}