import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:5001';

const QUICK_PROMPTS = [
  "Why is this route safer?",
  "Find nearest safe zone",
  "I feel unsafe",
  "Safety tips for night travel",
];

export default function AIAssistant({ selectedRoute }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm GuardianRoute AI 🛡️. Ask me about route safety, safe zones, or travel tips." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (msg) => {
    const text = msg || input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    const routeContext = selectedRoute
      ? `Route: ${selectedRoute.label}, Safety Score: ${selectedRoute.safety_score}/100, Status: ${selectedRoute.classification.label}, Distance: ${selectedRoute.distance_km}km, Duration: ${selectedRoute.duration_min}min, Breakdown: ${JSON.stringify(selectedRoute.breakdown)}`
      : 'No route selected yet.';

    try {
      const res = await axios.post(`${API}/api/chat`, { message: text, route_context: routeContext });
      setMessages((prev) => [...prev, { role: 'assistant', text: res.data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: '⚠️ Could not reach AI. Check backend connection.' }]);
    }
    setLoading(false);
  };

  return (
    <div className="ai-assistant">
      <div className="ai-header">
        <span>🤖 AI Safety Assistant</span>
        <span className="powered-by">Powered by Gemini</span>
      </div>
      <div className="quick-prompts">
        {QUICK_PROMPTS.map((p) => (
          <button key={p} className="quick-btn" onClick={() => send(p)}>{p}</button>
        ))}
      </div>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}`}>
            {m.role === 'assistant' && <span className="chat-avatar">🛡️</span>}
            <span className="chat-text">{m.text}</span>
          </div>
        ))}
        {loading && (
          <div className="chat-bubble assistant">
            <span className="chat-avatar">🛡️</span>
            <span className="chat-text typing">Thinking...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input
          type="text"
          placeholder="Ask about route safety..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button onClick={() => send()} disabled={loading}>Send</button>
      </div>
    </div>
  );
}
