import "./EmptyState.css";

export default function EmptyState({ icon, title, description }) {
  return (
    <div className="empty-state-container">
      <div className="empty-state-icon">{icon}</div>
      <h4 className="empty-state-title">{title}</h4>
      {description && <p className="empty-state-desc">{description}</p>}
    </div>
  );
}