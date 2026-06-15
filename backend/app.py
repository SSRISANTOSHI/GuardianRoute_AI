import os
import hashlib
import jwt
import random
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
from functools import wraps
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
from safety_engine import compute_safety_score, classify
from rag_loader import RAG_CONTEXT
from database import (
    init_db, log_query, log_routes, log_chat, get_heatmap_zones,
    create_user, get_user_by_email, get_user_by_id,
    add_route_history, get_route_history,
    save_route, get_saved_routes, delete_saved_route,
    get_emergency_contacts, add_emergency_contact, delete_emergency_contact,
    get_preferences, update_preferences,
)

load_dotenv()

app = Flask(__name__)
CORS(app, supports_credentials=True)

ORS_API_KEY = os.getenv("ORS_API_KEY", "")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
JWT_SECRET = os.getenv("JWT_SECRET", "guardianroute-secret-key-change-in-prod")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
MAIL_SERVER   = os.getenv("MAIL_SERVER", "smtp.gmail.com")
MAIL_PORT     = int(os.getenv("MAIL_PORT", 587))
MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
MAIL_SENDER   = os.getenv("MAIL_DEFAULT_SENDER", MAIL_USERNAME)

# In-memory OTP store: { email: { otp, expires } }
_otp_store: dict = {}

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel("gemini-2.0-flash-lite")
else:
    gemini_model = None

init_db()

NOMINATIM_HEADERS = {"User-Agent": "GuardianRouteAI/1.0"}


# ── Auth helpers ──────────────────────────────────────────────────────────────

def hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def make_token(user_id: int, name: str = "", email: str = "") -> str:
    payload = {
        "user_id": user_id,
        "name": name,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"error": "Token required"}), 401
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user_id = data["user_id"]
            # Auto-create user in DB if missing (e.g. DB was recreated)
            if not get_user_by_id(user_id):
                name  = data.get("name", "User")
                email = data.get("email", "")
                if email:
                    existing = get_user_by_email(email)
                    if existing:
                        user_id = existing["id"]
                    else:
                        import secrets
                        new_id = create_user(name, email, secrets.token_hex(32))
                        if new_id:
                            user_id = new_id
            request.user_id = user_id
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated


def optional_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        request.user_id = None
        if token:
            try:
                data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
                request.user_id = data["user_id"]
            except Exception:
                pass
        return f(*args, **kwargs)
    return decorated


# ── Geocoding helpers ─────────────────────────────────────────────────────────

def geocode(place: str):
    params = {"q": place, "format": "json", "limit": 1}
    r = requests.get("https://nominatim.openstreetmap.org/search", params=params, headers=NOMINATIM_HEADERS, timeout=10)
    results = r.json()
    if not results:
        return None, None
    return float(results[0]["lat"]), float(results[0]["lon"])


def get_osrm_routes(src_lat, src_lon, dst_lat, dst_lon):
    url = f"http://router.project-osrm.org/route/v1/driving/{src_lon},{src_lat};{dst_lon},{dst_lat}"
    params = {"overview": "full", "geometries": "geojson", "alternatives": "true"}
    r = requests.get(url, params=params, timeout=15)
    r.raise_for_status()
    data = r.json()
    if data.get("code") != "Ok":
        raise Exception(data.get("message", "OSRM error"))
    features = []
    for route in data["routes"]:
        leg = route["legs"][0]
        features.append({
            "geometry": route["geometry"],
            "properties": {"summary": {"distance": leg["distance"], "duration": leg["duration"]}},
        })
    return features


