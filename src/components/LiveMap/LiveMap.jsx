import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './LiveMap.css';

// Solución al bug de íconos de Leaflet en React/Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

export default function LiveMap({ sellersLocation }) {
  // Coordenadas por defecto (Bogotá, Colombia - Cámbialas a la de tu ciudad)
  const defaultPosition = [4.7110, -74.0721]; 

  return (
    <div style={{ height: '450px', width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <MapContainer center={defaultPosition} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {sellersLocation.map((seller) => (
          seller.lat && seller.lng && (
            <Marker key={seller.id} position={[seller.lat, seller.lng]}>
              <Popup>
                <strong>{seller.name}</strong><br />
                Última actualización: {seller.updatedAt ? new Date(seller.updatedAt).toLocaleTimeString() : 'Desconocido'}
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
}