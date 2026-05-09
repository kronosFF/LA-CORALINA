import React, { createContext, useState, useEffect } from "react";
import { 
  collection, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  getDocs,
  where
} from "firebase/firestore";
import { db } from "../config/firebase";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Cargar usuarios
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("name"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const usersList = [];
      snapshot.forEach(doc => {
        usersList.push({ id: doc.id, ...doc.data() });
      });
      
      if (usersList.length === 0) {
        const initialUsers = [
          { name: "Admin", username: "admin", password: "123456", role: "admin", active: true, photo: null },
          { name: "Planta", username: "planta", password: "123456", role: "planta", active: true, photo: null },
          { name: "Vendedor 1", username: "vendedor1", password: "123456", role: "vendedor", active: true, photo: null },
        ];
        for (const u of initialUsers) {
          await addDoc(collection(db, "users"), u);
        }
        setUsers(initialUsers);
      } else {
        setUsers(usersList);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Notificaciones
  useEffect(() => {
    if (!user || user.role !== "vendedor") {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    
    const q = query(collection(db, `notifications_${user.id}`), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = [];
      let unread = 0;
      snapshot.forEach(doc => {
        const notif = { id: doc.id, ...doc.data() };
        notifs.push(notif);
        if (!notif.read) unread++;
      });
      setNotifications(notifs);
      setUnreadCount(unread);
    });
    return () => unsubscribe();
  }, [user]);

  // LOGIN - SIN VALIDACIÓN, SOLO BUSCA EL USUARIO
  const login = async (username, password) => {
    try {
      const q = query(collection(db, "users"), where("username", "==", username), where("password", "==", password));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        alert("❌ Usuario o contraseña incorrectos");
        return false;
      }
      
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      
      setUser({ id: userDoc.id, ...userData });
      return true;
    } catch (error) {
      alert("❌ Error al iniciar sesión");
      return false;
    }
  };

  const logout = () => {
    setUser(null);
  };

  const addUser = async (newUser) => {
    if (!newUser.name || !newUser.username || !newUser.password) {
      alert("❌ Nombre, usuario y contraseña requeridos");
      return false;
    }

    const exists = users.some(u => u.username === newUser.username);
    if (exists) {
      alert("❌ Ya existe un usuario con ese nombre");
      return false;
    }

    try {
      await addDoc(collection(db, "users"), {
        name: newUser.name,
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
        active: true,
        photo: null,
      });
      alert("✅ Usuario creado");
      return true;
    } catch (error) {
      alert("❌ Error al crear usuario");
      return false;
    }
  };

  const updatePassword = async (userId, newPassword) => {
    try {
      await updateDoc(doc(db, "users", userId), { password: newPassword });
      alert("✅ Contraseña actualizada");
      return true;
    } catch (error) {
      alert("❌ Error al actualizar contraseña");
      return false;
    }
  };

  const updateUser = async (updatedUser) => {
    if (!updatedUser.name) {
      alert("❌ El nombre es requerido");
      return false;
    }
    try {
      await updateDoc(doc(db, "users", updatedUser.id), {
        name: updatedUser.name,
        role: updatedUser.role,
        active: updatedUser.active,
      });
      alert("✅ Usuario actualizado");
      return true;
    } catch (error) {
      alert("❌ Error al actualizar usuario");
      return false;
    }
  };

  const toggleUserStatus = async (id, currentActive) => {
    if (!confirm(currentActive ? "¿Bloquear este usuario?" : "¿Activar este usuario?")) return false;
    try {
      await updateDoc(doc(db, "users", id), { active: !currentActive });
      alert(currentActive ? "✅ Usuario bloqueado" : "✅ Usuario activado");
      return true;
    } catch (error) {
      alert("❌ Error al cambiar estado");
      return false;
    }
  };

  const deleteUser = async (id) => {
    if (!confirm("¿Eliminar este usuario?")) return false;
    try {
      await deleteDoc(doc(db, "users", id));
      alert("✅ Usuario eliminado");
      return true;
    } catch (error) {
      alert("❌ Error al eliminar usuario");
      return false;
    }
  };

  const sendNotification = async (sellerId, title, message, orderId) => {
    if (!sellerId) return false;
    try {
      await addDoc(collection(db, `notifications_${sellerId}`), {
        title, message, orderId, read: false, createdAt: new Date()
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  const markNotificationAsRead = async (sellerId, notificationId) => {
    try {
      await updateDoc(doc(db, `notifications_${sellerId}`, notificationId), { read: true });
      return true;
    } catch (error) {
      return false;
    }
  };

  const getActiveSellers = () => users.filter(u => u.role === "vendedor" && u.active === true);

  return (
    <AuthContext.Provider value={{
      user, users, loading, notifications, unreadCount,
      login, logout, addUser, updateUser, updatePassword,
      deleteUser, toggleUserStatus, getActiveSellers,
      sendNotification, markNotificationAsRead
    }}>
      {children}
    </AuthContext.Provider>
  );
}