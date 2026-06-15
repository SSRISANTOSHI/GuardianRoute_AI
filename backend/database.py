import os
import mysql.connector
from mysql.connector import Error

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "guardianroute"),
    "connection_timeout": 5,
}

_conn = None


def get_conn():
    global _conn
    try:
        if _conn and _conn.is_connected():
            return _conn
        _conn = None
        _conn = mysql.connector.connect(**DB_CONFIG)
        return _conn
    except Error:
        _conn = None
        return None


def init_db():
    conn = get_conn()
    if not conn:
        return False
    try:
        cur = conn.cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS route_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                source VARCHAR(255),
                destination VARCHAR(255),
                safety_score INT,
                classification VARCHAR(50),
                distance_km FLOAT,
                duration_min INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS saved_routes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(100),
                source VARCHAR(255),
                destination VARCHAR(255),
                safety_score INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS emergency_contacts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                contact_name VARCHAR(100) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                relation VARCHAR(50),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS safety_preferences (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                avoid_night_travel TINYINT(1) DEFAULT 0,
                prefer_lit_roads TINYINT(1) DEFAULT 1,
                min_safety_score INT DEFAULT 60,
                alert_on_low_score TINYINT(1) DEFAULT 1,
                share_location TINYINT(1) DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS route_queries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT NULL,
                source VARCHAR(255),
                destination VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS route_results (
                id INT AUTO_INCREMENT PRIMARY KEY,
                query_id INT,
                label VARCHAR(10),
                distance_km FLOAT,
                duration_min INT,
                safety_score INT,
                classification VARCHAR(50),
                recommended TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (query_id) REFERENCES route_queries(id)
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS heatmap_zones (
                id INT AUTO_INCREMENT PRIMARY KEY,
                latitude FLOAT NOT NULL,
                longitude FLOAT NOT NULL,
                safety_score INT NOT NULL,
                zone_type ENUM('SAFE','MODERATE','RISK') NOT NULL,
                label VARCHAR(100)
            )
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS chat_queries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT NULL,
                user_message TEXT,
                ai_reply TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.commit()

        # Seed heatmap if empty
        cur.execute("SELECT COUNT(*) FROM heatmap_zones")
        if cur.fetchone()[0] == 0:
            seed = [
                (13.0827, 80.2707, 85, "SAFE", "Chennai Central"),
                (12.9790, 80.1730, 78, "SAFE", "Tambaram"),
                (12.8230, 80.0440, 70, "MODERATE", "SRM Kattankulathur"),
                (13.0524, 80.2453, 35, "RISK", "Low Safety Zone"),
                (13.0600, 80.2500, 65, "MODERATE", "Moderate Zone"),
                (13.0451, 80.2345, 90, "SAFE", "Safe Zone A"),
                (13.0392, 80.2211, 35, "RISK", "Risk Zone B"),
                (13.0554, 80.2278, 65, "MODERATE", "Moderate Zone C"),
            ]
            cur.executemany(
                "INSERT INTO heatmap_zones (latitude, longitude, safety_score, zone_type, label) VALUES (%s,%s,%s,%s,%s)",
                seed,
            )
            conn.commit()
        return True
    except Error as e:
        print(f"[DB] init_db error: {e}")
        return False


# ── User auth ────────────────────────────────────────────────────────────────

def create_user(name, email, password_hash):
    conn = get_conn()
    if not conn:
        return None
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO users (name, email, password_hash) VALUES (%s,%s,%s)", (name, email, password_hash))
        conn.commit()
        return cur.lastrowid
    except Error:
        return None


def get_user_by_email(email):
    conn = get_conn()
    if not conn:
        return None
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM users WHERE email=%s", (email,))
        return cur.fetchone()
    except Error:
        return None


def get_user_by_id(user_id):
    conn = get_conn()
    if not conn:
        return None
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id, name, email, created_at FROM users WHERE id=%s", (user_id,))
        return cur.fetchone()
    except Error:
        return None


# ── Route history ─────────────────────────────────────────────────────────────

def add_route_history(user_id, source, destination, safety_score, classification, distance_km, duration_min):
    conn = get_conn()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO route_history (user_id, source, destination, safety_score, classification, distance_km, duration_min) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (user_id, source, destination, safety_score, classification, distance_km, duration_min),
        )
        conn.commit()
    except Error:
        pass


def get_route_history(user_id):
    conn = get_conn()
    if not conn:
        return []
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT * FROM route_history WHERE user_id=%s ORDER BY created_at DESC LIMIT 20",
            (user_id,),
        )
        return cur.fetchall()
    except Error:
        return []


