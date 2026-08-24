import { useState, useContext, useRef } from "react";
import { ProductContext } from "../../context/ProductContext";
import { AuthContext } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Icons from "../../components/icons/Icons";
import EmptyState from "../../components/EmptyState/EmptyState";
import "./products.css";

export default function Products() {
  const { user } = useContext(AuthContext);
  const { addToast } = useToast();
  const { products, addProduct, updateProduct, updateProductImage, deleteProduct } = useContext(ProductContext);

  if (user?.role !== "admin" && user?.role !== "planta") {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>No tienes acceso a esta sección</p>
      </div>
    );
  }

  const [form, setForm] = useState({ id: null, name: "", price: "", image: null });
  const [editing, setEditing] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageName, setSelectedImageName] = useState("");
  const fileInputRef = useRef(null);

  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImageName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => { setSelectedImage(reader.result); setForm({ ...form, image: reader.result }); };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setForm({ id: null, name: "", price: "", image: null });
    setSelectedImage(null); setSelectedImageName(""); setEditing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price) {
      addToast("Completa los datos del producto", "error");
      return;
    }

    let success;
    if (editing) {
      success = await updateProduct(form);
      if (success && selectedImage && form.id) await updateProductImage(form.id, selectedImage);
    } else { success = await addProduct(form); }

    if (success) {
      resetForm();
      addToast(editing ? "Producto actualizado" : "Producto creado", "success");
    }
  };

  const handleEdit = (product) => {
    setForm({ id: product.id, name: product.name, price: product.price, image: product.image || null });
    setSelectedImage(product.image || null); setEditing(true);
  };

  const handleDelete = (id) => { deleteProduct(id); };

  return (
    <div className="products-page">
      <h1>Productos</h1>

      <div className="products-form-card">
        <h3>{editing ? "Editar producto" : "Nuevo producto"}</h3>
        <form onSubmit={handleSubmit} className="products-form">
          <input
            name="name"
            placeholder="Nombre del producto"
            value={form.name}
            onChange={handleChange}
            className="products-input"
          />
          <input
            name="price"
            type="number"
            placeholder="Precio"
            value={form.price}
            onChange={handleChange}
            className="products-input"
          />

          <div className="photo-container">
            <label className="photo-label"><Icons.Image size={18} /> Imagen del producto</label>
            <div className="file-upload-wrapper">
              <label className="file-upload-label">
                <Icons.Upload size={16} />
                Seleccionar archivo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  ref={fileInputRef}
                  className="file-input-hidden"
                />
              </label>
              {selectedImageName && <span className="file-name">{selectedImageName}</span>}
              {!selectedImageName && form.image && <span className="file-name">Imagen actual cargada</span>}
            </div>
            {(selectedImage || form.image) && (
              <div className="preview-container">
                <img src={selectedImage || form.image} alt="Preview" className="preview-image" />
                <button
                  type="button"
                  onClick={() => { setSelectedImage(null); setSelectedImageName(""); setForm({ ...form, image: null }); }}
                  className="btn-remove"
                >
                  <Icons.X size={14} />
                  Eliminar imagen
                </button>
              </div>
            )}
          </div>

          <div className="btn-group">
            <button type="submit" className="btn-primary">
              {editing ? "Actualizar" : "Crear"}
            </button>
            {editing && (
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <h3>Lista de productos</h3>
      {products.length === 0 && (
        <EmptyState
          icon={<Icons.Package size={32} />}
          title="No hay productos"
          description="Agrega tu primer producto usando el formulario de arriba."
        />
      )}

      <div className="products-grid">
        {products.map((product) => (
          <div key={product.id} className="product-card">
            {product.image && (
              <div className="product-image-container">
                <img src={product.image} alt={product.name} className="product-img" />
              </div>
            )}
            <div className="product-info">
              <strong>{product.name}</strong>
              <div className="product-price">${product.price.toLocaleString()}</div>
              <div className="product-stock">Stock: {product.stock || 0} uds</div>
            </div>
            <div className="product-actions">
              <button className="btn-edit" onClick={() => handleEdit(product)}>
                <Icons.Edit size={16} />
              </button>
              <button className="btn-delete" onClick={() => handleDelete(product.id)}>
                <Icons.Trash size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}