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
  onSnapshot
} from "firebase/firestore";
import { db } from "../config/firebase";

export const ClientContext = createContext();

export function ClientProvider({ children }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "clients"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const clientsList = [];
      querySnapshot.forEach((doc) => {
        clientsList.push({ id: doc.id, ...doc.data() });
      });
      
      if (clientsList.length === 0) {
        const initialClients = [
          { name: "Juan Perez", phone: "3001234567", address: "Centro", location: "Cerca al parque", notes: "Solo recibe antes de las 11am", email: "juan@example.com", alertDays: 0, prepMinutes: 15, deliveryMinutes: 30, lastOrderDate: null, photo: null },
          { name: "Maria Lopez", phone: "3019876543", address: "Norte", location: "Esquina verde", notes: "", email: "maria@example.com", alertDays: 0, prepMinutes: 20, deliveryMinutes: 45, lastOrderDate: null, photo: null },
        ];
        
        const addInitialClients = async () => {
          for (const client of initialClients) {
            await addDoc(collection(db, "clients"), client);
          }
        };
        addInitialClients();
      }
      
      setClients(clientsList);
      setLoading(false);
    }, (error) => {
      console.error("Error al cargar clientes:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateLastOrderDate = async (clientId, orderDate) => {
    if (!clientId) return;
    try {
      const clientRef = doc(db, "clients", clientId);
      await updateDoc(clientRef, {
        lastOrderDate: orderDate || new Date()
      });
    } catch (error) {
      console.error("Error al actualizar última fecha de pedido:", error);
    }
  };

  const addClient = async (newClient) => {
    if (!newClient.name || !newClient.phone) {
      alert("❌ Nombre y teléfono son requeridos");
      return false;
    }

    const exists = clients.some(
      (c) => c.phone === newClient.phone
    );

    if (exists) {
      alert("❌ Ya existe un cliente con ese teléfono");
      return false;
    }

    try {
      const clientData = {
        name: newClient.name,
        phone: newClient.phone,
        address: newClient.address || "",
        location: newClient.location || "",
        notes: newClient.notes || "",
        email: newClient.email || "",
        photo: newClient.photo || null,
        alertDays: Number(newClient.alertDays) || 0,
        prepMinutes: Number(newClient.prepMinutes) || 15,
        deliveryMinutes: Number(newClient.deliveryMinutes) || 30,
        lastOrderDate: null,
      };
      const docRef = await addDoc(collection(db, "clients"), clientData);
      alert("✅ Cliente creado");
      return true;
    } catch (error) {
      console.error("Error al crear cliente:", error);
      alert("❌ Error al crear cliente");
      return false;
    }
  };

  const updateClient = async (updatedClient) => {
    if (!updatedClient.name || !updatedClient.phone) {
      alert("❌ Nombre y teléfono son requeridos");
      return false;
    }

    try {
      const clientRef = doc(db, "clients", updatedClient.id);
      await updateDoc(clientRef, {
        name: updatedClient.name,
        phone: updatedClient.phone,
        address: updatedClient.address || "",
        location: updatedClient.location || "",
        notes: updatedClient.notes || "",
        email: updatedClient.email || "",
        photo: updatedClient.photo || null,
        alertDays: Number(updatedClient.alertDays) || 0,
        prepMinutes: Number(updatedClient.prepMinutes) || 15,
        deliveryMinutes: Number(updatedClient.deliveryMinutes) || 30,
      });
      
      alert("✅ Cliente actualizado");
      return true;
    } catch (error) {
      console.error("Error al actualizar cliente:", error);
      alert("❌ Error al actualizar cliente");
      return false;
    }
  };

  const updateClientPhoto = async (clientId, photoUrl) => {
    try {
      const clientRef = doc(db, "clients", clientId);
      await updateDoc(clientRef, { photo: photoUrl });
      return true;
    } catch (error) {
      console.error("Error al actualizar foto:", error);
      return false;
    }
  };

  const deleteClient = async (id) => {
    if (!confirm("¿Eliminar este cliente? Se eliminarán también sus pedidos asociados.")) return false;
    
    try {
      await deleteDoc(doc(db, "clients", id));
      alert("✅ Cliente eliminado");
      return true;
    } catch (error) {
      console.error("Error al eliminar cliente:", error);
      alert("❌ Error al eliminar cliente");
      return false;
    }
  };

  const getInactiveClients = () => {
    const today = new Date();
    const inactive = [];
    
    clients.forEach(client => {
      if (!client.alertDays || client.alertDays <= 0) return;
      if (!client.lastOrderDate) return;
      
      let lastDate;
      if (client.lastOrderDate?.toDate) {
        lastDate = client.lastOrderDate.toDate();
      } else {
        lastDate = new Date(client.lastOrderDate);
      }
      
      if (isNaN(lastDate.getTime())) return;
      
      const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff >= client.alertDays) {
        inactive.push({
          ...client,
          daysInactive: daysDiff,
          expectedDays: client.alertDays
        });
      }
    });
    
    return inactive.sort((a, b) => b.daysInactive - a.daysInactive);
  };

  return (
    <ClientContext.Provider
      value={{
        clients,
        loading,
        addClient,
        updateClient,
        deleteClient,
        updateClientPhoto,
        updateLastOrderDate,
        getInactiveClients,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}