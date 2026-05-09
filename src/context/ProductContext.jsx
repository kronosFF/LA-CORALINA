import React, { createContext, useState, useEffect } from "react";
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  orderBy,
  where,
  onSnapshot
} from "firebase/firestore";
import { db } from "../config/firebase";

export const ProductContext = createContext();

export function ProductProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const movementTypes = {
    ENTRADA_PRODUCCION: { label: "🏭 Entrada por producción", type: "entrada" },
    ENTRADA_COMPRA: { label: "📦 Entrada por compra", type: "entrada" },
    ENTRADA_DEVOLUCION: { label: "🔄 Devolución (cancelación)", type: "entrada" },
    SALIDA_VENTA: { label: "💰 Salida por venta", type: "salida" },
    SALIDA_DETERIORO: { label: "⚠️ Salida por deterioro", type: "salida" },
    SALIDA_AJUSTE: { label: "🔧 Salida por ajuste", type: "salida" },
  };

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productsList = [];
      querySnapshot.forEach((doc) => {
        productsList.push({ id: doc.id, ...doc.data() });
      });
      
      if (productsList.length === 0) {
        const initialProducts = [
          { name: "Botellón 20L", price: 8000, stock: 50, image: null },
          { name: "Paca x20", price: 12000, stock: 30, image: null },
          { name: "Botella 1L", price: 2000, stock: 100, image: null },
          { name: "Galón 5L", price: 4000, stock: 40, image: null },
        ];
        
        const addInitialProducts = async () => {
          for (const product of initialProducts) {
            await addDoc(collection(db, "products"), product);
          }
        };
        addInitialProducts();
      }
      
      setProducts(productsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const addProduct = async (product) => {
    if (!product.name || !product.price) {
      alert("❌ Completa los datos del producto");
      return false;
    }

    try {
      await addDoc(collection(db, "products"), {
        name: product.name,
        price: Number(product.price),
        stock: 0,
        image: product.image || null,
      });
      alert("✅ Producto creado");
      return true;
    } catch (error) {
      console.error("Error al crear producto:", error);
      alert("❌ Error al crear producto");
      return false;
    }
  };

  const updateProduct = async (updatedProduct) => {
    if (!updatedProduct.name || !updatedProduct.price) {
      alert("❌ Completa los datos del producto");
      return false;
    }

    try {
      const productRef = doc(db, "products", updatedProduct.id);
      await updateDoc(productRef, {
        name: updatedProduct.name,
        price: Number(updatedProduct.price),
        image: updatedProduct.image || null,
      });
      alert("✅ Producto actualizado");
      return true;
    } catch (error) {
      console.error("Error al actualizar producto:", error);
      alert("❌ Error al actualizar producto");
      return false;
    }
  };

  const updateProductImage = async (productId, imageUrl) => {
    try {
      const productRef = doc(db, "products", productId);
      await updateDoc(productRef, { image: imageUrl });
      return true;
    } catch (error) {
      console.error("Error al actualizar imagen:", error);
      return false;
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm("¿Eliminar este producto?")) return false;
    try {
      await deleteDoc(doc(db, "products", id));
      alert("✅ Producto eliminado");
      return true;
    } catch (error) {
      console.error("Error al eliminar producto:", error);
      alert("❌ Error al eliminar producto");
      return false;
    }
  };

  const addStock = async (productId, quantity, movementType, comment, user) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return false;

    try {
      const productRef = doc(db, "products", productId);
      await updateDoc(productRef, { stock: (product.stock || 0) + Number(quantity) });

      await addDoc(collection(db, "stockMovements"), {
        productId,
        productName: product.name,
        type: "entrada",
        movementType: movementType,
        quantity: Number(quantity),
        comment: comment,
        userName: user?.name,
        date: new Date(),
      });

      alert(`✅ Se agregaron ${quantity} unidades a ${product.name}`);
      return true;
    } catch (error) {
      console.error("Error al agregar stock:", error);
      alert("❌ Error al agregar stock");
      return false;
    }
  };

  // ✅ FUNCIÓN CORREGIDA - Asegurar que se guarda SALIDA_DETERIORO
  const reduceStock = async (productId, quantity, movementType, comment, user) => {
    console.log("🔴 reduceStock llamado con movementType:", movementType);
    
    const product = products.find((p) => p.id === productId);
    if (!product) {
      console.error("Producto no encontrado:", productId);
      return false;
    }

    if (product.stock < quantity) {
      alert(`❌ Stock insuficiente para ${product.name}. Disponible: ${product.stock}`);
      return false;
    }

    try {
      const productRef = doc(db, "products", productId);
      await updateDoc(productRef, { stock: product.stock - Number(quantity) });

      // Asegurar que el movementType sea el correcto
      const finalMovementType = movementType || "SALIDA_AJUSTE";
      console.log("📝 Guardando movimiento con movementType:", finalMovementType);
      
      await addDoc(collection(db, "stockMovements"), {
        productId,
        productName: product.name,
        type: "salida",
        movementType: finalMovementType,
        quantity: Number(quantity),
        comment: comment,
        userName: user?.name,
        date: new Date(),
      });

      alert(`✅ Se quitaron ${quantity} unidades de ${product.name}`);
      return true;
    } catch (error) {
      console.error("Error al quitar stock:", error);
      alert("❌ Error al quitar stock");
      return false;
    }
  };

  const reduceStockForOrder = async (items, user) => {
    for (const item of items) {
      const product = products.find((p) => p.id === item.id);
      if (!product || product.stock < item.qty) {
        alert(`❌ Stock insuficiente para ${item.name}`);
        return false;
      }
    }

    for (const item of items) {
      const product = products.find((p) => p.id === item.id);
      const productRef = doc(db, "products", item.id);
      await updateDoc(productRef, { stock: product.stock - item.qty });

      await addDoc(collection(db, "stockMovements"), {
        productId: item.id,
        productName: item.name,
        type: "salida",
        movementType: "SALIDA_VENTA",
        quantity: item.qty,
        comment: `Venta - ${item.name} x${item.qty}`,
        userName: user?.name,
        date: new Date(),
      });
    }
    return true;
  };

  const returnStockFromOrder = async (items, user) => {
    for (const item of items) {
      const product = products.find((p) => p.id === item.id);
      const productRef = doc(db, "products", item.id);
      await updateDoc(productRef, { stock: product.stock + item.qty });

      await addDoc(collection(db, "stockMovements"), {
        productId: item.id,
        productName: item.name,
        type: "entrada",
        movementType: "ENTRADA_DEVOLUCION",
        quantity: item.qty,
        comment: "Devolución por cancelación",
        userName: user?.name,
        date: new Date(),
      });
    }
  };

  const getStockMovements = async (filters = {}) => {
    try {
      let q;
      
      if (filters.movementType) {
        q = query(collection(db, "stockMovements"), where("movementType", "==", filters.movementType));
      } else if (filters.productId) {
        q = query(collection(db, "stockMovements"), where("productId", "==", filters.productId));
      } else {
        q = query(collection(db, "stockMovements"), orderBy("date", "desc"));
      }
      
      const querySnapshot = await getDocs(q);
      const movements = [];
      querySnapshot.forEach((doc) => {
        movements.push({ id: doc.id, ...doc.data() });
      });
      
      if (filters.movementType || filters.productId) {
        movements.sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          return dateB - dateA;
        });
      }
      
      return movements;
    } catch (error) {
      console.error("Error al cargar movimientos:", error);
      return [];
    }
  };

  return (
    <ProductContext.Provider
      value={{
        products,
        loading,
        movementTypes,
        addProduct,
        updateProduct,
        updateProductImage,
        deleteProduct,
        addStock,
        reduceStock,
        reduceStockForOrder,
        returnStockFromOrder,
        getStockMovements,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}