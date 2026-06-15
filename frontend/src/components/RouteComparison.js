import React from 'react';

const ICONS = {
  emergency_access: '🚨',
  time_risk: '🕐',
  weather: '🌤️',
  transport: '🚌',
  zone_safety: '📍',
};

function ScoreBar({ value }) {
  const color = value >= 80 ? '#22c55e' : value >= 60 ? '#eab308' : '#ef4444';
  return (
    <div className="score-bar-wrap">
      <div className="score-bar" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

function RouteCard({ route, onSelect, selected }) {
  const borderColor =
    route.classification.color === 'green'
      ? '#22c55e'
      : route.classification.color === 'yellow'
      ? '#eab308'
      : '#ef4444';

  return (
    <div
      className={`route-card ${selected ? 'selected' : ''} ${route.recommended ? 'recommended' : ''}`}
      style={{ borderLeft: `4px solid ${borderColor}` }}
      onClick={() => onSelect(route)}
    >
      {route.recommended && <div className="badge recommended-badge">⭐ AI Recommended</div>}
      <div className="route-header">
        <h3>{route.label}</h3>
        <div className="score-circle" style={{ background: borderColor }}>
          {route.safety_score}
        </div>
      </div>
      <div className="route-meta">
        <span>⏱ {route.duration_min} min</span>
        <span>📏 {route.distance_km} km</span>
        <span className="classification-badge" style={{ color: borderColor }}>
          {route.classification.label}
        </span>
      </div>
      {route.area_name && (
        <div className="area-name">📌 {route.area_name.split(',').slice(0, 3).join(', ')}</div>
      )}
      <ScoreBar value={route.safety_score} />
      <div className="breakdown">
        {Object.entries(route.breakdown).map(([key, val]) => (
          <div key={key} className="breakdown-item">
            <span>{ICONS[key]} {key.replace(/_/g, ' ')}</span>
            <span>{val}/100</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RouteComparison({ routes, onSelectRoute, selectedRoute }) {
  if (!routes.length) return null;
  return (
    <div className="route-comparison">
      <h2>🛡️ Route Safety Comparison</h2>
      <div className="routes-grid">
        {routes.map((r) => (
          <RouteCard
            key={r.id}
            route={r}
            onSelect={onSelectRoute}
            selected={selectedRoute?.id === r.id}
          />
        ))}
      </div>
    </div>
  );
}
