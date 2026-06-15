import React, { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  CircleMarker,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 13);
  }, [center, map]);
  return null;
}

function routeColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}

function heatColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function SafetyMap({ routes, selectedRoute, source, destination, heatmapZones, safeZones }) {
  const center = source ? [source.lat, source.lon] : [13.0827, 80.2707];

  return (
    <div style={{ position: 'relative' }}>
    <MapContainer center={center} zoom={12} className="map-container">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OSM</a>'
      />
      <FlyTo center={source ? [source.lat, source.lon] : null} />

      {heatmapZones.map((z, i) => (
        <CircleMarker
          key={`heat-${i}`}
          center={[z.lat, z.lon]}
          radius={24}
          pathOptions={{ color: heatColor(z.score), fillColor: heatColor(z.score), fillOpacity: 0.35, weight: 1 }}
        >
          <Popup>{z.label}: {z.score}/100</Popup>
        </CircleMarker>
      ))}

      {routes.map((r) => {
        const coords = r.coordinates.map(([lon, lat]) => [lat, lon]);
        const isSelected = selectedRoute?.id === r.id;
        return (
          <Polyline
            key={r.id}
            positions={coords}
            pathOptions={{
              color: routeColor(r.safety_score),
              weight: isSelected ? 6 : 3,
              opacity: isSelected ? 1 : 0.5,
              dashArray: r.recommended ? null : '8 4',
            }}
          >
            <Popup>
              <b>{r.label}</b><br />
              Safety: {r.safety_score}/100<br />
              {r.classification.label}
            </Popup>
          </Polyline>
        );
      })}

      {source && (
        <Marker position={[source.lat, source.lon]}>
          <Popup>📍 Source</Popup>
        </Marker>
      )}
      {destination && (
        <Marker position={[destination.lat, destination.lon]}>
          <Popup>🏁 Destination</Popup>
        </Marker>
      )}

      {safeZones.map((z, i) => {
        const dist = source ? haversineKm(source.lat, source.lon, z.lat, z.lon).toFixed(1) : null;
        return (
          <CircleMarker
            key={`sz-${i}`}
            center={[z.lat, z.lon]}
            radius={8}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.8 }}
          >
            <Popup>🔵 {z.name}<br />{z.type}{dist ? ` • ${dist} km away` : ''}</Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
    <div className="map-legend">
      <div><span className="dot" style={{ background: '#22c55e' }} /> High Safety (80–100)</div>
      <div><span className="dot" style={{ background: '#eab308' }} /> Moderate (60–79)</div>
      <div><span className="dot" style={{ background: '#ef4444' }} /> Use Caution (&lt;60)</div>
      <div><span className="dot" style={{ background: '#3b82f6' }} /> Safe Zone</div>
    </div>
    </div>
  );
}
