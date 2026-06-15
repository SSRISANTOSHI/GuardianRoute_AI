import React, { useState } from 'react';
import axios from 'axios';

function distKm(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = ((lat2-lat1)*Math.PI)/180, dLon = ((lon2-lon1)*Math.PI)/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
}

const API = 'http://localhost:5001';

const TYPE_META = {
  hospital:     { icon: '🏥', safe: true  },
  police:       { icon: '👮', safe: true  },
  railway:      { icon: '🚂', safe: true  },
  station:      { icon: '🚉', safe: true  },
  pharmacy:     { icon: '💊', safe: true  },
  fire_station: { icon: '🚒', safe: true  },
  bar:          { icon: '🍺', safe: false },
  nightclub:    { icon: '🎵', safe: false },
  default:      { icon: '📍', safe: true  },
};

export default function SafeZoneFinder({ source, onZonesFound, liveScanTrigger }) {
  const [loading, setLoading]         = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [zones, setZones]             = useState([]);
  const [liveZones, setLiveZones]     = useState(null); // { safe: [], danger: [], coords: {} }
  const [tab, setTab]                 = useState('route'); // 'route' | 'live'

  // ── Route-based zones (existing) ──────────────────────────
  const findRouteZones = async () => {
    if (!source) return alert('Please search for a route first to set your location.');
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/safezones`, {
        params: { lat: source.lat, lon: source.lon, radius: 3000 },
      });
      const sorted = res.data.zones.sort((a, b) =>
        parseFloat(distKm(source.lat, source.lon, a.lat, a.lon)) -
        parseFloat(distKm(source.lat, source.lon, b.lat, b.lon))
      );
      setZones(sorted);
      onZonesFound(sorted);
    } catch {
      alert('Could not fetch safe zones. Check backend connection.');
    }
    setLoading(false);
  };

  // ── Live location scan ─────────────────────────────────────
  const scanLiveZones = () => {
    if (!navigator.geolocation) return alert('Geolocation not supported.');
    setLiveLoading(true);
    setTab('live');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const res = await axios.get(`${API}/api/safezones`, {
            params: { lat, lon, radius: 2000 },
          });
          const all = res.data.zones.sort((a, b) =>
            parseFloat(distKm(lat, lon, a.lat, a.lon)) -
            parseFloat(distKm(lat, lon, b.lat, b.lon))
          );
          const safe   = all.filter(z => (TYPE_META[z.type] || TYPE_META.default).safe);
          const danger = all.filter(z => !(TYPE_META[z.type] || TYPE_META.default).safe);
          setLiveZones({ safe, danger, coords: { lat, lon } });
          onZonesFound(all);
        } catch {
          alert('Could not fetch live zones. Check backend connection.');
        }
        setLiveLoading(false);
      },
      () => { alert('Could not get your location.'); setLiveLoading(false); },
      { timeout: 8000 }
    );
  };

  // expose scanLiveZones via liveScanTrigger ref pattern
  React.useEffect(() => {
    if (liveScanTrigger?.current !== undefined) {
      liveScanTrigger.current = scanLiveZones;
    }
  });

  const lc = liveZones?.coords;

  return (
    <div className="safezone-finder">

      {/* Emergency contacts always on top */}
      <div className="emergency-contacts">
        <div className="ec-title">🆘 Emergency Contacts</div>
        <div className="ec-row"><span>📞 Emergency</span><a href="tel:112">112</a></div>
        <div className="ec-row"><span>👮 Police</span><a href="tel:100">100</a></div>
        <div className="ec-row"><span>🚑 Ambulance</span><a href="tel:108">108</a></div>
        <div className="ec-row"><span>👩 Women Helpline</span><a href="tel:181">181</a></div>
      </div>

      {/* Tab switcher */}
      <div className="sz-tab-bar">
        <button className={`sz-tab ${tab === 'route' ? 'active' : ''}`} onClick={() => setTab('route')}>
          📍 Route Zones
        </button>
        <button className={`sz-tab ${tab === 'live' ? 'active' : ''}`} onClick={() => { setTab('live'); if (!liveZones) scanLiveZones(); }}>
          🔴 Live Scan
        </button>
      </div>

      {/* ── Route Zones tab ── */}
      {tab === 'route' && (
        <>
          <div className="safezone-header">
            <h3>🆘 SafeZone Finder</h3>
            <button className="find-zones-btn" onClick={findRouteZones} disabled={loading}>
              {loading ? 'Searching…' : 'Find Nearby Safe Zones'}
            </button>
          </div>
          {zones.length > 0 ? (
            <div className="zones-list">
              {zones.map((z, i) => (
                <div key={i} className="zone-item">
                  <span className="zone-icon">{(TYPE_META[z.type] || TYPE_META.default).icon}</span>
                  <div>
                    <div className="zone-name">{z.name}</div>
                    <div className="zone-type">
                      {z.type}{source ? ` • ${distKm(source.lat, source.lon, z.lat, z.lon)} km away` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="zones-empty">Click the button to find hospitals, police stations, and transport hubs near your route.</p>
          )}
        </>
      )}

      {/* ── Live Scan tab ── */}
      {tab === 'live' && (
        <>
          <div className="live-scan-header">
            <h3>🔴 Live Zone Scan</h3>
            <button className="live-scan-btn" onClick={scanLiveZones} disabled={liveLoading}>
              {liveLoading ? '⏳ Scanning…' : '🎯 Re-scan My Location'}
            </button>
          </div>

          {liveLoading && (
            <div className="live-scanning-indicator">
              <div className="live-pulse" />
              Detecting your location and scanning nearby zones…
            </div>
          )}

          {liveZones && !liveLoading && (
            <>
              <div className="live-coords-badge">
                📡 Scanned at {liveZones.coords.lat.toFixed(5)}, {liveZones.coords.lon.toFixed(5)}
              </div>

              {/* Safe zones */}
              <div className="live-section-title safe">✅ Safe Zones Nearby ({liveZones.safe.length})</div>
              {liveZones.safe.length > 0 ? (
                <div className="zones-list">
                  {liveZones.safe.map((z, i) => (
                    <div key={i} className="zone-item safe-zone-item">
                      <span className="zone-icon">{(TYPE_META[z.type] || TYPE_META.default).icon}</span>
                      <div>
                        <div className="zone-name">{z.name}</div>
                        <div className="zone-type zone-type-safe">
                          {z.type} • {distKm(lc.lat, lc.lon, z.lat, z.lon)} km away
                        </div>
                      </div>
                      <span className="zone-badge safe-badge">SAFE</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="zones-empty">No safe facilities found within 2 km.</p>
              )}

              {/* Danger zones */}
              <div className="live-section-title danger">⚠️ Caution Zones Nearby ({liveZones.danger.length})</div>
              {liveZones.danger.length > 0 ? (
                <div className="zones-list">
                  {liveZones.danger.map((z, i) => (
                    <div key={i} className="zone-item danger-zone-item">
                      <span className="zone-icon">{(TYPE_META[z.type] || TYPE_META.default).icon}</span>
                      <div>
                        <div className="zone-name">{z.name}</div>
                        <div className="zone-type zone-type-danger">
                          {z.type} • {distKm(lc.lat, lc.lon, z.lat, z.lon)} km away
                        </div>
                      </div>
                      <span className="zone-badge danger-badge">CAUTION</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="zones-empty">No caution zones detected nearby. Stay safe! ✅</p>
              )}
            </>
          )}

          {!liveZones && !liveLoading && (
            <p className="zones-empty">Click <strong>🎯 Re-scan My Location</strong> to detect safe and danger zones around your current position.</p>
          )}
        </>
      )}
    </div>
  );
}
