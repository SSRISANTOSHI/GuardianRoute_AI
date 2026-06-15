import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = 'http://localhost:5001';

function LocationInput({ placeholder, value, onChange, icon }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const debounce = useRef(null);

  const handleChange = (val) => {
    onChange(val);
    clearTimeout(debounce.current);
    if (val.length < 3) { setSuggestions([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/api/autocomplete`, { params: { q: val } });
        setSuggestions(res.data.suggestions);
        setShowDrop(true);
      } catch { setSuggestions([]); }
    }, 350);
  };

  const pick = (label) => {
    onChange(label);
    setSuggestions([]);
    setShowDrop(false);
  };

  return (
    <div className="location-input-wrap">
      <div className="input-group">
        <span className="input-icon">{icon}</span>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setTimeout(() => setShowDrop(false), 150)}
          onFocus={() => suggestions.length && setShowDrop(true)}
          required
        />
      </div>
      {showDrop && suggestions.length > 0 && (
        <ul className="autocomplete-drop">
          {suggestions.map((s, i) => (
            <li key={i} onMouseDown={() => pick(s.label)}>{s.label}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function RouteSearch({ onSearch, loading, onLiveScan }) {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('Tambaram Railway Station');
  const [locating, setLocating] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');

  const resolveLocation = useCallback(async (latitude, longitude) => {
    try {
      const res = await axios.get(`${API}/api/reverse-geocode`, { params: { lat: latitude, lon: longitude } });
      setSource(res.data.display_name || `${latitude},${longitude}`);
    } catch {
      setSource(`${latitude},${longitude}`);
    }
  }, []);

  // Auto-detect on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    setLiveStatus('Detecting your location…');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await resolveLocation(pos.coords.latitude, pos.coords.longitude);
        setLiveStatus('📍 Live location detected');
        setLocating(false);
        setTimeout(() => setLiveStatus(''), 3000);
      },
      () => {
        setLiveStatus('');
        setLocating(false);
      },
      { timeout: 8000 }
    );
  }, [resolveLocation]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return alert('Geolocation not supported.');
    setLocating(true);
    setLiveStatus('Detecting…');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await resolveLocation(pos.coords.latitude, pos.coords.longitude);
        setLiveStatus('📍 Live location set');
        setLocating(false);
        setTimeout(() => setLiveStatus(''), 3000);
      },
      () => { alert('Could not get your location.'); setLocating(false); setLiveStatus(''); }
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (source && destination) onSearch(source, destination);
  };

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="search-row">
        <div className="location-input-with-btn">
          <LocationInput
            placeholder={locating ? 'Detecting live location…' : 'From: Your location'}
            value={source}
            onChange={setSource}
            icon={locating ? '⏳' : '📍'}
          />
          <button
            type="button"
            className="locate-btn"
            onClick={useMyLocation}
            disabled={locating}
            title="Re-detect my live location"
          >
            {locating ? '⏳' : '🎯'}
          </button>
        </div>

        <LocationInput placeholder="To: Enter destination" value={destination} onChange={setDestination} icon="🏁" />

        <button type="submit" className="search-btn" disabled={loading || !source}>
          {loading ? '⏳ Analyzing…' : '🛡️ Find Safest Route'}
        </button>
      </div>

      <div className="search-bottom-row">
        {liveStatus && <span className="live-status">{liveStatus}</span>}
        <button
          type="button"
          className="live-scan-btn"
          onClick={onLiveScan}
          title="Scan safe and danger zones along your current location"
        >
          🔴 Scan Live Zones
        </button>
      </div>
    </form>
  );
}
