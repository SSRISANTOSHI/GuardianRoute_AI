import math
import requests
from datetime import datetime

ORS_API_KEY = None  # set via env if available
OPENWEATHER_API_KEY = None


def get_time_risk_score(hour: int) -> float:
    """Higher score = safer. Daytime is safer."""
    if 6 <= hour < 20:
        return 80.0
    elif 20 <= hour < 22:
        return 55.0
    elif 22 <= hour or hour < 4:
        return 25.0
    else:
        return 45.0


def get_weather_score(lat: float, lon: float, api_key: str) -> float:
    if not api_key:
        return 70.0
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}"
        r = requests.get(url, timeout=5)
        data = r.json()
        weather_id = data["weather"][0]["id"]
        if weather_id >= 800:
            return 90.0
        elif 700 <= weather_id < 800:
            return 60.0
        elif 500 <= weather_id < 700:
            return 40.0
        elif 200 <= weather_id < 500:
            return 20.0
        return 65.0
    except Exception:
        return 70.0


def haversine(lat1, lon1, lat2, lon2) -> float:
    """Distance in km between two coordinates."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


OVERPASS_URL = "https://maps.mail.ru/osm/tools/overpass/api/interpreter"


def overpass_count(query: str) -> int:
    """Run an Overpass count query, works with node/way/relation."""
    try:
        r = requests.post(OVERPASS_URL, data={"data": query}, timeout=12)
        total = r.json().get("elements", [{}])[0].get("tags", {}).get("total", 0)
        return int(total) if total else 0
    except Exception:
        return 0


def get_emergency_score(lat: float, lon: float) -> float:
    """Query Overpass for hospitals/police/railway — nodes, ways, and relations."""
    query = f"""
    [out:json][timeout:12];
    (
      node["amenity"~"hospital|police|fire_station"](around:2000,{lat},{lon});
      way["amenity"~"hospital|police|fire_station"](around:2000,{lat},{lon});
      relation["amenity"~"hospital|police"](around:2000,{lat},{lon});
      node["railway"~"station|halt"](around:2000,{lat},{lon});
      way["railway"~"station|halt"](around:2000,{lat},{lon});
    );
    out count;
    """
    count = overpass_count(query)
    return min(100.0, 40.0 + count * 12.0)


def get_transport_score(lat: float, lon: float) -> float:
    """Query Overpass for bus stops, metro, auto stands — nodes and ways."""
    query = f"""
    [out:json][timeout:12];
    (
      node["highway"="bus_stop"](around:1000,{lat},{lon});
      node["amenity"="bus_station"](around:1000,{lat},{lon});
      way["amenity"="bus_station"](around:1000,{lat},{lon});
      node["railway"~"station|halt|tram_stop|subway_entrance"](around:1000,{lat},{lon});
      way["railway"~"station|halt"](around:1000,{lat},{lon});
      node["amenity"="taxi"](around:500,{lat},{lon});
    );
    out count;
    """
    count = overpass_count(query)
    return min(100.0, 30.0 + count * 8.0)


def get_zone_score(lat: float, lon: float) -> float:
    """Synthetic zone safety based on pre-seeded known zones."""
    ZONES = [
        (13.0827, 80.2707, 85),  # Chennai Central
        (12.9790, 80.1730, 78),  # Tambaram
        (12.8230, 80.0440, 70),  # SRM Kattankulathur
        (13.0524, 80.2453, 40),  # Low-safety sample zone
        (13.0600, 80.2500, 65),  # Moderate zone
    ]
    best = 50.0
    for zlat, zlon, zscore in ZONES:
        d = haversine(lat, lon, zlat, zlon)
        if d < 3.0:
            influence = zscore * (1 - d / 3.0)
            if influence > best:
                best = influence
    return best


def sample_coords(coords: list, n: int = 3) -> list:
    """Sample n evenly-spaced [lon, lat] points along route."""
    if len(coords) <= n:
        return coords
    step = len(coords) // n
    return [coords[i * step] for i in range(n)]


def avg(scores: list) -> float:
    return sum(scores) / len(scores) if scores else 50.0


def reverse_geocode(lat: float, lon: float) -> str:
    """Nominatim reverse geocode — returns display name string."""
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {"lat": lat, "lon": lon, "format": "json"}
        headers = {"User-Agent": "GuardianRouteAI/1.0"}
        r = requests.get(url, params=params, headers=headers, timeout=5)
        return r.json().get("display_name", "")
    except Exception:
        return ""


def compute_safety_score(coords: list, weather_api_key: str = None) -> dict:
    """
    coords: list of [lon, lat] pairs from ORS route geometry.
    Samples multiple points along the route for more accurate scoring.
    """
    if not coords:
        return {"total": 50, "breakdown": {}}

    # Sample start, middle, end of route for representative scoring
    sample_points = sample_coords(coords, n=3)

    hour = datetime.now().hour
    time_score = get_time_risk_score(hour)

    emergency_scores, transport_scores, zone_scores, weather_scores = [], [], [], []
    for pt in sample_points:
        lat, lon = pt[1], pt[0]
        emergency_scores.append(get_emergency_score(lat, lon))
        transport_scores.append(get_transport_score(lat, lon))
        zone_scores.append(get_zone_score(lat, lon))

    # Weather from route midpoint
    mid = sample_points[len(sample_points) // 2]
    weather_score = get_weather_score(mid[1], mid[0], weather_api_key or OPENWEATHER_API_KEY)

    emergency_score = avg(emergency_scores)
    transport_score = avg(transport_scores)
    zone_score = avg(zone_scores)

    total = (
        0.30 * emergency_score
        + 0.25 * time_score
        + 0.20 * weather_score
        + 0.15 * transport_score
        + 0.10 * zone_score
    )

    # Reverse geocode midpoint for display
    mid_coord = sample_points[len(sample_points) // 2]
    area_name = reverse_geocode(mid_coord[1], mid_coord[0])

    return {
        "total": round(total),
        "area_name": area_name,
        "breakdown": {
            "emergency_access": round(emergency_score),
            "time_risk": round(time_score),
            "weather": round(weather_score),
            "transport": round(transport_score),
            "zone_safety": round(zone_score),
        },
    }


def classify(score: int) -> dict:
    if score >= 80:
        return {"label": "Highly Safe", "color": "green"}
    elif score >= 60:
        return {"label": "Moderately Safe", "color": "yellow"}
    else:
        return {"label": "Use Caution", "color": "red"}
