import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const API = 'http://localhost:5001';

function Section({ title, children }) {
  return (
    <div className="dash-section">
      <h3 className="dash-section-title">{title}</h3>
      {children}
    </div>
  );
}

function RouteHistory({ headers }) {
  const [history, setHistory] = useState([]);
  useEffect(() => {
    axios.get(`${API}/api/user/history`, { headers }).then(r => setHistory(r.data.history)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!history.length) return <p className="dash-empty">No route history yet. Start planning safe routes!</p>;
  return (
    <div className="dash-list">
      {history.map(h => (
        <div key={h.id} className="dash-item">
          <div className="dash-item-main">
            <div className="dash-item-route">{h.source} → {h.destination}</div>
            <div className="dash-item-meta">{h.distance_km} km · {h.duration_min} min · {h.created_at?.slice(0, 10)}</div>
          </div>
          <div className="dash-score" style={{ background: h.safety_score >= 80 ? '#166534' : h.safety_score >= 60 ? '#713f12' : '#450a0a' }}>
            {h.safety_score}
          </div>
        </div>
      ))}
    </div>
  );
}

function SavedRoutes({ headers }) {
  const [saved, setSaved] = useState([]);
  const load = () => axios.get(`${API}/api/user/saved-routes`, { headers }).then(r => setSaved(r.data.saved)).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const del = async (id) => {
    await axios.delete(`${API}/api/user/saved-routes/${id}`, { headers });
    load();
  };

  if (!saved.length) return <p className="dash-empty">No saved routes. Save a route from the planner!</p>;
  return (
    <div className="dash-list">
      {saved.map(r => (
        <div key={r.id} className="dash-item">
          <div className="dash-item-main">
            <div className="dash-item-route">⭐ {r.name}</div>
            <div className="dash-item-meta">{r.source} → {r.destination}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="dash-score" style={{ background: '#1e1b4b' }}>{r.safety_score}</div>
            <button className="dash-del-btn" onClick={() => del(r.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmergencyContacts({ headers }) {
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', relation: '' });
  const [adding, setAdding] = useState(false);

  const load = () => axios.get(`${API}/api/user/emergency-contacts`, { headers }).then(r => setContacts(r.data.contacts)).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (e) => {
    e.preventDefault();
    await axios.post(`${API}/api/user/emergency-contacts`, form, { headers });
    setForm({ name: '', phone: '', relation: '' });
    setAdding(false);
    load();
  };

  const del = async (id) => {
    await axios.delete(`${API}/api/user/emergency-contacts/${id}`, { headers });
    load();
  };

  return (
    <div>
      <div className="dash-list">
        {contacts.map(c => (
          <div key={c.id} className="dash-item">
            <div className="dash-item-main">
              <div className="dash-item-route">📞 {c.contact_name}</div>
              <div className="dash-item-meta">{c.phone} · {c.relation}</div>
            </div>
            <button className="dash-del-btn" onClick={() => del(c.id)}>✕</button>
          </div>
        ))}
        {!contacts.length && !adding && <p className="dash-empty">No emergency contacts added yet.</p>}
      </div>

      {adding ? (
        <form className="dash-add-form" onSubmit={add}>
          <input placeholder="Contact Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input placeholder="Phone Number" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
          <input placeholder="Relation (e.g. Mother)" value={form.relation} onChange={e => setForm(f => ({ ...f, relation: e.target.value }))} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="dash-save-btn">Add</button>
            <button type="button" className="dash-cancel-btn" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className="dash-add-btn" onClick={() => setAdding(true)}>+ Add Contact</button>
      )}
    </div>
  );
}

function SafetyPreferences({ headers }) {
  const [prefs, setPrefs] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/user/preferences`, { headers }).then(r => setPrefs(r.data.preferences)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (k) => setPrefs(p => ({ ...p, [k]: p[k] ? 0 : 1 }));

  const save = async () => {
    await axios.put(`${API}/api/user/preferences`, prefs, { headers });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!prefs) return <p className="dash-empty">Loading preferences...</p>;

  const toggles = [
    ['avoid_night_travel', '🌙 Avoid night travel (after 10 PM)'],
    ['prefer_lit_roads', '💡 Prefer well-lit roads'],
    ['alert_on_low_score', '🔔 Alert when safety score < threshold'],
    ['share_location', '📍 Share location with emergency contacts'],
  ];

  return (
    <div className="prefs-form">
      {toggles.map(([key, label]) => (
        <div key={key} className="pref-row">
          <span className="pref-label">{label}</span>
          <button className={`pref-toggle ${prefs[key] ? 'on' : ''}`} onClick={() => toggle(key)}>
            {prefs[key] ? 'ON' : 'OFF'}
          </button>
        </div>
      ))}
      <div className="pref-row">
        <span className="pref-label">🎯 Minimum Safety Score Threshold</span>
        <div className="pref-score-input">
          <input
            type="range" min="40" max="90" step="5"
            value={prefs.min_safety_score || 60}
            onChange={e => setPrefs(p => ({ ...p, min_safety_score: parseInt(e.target.value) }))}
          />
          <span>{prefs.min_safety_score || 60}</span>
        </div>
      </div>
      <button className="dash-save-btn" onClick={save}>{saved ? '✅ Saved!' : 'Save Preferences'}</button>
    </div>
  );
}

export default function Dashboard() {
  const { user, getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('history');
  const headers = getAuthHeader();

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  if (!user) return null;

  const tabs = [
    { id: 'history', label: '📍 Route History' },
    { id: 'saved', label: '⭐ Saved Routes' },
    { id: 'contacts', label: '📞 Emergency Contacts' },
    { id: 'prefs', label: '⚙️ Preferences' },
  ];

  return (
    <div className="dashboard">
      <div className="dash-header">
        <div>
          <h1>Welcome back, {user.name.split(' ')[0]} 👋</h1>
          <p className="dash-subtitle">Manage your safety preferences and travel history</p>
        </div>
        <button className="dash-plan-btn" onClick={() => navigate('/app')}>🛡️ Plan Safe Route</button>
      </div>

      <div className="dash-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`dash-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="dash-content">
        {activeTab === 'history' && <Section title="Recent Routes"><RouteHistory headers={headers} /></Section>}
        {activeTab === 'saved' && <Section title="Saved Routes"><SavedRoutes headers={headers} /></Section>}
        {activeTab === 'contacts' && <Section title="Emergency Contacts"><EmergencyContacts headers={headers} /></Section>}
        {activeTab === 'prefs' && <Section title="Safety Preferences"><SafetyPreferences headers={headers} /></Section>}
      </div>
    </div>
  );
}
