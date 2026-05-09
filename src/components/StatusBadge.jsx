export default function StatusBadge({ status }) {
  const config = {
    preparacion: { color: "#2563eb", label: "EN PREPARACIÓN" },
    reparto: { color: "#f59e0b", label: "EN REPARTO" },
    entregado: { color: "#16a34a", label: "ENTREGADO" },
  };

  const current = config[status];

  if (!current) return null;

  return (
    <span style={{ color: current.color, fontWeight: "bold" }}>
      {current.label}
    </span>
  );
}