# ── Auth endpoints ────────────────────────────────────────────────────────────

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400
    if get_user_by_email(email):
        return jsonify({"error": "Email already registered."}), 409
    user_id = create_user(name, email, hash_pw(password))
    if not user_id:
        return jsonify({"error": "Registration failed. Database unavailable."}), 500
    return jsonify({"token": make_token(user_id, name, email), "user": {"id": user_id, "name": name, "email": email}}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    user = get_user_by_email(email)
    if not user or user["password_hash"] != hash_pw(password):
        return jsonify({"error": "Invalid email or password."}), 401
    u = {"id": user["id"], "name": user["name"], "email": user["email"]}
    return jsonify({"token": make_token(user["id"], user["name"], user["email"]), "user": u})


@app.route("/api/auth/google", methods=["POST"])
def google_auth():
    credential = request.json.get("credential", "")
    if not credential:
        return jsonify({"error": "Missing credential"}), 400
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as g_requests
        info = id_token.verify_oauth2_token(credential, g_requests.Request(), GOOGLE_CLIENT_ID)
        email = info.get("email", "").lower()
        name  = info.get("name") or email.split("@")[0]
        if not email:
            return jsonify({"error": "Could not get email from Google"}), 400
        user = get_user_by_email(email)
        if user:
            user_id = user["id"]
        else:
            import secrets
            user_id = create_user(name, email, secrets.token_hex(32))
        return jsonify({"token": make_token(user_id, name, email), "user": {"id": user_id, "name": name, "email": email}})
    except Exception as e:
        return jsonify({"error": f"Google auth failed: {str(e)}"}), 500


@app.route("/api/auth/otp/send", methods=["POST"])
def otp_send():
    email = request.json.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "Email is required."}), 400
    otp = str(random.randint(100000, 999999))
    _otp_store[email] = {
        "otp": otp,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    try:
        msg = MIMEText(
            f"Your GuardianRoute AI login OTP is:\n\n"
            f"  {otp}\n\n"
            f"This code expires in 10 minutes. Do not share it with anyone."
        )
        msg["Subject"] = f"{otp} is your GuardianRoute AI OTP"
        msg["From"]    = MAIL_SENDER
        msg["To"]      = email
        with smtplib.SMTP(MAIL_SERVER, MAIL_PORT) as s:
            s.starttls()
            s.login(MAIL_USERNAME, MAIL_PASSWORD)
            s.sendmail(MAIL_SENDER, [email], msg.as_string())
        return jsonify({"message": "OTP sent."})
    except Exception as e:
        return jsonify({"error": f"Failed to send OTP: {str(e)}"}), 500


@app.route("/api/auth/otp/verify", methods=["POST"])
def otp_verify():
    email = request.json.get("email", "").strip().lower()
    otp   = request.json.get("otp", "").strip()
    name  = request.json.get("name", "").strip()
    entry = _otp_store.get(email)
    if not entry:
        return jsonify({"error": "No OTP found. Please request a new one."}), 400
    if datetime.now(timezone.utc) > entry["expires"]:
        _otp_store.pop(email, None)
        return jsonify({"error": "OTP expired. Please request a new one."}), 400
    if entry["otp"] != otp:
        return jsonify({"error": "Incorrect OTP. Please try again."}), 401
    _otp_store.pop(email, None)
    user = get_user_by_email(email)
    if user:
        user_id = user["id"]
        uname   = user["name"]
    else:
        import secrets
        uname   = name or email.split("@")[0]
        user_id = create_user(uname, email, secrets.token_hex(32))
    return jsonify({"token": make_token(user_id, uname, email), "user": {"id": user_id, "name": uname, "email": email}})


@app.route("/api/auth/me", methods=["GET"])
@token_required
def me():
    user = get_user_by_id(request.user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    # Serialize datetime
    if user.get("created_at"):
        user["created_at"] = str(user["created_at"])
    return jsonify({"user": user})


# ── User data endpoints ───────────────────────────────────────────────────────

@app.route("/api/user/history", methods=["GET"])
@token_required
def history():
    rows = get_route_history(request.user_id)
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])
    return jsonify({"history": rows})


@app.route("/api/user/saved-routes", methods=["GET"])
@token_required
def get_saved():
    rows = get_saved_routes(request.user_id)
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = str(r["created_at"])
    return jsonify({"saved": rows})


@app.route("/api/user/saved-routes", methods=["POST"])
@token_required
def post_saved():
    data = request.json
    rid = save_route(
        request.user_id,
        data.get("name", "My Route"),
        data.get("source", ""),
        data.get("destination", ""),
        data.get("safety_score", 0),
    )
    return jsonify({"id": rid, "message": "Route saved."})