# ── Saved routes ──────────────────────────────────────────────────────────────

def save_route(user_id, name, source, destination, safety_score):
    conn = get_conn()
    if not conn:
        return None
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO saved_routes (user_id, name, source, destination, safety_score) VALUES (%s,%s,%s,%s,%s)",
            (user_id, name, source, destination, safety_score),
        )
        conn.commit()
        return cur.lastrowid
    except Error:
        return None


def get_saved_routes(user_id):
    conn = get_conn()
    if not conn:
        return []
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM saved_routes WHERE user_id=%s ORDER BY created_at DESC", (user_id,))
        return cur.fetchall()
    except Error:
        return []


def delete_saved_route(route_id, user_id):
    conn = get_conn()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM saved_routes WHERE id=%s AND user_id=%s", (route_id, user_id))
        conn.commit()
    except Error:
        pass


# ── Emergency contacts ────────────────────────────────────────────────────────

def get_emergency_contacts(user_id):
    conn = get_conn()
    if not conn:
        return []
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM emergency_contacts WHERE user_id=%s", (user_id,))
        return cur.fetchall()
    except Error:
        return []


def add_emergency_contact(user_id, name, phone, relation):
    conn = get_conn()
    if not conn:
        return None
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO emergency_contacts (user_id, contact_name, phone, relation) VALUES (%s,%s,%s,%s)",
            (user_id, name, phone, relation),
        )
        conn.commit()
        return cur.lastrowid
    except Error:
        return None


def delete_emergency_contact(contact_id, user_id):
    conn = get_conn()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM emergency_contacts WHERE id=%s AND user_id=%s", (contact_id, user_id))
        conn.commit()
    except Error:
        pass


# ── Safety preferences ────────────────────────────────────────────────────────

def get_preferences(user_id):
    conn = get_conn()
    if not conn:
        return {}
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM safety_preferences WHERE user_id=%s", (user_id,))
        row = cur.fetchone()
        if not row:
            cur.execute("INSERT INTO safety_preferences (user_id) VALUES (%s)", (user_id,))
            conn.commit()
            cur.execute("SELECT * FROM safety_preferences WHERE user_id=%s", (user_id,))
            row = cur.fetchone()
        return row or {}
    except Error:
        return {}


def update_preferences(user_id, prefs: dict):
    conn = get_conn()
    if not conn:
        return
    allowed = {"avoid_night_travel", "prefer_lit_roads", "min_safety_score", "alert_on_low_score", "share_location"}
    fields = {k: v for k, v in prefs.items() if k in allowed}
    if not fields:
        return
    try:
        cur = conn.cursor()
        sets = ", ".join(f"{k}=%s" for k in fields)
        cur.execute(
            f"INSERT INTO safety_preferences (user_id, {', '.join(fields)}) VALUES (%s, {', '.join(['%s']*len(fields))}) ON DUPLICATE KEY UPDATE {sets}",
            [user_id] + list(fields.values()) + list(fields.values()),
        )
        conn.commit()
    except Error:
        pass


# ── Generic logging ───────────────────────────────────────────────────────────

def log_query(source, destination, user_id=None):
    conn = get_conn()
    if not conn:
        return None
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO route_queries (user_id, source, destination) VALUES (%s,%s,%s)", (user_id, source, destination))
        conn.commit()
        return cur.lastrowid
    except Error:
        return None


def log_routes(query_id, routes):
    conn = get_conn()
    if not conn or not query_id:
        return
    try:
        cur = conn.cursor()
        for r in routes:
            cur.execute(
                "INSERT INTO route_results (query_id, label, distance_km, duration_min, safety_score, classification, recommended) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (query_id, r["label"], r["distance_km"], r["duration_min"], r["safety_score"], r["classification"]["label"], 1 if r.get("recommended") else 0),
            )
        conn.commit()
    except Error:
        pass


def log_chat(user_message, ai_reply, user_id=None):
    conn = get_conn()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO chat_queries (user_id, user_message, ai_reply) VALUES (%s,%s,%s)", (user_id, user_message, ai_reply))
        conn.commit()
    except Error:
        pass


def get_heatmap_zones():
    conn = get_conn()
    if not conn:
        return []
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT latitude AS lat, longitude AS lon, safety_score AS score, label FROM heatmap_zones")
        return cur.fetchall()
    except Error:
        return []
