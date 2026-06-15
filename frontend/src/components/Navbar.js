import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const PUBLIC_LINKS = [
  { to: '/',        label: 'Home' },
  { to: '/about',   label: 'About' },
  { to: '/mission', label: 'Mission & Vision' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const isLanding = location.pathname === '/';

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  const navLinks = user
    ? [...PUBLIC_LINKS, { to: '/app', label: 'Route Planner' }]
    : PUBLIC_LINKS;

  return (
    <nav className={`navbar ${isLanding ? 'navbar-transparent' : 'navbar-solid'}`}>
      <Link to="/" className="nav-brand" onClick={() => setMenuOpen(false)}>
        <span className="nav-brand-icon">🛡️</span>
        <span className="nav-brand-text">GuardianRoute <span className="nav-brand-ai">AI</span></span>
      </Link>

      <button className="nav-hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="menu">
        {menuOpen ? '✕' : '☰'}
      </button>

      <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
        {navLinks.map(l => (
          <Link
            key={l.to}
            to={l.to}
            className={`nav-link ${location.pathname === l.to ? 'active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            {l.label}
          </Link>
        ))}

        <div className="nav-right">
          {user ? (
            <>
              <Link to="/dashboard" className="nav-link nav-user-link" onClick={() => setMenuOpen(false)}>
                <span className="nav-avatar">{user.name[0].toUpperCase()}</span>
                {user.name.split(' ')[0]}
              </Link>
              <button className="nav-logout-btn" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login"    className="nav-link" onClick={() => setMenuOpen(false)}>Login</Link>
              <Link to="/register" className="nav-cta"  onClick={() => setMenuOpen(false)}>Sign Up Free</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
