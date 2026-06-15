import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const FEATURES = [
  { icon: '🛡️', title: 'AI Safety Score',   desc: 'Every route scored 0–100 across 5 parameters in real time.' },
  { icon: '🗺️', title: 'Safe Route Map',    desc: 'Color-coded routes with heatmap overlays on live OSM maps.' },
  { icon: '🤖', title: 'Gemini Assistant',  desc: 'Ask anything about your route — powered by Gemini 1.5 Flash.' },
  { icon: '🆘', title: 'SafeZone Finder',   desc: 'Nearest hospitals, police stations & transport hubs instantly.' },
  { icon: '🌤️', title: 'Weather Risk',      desc: 'Real-time weather factored into every safety calculation.' },
  { icon: '🕐', title: 'Time-based Risk',   desc: 'Night vs day risk scoring so you travel confidently, always.' },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <div className="landing-bg" />
      <div className="landing-overlay" />

      {/* ── Hero ── */}
      <div className="landing-hero-3d">
        <div className="hero-tag">
          <span className="hero-tag-dot" />
          AI-Powered Women Safety Platform
        </div>

        <h1 className="hero-title">
          Not Just the<br />Fastest Route.<br />
          <span className="hero-highlight">The Safest Route.</span>
        </h1>

        <p className="hero-subtitle">
          GuardianRoute AI scores every route 0–100 using emergency access,
          weather, transport availability, and time-based risk — so you always
          travel with confidence.
        </p>

        <div className="hero-actions">
          <Link to="/register" className="hero-btn-primary">🚀 Get Started Free</Link>
          <Link to="/login"    className="hero-btn-outline">Login →</Link>
        </div>

        {/* Stat cards */}
        <div className="stats-3d-row">
          <div className="stat-card-3d">
            <div className="stat-card-glow green" />
            <div className="stat-num">0–100</div>
            <div className="stat-lbl">Safety Score</div>
          </div>
          <div className="stat-card-3d">
            <div className="stat-card-glow purple" />
            <div className="stat-num">5+</div>
            <div className="stat-lbl">AI Parameters</div>
          </div>
          <div className="stat-card-3d">
            <div className="stat-card-glow blue" />
            <div className="stat-num">24/7</div>
            <div className="stat-lbl">AI Assistant</div>
          </div>
          <div className="stat-card-3d">
            <div className="stat-card-glow red" />
            <div className="stat-num">181</div>
            <div className="stat-lbl">Helpline</div>
          </div>
        </div>

        {/* Feature pills */}
        <div className="hero-pills">
          <span className="pill green">🚨 Emergency Access</span>
          <span className="pill blue">🌤️ Weather Risk</span>
          <span className="pill purple">🚌 Transport Score</span>
          <span className="pill orange">🕐 Time Risk</span>
          <span className="pill teal">🤖 Gemini AI</span>
        </div>
      </div>

      {/* ── Feature cards — right side ── */}
      <div className="landing-features">
        <div className="features-heading">Everything you need to travel safe</div>
        <div className="features-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="features-cta">
          <Link to="/register" className="hero-btn-primary" style={{ display: 'inline-block', textAlign: 'center' }}>
            Create Free Account
          </Link>
          <p className="features-note">🔒 Login required to access the route planner &amp; all features</p>
        </div>
      </div>

      {/* Corner badge */}
      <div className="corner-badge">
        <span className="corner-badge-dot" />
        Live Safety Intelligence — India
      </div>
    </div>
  );
}
