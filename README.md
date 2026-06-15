
# GuardianRoute AI

> "Not Just the Fastest Route. The Safest Route."

AI-Powered Safety-Aware Journey Planner for Women Commuters.

---

## Quick Start

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in your API keys in .env
pip install -r requirements.txt
python app.py
```

Backend runs at `http://localhost:5000`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs at `http://localhost:3000`

---

## API Keys Required

| Key | Where to Get |
|-----|-------------|
| `ORS_API_KEY` | [openrouteservice.org](https://openrouteservice.org) — Free tier available |
| `OPENWEATHER_API_KEY` | [openweathermap.org](https://openweathermap.org/api) — Free tier available |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com) — Free tier available |

---

## Features

- 🛡️ **AI Safety Score Engine** — Scores routes 0–100 using emergency access, time risk, weather, transport, zone safety
- 🗺️ **Interactive Safety Map** — Color-coded routes + heatmap overlay (Leaflet + OpenStreetMap)
- 📊 **Route Comparison Dashboard** — Side-by-side safety metrics for all route options
- 🤖 **AI Safety Assistant** — Gemini-powered chat explaining route recommendations
- 🆘 **SafeZone Finder** — Nearby hospitals, police stations, railway stations via OSM Overpass API

## Safety Score Formula

```
Safety Score =
  30% × Emergency Access Score  (OSM: hospitals, police, stations)
+ 25% × Time Risk Score         (hour-based risk logic)
+ 20% × Weather Score           (OpenWeather API)
+ 15% × Transport Score         (OSM: bus stops, metro)
+ 10% × Zone Safety Score       (synthetic + OSM zones)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, React Leaflet, Axios |
| Backend | Flask, Python |
| Maps | OpenStreetMap, OpenRouteService |
| AI | Gemini 1.5 Flash |
| Weather | OpenWeather API |
| Safe Zones | OSM Overpass API |
=======
# GuardianRoute_AI

Reimagining Urban Mobility & Daily Commute in India 2026

Problem Statements / Tracks: Women Safety & Secure Commute: Create innovative solutions to make daily commuting safer and more secure for women.
