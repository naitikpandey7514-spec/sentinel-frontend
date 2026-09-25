function StatCard({ title, value, description, icon: Icon }) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span>{title}</span>

        {Icon && (
          <div className="stat-icon">
            <Icon size={20} />
          </div>
        )}
      </div>

      <strong>{value}</strong>

      <p>{description}</p>
    </div>
  );
}

export default StatCard;