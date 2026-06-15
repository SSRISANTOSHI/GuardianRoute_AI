import React from 'react';
import { Link } from 'react-router-dom';
import './StaticPage.css';

export default function MissionPage() {
  return (
    <div className="static-page">
      <div className="static-hero mission-hero">
        <div className="static-hero-badge">Mission & Vision</div>
        <h1>Safer Journeys.<br /><span>Empowered Women.</span></h1>
        <p>
          We believe every woman deserves to travel without fear.
          GuardianRoute AI is our commitment to making that a reality.
        </p>
      </div>

      <div className="mission-pillars">
        <div className="pillar mission">
          <div className="pillar-icon">🎯</div>
          <h2>Our Mission</h2>
          <p>
            To empower women commuters across India by providing AI-powered,
            safety-first route intelligence that makes every journey — day or night —
            a confident decision rather than a fearful guess.
          </p>
          <ul>
            <li>Improve women's commuting confidence</li>
            <li>Reduce exposure to isolated travel corridors</li>
            <li>Provide explainable, data-backed safety recommendations</li>
            <li>Support safer late-night commuting</li>
          </ul>
        </div>

        <div className="pillar vision">
          <div className="pillar-icon">🔭</div>
          <h2>Our Vision</h2>
          <p>
            A future where every mobility platform in India — whether cab booking,
            metro planning, or bus navigation — has a Safety Intelligence Layer
            that prioritizes women's safety above all else.
          </p>
          <ul>
            <li>Integrate into OneJourney as SafeRoute™ feature</li>
            <li>Scale to every city in India</li>
            <li>Power smart-city safety dashboards</li>
            <li>Partner with government safety initiatives</li>
          </ul>
        </div>
      </div>

      <div className="static-section">
        <h2>Government Alignment</h2>
        <div className="static-grid two-col">
          {[
            ['🏗️', 'Mission Shakti', "Aligned with GoI's Mission Shakti — safety, security & empowerment of women."],
            ['📞', 'ERSS 112', 'Integrated with Emergency Response Support System for fastest emergency dispatch.'],
            ['🏥', 'One Stop Centres', "Routes factored against OSC proximity — women's crisis support locations."],
            ['📻', 'Women Helpline 181', 'Free, 24x7 pan-India helpline prominently featured in our AI assistant.'],
            ['🚂', 'Railway Safety', 'Safety of female passengers aligned with Indian Railways PIB guidelines.'],
            ['🚨', 'NERS', 'Nationwide Emergency Response System integration for nearest responder dispatch.'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="static-card compact">
              <div className="static-card-icon">{icon}</div>
              <div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="static-section roadmap">
        <h2>Roadmap</h2>
        <div className="timeline">
          {[
            ['Phase 1 — MVP', 'Route safety scoring, AI assistant, safe zone finder, heatmap'],
            ['Phase 2 — Smart City', 'CCTV analytics integration, smart streetlight data, crowd prediction'],
            ['Phase 3 — Platform', 'OneJourney SafeRoute™ integration across cab, metro, bus modes'],
            ['Phase 4 — National', 'Pan-India deployment, government safety dashboard, public API'],
          ].map(([phase, desc], i) => (
            <div key={i} className="timeline-item">
              <div className="timeline-dot" />
              <div>
                <div className="timeline-phase">{phase}</div>
                <div className="timeline-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="static-cta">
        <h2>Join the Movement</h2>
        <p>Help us make India's streets safer — one route at a time.</p>
        <Link to="/register" className="hero-btn-primary">🛡️ Get Started Free</Link>
      </div>
    </div>
  );
}
