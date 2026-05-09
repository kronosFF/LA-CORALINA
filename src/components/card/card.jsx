import './Card.css'; // <-- Esta es la ruta. Como están en la misma carpeta, es así de simple.

export default function Card({ children }) {
  return (
    <div className="card">
      {children}
    </div>
  );
}