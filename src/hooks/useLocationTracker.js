import { useEffect, useRef } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";

export function useLocationTracker(user) {
  const watchIdRef = useRef(null);

  useEffect(() => {
    // Solo ejecutar si es vendedor y está en un navegador con GPS
    if (!user || user.role !== "vendedor" || !navigator.geolocation) return;

    // Iniciar el rastreo
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Guardar/Actualizar en Firestore en la colección 'userLocations'
          await setDoc(doc(db, "userLocations", user.id), {
            lat: latitude,
            lng: longitude,
            name: user.name,
            id: user.id,
            updatedAt: new Date()
          }, { merge: true });
        } catch (error) {
          console.error("Error guardando ubicación en Firestore:", error);
        }
      },
      (error) => {
        console.error("Error obteniendo ubicación GPS:", error.message);
      },
      { 
        enableHighAccuracy: true, // Usa el GPS del celular en vez de la antena WiFi
        maximumAge: 15000,        // No usar caché mayor a 15 segundos
        timeout: 10000            // Si no consigue señal en 10 seg, falla
      }
    );

    // Limpiar al desmontar o cerrar sesión
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user]);
}