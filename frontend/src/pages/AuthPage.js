import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

const API = 'http://localhost:5001';

export default function AuthPage({ defaultTab = 'login' }) {
  const [tab, setTab]     = useState(defaultTab);
  const [form, setForm]   = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading]   = useState(false);
  const [gLoading, setGLoading] = useState(false);

  // OTP step state — set after successful credential check
  const [otpStep, setOtpStep]   = useState(false);   // show OTP screen?
  const [otpEmail, setOtpEmail] = useState('');
  const [pendingToken, setPendingToken] = useState(null); // token from backend
  const [pendingUser, setPendingUser]   = useState(null); // user from backend
  const [otpCode, setOtpCode]   = useState('');
  const [otpSent, setOtpSent]   = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    setTab(location.pathname === '/register' ? 'register' : 'login');
    setError('');
    setOtpStep(false);
    setOtpCode('');
    setOtpTimer(0);
  }, [location.pathname]);

  useEffect(() => {
    if (otpTimer <= 0) return;
    const t = setTimeout(() => setOtpTimer(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [otpTimer]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Send OTP to email (called after credential success)
  const sendOtp = async (email) => {
    try {
      await axios.post(`${API}/api/auth/otp/send`, { email });
      setOtpSent(true);
      setOtpTimer(60);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP.');
    }
  };

  // Step 1a: password login/register
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload  = tab === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };
      const res = await axios.post(`${API}${endpoint}`, payload);
      // Credentials OK — go to OTP step
      setPendingToken(res.data.token);
      setPendingUser(res.data.user);
      setOtpEmail(form.email);
      setOtpStep(true);
      await sendOtp(form.email);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.');
    }
    setLoading(false);
  };

  // Step 1b: Google sign-in
  const handleGoogleSuccess = async (credentialResponse) => {
    setGLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API}/api/auth/google`, { credential: credentialResponse.credential });
      setPendingToken(res.data.token);
      setPendingUser(res.data.user);
      setOtpEmail(res.data.user.email);
      setOtpStep(true);
      await sendOtp(res.data.user.email);
    } catch (err) {
      setError(err.response?.data?.error || 'Google sign-in failed.');
    }
    setGLoading(false);
  };

  // Step 2: verify OTP → actually log in
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otpCode.length !== 6) return setError('Enter the 6-digit OTP.');
    setError('');
    setOtpLoading(true);
    try {
      await axios.post(`${API}/api/auth/otp/verify`, { email: otpEmail, otp: otpCode });
      login(pendingToken, pendingUser);
      navigate('/app');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP. Try again.');
    }
    setOtpLoading(false);
  };

  // ── OTP verification screen ────────────────────────────────
  if (otpStep) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand"><span>🛡️</span><span>GuardianRoute AI</span></div>

          <div className="otp-info">
            🔐 Two-step verification<br />
            <small>A 6-digit code was sent to <strong>{otpEmail}</strong></small>
          </div>

          <form className="auth-form" onSubmit={handleVerifyOtp}>
            <div className="auth-field">
              <label>Enter OTP</label>
              <input
                type="text" inputMode="numeric" maxLength={6}
                placeholder="• • • • • •" className="otp-input"
                value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                autoFocus required
              />
            </div>

            {error && <div className="auth-error">⚠️ {error}</div>}

            <button type="submit" className="auth-submit" disabled={otpLoading || otpCode.length !== 6}>
              {otpLoading ? '⏳ Verifying…' : '✅ Verify & Continue'}
            </button>

            <button type="button" className="otp-resend-btn"
              onClick={() => { setOtpCode(''); setError(''); sendOtp(otpEmail); }}
              disabled={otpTimer > 0 || otpLoading}>
              {otpTimer > 0 ? `Resend in ${otpTimer}s` : '🔄 Resend OTP'}
            </button>

            <button type="button" className="otp-resend-btn"
              onClick={() => { setOtpStep(false); setOtpCode(''); setError(''); }}>
              ← Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Login / Register screen ────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand"><span>🛡️</span><span>GuardianRoute AI</span></div>

        <div className="auth-tabs">
          <button className={tab === 'login'    ? 'auth-tab active' : 'auth-tab'} onClick={() => navigate('/login')}>Login</button>
          <button className={tab === 'register' ? 'auth-tab active' : 'auth-tab'} onClick={() => navigate('/register')}>Register</button>
        </div>

        {gLoading ? (
          <button className="google-btn" disabled type="button">⏳ Signing in…</button>
        ) : (
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Google sign-in was cancelled or failed.')}
            width="100%"
            text="continue_with"
            shape="rectangular"
            theme="filled_black"
          />
        )}

        <div className="auth-divider"><span>or</span></div>

        <form onSubmit={handleSubmit} className="auth-form">
          {tab === 'register' && (
            <div className="auth-field">
              <label>Full Name</label>
              <input type="text" placeholder="Your name" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
          )}
          <div className="auth-field">
            <label>Email</label>
            <input type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} required />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input type="password" placeholder={tab === 'register' ? 'At least 6 characters' : 'Your password'} value={form.password} onChange={e => set('password', e.target.value)} required />
          </div>

          {error && <div className="auth-error">⚠️ {error}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '⏳ Please wait…' : tab === 'login' ? '🔐 Login' : '🛡️ Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          {tab === 'login' && <p>Don't have an account? <button onClick={() => navigate('/register')}>Register</button></p>}
          {tab === 'register' && <p>Already have an account? <button onClick={() => navigate('/login')}>Login</button></p>}
          <Link to="/" className="auth-back">← Back to Home</Link>
        </div>

        <div className="auth-benefits">
          <div className="benefit-title">What you get with an account:</div>
          {['📍 Route history & analytics', '⭐ Save favorite safe routes', '📞 Emergency contacts', '⚙️ Safety preferences'].map(b => (
            <div key={b} className="benefit-item">{b}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