@app.route("/api/user/saved-routes/<int:rid>", methods=["DELETE"])
@token_required
def del_saved(rid):
    delete_saved_route(rid, request.user_id)
    return jsonify({"message": "Deleted."})


@app.route("/api/user/emergency-contacts", methods=["GET"])
@token_required
def get_contacts():
    return jsonify({"contacts": get_emergency_contacts(request.user_id)})


@app.route("/api/user/emergency-contacts", methods=["POST"])
@token_required
def add_contact():
    data = request.json
    cid = add_emergency_contact(
        request.user_id,
        data.get("name", ""),
        data.get("phone", ""),
        data.get("relation", ""),
    )
    return jsonify({"id": cid, "message": "Contact added."})


@app.route("/api/user/emergency-contacts/<int:cid>", methods=["DELETE"])
@token_required
def del_contact(cid):
    delete_emergency_contact(cid, request.user_id)
    return jsonify({"message": "Deleted."})


@app.route("/api/user/preferences", methods=["GET"])
@token_required
def get_prefs():
    prefs = get_preferences(request.user_id)
    if prefs.get("id"):
        del prefs["id"]
    if prefs.get("user_id"):
        del prefs["user_id"]
    return jsonify({"preferences": prefs})


@app.route("/api/user/preferences", methods=["PUT"])
@token_required
def put_prefs():
    update_preferences(request.user_id, request.json)
    return jsonify({"message": "Preferences updated."})


# ── Route planning ────────────────────────────────────────────────────────────

@app.route("/api/routes", methods=["POST"])
@optional_auth
def get_routes():
    data = request.json
    src = data.get("source", "")
    dst = data.get("destination", "")

    if data.get("src_lat") and data.get("src_lon"):
        src_lat, src_lon = float(data["src_lat"]), float(data["src_lon"])
    else:
        src_lat, src_lon = geocode(src)

    dst_lat, dst_lon = geocode(dst)

    if not src_lat or not dst_lat:
        return jsonify({"error": "Could not geocode one or both locations."}), 400

    try:
        features = get_osrm_routes(src_lat, src_lon, dst_lat, dst_lon)
    except Exception as e:
        return jsonify({"error": f"Route fetch failed: {str(e)}"}), 500

    routes = []
    for i, feat in enumerate(features):
        props = feat["properties"]["summary"]
        coords = feat["geometry"]["coordinates"]
        safety = compute_safety_score(coords, OPENWEATHER_API_KEY)
        score = safety["total"]
        routes.append({
            "id": i,
            "label": f"Route {chr(65 + i)}",
            "distance_km": round(props["distance"] / 1000, 1),
            "duration_min": round(props["duration"] / 60),
            "safety_score": score,
            "classification": classify(score),
            "breakdown": safety["breakdown"],
            "area_name": safety.get("area_name", ""),
            "coordinates": coords,
        })

    routes.sort(key=lambda r: r["safety_score"], reverse=True)
    routes[0]["recommended"] = True

    query_id = log_query(src or f"{src_lat},{src_lon}", dst, request.user_id)
    log_routes(query_id, routes)

    # Save best route to history if logged in
    if request.user_id:
        best = routes[0]
        add_route_history(
            request.user_id, src, dst,
            best["safety_score"], best["classification"]["label"],
            best["distance_km"], best["duration_min"],
        )

    return jsonify({
        "routes": routes,
        "source": {"lat": src_lat, "lon": src_lon},
        "destination": {"lat": dst_lat, "lon": dst_lon},
    })


# ── SafeZones ─────────────────────────────────────────────────────────────────

