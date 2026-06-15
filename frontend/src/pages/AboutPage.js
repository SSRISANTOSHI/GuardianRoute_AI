import React from 'react';
import { Link } from 'react-router-dom';
import './StaticPage.css';

export default function AboutPage() {
  return (
    <div className="static-page">
      <div className="static-hero">
        <div className="static-hero-badge">About GuardianRoute AI</div>
        <h1>Redefining Urban Mobility<br /><span>Through Safety Intelligence</span></h1>
        <p>
          GuardianRoute AI is an AI-powered journey planner that puts women's safety first.
          Built for India's women commuters, it transforms every navigation decision into a
          safety-aware choice.
        </p>
      </div>

      <div className="static-grid">
        <div className="static-card">
          <div className="static-card-icon">🎯</div>
          <h3>The Problem</h3>
          <p>
            Every existing navigation app optimizes for speed, distance, and cost.
            None of them ask: <em>"Is this route safe for a woman traveling at 10 PM?"</em>
            Women are left to make dangerous guesses.
          </p>
        </div>
        <div className="static-card">
          <div className="static-card-icon">💡</div>
          <h3>Our Solution</h3>
          <p>
            We introduce <strong>Safety as a Routing Parameter</strong>.
            Every route gets scored 0–100 using emergency access, weather, transport
            availability, and time-based risk — powered by real-time OSM and government data.
          </p>
        </div>
        <div className="static-card">
          <div className="static-card-icon">🤖</div>
          <h3>AI at the Core</h3>
          <p>
            Gemini 1.5 Flash powers our Safety Assistant. It explains recommendations
            using actual government sources — NCW guidelines, ERSS, Mission Shakti,
            Women Helpline schemes — not generic advice.
          </p>
        </div>
        <div className="static-card">
          <div className="static-card-icon">🗺️</div>
          <h3>Open Data Driven</h3>
          <p>
            Built entirely on open APIs — OpenStreetMap, OpenRouteService, Overpass API,
            Nominatim, and OpenWeather. No proprietary data. Fully transparent. Scalable.
          </p>
        </div>
      </div>

      <div className="static-section">
        <h2>Safety Score Formula</h2>
        <div className="score-formula">
          {[
            ['30%', '🚨', 'Emergency Access', 'Distance to hospitals, police, railway stations'],
            ['25%', '🕐', 'Time Risk', 'Hour-based risk — day/evening/night/late-night'],
            ['20%', '🌤️', 'Weather Score', 'Rain, fog, storm impact via OpenWeather'],
            ['15%', '🚌', 'Transport Score', 'Bus stops, metro, auto stands via OSM'],
            ['10%', '📍', 'Zone Safety', 'Known safe/risk zone scoring'],
          ].map(([pct, icon, label, desc]) => (
            <div key={label} className="formula-row">
              <div className="formula-pct">{pct}</div>
              <div className="formula-icon">{icon}</div>
              <div>
                <div className="formula-label">{label}</div>
                <div className="formula-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="static-cta">
        <h2>Ready to Travel Safer?</h2>
        <Link to="/app" className="hero-btn-primary">🛡️ Start Planning</Link>
      </div>
    </div>
  );
}
