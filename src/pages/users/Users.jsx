import { useState, useContext, useRef } from "react";
import { AuthContext } from "../../context/AuthContext";
import Icons from "../../components/icons/Icons";
import "./users.css";

export default function Users() {
  const { user, users, addUser, updateUser, updatePassword, deleteUser, toggleUserStatus, updateUserPhoto } = useContext(AuthContext);

  if (user?.role !== "admin" && user?.role !== "planta") {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>No tienes acceso a esta sección</p>
      </div>
    );
  }

  const [form, setForm] = useState({
    id: null,
    name: "",
    username: "",
    password: "",
    role: "vendedor",
    active: true,
    photo: null,
  });
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const resetForm = () => {
    setForm({
      id: null,
      name: "",
      username: "",
      password: "",
      role: "vendedor",
      active: true,
      photo: null,
    });
    setSelectedPhoto(null);
    setSelectedPhotoName("");
    setEditing(false);
    setCreating(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedPhotoName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedPhoto(reader.result);
        setForm({ ...form, photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedPhoto(null);
    setSelectedPhotoName("");
    setForm({ ...form, photo: null });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.username || !form.password) {
      alert("Nombre, usuario y contraseña son requeridos");
      return;
    }
    const success = await addUser(form);
    if (success) resetForm();
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!form.name) {
      alert("El nombre es requerido");
      return;
    }

    const success = await updateUser(form);
    if (success && selectedPhoto && form.id) {
      await updateUserPhoto(form.id, selectedPhoto);
    }
    if (success) resetForm();
  };

  const handleEdit = (u) => {
    if (u.id === user.id) {
      alert("No puedes editarte a ti mismo.");
      return;
    }
    setForm({
      id: u.id,
      name: u.name,
      username: u.username,
      password: "",
      role: u.role,
      active: u.active,
      photo: u.photo || null,
    });
    setSelectedPhoto(u.photo || null);
    setEditing(true);
    setCreating(false);
  };

  const handleToggle = (id, active) => {
    if (id === user.id) {
      alert("No puedes bloquearte a ti mismo.");
      return;
    }
    toggleUserStatus(id, active);
  };

  const handleDelete = (id) => {
    if (id === user.id) {
      alert("No puedes eliminarte a ti mismo.");
      return;
    }
    deleteUser(id);
  };

  const isLastAdmin = () => {
    const adminCount = users.filter(u => u.role === "admin" && u.active === true).length;
    return adminCount === 1 && user.role === "admin";
  };

  return (
    <div className="users-page">
      <h1>Usuarios</h1>

      {!editing && !creating && (
        <button onClick={() => setCreating(true)} className="new-btn">
          <Icons.Plus size={18} />
          Nuevo usuario
        </button>
      )}

      {/* FORMULARIO DE CREACIÓN */}
      {creating && (
        <div className="form-card">
          <h3><Icons.Plus size={18} /> Nuevo usuario</h3>
          <form onSubmit={handleCreate} className="form">
            <input
              name="name"
              placeholder="Nombre completo"
              value={form.name}
              onChange={handleChange}
              className="input"
            />
            <input
              name="username"
              placeholder="Usuario"
              value={form.username}
              onChange={handleChange}
              className="input"
            />
            <input
              name="password"
              type="password"
              placeholder="Contraseña"
              value={form.password}
              onChange={handleChange}
              className="input"
            />
            <select name="role" value={form.role} onChange={handleChange} className="input">
              <option value="vendedor">Vendedor</option>
              <option value="planta">Planta</option>
              <option value="admin">Admin</option>
            </select>

            <div className="photo-upload-container">
              <label className="photo-label"><Icons.Image size={18} /> Foto de perfil (opcional)</label>
              <div className="file-upload-wrapper">
                <label className="file-upload-label">
                  <Icons.Upload size={16} />
                  Seleccionar archivo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    ref={fileInputRef}
                    className="file-input-hidden"
                  />
                </label>
                {selectedPhotoName && <span className="file-name">{selectedPhotoName}</span>}
              </div>
              {selectedPhoto && (
                <div className="preview-container">
                  <img src={selectedPhoto} alt="Preview" className="preview-image" />
                  <button type="button" onClick={handleRemovePhoto} className="btn-remove">
                    <Icons.X size={14} />
                    Eliminar
                  </button>
                </div>
              )}
            </div>

            <div className="button-group">
              <button type="submit" className="btn-primary">Crear usuario</button>
              <button type="button" onClick={resetForm} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* FORMULARIO DE EDICIÓN */}
      {editing && (
        <div className="form-card">
          <h3><Icons.Edit size={18} /> Editar usuario</h3>
          <div className="warning-text">El nombre de usuario NO se puede cambiar.</div>
          <form onSubmit={handleUpdate} className="form">
            <input
              name="name"
              placeholder="Nombre completo"
              value={form.name}
              onChange={handleChange}
              className="input"
            />
            <input
              name="username"
              placeholder="Usuario"
              value={form.username}
              className="input input-disabled"
              disabled
            />
            <select name="role" value={form.role} onChange={handleChange} className="input">
              <option value="vendedor">Vendedor</option>
              <option value="planta">Planta</option>
              <option value="admin">Admin</option>
            </select>

            <div className="photo-upload-container">
              <label className="photo-label"><Icons.Image size={18} /> Foto de perfil</label>
              <div className="file-upload-wrapper">
                <label className="file-upload-label">
                  <Icons.Upload size={16} />
                  Cambiar foto
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    ref={fileInputRef}
                    className="file-input-hidden"
                  />
                </label>
                {selectedPhotoName && <span className="file-name">{selectedPhotoName}</span>}
                {!selectedPhotoName && form.photo && <span className="file-name">Foto actual cargada</span>}
              </div>
              {(selectedPhoto || form.photo) && (
                <div className="preview-container">
                  <img src={selectedPhoto || form.photo} alt="Preview" className="preview-image" />
                  <button type="button" onClick={handleRemovePhoto} className="btn-remove">
                    <Icons.X size={14} />
                    Eliminar foto
                  </button>
                </div>
              )}
            </div>

            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  style={{ marginRight: "8px" }}
                />
                Usuario activo (puede iniciar sesión)
              </label>
            </div>
            <div className="button-group">
              <button type="submit" className="btn-primary">Actualizar</button>
              <button type="button" onClick={resetForm} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <h3>Lista de usuarios</h3>

      <div className="users-grid">
        {users.map((u) => {
          const isSelf = u.id === user.id;

          return (
            <UserCard
              key={u.id}
              user={u}
              isSelf={isSelf}
              isLastAdmin={isLastAdmin()}
              onEdit={handleEdit}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onPasswordChange={(id) => {
                const newPass = prompt("Ingrese nueva contraseña para " + u.username);
                if (newPass) updatePassword(id, newPass);
              }}
            />
          );
        })}
      </div>

      <div className="security-note">
        <Icons.Lock size={16} />
        <strong>Nota de seguridad:</strong> No puedes modificar, bloquear o eliminar tu propio usuario.
      </div>
    </div>
  );
}

// ============================================
// 🎨 TARJETA DE USUARIO - OPCIÓN 2 (GRADIENTE EN CABECERA)
// ============================================
function UserCard({ user, isSelf, isLastAdmin, onEdit, onToggle, onDelete, onPasswordChange }) {
  const [expanded, setExpanded] = useState(false);

  const getRoleColor = (role) => {
    if (role === "admin") return "gradient-admin";
    if (role === "planta") return "gradient-planta";
    return "gradient-vendedor";
  };

  const getRoleLabel = (role) => {
    if (role === "admin") return "Admin";
    if (role === "planta") return "Planta";
    return "Vendedor";
  };

  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className={`user-card-gradient ${!user.active ? "inactive" : ""} ${isSelf ? "self" : ""}`}>
      {/* Cabecera con gradiente según rol */}
      <div className={`user-card-header ${getRoleColor(user.role)}`}>
        <div className="user-header-left">
          {user.photo ? (
            <img src={user.photo} alt={user.name} className="user-header-image" />
          ) : (
            <div className="user-header-initials">{initials}</div>
          )}
          <div className="user-header-info">
            <h4 className="user-header-name">
              {user.name}
              {isSelf && <span className="self-badge-header"> Tú</span>}
            </h4>
            <span className="user-header-username">@{user.username}</span>
          </div>
        </div>
        <div className="user-header-actions">
          <button
            className="user-btn-expand"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <Icons.Cancel size={16} /> : <Icons.Plus size={16} />}
          </button>
        </div>
      </div>

      {/* Cuerpo de la tarjeta */}
      <div className="user-card-body">
        <div className="user-badges">
          <span className={`user-role-badge ${user.role}`}>
            {getRoleLabel(user.role)}
          </span>
          {!user.active && <span className="user-status-badge inactive-badge">Bloqueado</span>}
          {isLastAdmin && user.role === "admin" && <span className="user-status-badge warning-badge">Último admin</span>}
          {isSelf && <span className="user-status-badge self-badge">Tú</span>}
        </div>

        {/* Expansión - Botones de acción */}
        {expanded && (
          <div className="user-expanded">
            <div className="user-expanded-row">
              <span><strong>Nombre:</strong> {user.name}</span>
            </div>
            <div className="user-expanded-row">
              <span><strong>Usuario:</strong> @{user.username}</span>
            </div>
            <div className="user-expanded-row">
              <span><strong>Rol:</strong> {getRoleLabel(user.role)}</span>
            </div>
            <div className="user-expanded-row">
              <span><strong>Estado:</strong> {user.active ? "Activo ✅" : "Bloqueado ❌"}</span>
            </div>
            <div className="user-action-buttons">
              <button
                className="user-btn-edit"
                onClick={() => onEdit(user)}
                disabled={isSelf}
                title={isSelf ? "No puedes editarte a ti mismo" : ""}
              >
                <Icons.Edit size={14} />
                Editar
              </button>
              <button
                className="user-btn-password"
                onClick={() => onPasswordChange(user.id)}
                disabled={isSelf}
                title={isSelf ? "No puedes cambiar tu propia contraseña" : ""}
              >
                <Icons.Lock size={14} />
                Contraseña
              </button>
              <button
                className={!user.active ? "user-btn-activate" : "user-btn-block"}
                onClick={() => onToggle(user.id, user.active)}
                disabled={isSelf || (isLastAdmin && user.role === "admin")}
                title={isSelf ? "No puedes bloquearte a ti mismo" : ""}
              >
                {!user.active ? <Icons.Check size={14} /> : <Icons.Lock size={14} />}
                {!user.active ? "Activar" : "Bloquear"}
              </button>
              <button
                className="user-btn-delete"
                onClick={() => onDelete(user.id)}
                disabled={isSelf}
                title={isSelf ? "No puedes eliminarte a ti mismo" : ""}
              >
                <Icons.Trash size={14} />
                Eliminar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}