@app.route("/api/safezones", methods=["GET"])
def get_safezones():
    lat = float(request.args.get("lat", 13.0451))
    lon = float(request.args.get("lon", 80.2345))
    radius = int(request.args.get("radius", 3000))
    query = f"""
    [out:json][timeout:15];
    (
      node["amenity"~"hospital|police|fire_station"](around:{radius},{lat},{lon});
      way["amenity"~"hospital|police|fire_station"](around:{radius},{lat},{lon});
      node["railway"~"station|halt"](around:{radius},{lat},{lon});
      way["railway"~"station|halt"](around:{radius},{lat},{lon});
      node["amenity"="pharmacy"](around:{radius},{lat},{lon});
    );
    out body center;
    """
    try:
        r = requests.post("https://maps.mail.ru/osm/tools/overpass/api/interpreter", data={"data": query}, timeout=15)
        elements = r.json().get("elements", [])
        zones = []
        for el in elements[:25]:
            tags = el.get("tags", {})
            name = tags.get("name", tags.get("amenity", tags.get("railway", "Safe Zone")))
            zone_type = tags.get("amenity") or tags.get("railway") or "facility"
            el_lat = el.get("lat") or el.get("center", {}).get("lat")
            el_lon = el.get("lon") or el.get("center", {}).get("lon")
            if el_lat and el_lon:
                zones.append({"name": name, "type": zone_type, "lat": el_lat, "lon": el_lon})
        return jsonify({"zones": zones})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── AI Chat ───────────────────────────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
@optional_auth
def chat():
    if not gemini_model:
        return jsonify({"reply": "AI Assistant unavailable. Please set GEMINI_API_KEY."}), 200
    data = request.json
    user_msg = data.get("message", "")
    route_context = data.get("route_context", "")
    prompt = f"""
{RAG_CONTEXT}

Current Route Info:
{route_context}

User Question: {user_msg}

You are GuardianRoute AI safety assistant for women commuters in India. Answer concisely using the knowledge above.
Reference specific helplines, safe zones, or government schemes when relevant.
"""
    try:
        response = gemini_model.generate_content(prompt)
        reply = response.text
        log_chat(user_msg, reply, request.user_id)
        return jsonify({"reply": reply})
    except Exception as e:
        err = str(e)
        if "429" in err or "quota" in err.lower():
            return jsonify({"reply": "⚠️ AI Assistant is temporarily unavailable (rate limit reached). Please try again in a moment."}), 200
        return jsonify({"reply": f"Error: {err}"}), 500


# ── Heatmap ───────────────────────────────────────────────────────────────────

@app.route("/api/heatmap", methods=["GET"])
def heatmap():
    zones = get_heatmap_zones()
    if not zones:
        zones = [
            {"lat": 13.0827, "lon": 80.2707, "score": 85, "label": "Chennai Central"},
            {"lat": 12.9790, "lon": 80.1730, "score": 78, "label": "Tambaram"},
            {"lat": 12.8230, "lon": 80.0440, "score": 70, "label": "SRM Kattankulathur"},
            {"lat": 13.0524, "lon": 80.2453, "score": 35, "label": "Low Safety Zone"},
            {"lat": 13.0600, "lon": 80.2500, "score": 65, "label": "Moderate Zone"},
        ]
    return jsonify({"zones": zones})


# ── Nominatim helpers ─────────────────────────────────────────────────────────

@app.route("/api/autocomplete", methods=["GET"])
def api_autocomplete():
    q = request.args.get("q", "")
    if len(q) < 3:
        return jsonify({"suggestions": []})
    params = {"q": q, "format": "json", "limit": 5, "addressdetails": 0}
    r = requests.get("https://nominatim.openstreetmap.org/search", params=params, headers=NOMINATIM_HEADERS, timeout=8)
    suggestions = [{"label": res["display_name"], "lat": res["lat"], "lon": res["lon"]} for res in r.json()]
    return jsonify({"suggestions": suggestions})


@app.route("/api/reverse-geocode", methods=["GET"])
def api_reverse_geocode():
    lat, lon = request.args.get("lat"), request.args.get("lon")
    if not lat or not lon:
        return jsonify({"error": "Missing lat/lon"}), 400
    params = {"lat": lat, "lon": lon, "format": "json"}
    r = requests.get("https://nominatim.openstreetmap.org/reverse", params=params, headers=NOMINATIM_HEADERS, timeout=5)
    data = r.json()
    return jsonify({"display_name": data.get("display_name", ""), "address": data.get("address", {})})


if __name__ == "__main__":
    app.run(debug=True, port=5001)
