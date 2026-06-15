import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import RouteSearch from './components/RouteSearch';
import RouteComparison from './components/RouteComparison';
import SafetyMap from './components/SafetyMap';
import AIAssistant from './components/AIAssistant';
import SafeZoneFinder from './components/SafeZoneFinder';
import { useAuth } from './context/AuthContext';
import './App.css';

const API = 'http://localhost:5001';

export default function RoutePlannerApp() {
  const { user, getAuthHeader } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [source, setSource] = useState(null);
  const [sourceName, setSourceName] = useState('');
  const [destName, setDestName] = useState('');
  const [destination, setDestination] = useState(null);
  const [heatmapZones, setHeatmapZones] = useState([]);
  const [safeZones, setSafeZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('map');
  const [saveMsg, setSaveMsg] = useState('');
  const liveScanTrigger = useRef(null);

  const handleLiveScan = () => {
    setActiveTab('zones');
    setTimeout(() => { if (liveScanTrigger.current) liveScanTrigger.current(); }, 100);
  };

  useEffect(() => {
    axios.get(`${API}/api/heatmap`).then(r => setHeatmapZones(r.data.zones)).catch(() => {});
  }, []);

  const handleSearch = async (src, dst) => {
    setLoading(true);
    setError('');
    setRoutes([]);
    setSafeZones([]);
    setSaveMsg('');
    setSourceName(src);
    setDestName(dst);
    try {
      const res = await axios.post(
        `${API}/api/routes`,
        { source: src, destination: dst },
        { headers: getAuthHeader() }
      );
      setRoutes(res.data.routes);
      setSource(res.data.source);
      setDestination(res.data.destination);
      setSelectedRoute(res.data.routes[0]);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to fetch routes. Ensure backend is running.');
    }
    setLoading(false);
  };

  const handleSaveRoute = async () => {
    if (!user) { setSaveMsg('Login to save routes'); return; }
    if (!selectedRoute) return;
    try {
      await axios.post(
        `${API}/api/user/saved-routes`,
        {
          name: `${sourceName.split(',')[0]} → ${destName.split(',')[0]}`,
          source: sourceName,
          destination: destName,
          safety_score: selectedRoute.safety_score,
        },
        { headers: getAuthHeader() }
      );
      setSaveMsg('✅ Route saved!');
    } catch {
      setSaveMsg('Failed to save.');
    }
    setTimeout(() => setSaveMsg(''), 3000);
  };

  return (
    <div className="app">
      <main className="app-main">
        <div className="planner-topbar">
          <div>
            <h2 className="planner-title">🛡️ Safe Route Planner</h2>
            <p className="planner-sub">AI-powered safety scoring for every route</p>
          </div>
          {routes.length > 0 && (
            <div className="planner-actions">
              {saveMsg && <span className="save-msg">{saveMsg}</span>}
              <button className="save-route-btn" onClick={handleSaveRoute}>⭐ Save Route</button>
            </div>
          )}
        </div>

        <RouteSearch onSearch={handleSearch} loading={loading} onLiveScan={handleLiveScan} />

        {error && <div className="error-banner">⚠️ {error}</div>}

        <div className="content-grid">
          <div className="left-panel">
            <div className="tab-bar">
              <button className={activeTab === 'map' ? 'tab active' : 'tab'} onClick={() => setActiveTab('map')}>🗺️ Map</button>
              <button className={activeTab === 'ai' ? 'tab active' : 'tab'} onClick={() => setActiveTab('ai')}>🤖 AI Assistant</button>
              <button className={activeTab === 'zones' ? 'tab active' : 'tab'} onClick={() => setActiveTab('zones')}>🆘 Safe Zones</button>
            </div>

            {activeTab === 'map' && (
              <SafetyMap
                routes={routes}
                selectedRoute={selectedRoute}
                source={source}
                destination={destination}
                heatmapZones={heatmapZones}
                safeZones={safeZones}
              />
            )}
            {activeTab === 'ai' && <AIAssistant selectedRoute={selectedRoute} />}
            {activeTab === 'zones' && <SafeZoneFinder source={source} onZonesFound={setSafeZones} liveScanTrigger={liveScanTrigger} />}
          </div>

          <div className="right-panel">
            {routes.length > 0 ? (
              <RouteComparison routes={routes} onSelectRoute={setSelectedRoute} selectedRoute={selectedRoute} />
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🗺️</div>
                <h3>Ready to Find Your Safest Route</h3>
                <p>Enter your source and destination above to get AI-powered safety scores for each route option.</p>
                <div className="legend">
                  <div><span className="dot green" />High Safety (80–100)</div>
                  <div><span className="dot yellow" />Moderate Safety (60–79)</div>
                  <div><span className="dot red" />Use Caution (&lt;60)</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
