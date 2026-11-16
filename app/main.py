"""Sonara - self-hosted player.

Sources: YouTube (search / links), Spotify links (resolved to YouTube audio),
and files uploaded from the user's device. Extras: folders, lyrics (LRCLIB),
server-side settings."""
import base64
import contextvars
import hashlib
import hmac
import json
import mimetypes
import os
import queue
import re
import secrets
import shutil
import sqlite3
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import deque
from contextlib import contextmanager
from http.cookies import SimpleCookie
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.responses import (FileResponse, HTMLResponse, JSONResponse,
                               RedirectResponse, Response, StreamingResponse)
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
from yt_dlp import YoutubeDL

DATA = Path(os.environ.get("DATA_DIR", "/data"))
MUSIC = DATA / "music"
COVERS = DATA / "covers"
MUSIC.mkdir(parents=True, exist_ok=True)
COVERS.mkdir(parents=True, exist_ok=True)
DB = DATA / "library.db"
WORKERS = int(os.environ.get("DOWNLOAD_WORKERS", "2"))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")
FORMATS = ("m4a", "mp3", "opus")
AUDIO_EXT = {".mp3", ".m4a", ".aac", ".flac", ".wav", ".ogg", ".opus",
             ".webm", ".mp4", ".wma", ".aiff", ".aif", ".mkv", ".mov", ".m4v"}
mimetypes.add_type("audio/mp4", ".m4a")
mimetypes.add_type("audio/ogg", ".opus")
mimetypes.add_type("audio/flac", ".flac")

SPOTIFY_RE = re.compile(
    r"open\.spotify\.com/(?:intl-[\w-]+/)?(track|album|playlist)/([A-Za-z0-9]+)")
YOUTUBE_HOSTS = ("youtube.com", "youtu.be", "youtube-nocookie.com")
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
TRACK_COLS = ("id,title,artist,duration,source,video_id,status,error,"
              "lyrics_state,kind,gain")

app = FastAPI(title="Sonara")
jobs: "queue.Queue[tuple[str, object]]" = queue.Queue()
events: deque = deque(maxlen=30)
_event_id = 0
_event_lock = threading.Lock()


# ---------------------------------------------------------------- database
@contextmanager
def db():
    con = sqlite3.connect(DB, timeout=30)
    con.row_factory = sqlite3.Row
    con.create_function("cur_profile", 0, profile_id)
    try:
        yield con
        con.commit()
    finally:
        con.close()


def init_db():
    with db() as con:
        con.execute("PRAGMA journal_mode=WAL")
        con.executescript("""
        CREATE TABLE IF NOT EXISTS tracks(
            id INTEGER PRIMARY KEY,
            ext_id TEXT UNIQUE,
            title TEXT, artist TEXT, duration INTEGER DEFAULT 0,
            source TEXT, video_id TEXT,
            status TEXT DEFAULT 'queued', error TEXT,
            added_at REAL);
        CREATE TABLE IF NOT EXISTS playlists(
            id INTEGER PRIMARY KEY, name TEXT, url TEXT UNIQUE, source TEXT);
        CREATE TABLE IF NOT EXISTS playlist_tracks(
            playlist_id INTEGER, track_id INTEGER, position INTEGER,
            PRIMARY KEY(playlist_id, track_id));
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, created REAL);
        CREATE TABLE IF NOT EXISTS imported(
            path TEXT PRIMARY KEY, size INTEGER, mtime REAL);
        CREATE TABLE IF NOT EXISTS artists(
            name TEXT PRIMARY KEY, data TEXT, fetched REAL);
        CREATE TABLE IF NOT EXISTS profiles(id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE IF NOT EXISTS library(
            profile_id INTEGER, track_id INTEGER,
            PRIMARY KEY(profile_id, track_id));
        CREATE TRIGGER IF NOT EXISTS own_new_track AFTER INSERT ON tracks BEGIN
            INSERT OR IGNORE INTO library VALUES(cur_profile(), NEW.id);
        END;
        CREATE TABLE IF NOT EXISTS profile_keys(
            token TEXT PRIMARY KEY, profile_id INTEGER);
        CREATE TABLE IF NOT EXISTS activity(
            id INTEGER PRIMARY KEY, at REAL, profile_id INTEGER, action TEXT,
            text TEXT);
        CREATE TABLE IF NOT EXISTS trash(
            id INTEGER PRIMARY KEY, at REAL, profile_id INTEGER, kind TEXT,
            name TEXT, data TEXT);
        CREATE TABLE IF NOT EXISTS profile_tracks(
            profile_id INTEGER, track_id INTEGER, liked INTEGER DEFAULT 0,
            plays INTEGER DEFAULT 0, last_played REAL,
            PRIMARY KEY(profile_id, track_id));
        """)
        if "position" not in {r["name"] for r in
                              con.execute("PRAGMA table_info(playlists)")}:
            con.execute("ALTER TABLE playlists ADD COLUMN position INTEGER")
        if "profile_id" not in {r["name"] for r in
                                con.execute("PRAGMA table_info(playlists)")}:
            con.execute("ALTER TABLE playlists ADD COLUMN profile_id INTEGER "
                        "DEFAULT 1")
        pcols = {r["name"] for r in con.execute("PRAGMA table_info(profiles)")}
        if "pin" not in pcols:
            con.execute("ALTER TABLE profiles ADD COLUMN pin TEXT")
        if "kid" not in pcols:
            con.execute("ALTER TABLE profiles ADD COLUMN kid INTEGER DEFAULT 0")
        cols = {r["name"] for r in con.execute("PRAGMA table_info(tracks)")}
        for name, ddl in (("file", "TEXT"), ("lyrics", "TEXT"),
                          ("lyrics_state", "TEXT"),
                          ("kind", "TEXT DEFAULT 'audio'"),
                          ("liked", "INTEGER DEFAULT 0"),
                          ("plays", "INTEGER DEFAULT 0"),
                          ("last_played", "REAL"), ("video_file", "TEXT"),
                          ("raw_title", "TEXT"), ("raw_artist", "TEXT"),
                          ("lyrics_offset", "REAL DEFAULT 0"),
                          ("gain", "REAL")):
            if name not in cols:
                con.execute(f"ALTER TABLE tracks ADD COLUMN {name} {ddl}")
        # Each profile has its own library. Songs from before that split all
        # go to the first profile.
        if not con.execute("SELECT 1 FROM settings WHERE key='library_split'"
                           ).fetchone():
            con.execute("INSERT OR IGNORE INTO library SELECT 1,id FROM tracks")
            con.execute("INSERT OR REPLACE INTO settings VALUES"
                        "('library_split','1')")
        # Likes and play counts belong to a profile. The first profile takes
        # over what was counted before profiles existed.
        if not con.execute("SELECT 1 FROM profiles").fetchone():
            con.execute("INSERT INTO profiles(id,name) VALUES(1,'Me')")
            con.execute(
                "INSERT OR IGNORE INTO profile_tracks SELECT 1,id,liked,"
                "COALESCE(plays,0),last_played FROM tracks WHERE liked=1 "
                "OR COALESCE(plays,0)>0")
        con.execute("UPDATE tracks SET file=video_id||'.m4a' WHERE file IS NULL "
                    "AND status='ready' AND video_id IS NOT NULL")
        # Older versions kept a separate "ytv:" row for the video copy of a
        # song. Fold it into the audio row so each song appears once.
        for r in con.execute("SELECT * FROM tracks WHERE ext_id LIKE 'ytv:%'"
                             ).fetchall():
            twin = con.execute("SELECT id FROM tracks WHERE ext_id=?",
                               ("yt:" + r["video_id"],)).fetchone()
            if twin:
                con.execute("UPDATE tracks SET kind='video',video_file=?,"
                            "status=CASE WHEN ? IS NULL THEN 'queued' ELSE "
                            "status END WHERE id=?",
                            (r["file"], r["file"], twin["id"]))
                con.execute("UPDATE OR IGNORE playlist_tracks SET track_id=? "
                            "WHERE track_id=?", (twin["id"], r["id"]))
                con.execute("DELETE FROM playlist_tracks WHERE track_id=?",
                            (r["id"],))
                con.execute("DELETE FROM tracks WHERE id=?", (r["id"],))
            else:
                con.execute("UPDATE tracks SET ext_id=?,video_file=file "
                            "WHERE id=?", ("yt:" + r["video_id"], r["id"]))


def get_setting(key: str, default: str = "") -> str:
    with db() as con:
        row = con.execute("SELECT value FROM settings WHERE key=?",
                          (key,)).fetchone()
    return row["value"] if row and row["value"] is not None else default


def set_setting(key: str, value: str):
    with db() as con:
        con.execute("INSERT OR REPLACE INTO settings VALUES(?,?)", (key, value))


def spotify_creds():
    return (get_setting("spotify_client_id") or
            os.environ.get("SPOTIFY_CLIENT_ID", "").strip(),
            get_setting("spotify_client_secret") or
            os.environ.get("SPOTIFY_CLIENT_SECRET", "").strip())


def notify(msg: str, level: str = "info"):
    global _event_id
    with _event_lock:
        _event_id += 1
        events.append({"id": _event_id, "msg": msg, "level": level})


def clean_err(e: Exception) -> str:
    return ANSI_RE.sub("", str(e)).replace("ERROR: ", "")[:300]


# -------------------------------------------------------------------- auth
# Optional single password. When one is set, every /api and /media request
# needs the session cookie handed out by /api/login.
_auth = {"hash": "", "sessions": set(), "fails": deque(maxlen=50)}
COOKIE = "hm_session"
OPEN_PATHS = {"/api/login", "/api/auth"}


def hash_pw(pw: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000)
    return f"{salt}${digest.hex()}"


def check_pw(pw: str, stored: str) -> bool:
    return hmac.compare_digest(hash_pw(pw, stored.split("$")[0]), stored)


def load_auth():
    stored = get_setting("password_hash")
    env_pw = os.environ.get("APP_PASSWORD", "")
    if not stored and env_pw and get_setting("password_removed") != "1":
        stored = hash_pw(env_pw)
        set_setting("password_hash", stored)
    _auth["hash"] = stored
    with db() as con:
        _auth["sessions"] = {r["token"] for r in
                             con.execute("SELECT token FROM sessions")}


def new_session() -> str:
    token = secrets.token_urlsafe(32)
    with db() as con:
        con.execute("INSERT INTO sessions VALUES(?,?)", (token, time.time()))
    _auth["sessions"].add(token)
    return token


def clear_sessions():
    with db() as con:
        con.execute("DELETE FROM sessions")
    _auth["sessions"] = set()


def scope_token(scope) -> str:
    for k, v in scope.get("headers") or []:
        if k == b"cookie":
            c = SimpleCookie()
            try:
                c.load(v.decode("latin-1"))
            except Exception:
                return ""
            return c[COOKIE].value if COOKIE in c else ""
    return ""


def is_authed(scope) -> bool:
    return not _auth["hash"] or scope_token(scope) in _auth["sessions"]


def set_cookie(resp, token: str):
    resp.set_cookie(COOKIE, token, max_age=60 * 60 * 24 * 60, httponly=True,
                    samesite="lax")


# Which profile a request is for (likes, history and folders are per
# profile). The page sends it with every request; without it, the first.
_profile: contextvars.ContextVar = contextvars.ContextVar("profile", default=1)
_profile_key: contextvars.ContextVar = contextvars.ContextVar("pkey", default="")
_profile_info: dict = {1: {"pin": None, "kid": False}}
_profile_keys: dict = {}   # key given after a correct PIN -> profile id


def header_profile(scope):
    """(profile id, whether the page named one, its PIN key)"""
    pid, sent, key = 1, False, ""
    for k, v in scope.get("headers") or []:
        if k == b"x-profile":
            try:
                pid, sent = int(v), True
            except ValueError:
                pass
        elif k == b"x-profile-key":
            key = v.decode("latin-1")
    if pid not in _profile_info:
        pid = 1
    return pid, sent, key


def profile_id() -> int:
    p = _profile.get()
    return p if p in _profile_info else 1


def load_profiles():
    with db() as con:
        info = {r["id"]: {"pin": r["pin"], "kid": bool(r["kid"])}
                for r in con.execute("SELECT id,pin,kid FROM profiles")}
        keys = {r["token"]: r["profile_id"] for r in con.execute(
            "SELECT token,profile_id FROM profile_keys")}
    _profile_info.clear()
    _profile_info.update(info or {1: {"pin": None, "kid": False}})
    _profile_keys.clear()
    _profile_keys.update(keys)


# What a listen-only (kids) profile may still change: its own likes, play
# counts and folders.
KID_OK = re.compile(r"^/api/(tracks/\d+/(like|played)|playlists(/.*)?|"
                    r"login|logout|profiles/\d+/unlock)$")


def profile_block(path: str, method: str, pid: int, sent: bool, key: str):
    """(status, message) when the profile may not make this request."""
    info = _profile_info.get(pid)
    if not info or not path.startswith("/api/") or path in OPEN_PATHS:
        return None
    write = method not in ("GET", "HEAD", "OPTIONS")
    if (info["pin"] and _profile_keys.get(key) != pid
            and not path.startswith("/api/profiles") and (write or sent)):
        return 423, "This profile is locked with a PIN"
    if info["kid"] and write and not KID_OK.match(path):
        return 403, ("This profile can only listen. Downloading, deleting "
                     "and changing things is switched off for it.")
    return None


class AuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope["path"]
            pid, sent, key = header_profile(scope)
            _profile.set(pid)
            _profile_key.set(key)
            if (path.startswith(("/api/", "/media/")) and path not in OPEN_PATHS
                    and not is_authed(scope)):
                resp = JSONResponse({"detail": "Login required"}, 401)
                return await resp(scope, receive, send)
            block = profile_block(path, scope["method"], pid, sent, key)
            if block:
                resp = JSONResponse({"detail": block[1]}, block[0])
                return await resp(scope, receive, send)

            async def hardened(message):
                # Browser protections: no guessing of file types, no showing
                # the player inside another site's frame, no leaking its
                # address to the sites that covers and streams come from.
                if message["type"] == "http.response.start":
                    message["headers"] = [
                        *message.get("headers", []),
                        (b"x-content-type-options", b"nosniff"),
                        (b"x-frame-options", b"DENY"),
                        (b"referrer-policy", b"no-referrer")]
                await send(message)
            return await self.inner(scope, receive, hardened)
        await self.inner(scope, receive, send)


app.add_middleware(AuthMiddleware)


class LoginReq(BaseModel):
    password: str


@app.get("/api/auth")
def auth_state(request: Request):
    return {"required": bool(_auth["hash"]), "authed": is_authed(request.scope)}


@app.post("/api/login")
def login(req: LoginReq):
    if not _auth["hash"]:
        return {"ok": True}
    now = time.time()
    if sum(1 for t in _auth["fails"] if now - t < 300) >= 8:
        raise HTTPException(429, "Too many attempts. Try again in a few minutes.")
    if not check_pw(req.password, _auth["hash"]):
        _auth["fails"].append(now)
        time.sleep(1)
        raise HTTPException(401, "Wrong password")
    resp = JSONResponse({"ok": True})
    set_cookie(resp, new_session())
    return resp


@app.post("/api/logout")
def logout(request: Request):
    token = scope_token(request.scope)
    if token:
        with db() as con:
            con.execute("DELETE FROM sessions WHERE token=?", (token,))
        _auth["sessions"].discard(token)
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(COOKIE)
    return resp


@app.put("/api/password")
def set_password(body: dict):
    """Set, change or (with an empty value) remove the password. Everyone
    else is signed out; the caller stays signed in."""
    pw = str(body.get("password") or "")
    if pw and len(pw) < 4:
        raise HTTPException(400, "Password must be at least 4 characters")
    clear_sessions()
    resp = JSONResponse({"ok": True, "password_set": bool(pw)})
    if pw:
        _auth["hash"] = hash_pw(pw)
        set_setting("password_hash", _auth["hash"])
        set_setting("password_removed", "0")
        set_cookie(resp, new_session())
    else:
        _auth["hash"] = ""
        set_setting("password_hash", "")
        set_setting("password_removed", "1")
        resp.delete_cookie(COOKIE)
    return resp


# ------------------------------------------------------------------ yt-dlp
def yt_info(target: str, **extra):
    opts = {"quiet": True, "no_warnings": True, "skip_download": True,
            "extract_flat": True, **extra}
    with YoutubeDL(opts) as y:
        return y.extract_info(target, download=False)


def entry_dict(e: dict) -> dict:
    artist = e.get("channel") or e.get("uploader") or ""
    return {"video_id": e.get("id"), "title": e.get("title") or "Unknown",
            "artist": re.sub(r" - Topic$", "", artist),
            "duration": int(e.get("duration") or 0)}


def match_youtube(artist: str, title: str, duration: int) -> str:
    """Find the YouTube video that best matches a Spotify track."""
    info = yt_info(f"ytsearch5:{artist} - {title}")
    best, best_score = None, None
    for rank, e in enumerate(info.get("entries") or []):
        if not e or not e.get("id"):
            continue
        d = int(e.get("duration") or 0)
        score = rank * 3 + (abs(d - duration) if d and duration else 15)
        if best_score is None or score < best_score:
            best, best_score = e["id"], score
    if not best:
        raise RuntimeError("No YouTube match found")
    return best


def audio_setting() -> str:
    """'best' keeps YouTube's top audio stream untouched (no re-encoding)."""
    fmt = get_setting("format", "best")
    return fmt if fmt in ("best", *FORMATS) else "best"


def video_format() -> str:
    # The video file's sound is what plays, so it gets the best audio too.
    audio = ("bestaudio[ext=m4a]" if audio_setting() in ("m4a", "mp3")
             else "bestaudio")
    return (f"bestvideo[height<=720][vcodec^=avc1]+{audio}/"
            "bestvideo[height<=720]+bestaudio/best[height<=720]/best")


progress: dict = {}   # track id -> {"stage", "pct", "speed", "eta"}
cancelled: set = set()  # track ids whose download should stop


class Cancelled(Exception):
    pass


def hook_for(tid: int, stage: str):
    """A yt-dlp progress hook that records how far a track's download is
    and aborts it once the track has been cancelled."""
    def hook(d):
        if tid in cancelled:
            raise Cancelled()
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            done = d.get("downloaded_bytes") or 0
            progress[tid] = {"stage": stage, "speed": d.get("speed"),
                             "eta": d.get("eta"),
                             "pct": min(100, round(done * 100 / total))
                             if total else None}
        elif d.get("status") == "finished":
            progress[tid] = {"stage": stage, "pct": 100, "speed": None,
                             "eta": 0}
    return hook


def drop_files(vid: str | None):
    """Remove every file of a video that no track uses any more."""
    if not vid:
        return
    with db() as con:
        if con.execute("SELECT 1 FROM tracks WHERE video_id=?",
                       (vid,)).fetchone():
            return
    for p in MUSIC.glob(f"{vid}.*"):
        p.unlink(missing_ok=True)


def download(video_id: str, kind: str = "audio", hook=None) -> str:
    """Download audio (or 720p video); returns the file name inside MUSIC."""
    hooks = {"progress_hooks": [hook]} if hook else {}
    if kind == "video":
        name = f"{video_id}.mp4"
        if not (MUSIC / name).exists():
            opts = {"quiet": True, "no_warnings": True, "noplaylist": True,
                    **hooks,
                    "format": video_format(), "merge_output_format": "mp4",
                    "outtmpl": str(MUSIC / "%(id)s.%(ext)s")}
            with YoutubeDL(opts) as y:
                y.extract_info(f"https://www.youtube.com/watch?v={video_id}",
                               download=True)
            if not (MUSIC / name).exists():
                raise RuntimeError("Download finished but video file is missing")
        return name
    fmt = audio_setting()
    exts = tuple(dict.fromkeys((fmt, "opus", *FORMATS, "ogg")))
    for ext in exts:
        if (MUSIC / f"{video_id}.{ext}").exists():
            return f"{video_id}.{ext}"
    pp = {"key": "FFmpegExtractAudio", "preferredcodec": fmt}
    if fmt == "mp3":
        pp["preferredquality"] = "0"
    opts = {
        "quiet": True, "no_warnings": True, "noplaylist": True, **hooks,
        "format": ("bestaudio[ext=m4a]/bestaudio/best" if fmt == "m4a"
                   else "bestaudio/best"),
        "outtmpl": str(MUSIC / "%(id)s.%(ext)s"),
        "postprocessors": [pp],
    }
    with YoutubeDL(opts) as y:
        y.extract_info(f"https://www.youtube.com/watch?v={video_id}",
                       download=True)
    for ext in exts:  # with 'best' the extension depends on the stream
        if (MUSIC / f"{video_id}.{ext}").exists():
            return f"{video_id}.{ext}"
    raise RuntimeError("Download finished but audio file is missing")


# ----------------------------------------------------------------- spotify
def http(url: str, headers: dict | None = None, data: bytes | None = None):
    req = urllib.request.Request(url, data=data,
                                 headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "replace")


def spotify_api(kind: str, sid: str, cid: str, secret: str):
    auth = base64.b64encode(f"{cid}:{secret}".encode()).decode()
    tok = json.loads(http("https://accounts.spotify.com/api/token",
                          {"Authorization": f"Basic {auth}"},
                          b"grant_type=client_credentials"))["access_token"]
    hdr = {"Authorization": f"Bearer {tok}"}
    api = "https://api.spotify.com/v1"

    def conv(t):
        return {"id": t["id"], "title": t["name"],
                "artist": ", ".join(a["name"] for a in t.get("artists", [])),
                "duration": int(t.get("duration_ms") or 0) // 1000}

    if kind == "track":
        t = json.loads(http(f"{api}/tracks/{sid}", hdr))
        return t["name"], [conv(t)]
    head = json.loads(http(f"{api}/{kind}s/{sid}", hdr))
    tracks, page = [], head["tracks"]
    while page:
        for it in page.get("items", []):
            t = it.get("track") if kind == "playlist" else it
            if t and t.get("id"):
                tracks.append(conv(t))
        page = json.loads(http(page["next"], hdr)) if page.get("next") else None
    return head["name"], tracks


def spotify_embed(kind: str, sid: str):
    """No-credentials fallback: read the public embed page (max ~100 tracks)."""
    html = http(f"https://open.spotify.com/embed/{kind}/{sid}")
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        raise RuntimeError("Could not read Spotify page")
    ent = json.loads(m.group(1))["props"]["pageProps"]["state"]["data"]["entity"]
    name = ent.get("name") or ent.get("title") or "Spotify"
    if kind == "track":
        return name, [{
            "id": sid, "title": name,
            "artist": ", ".join(a["name"] for a in ent.get("artists", [])),
            "duration": int(ent.get("duration") or 0) // 1000}]
    tracks = []
    for t in ent.get("trackList", []):
        tid = (t.get("uri") or "").split(":")[-1] or t.get("uid")
        tracks.append({"id": tid, "title": t.get("title") or "Unknown",
                       "artist": t.get("subtitle") or "",
                       "duration": int(t.get("duration") or 0) // 1000})
    return name, tracks


def spotify_fetch(kind: str, sid: str):
    cid, secret = spotify_creds()
    if cid and secret:
        try:
            return spotify_api(kind, sid, cid, secret)
        except Exception as e:  # fall back to the embed page
            notify(f"Spotify API failed ({clean_err(e)}), using fallback", "warn")
    return spotify_embed(kind, sid)


# ------------------------------------------------------------------ lyrics
def lrclib(path: str, **params):
    url = f"https://lrclib.net/api/{path}?{urllib.parse.urlencode(params)}"
    try:
        return json.loads(http(url, {"User-Agent": "Sonara/1.0"}))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def clean_title(title: str, artist: str, source: str):
    t = re.sub(r"\s*[\(\[][^)\]]*[\)\]]", "", title or "")
    if source != "spotify" and " - " in t:
        artist, t = t.split(" - ", 1)
    t = re.sub(r"\s+(ft\.?|feat\.?)\s.*$", "", t, flags=re.I)
    artist = (artist or "").split(",")[0]
    return t.strip() or (title or ""), artist.strip()


def fetch_lyrics(tid: int):
    """Look up lyrics on LRCLIB and store them. Returns (state, lyrics)."""
    with db() as con:
        row = con.execute("SELECT * FROM tracks WHERE id=?", (tid,)).fetchone()
    if not row:
        raise HTTPException(404)
    state, text = lookup_lyrics(row["title"], row["artist"], row["source"],
                                row["duration"] or 0)
    with db() as con:
        con.execute("UPDATE tracks SET lyrics=?,lyrics_state=? WHERE id=?",
                    (text, state, tid))
    return state, text


def lookup_lyrics(title: str, artist: str, source: str, dur: int):
    title, artist = clean_title(title, artist, source)
    if not artist:  # a bare title (e.g. an untagged upload) matches random songs
        return "none", None
    has = lambda r: r and (r.get("syncedLyrics") or r.get("plainLyrics"))
    hit = None
    if dur and artist:
        hit = lrclib("get", track_name=title, artist_name=artist, duration=dur)
    if not has(hit):
        res = (lrclib("search", track_name=title, artist_name=artist)
               if artist else None) or []
        if not res:
            res = lrclib("search", q=f"{title} {artist}".strip()) or []
        res = [r for r in res if has(r)]
        res.sort(key=lambda r: (
            bool(dur) and abs((r.get("duration") or 0) - dur) > 3,
            not r.get("syncedLyrics"),
            abs((r.get("duration") or 0) - dur) if dur else 0))
        hit = res[0] if res else None
    if has(hit):
        synced = hit.get("syncedLyrics")
        state, text = ("synced", synced) if synced else ("plain",
                                                         hit["plainLyrics"])
    else:
        state, text = "none", None
    return state, text


# ------------------------------------------------- streaming (no download)
_stream_cache: dict = {}
_stream_lock = threading.Lock()
_STREAM_MIME = {"m4a": "audio/mp4", "mp4": "audio/mp4", "webm": "audio/webm",
                "opus": "audio/ogg", "mp3": "audio/mpeg"}


def resolve_stream(video_id: str, kind: str = "audio", fresh: bool = False):
    """Return (url, headers, mime) of a direct stream, cached ~1h.

    Video uses a single file that already contains sound, because the browser
    cannot join YouTube's separate video and audio streams itself."""
    key = (video_id, kind)
    hit = _stream_cache.get(key)
    if hit and not fresh and hit[0] > time.time():
        return hit[1:]
    fmt = ("best[height<=720][ext=mp4][acodec!=none][vcodec!=none]/"
           "best[ext=mp4][acodec!=none][vcodec!=none]/best"
           if kind == "video" else "bestaudio[ext=m4a]/bestaudio/best")
    opts = {"quiet": True, "no_warnings": True, "noplaylist": True,
            "format": fmt}
    with YoutubeDL(opts) as y:
        info = y.extract_info(f"https://www.youtube.com/watch?v={video_id}",
                              download=False)
    if not info.get("url"):
        raise RuntimeError("No streamable audio found")
    if len(_stream_cache) > 200:
        _stream_cache.clear()
    if kind == "video":
        mime = "video/mp4" if info.get("ext") == "mp4" else "video/webm"
    else:
        mime = _STREAM_MIME.get(info.get("ext"), "audio/mpeg")
    _stream_cache[key] = (time.time() + 3600, info["url"],
                          dict(info.get("http_headers") or {}), mime)
    return _stream_cache[key][1:]


# ------------------------------------------------------------- clean names
# YouTube titles carry clutter ("(Official Video)", "#song", "| lyrics").
# Brackets that describe the version (remix, slowed, live...) are kept.
_JUNK = (r"official|lyrics?|lyric|audio|video|visuali[sz]er|m/?v|hd|hq|4k|"
         r"karaoke|clip|videoclip|full song|out now|subtitles?|sub|"
         r"çeviri|sözleri|letra|legendado|explicit|clean|premiere|new")
_KEEP = (r"remix|mix|slowed|reverb|sped|speed|nightcore|live|acoustic|cover|"
         r"extended|edit|version|ver\.?|feat|ft|prod|with|instrumental|"
         r"remaster|bass|8d|hour|loop|mashup|unplugged|demo")
_BRACKET = re.compile(r"\s*[\(\[\{【]([^\(\)\[\]\{\}【】]*)[\)\]\}】]")
_TAIL = re.compile(r"\s*[-–—|:]?\s*\b(official\s+)?(music\s+)?"
                   r"(lyrics?|lyric|audio|video|visuali[sz]er)(\s+video)?\s*$",
                   re.I)
_DASH = re.compile(r"\s+[-–—]\s+")


def _norm(s: str) -> str:
    return re.sub(r"[\W_]+", "", (s or "").lower())


def clean_names(title: str, artist: str):
    """Return a tidier (title, artist) for a YouTube video."""
    raw = title or ""

    def bracket(m):
        inner = m.group(1)
        junk = re.search(rf"\b({_JUNK})\b", inner, re.I)
        keep = re.search(rf"\b({_KEEP})\b", inner, re.I)
        return "" if junk and not keep else m.group(0)

    t = _BRACKET.sub(bracket, raw)
    t = re.split(r"\s+[|｜]\s+|\s+//\s+", t)[0]
    t = re.sub(r"\s*#\w+", "", t)
    for _ in range(3):
        t = _TAIL.sub("", t)
    t = re.sub(r"\s{2,}", " ", t).strip(" -–—|:")
    a = re.sub(r"\s*(- Topic|VEVO|Official)$", "", artist or "", flags=re.I).strip()
    # "Artist - Title": split at the first dash that is not inside brackets
    depth, cut = 0, None
    for m in re.finditer(r"[\(\[\{【]|[\)\]\}】]|\s+[-–—]\s+", t):
        s = m.group(0)
        if s in "([{【":
            depth += 1
        elif s in ")]}】":
            depth = max(0, depth - 1)
        elif depth == 0:
            cut = m
            break
    if cut:
        left, right = t[:cut.start()].strip(), t[cut.end():].strip()
        if left and right:
            # the side that is the channel's own name is the artist
            if _norm(right) and _norm(right) == _norm(a):
                t, a = left, right
            else:
                t, a = right, left
    return (t or raw or "Unknown"), a


# ----------------------------------------------------------------- library
def add_track(ext_id, title, artist, duration, source, video_id=None,
              kind="video") -> int:
    raw_title, raw_artist = title, artist
    if source == "youtube" and get_setting("clean_names", "1") == "1":
        title, artist = clean_names(title, artist)
    with db() as con:
        if video_id:  # same YouTube video already here (e.g. via Spotify)?
            same = con.execute("SELECT ext_id FROM tracks WHERE video_id=? "
                               "ORDER BY id LIMIT 1", (video_id,)).fetchone()
            if same:
                ext_id = same["ext_id"]
        cur = con.execute(
            "INSERT OR IGNORE INTO tracks(ext_id,title,artist,duration,source,"
            "video_id,kind,added_at,raw_title,raw_artist) "
            "VALUES(?,?,?,?,?,?,?,?,?,?)",
            (ext_id, title, artist, duration, source, video_id, kind,
             time.time(), raw_title, raw_artist))
        row = con.execute("SELECT id,status,kind FROM tracks WHERE ext_id=?",
                          (ext_id,)).fetchone()
        con.execute("INSERT OR IGNORE INTO library VALUES(?,?)",
                    (profile_id(), row["id"]))
        enqueue = bool(cur.rowcount)
        if not enqueue and kind == "video" and row["kind"] != "video":
            con.execute("UPDATE tracks SET kind='video',status='queued',"
                        "error=NULL WHERE id=?", (row["id"],))
            enqueue = True
        elif not enqueue and row["status"] == "error":
            con.execute("UPDATE tracks SET status='queued',error=NULL WHERE id=?",
                        (row["id"],))
            enqueue = True
    if enqueue:
        jobs.put(("track", row["id"]))
    return row["id"]


def playlist_append(con, pid: int, tid: int):
    pos = con.execute("SELECT COALESCE(MAX(position),-1)+1 p FROM "
                      "playlist_tracks WHERE playlist_id=?", (pid,)).fetchone()["p"]
    con.execute("INSERT OR IGNORE INTO playlist_tracks VALUES(?,?,?)",
                (pid, tid, pos))


def make_playlist(name: str, url: str, source: str, track_ids: list[int],
                  profile: int = 1):
    if profile != 1:  # each profile gets its own copy of an imported playlist
        url = f"{url}#p{profile}"
    with db() as con:
        con.execute("INSERT OR IGNORE INTO playlists(name,url,source,"
                    "profile_id) VALUES(?,?,?,?)", (name, url, source, profile))
        pid = con.execute("SELECT id FROM playlists WHERE url=?",
                          (url,)).fetchone()["id"]
        for pos, tid in enumerate(track_ids):
            con.execute("INSERT OR REPLACE INTO playlist_tracks VALUES(?,?,?)",
                        (pid, tid, pos))


def yt_ext(video_id: str, kind: str) -> str:
    return "yt:" + video_id


def place(ids, name, url, source, playlist, nofolder, profile=1):
    """Where a multi-song import goes: a chosen folder, none, or its own."""
    if playlist:
        with db() as con:
            if con.execute("SELECT 1 FROM playlists WHERE id=?",
                           (playlist,)).fetchone():
                for tid in ids:
                    playlist_append(con, playlist, tid)
                return
    if not nofolder:
        make_playlist(name, url, source, ids, profile)


def do_import(url: str, kind: str = "video", skip=(), playlist=None,
              nofolder=False, profile=1):
    m = SPOTIFY_RE.search(url)
    if m:
        kind, sid = m.groups()
        name, tracks = spotify_fetch(kind, sid)
        tracks = [t for t in tracks if t["id"] not in set(skip)]
        ids = [add_track(f"sp:{t['id']}", t["title"], t["artist"],
                         t["duration"], "spotify") for t in tracks if t["id"]]
        if kind != "track" or playlist:
            place(ids, name, f"spotify:{kind}:{sid}", "spotify", playlist,
                  nofolder or kind == "track", profile)
        notify(f"Spotify: queued {len(ids)} track(s) from “{name}”")
        return
    single = "watch?v=" in url or "youtu.be/" in url or "/shorts/" in url
    info = yt_info(url, noplaylist=single)
    if info.get("_type") == "playlist":
        ids = []
        for e in info.get("entries") or []:
            if e and e.get("id") and e.get("title") not in ("[Deleted video]",
                                                          "[Private video]"):
                t = entry_dict(e)
                ids.append(add_track(yt_ext(t["video_id"], kind), t["title"],
                                     t["artist"], t["duration"], "youtube",
                                     t["video_id"], kind))
        name = info.get("title") or "YouTube playlist"
        place(ids, name, f"youtube:{info.get('id') or url}", "youtube",
              playlist, nofolder, profile)
        notify(f"YouTube: queued {len(ids)} track(s) from “{name}”")
    else:
        t = entry_dict(info)
        tid = add_track(yt_ext(t["video_id"], kind), t["title"], t["artist"],
                        t["duration"], "youtube", t["video_id"], kind)
        if playlist:
            place([tid], "", "", "youtube", playlist, True)
        notify(f"Queued “{t['title']}”")


def file_duration(name: str) -> int:
    try:
        return probe(MUSIC / name)["duration"]
    except Exception:
        return 0


def audio_codec(path: Path) -> str:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0",
                        "-show_entries", "stream=codec_name", "-of",
                        "csv=p=0", str(path)],
                       capture_output=True, text=True, timeout=60)
    return r.stdout.strip()


def upgrade_scan():
    """Queue a fresh download for every song saved before 'Best' quality."""
    with db() as con:
        rows = con.execute(
            "SELECT id,file,video_file FROM tracks WHERE status='ready' AND "
            "video_id IS NOT NULL AND source!='upload'").fetchall()
    n = 0
    for r in rows:
        name = r["video_file"] or r["file"]
        try:
            if not name or audio_codec(MUSIC / Path(name).name) == "opus":
                continue
        except Exception:
            continue
        jobs.put(("upgrade", r["id"]))
        n += 1
    notify(f"Upgrading {n} song(s) to best quality" if n
           else "Every song is already at the best quality")


def do_upgrade(tid: int):
    """Download a song again at the current quality. The old files are set
    aside first and put back if the new download fails."""
    with db() as con:
        row = con.execute("SELECT * FROM tracks WHERE id=?", (tid,)).fetchone()
        if not row or row["status"] != "ready" or not row["video_id"]:
            return
        olds = [Path(n).name for n in (row["file"], row["video_file"]) if n]
        for n in olds:  # leave files that another track also uses
            if con.execute("SELECT 1 FROM tracks WHERE id!=? AND (file=? OR "
                           "video_file=?)", (tid, n, n)).fetchone():
                return
        con.execute("UPDATE tracks SET status='downloading' WHERE id=?", (tid,))
    vid, bak, moved = row["video_id"], MUSIC / ".old", []
    bak.mkdir(exist_ok=True)
    try:
        for n in olds:
            if (MUSIC / n).exists():
                (MUSIC / n).replace(bak / n)
                moved.append(n)
        fname = download(vid, "audio", hook_for(tid, "audio"))
        vname = (download(vid, "video", hook_for(tid, "video"))
                 if row["video_file"] else None)
        with db() as con:
            con.execute("UPDATE tracks SET file=?,video_file=?,status='ready' "
                        "WHERE id=?", (fname, vname, tid))
        for n in moved:
            (bak / n).unlink(missing_ok=True)
    except Exception as e:
        for p in MUSIC.glob(f"{vid}.*"):
            p.unlink(missing_ok=True)
        if tid in cancelled:  # the song was deleted meanwhile
            cancelled.discard(tid)
            for n in moved:
                (bak / n).unlink(missing_ok=True)
        else:
            for n in moved:
                (bak / n).replace(MUSIC / n)
            with db() as con:
                con.execute("UPDATE tracks SET status='ready' WHERE id=?",
                            (tid,))
            notify(f"Could not upgrade “{row['title']}”: {clean_err(e)}", "warn")
    finally:
        progress.pop(tid, None)


def process_track(tid: int):
    with db() as con:
        row = con.execute("SELECT * FROM tracks WHERE id=?", (tid,)).fetchone()
        if not row:
            cancelled.discard(tid)
            return
        need_video = (row["kind"] == "video" and not row["video_file"]
                      and row["source"] != "upload")
        if row["status"] == "ready" and row["file"] and not need_video:
            return
        con.execute("UPDATE tracks SET status='downloading' WHERE id=?", (tid,))
    vid = row["video_id"]
    try:
        vid = vid or match_youtube(row["artist"], row["title"],
                                   row["duration"])
        fname = row["file"] or download(vid, "audio", hook_for(tid, "audio"))
        vname, kind = row["video_file"], row["kind"]
        if need_video:
            try:
                vname = download(vid, "video", hook_for(tid, "video"))
            except Exception:
                if tid in cancelled:
                    raise
                kind = "audio"  # no video to be had: keep the sound only
        # Use the real length of the file: lyrics are matched against it.
        dur = file_duration(fname) or row["duration"]
        with db() as con:
            con.execute("UPDATE tracks SET video_id=?,file=?,video_file=?,"
                        "kind=?,duration=?,status='ready',error=NULL "
                        "WHERE id=?", (vid, fname, vname, kind, dur, tid))
        if get_setting("auto_lyrics", "1") == "1":
            jobs.put(("lyrics", tid))
    except Exception as e:
        if tid in cancelled:  # deleted while downloading: leave nothing behind
            cancelled.discard(tid)
            drop_files(vid)
        else:
            with db() as con:
                con.execute("UPDATE tracks SET status='error',error=? "
                            "WHERE id=?", (clean_err(e), tid))
    finally:
        progress.pop(tid, None)


def worker():
    while True:
        kind, arg = jobs.get()
        _profile.set(arg[5] if kind == "import" and len(arg) > 5 else
                     arg.get("profile", 1) if kind == "ai" else 1)
        try:
            if kind == "import":
                do_import(*arg)
            elif kind == "upgrade_scan":
                upgrade_scan()
            elif kind == "upgrade":
                do_upgrade(arg)
            elif kind == "ai":
                run_ai(arg)
            elif kind == "lyrics":
                try:
                    fetch_lyrics(arg)
                except Exception:
                    pass  # stays unfetched; the UI can retry on demand
            else:
                process_track(arg)
        except Exception as e:
            notify(f"Import failed: {clean_err(e)}", "error")
        finally:
            jobs.task_done()


@app.on_event("startup")
def startup():
    init_db()
    load_auth()
    load_profiles()
    with db() as con:  # resume anything interrupted by a restart
        con.execute("UPDATE tracks SET status='queued' WHERE status='downloading'")
        pending = [r["id"] for r in con.execute(
            "SELECT id FROM tracks WHERE status='queued' ORDER BY id")]
    for tid in pending:
        jobs.put(("track", tid))
    for _ in range(max(1, WORKERS)):
        threading.Thread(target=worker, daemon=True).start()
    threading.Thread(target=watch_import, daemon=True).start()
    threading.Thread(target=loudness_worker, daemon=True).start()


# ------------------------------------------------------------------ upload
def probe(path: Path):
    r = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json",
                        "-show_format", "-show_streams", str(path)],
                       capture_output=True, text=True, timeout=120)
    info = json.loads(r.stdout or "{}")
    streams = info.get("streams") or []
    if not any(s.get("codec_type") == "audio" for s in streams):
        raise ValueError("not an audio file")
    fmt = info.get("format") or {}
    tags = {k.lower(): v for k, v in (fmt.get("tags") or {}).items()}
    for s in streams:
        for k, v in (s.get("tags") or {}).items():
            tags.setdefault(k.lower(), v)
    def is_picture(s):  # embedded cover art shows up as a "video" stream
        return bool((s.get("disposition") or {}).get("attached_pic")
                    or s.get("codec_name") in ("mjpeg", "png", "bmp", "gif"))

    vids = [s for s in streams if s.get("codec_type") == "video"]
    return {"title": tags.get("title"), "artist": tags.get("artist") or
            tags.get("album_artist") or "",
            "duration": int(float(fmt.get("duration") or 0)),
            "cover": any(is_picture(s) for s in vids),
            "video": any(not is_picture(s) for s in vids)}


def save_upload_meta(path: Path, name: str, playlist: int | None) -> dict:
    try:
        meta = probe(path)
    except Exception:
        path.unlink(missing_ok=True)
        raise HTTPException(400, f"“{name}” is not a playable audio file")
    title = meta["title"] or Path(name).stem
    with db() as con:
        cur = con.execute(
            "INSERT INTO tracks(ext_id,title,artist,duration,source,file,kind,"
            "status,added_at) VALUES(?,?,?,?,?,?,?,'ready',?)",
            (f"up:{path.name}", title, meta["artist"], meta["duration"],
             "upload", path.name, "video" if meta["video"] else "audio",
             time.time()))
        tid = cur.lastrowid
        if playlist and con.execute("SELECT 1 FROM playlists WHERE id=?",
                                    (playlist,)).fetchone():
            playlist_append(con, playlist, tid)
    if meta["cover"] or meta["video"]:  # cover art, or a frame of the video
        seek = ["-ss", "2"] if meta["video"] and meta["duration"] > 4 else []
        subprocess.run(["ffmpeg", "-y", "-v", "error", *seek, "-i", str(path),
                        "-an", "-frames:v", "1", "-vf", "scale=480:-2",
                        str(COVERS / f"{tid}.jpg")],
                       capture_output=True, timeout=120)
    if get_setting("auto_lyrics", "1") == "1":
        jobs.put(("lyrics", tid))
    return {"id": tid, "title": title,
            "kind": "video" if meta["video"] else "audio"}


@app.post("/api/upload")
async def upload(request: Request, name: str, playlist: int | None = None):
    ext = Path(name).suffix.lower()
    if ext not in AUDIO_EXT:
        raise HTTPException(400, f"Unsupported file type: {ext or name}")
    path = MUSIC / f"up_{uuid.uuid4().hex[:12]}{ext}"
    with open(path, "wb") as f:
        async for chunk in request.stream():
            f.write(chunk)
    return await run_in_threadpool(save_upload_meta, path, name, playlist)


# --------------------------------------------------------------------- api
class AddReq(BaseModel):
    video_id: str
    title: str = "Unknown"
    artist: str = ""
    duration: int = 0
    kind: str = "video"
    playlist: int | None = None  # also put the track into this folder


class ImportReq(BaseModel):
    url: str
    kind: str = "video"
    skip: list[str] = []  # Spotify track ids to leave out
    playlist: int | None = None  # put the songs into this existing folder
    nofolder: bool = False       # library only, make no folder


class LikeReq(BaseModel):
    liked: bool


class NameReq(BaseModel):
    name: str


class TrackRef(BaseModel):
    track_id: int


class TrackEdit(BaseModel):
    title: str | None = None
    artist: str | None = None


# ---------------------------------------------------------- watched folder
# Files copied into this folder (a mounted volume) join the library by
# themselves. They are linked or copied, never moved or deleted, and a
# sub-folder's name becomes a folder in the player.
IMPORT_DIR = Path(os.environ.get("IMPORT_DIR", "/import"))
_scan_lock = threading.Lock()


def scan_import() -> int:
    if not IMPORT_DIR.is_dir():
        return 0
    added = 0
    with _scan_lock:
        for p in sorted(IMPORT_DIR.rglob("*")):
            try:
                if (not p.is_file() or p.name.startswith(".")
                        or p.suffix.lower() not in AUDIO_EXT):
                    continue
                st = p.stat()
                if time.time() - st.st_mtime < 15:
                    continue  # probably still being copied
                rel = p.relative_to(IMPORT_DIR)
                with db() as con:
                    seen = con.execute("SELECT size FROM imported WHERE path=?",
                                       (str(rel),)).fetchone()
                if seen and seen["size"] == st.st_size:
                    continue
                dest = MUSIC / f"up_{uuid.uuid4().hex[:12]}{p.suffix.lower()}"
                try:
                    os.link(p, dest)       # no extra disk space when possible
                except OSError:
                    shutil.copy2(p, dest)
                pid = None
                if len(rel.parts) > 1:     # /import/Rock/song.mp3 -> "Rock"
                    with db() as con:
                        row = con.execute(
                            "SELECT id FROM playlists WHERE name=? AND "
                            "source='folder' AND COALESCE(profile_id,1)=1", (rel.parts[0],)).fetchone()
                        pid = row["id"] if row else con.execute(
                            "INSERT INTO playlists(name,url,source) "
                            "VALUES(?,?,?)", (rel.parts[0],
                                              f"folder:{uuid.uuid4().hex}",
                                              "folder")).lastrowid
                try:
                    save_upload_meta(dest, p.name, pid)
                    added += 1
                except HTTPException:
                    pass  # not playable: remembered below so it is not retried
                with db() as con:
                    con.execute("INSERT OR REPLACE INTO imported VALUES(?,?,?)",
                                (str(rel), st.st_size, st.st_mtime))
            except OSError:
                continue
    if added:
        notify(f"Added {added} file(s) from the watched folder")
    return added


def watch_import():
    while True:
        try:
            scan_import()
        except Exception:
            pass
        time.sleep(60)


@app.post("/api/import/scan")
def import_scan():
    if not IMPORT_DIR.is_dir():
        raise HTTPException(400, "No watched folder is set up on the server")
    return {"count": scan_import()}


@app.get("/api/thumb/{video_id}")
def thumb(video_id: str):
    """A YouTube thumbnail served from here, so the page is allowed to read
    its colours (browsers block that for images from other sites)."""
    if not re.fullmatch(r"[\w-]{6,20}", video_id):
        raise HTTPException(400, "Bad video id")
    try:
        req = urllib.request.Request(
            f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
            headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
    except Exception:
        raise HTTPException(404)
    return Response(data, media_type="image/jpeg",
                    headers={"Cache-Control": "max-age=604800"})


# ------------------------------------------------------- search everywhere
def track_cols() -> str:
    return (",".join("t." + c for c in TRACK_COLS.split(","))
            + ",t.video_file IS NOT NULL AS vfile,COALESCE(pt.liked,0) AS "
              "liked,COALESCE(pt.plays,0) AS plays")


def tracks_from() -> str:
    """The tracks table with the current profile's likes and play counts."""
    p = profile_id()
    return (f"tracks t JOIN library lb ON lb.track_id=t.id AND lb.profile_id={p} "
            "LEFT JOIN profile_tracks pt ON pt.track_id=t.id AND "
            f"pt.profile_id={p}")


@app.get("/api/library/search")
def library_search(q: str):
    q = q.strip()
    if not q:
        return []
    like = "%" + q.replace("%", "").replace("_", " ") + "%"
    with db() as con:
        return [dict(r) for r in con.execute(
            f"SELECT {track_cols()} FROM {tracks_from()} WHERE t.title LIKE "
            "? OR t.artist LIKE ? ORDER BY plays DESC, t.id DESC LIMIT 30",
            (like, like))]


_sp_token = {"value": None, "exp": 0.0}


def spotify_token() -> str | None:
    """An app token for Spotify's catalogue, or None without credentials."""
    cid, secret = spotify_creds()
    if not (cid and secret):
        return None
    if _sp_token["exp"] < time.time():
        auth = base64.b64encode(f"{cid}:{secret}".encode()).decode()
        j = json.loads(http("https://accounts.spotify.com/api/token",
                            {"Authorization": f"Basic {auth}"},
                            b"grant_type=client_credentials"))
        _sp_token.update(value=j["access_token"],
                         exp=time.time() + int(j.get("expires_in", 3600)) - 60)
    return _sp_token["value"]


@app.get("/api/spotify/search")
def spotify_search(q: str):
    """Search Spotify's catalogue (needs the API credentials from Settings)."""
    try:
        tok = spotify_token()
    except Exception as e:
        raise HTTPException(502, f"Spotify sign-in failed: {clean_err(e)}")
    if not tok or not q.strip():
        return {"available": bool(tok), "tracks": []}
    try:
        j = json.loads(http(
            "https://api.spotify.com/v1/search?type=track&limit=12&q="
            + urllib.parse.quote(q.strip()), {"Authorization": f"Bearer {tok}"}))
    except Exception as e:
        raise HTTPException(502, f"Spotify search failed: {clean_err(e)}")
    with db() as con:
        have = {r["ext_id"] for r in con.execute(
            "SELECT ext_id FROM tracks WHERE ext_id LIKE 'sp:%' AND id IN "
            "(SELECT track_id FROM library WHERE profile_id=?)",
            (profile_id(),))}
    out = []
    for t in (j.get("tracks") or {}).get("items") or []:
        imgs = (t.get("album") or {}).get("images") or []
        out.append({"id": t["id"], "title": t["name"],
                    "artist": ", ".join(a["name"] for a in t.get("artists", [])),
                    "duration": int(t.get("duration_ms") or 0) // 1000,
                    "cover": (imgs[1] if len(imgs) > 1 else imgs[0])["url"]
                    if imgs else None,
                    "in_library": f"sp:{t['id']}" in have})
    return {"available": True, "tracks": out}


class SpotifyAdd(BaseModel):
    id: str
    title: str
    artist: str = ""
    duration: int = 0
    playlist: int | None = None


@app.post("/api/spotify/add")
def spotify_add(req: SpotifyAdd):
    """Download one Spotify song (its best match on YouTube)."""
    if not re.fullmatch(r"[A-Za-z0-9]{10,40}", req.id):
        raise HTTPException(400, "Bad track id")
    tid = add_track(f"sp:{req.id}", req.title, req.artist, req.duration,
                    "spotify")
    log_act("add", f"Downloaded “{req.title}” (Spotify)")
    if req.playlist:
        with db() as con:
            if con.execute("SELECT 1 FROM playlists WHERE id=?",
                           (req.playlist,)).fetchone():
                playlist_append(con, req.playlist, tid)
    return {"id": tid}


@app.get("/api/spotify/match")
def spotify_match(title: str, artist: str = "", duration: int = 0):
    """The YouTube video to stream for a Spotify song that is not downloaded."""
    try:
        return {"video_id": match_youtube(artist, title, duration)}
    except Exception as e:
        raise HTTPException(502, clean_err(e))


@app.get("/api/search")
def search(q: str):
    q = q.strip()
    if not q:
        return []
    try:
        info = yt_info(f"ytsearch15:{q}")
    except Exception as e:
        raise HTTPException(502, clean_err(e))
    res = [entry_dict(e) for e in info.get("entries") or [] if e and e.get("id")]
    with db() as con:
        have = {r["video_id"] for r in con.execute(
            "SELECT video_id FROM tracks WHERE video_id IS NOT NULL AND id "
            "IN (SELECT track_id FROM library WHERE profile_id=?)",
            (profile_id(),))}
    for r in res:
        r["in_library"] = r["video_id"] in have
    return res


@app.post("/api/add")
def add(req: AddReq):
    if not re.fullmatch(r"[\w-]{6,20}", req.video_id):
        raise HTTPException(400, "Bad video id")
    kind = "video" if req.kind == "video" else "audio"
    tid = add_track(yt_ext(req.video_id, kind), req.title, req.artist,
                    req.duration, "youtube", req.video_id, kind)
    log_act("add", f"Downloaded “{req.title}”")
    if req.playlist:
        with db() as con:
            if con.execute("SELECT 1 FROM playlists WHERE id=?",
                           (req.playlist,)).fetchone():
                playlist_append(con, req.playlist, tid)
    return {"id": tid}


@app.post("/api/import")
def import_url(req: ImportReq):
    url = req.url.strip()
    host = (urllib.parse.urlparse(url).hostname or "").lower()
    ok = SPOTIFY_RE.search(url) or any(
        host == h or host.endswith("." + h) for h in YOUTUBE_HOSTS)
    if not ok:
        raise HTTPException(400, "Only YouTube and Spotify links are supported")
    log_act("add", f"Imported a link: {url[:200]}")
    jobs.put(("import", (url, "video" if req.kind == "video" else "audio",
                         tuple(req.skip), req.playlist, req.nofolder,
                         profile_id())))
    return {"ok": True}


@app.get("/api/spotify/preview")
def spotify_preview(url: str):
    """What a Spotify link contains, so it can be checked before importing."""
    m = SPOTIFY_RE.search(url)
    if not m:
        raise HTTPException(400, "Not a Spotify track, album or playlist link")
    kind, sid = m.groups()
    try:
        name, tracks = spotify_fetch(kind, sid)
    except Exception as e:
        raise HTTPException(502, f"Could not read that Spotify link: "
                                 f"{clean_err(e)}")
    with db() as con:
        have = {r["ext_id"] for r in con.execute(
            "SELECT ext_id FROM tracks WHERE ext_id LIKE 'sp:%' AND id IN "
            "(SELECT track_id FROM library WHERE profile_id=?)",
            (profile_id(),))}
    tracks = [{**t, "in_library": f"sp:{t['id']}" in have}
              for t in tracks if t.get("id")]
    return {"kind": kind, "name": name, "tracks": tracks}


_sp_covers: dict = {}


@app.get("/api/spotify/cover/{sid}")
def spotify_cover(sid: str):
    """Cover art of a Spotify track (looked up once, then remembered)."""
    if not re.fullmatch(r"[A-Za-z0-9]{10,40}", sid):
        raise HTTPException(400, "Bad track id")
    if sid not in _sp_covers:
        try:
            page = urllib.parse.quote(f"https://open.spotify.com/track/{sid}",
                                      safe="")
            _sp_covers[sid] = json.loads(http(
                f"https://open.spotify.com/oembed?url={page}")
            ).get("thumbnail_url") or ""
        except Exception:
            _sp_covers[sid] = ""
        if len(_sp_covers) > 5000:
            _sp_covers.clear()
    if not _sp_covers.get(sid):
        raise HTTPException(404)
    return RedirectResponse(_sp_covers[sid],
                            headers={"Cache-Control": "max-age=86400"})


# ------------------------------------------------------------------- remix
class RemixReq(BaseModel):
    track_id: int
    name: str = ""
    speed: float = 1.0    # 0.5 - 1.5; pitch follows, like a record player
    bass: float = 0.0     # dB of bass boost
    reverb: float = 0.0   # 0 - 1
    pan: bool = False     # "8D": the sound circles from ear to ear


def scale_lrc(text: str, speed: float) -> str:
    """Move synced-lyrics time stamps to match a slower or faster song."""
    def stamp(m):
        t = (int(m.group(1)) * 60 + float(m.group(2))) / speed
        return f"[{int(t // 60):02d}:{t % 60:05.2f}]"
    return re.sub(r"\[(\d+):(\d+(?:\.\d+)?)\]", stamp, text)


@app.post("/api/remix")
def remix(req: RemixReq):
    """Render a changed copy of a song (speed, bass, reverb, 8D) and add it
    to the library as a new track. The original is left alone."""
    with db() as con:
        row = con.execute("SELECT * FROM tracks WHERE id=?",
                          (req.track_id,)).fetchone()
    if not row or row["status"] != "ready" or not row["file"]:
        raise HTTPException(404, "That song is not in the library")
    speed = max(0.5, min(1.5, req.speed))
    bass = max(0.0, min(15.0, req.bass))
    reverb = max(0.0, min(1.0, req.reverb))
    af = ["aresample=48000"]
    if abs(speed - 1) > 0.004:
        af += [f"asetrate={48000 * speed:.0f}", "aresample=48000"]
    if bass:
        af.append(f"bass=g={bass:.1f}:f=110:w=0.7")
    if reverb:
        decays = "|".join(f"{d * reverb:.2f}" for d in (0.5, 0.4, 0.3, 0.2))
        af.append(f"aecho=0.8:0.9:70|140|230|360:{decays}")
    if req.pan:
        af.append("apulsator=hz=0.09:amount=1")
    if len(af) == 1:
        raise HTTPException(400, "Nothing was changed")
    af.append("alimiter=limit=0.95")
    out = MUSIC / f"rx_{uuid.uuid4().hex[:12]}.m4a"
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i",
                        str(MUSIC / Path(row["file"]).name), "-vn", "-af",
                        ",".join(af), "-c:a", "aac", "-b:a", "256k", str(out)],
                       capture_output=True, text=True, timeout=900)
    if r.returncode or not out.exists():
        out.unlink(missing_ok=True)
        raise HTTPException(500, f"Remix failed: {r.stderr.strip()[-200:]}")
    lyrics, state = row["lyrics"], row["lyrics_state"]
    if lyrics and state == "synced" and abs(speed - 1) > 0.004:
        lyrics = scale_lrc(lyrics, speed)
    title = req.name.strip() or f"{row['title']} (Remix)"
    with db() as con:
        cur = con.execute(
            "INSERT INTO tracks(ext_id,title,artist,duration,source,file,kind,"
            "status,added_at,lyrics,lyrics_state,lyrics_offset) "
            "VALUES(?,?,?,?,?,?,'audio','ready',?,?,?,?)",
            (f"rx:{out.stem}", title, row["artist"], file_duration(out.name),
             "remix", out.name, time.time(), lyrics, state,
             (row["lyrics_offset"] or 0) / speed))
        tid = cur.lastrowid
    copy_cover(row, tid)
    return {"id": tid, "title": title}


def copy_cover(row, tid: int):
    """Give a song made from another one (remix, split) that song's cover."""
    try:
        cover = COVERS / f"{tid}.jpg"
        if row["video_id"]:
            req_ = urllib.request.Request(
                f"https://i.ytimg.com/vi/{row['video_id']}/mqdefault.jpg",
                headers={"User-Agent": UA})
            with urllib.request.urlopen(req_, timeout=15) as resp:
                cover.write_bytes(resp.read())
        elif (COVERS / f"{row['id']}.jpg").exists():
            cover.write_bytes((COVERS / f"{row['id']}.jpg").read_bytes())
    except Exception:
        pass


# -------------------------------------------------------------- AI add-on
# An optional second container (see ai/) does the work that needs a graphics
# card. Both containers mount the same /data folder, so files are passed by
# path. Without the add-on these endpoints simply report "not available".
AI_URL = os.environ.get("AI_URL", "http://ai:8000").rstrip("/")
AI_TMP = DATA / "ai_tmp"
ai_jobs: deque = deque(maxlen=20)


def ai_call(path: str, body: dict | None = None, timeout: float = 5):
    req = urllib.request.Request(
        AI_URL + path, headers={"Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read()).get("detail")
        except Exception:
            detail = None
        raise RuntimeError(detail or f"The AI add-on failed ({e.code})")
    except (urllib.error.URLError, OSError):
        raise RuntimeError("The AI add-on is not running")


def wav_to_track(wav: Path, title: str, artist: str, source: str,
                 like=None) -> int:
    """Store an AI result as a new song (256 kbps AAC)."""
    out = MUSIC / f"ai_{uuid.uuid4().hex[:12]}.m4a"
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav),
                        "-c:a", "aac", "-b:a", "256k", str(out)],
                       capture_output=True, text=True, timeout=900)
    if r.returncode or not out.exists():
        out.unlink(missing_ok=True)
        raise RuntimeError("Could not save the result")
    with db() as con:
        cur = con.execute(
            "INSERT INTO tracks(ext_id,title,artist,duration,source,file,kind,"
            "status,added_at,lyrics,lyrics_state,lyrics_offset) "
            "VALUES(?,?,?,?,?,?,'audio','ready',?,?,?,?)",
            (f"ai:{out.stem}", title, artist, file_duration(out.name), source,
             out.name, time.time(), like["lyrics"] if like else None,
             like["lyrics_state"] if like else None,
             (like["lyrics_offset"] or 0) if like else 0))
        tid = cur.lastrowid
    if like is not None:
        copy_cover(like, tid)
    return tid


# ------------------------------------------------------------ song engine
# ACE-Step 1.5 in its own container: full songs with vocals from a style and
# lyrics, covers of an existing song, and replacing part of a song.
SONG_URL = os.environ.get("SONG_URL", "http://songs:8001").rstrip("/")
_gpu_lock = threading.Lock()  # one graphics-card job at a time (6 GB cards)


def song_call(path: str, body: dict | None = None, timeout: float = 30):
    req = urllib.request.Request(
        SONG_URL + path, headers={"Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            j = json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read()).get("detail")
        except Exception:
            detail = None
        raise RuntimeError(detail or f"The song engine failed ({e.code})")
    except (urllib.error.URLError, OSError):
        raise RuntimeError("The song engine is not running")
    return j.get("data", j) if isinstance(j, dict) else j


def song_upload(fields: dict, src: Path):
    """Submit a job together with a source audio file (cover, re-make)."""
    boundary = uuid.uuid4().hex
    parts = []
    for k, v in fields.items():
        v = str(v).lower() if isinstance(v, bool) else str(v)
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; '
                     f'name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; '
                 f'name="src_audio"; filename="{src.name}"\r\n'
                 'Content-Type: audio/wav\r\n\r\n'.encode()
                 + src.read_bytes() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(
        SONG_URL + "/release_task", data=b"".join(parts),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            j = json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read()).get("detail")
        except Exception:
            detail = None
        raise RuntimeError(detail or f"The song engine failed ({e.code})")
    except (urllib.error.URLError, OSError):
        raise RuntimeError("The song engine is not running")
    return j.get("data", j)


def song_make(body: dict, out: Path, src: Path | None = None):
    """Submit a job to the song engine, wait for it and save the audio."""
    try:
        ai_call("/unload", {}, 30)  # free the card for the big model
    except Exception:
        pass
    body = {"inference_steps": 8, "batch_size": 1, "thinking": False,
            "audio_format": "flac", "use_random_seed": True, **body}
    task = song_upload(body, src) if src else song_call("/release_task", body)
    task_id = task["task_id"]
    deadline = time.time() + 3600
    while time.time() < deadline:
        time.sleep(3)
        res = song_call("/query_result", {"task_id_list": [task_id]})
        item = next((x for x in res if x.get("task_id") == task_id), None) \
            if isinstance(res, list) else None
        if not item or item.get("status") == 0:
            continue
        result = item.get("result")
        if isinstance(result, str):
            try:
                result = json.loads(result)
            except ValueError:
                result = []
        first = result[0] if isinstance(result, list) and result else {}
        if item.get("status") != 1 or not first.get("file"):
            raise RuntimeError("The song engine could not make this song")
        with urllib.request.urlopen(SONG_URL + first["file"], timeout=600) as r:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(r.read())
        return
    raise RuntimeError("The song engine took too long")


def song_source(row, tmp: Path) -> str:
    """A copy of a library song as WAV for the engine to read."""
    tmp.mkdir(parents=True, exist_ok=True)
    wav = tmp / "source.wav"
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i",
                        str(MUSIC / Path(row["file"]).name), "-vn", "-ar",
                        "48000", "-ac", "2", str(wav)],
                       capture_output=True, text=True, timeout=600)
    if r.returncode or not wav.exists():
        raise RuntimeError("Could not read that song")
    return str(wav)


def run_song(job: dict, tmp: Path):
    out = tmp / "song.flac"
    body = {"prompt": job["style"], "lyrics": job["lyrics"] or "[Instrumental]"}
    for key in ("audio_duration", "bpm", "key_scale", "vocal_language", "seed"):
        if job.get(key):
            body[key] = job[key]
    if job.get("seed"):
        body["use_random_seed"] = False
    row = src = None
    if job["kind"] in ("cover", "repaint", "extend"):
        with db() as con:
            row = con.execute("SELECT * FROM tracks WHERE id=? AND "
                              "status='ready'", (job["track_id"],)).fetchone()
        if not row or not row["file"]:
            raise RuntimeError("That song is no longer in the library")
        src = Path(song_source(row, tmp))
        body["task_type"] = "repaint" if job["kind"] == "extend" else job["kind"]
        if job["kind"] == "extend":
            # Add silence after the end (or before the start) and have the
            # engine write music into exactly that stretch.
            secs = job["seconds"]
            length = round((src.stat().st_size - 44) / 192000, 2)  # 48 kHz 16-bit stereo
            padded = tmp / "padded.wav"
            pad = (f"adelay={secs * 1000}:all=1" if job["where"] == "start"
                   else f"apad=pad_dur={secs}")
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src),
                            "-af", pad, str(padded)], check=True, timeout=600)
            src = padded
            start = 0 if job["where"] == "start" else length
            body.update(repainting_start=start, repainting_end=start + secs,
                        audio_duration=length + secs)
        elif job["kind"] == "cover":
            body["audio_cover_strength"] = job["strength"]
        else:
            body.update(repainting_start=job["start"],
                        repainting_end=job["end"])
    song_make(body, out, src)
    tid = wav_to_track(out, job["label"], job.get("artist") or "AI",
                       "ai" if job["kind"] == "song" else "remix")
    if row is not None:
        copy_cover(row, tid)
    if job["kind"] == "song" and job["lyrics"]:
        with db() as con:  # the words that were sung, shown as plain lyrics
            con.execute("UPDATE tracks SET lyrics=?,lyrics_state='plain' "
                        "WHERE id=?", (job["lyrics"], tid))
    notify(f"“{job['label']}” is ready in your library")


def run_ai(job: dict):
    with _gpu_lock:
        _run_ai(job)


def _run_ai(job: dict):
    job["state"] = "working"
    tmp = AI_TMP / job["id"]
    try:
        if job["kind"] in ("song", "cover", "repaint", "extend"):
            run_song(job, tmp)
            job["state"] = "done"
            return
        if job["kind"] == "lyrics":
            run_lyrics(job)
            job["state"] = "done"
            return
        if job["kind"] == "split":
            with db() as con:
                row = con.execute("SELECT * FROM tracks WHERE id=?",
                                  (job["track_id"],)).fetchone()
            if not row or not row["file"]:
                raise RuntimeError("That song is no longer in the library")
            res = ai_call("/separate", {
                "src": str(MUSIC / Path(row["file"]).name),
                "out_dir": str(tmp)}, 3600)
            wav_to_track(Path(res["instrumental"]),
                         f"{row['title']} (Instrumental)", row["artist"],
                         "remix", row)
            wav_to_track(Path(res["vocals"]), f"{row['title']} (Vocals only)",
                         row["artist"], "remix", row)
            notify(f"“{row['title']}” is split: the instrumental and the "
                   "vocals-only song are in your library")
        elif job["kind"] == "mashup":
            with db() as con:
                rows = {r["id"]: r for r in con.execute(
                    "SELECT * FROM tracks WHERE status='ready' AND file IS "
                    "NOT NULL")}
            ids = [job["base_id"], *job["vocal_ids"]]
            if any(i not in rows for i in ids):
                raise RuntimeError("One of the songs is no longer in the library")
            path = lambda i: str(MUSIC / Path(rows[i]["file"]).name)
            out = tmp / "mashup.wav"
            ai_call("/mashup", {"base": path(ids[0]),
                                "vocals": [path(i) for i in ids[1:]],
                                "out": str(out)}, 3600)
            artists = list(dict.fromkeys(
                rows[i]["artist"] for i in ids if rows[i]["artist"]))
            tid = wav_to_track(out, job["label"], " × ".join(artists), "remix")
            copy_cover(rows[ids[0]], tid)
            notify(f"Mashup “{job['label']}” is ready in your library")
        else:
            out = tmp / "music.wav"
            ai_call("/generate", {"prompt": job["prompt"],
                                  "seconds": job["seconds"],
                                  "out": str(out)}, 3600)
            wav_to_track(out, job["label"], "AI", "ai")
            notify(f"“{job['label']}” is ready in your library")
        job["state"] = "done"
    except Exception as e:
        job.update(state="error", error=clean_err(e))
        notify(f"AI: {clean_err(e)}", "error")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def ai_queue(job: dict, songs: bool = False):
    try:
        song_call("/health", timeout=3) if songs else ai_call("/health",
                                                              timeout=3)
    except Exception as e:
        raise HTTPException(503, f"{e}. Start it on the server with: "
                                 "docker compose --profile ai up -d --build")
    job.update(id=uuid.uuid4().hex[:12], state="queued", profile=profile_id())
    ai_jobs.append(job)
    jobs.put(("ai", job))
    return {"ok": True}


def ai_active() -> list:
    return [{"kind": j["kind"], "label": j["label"], "state": j["state"]}
            for j in ai_jobs if j["state"] in ("queued", "working")]


@app.get("/api/ai")
def ai_status():
    try:
        info = ai_call("/health", timeout=2)
    except Exception:
        info = {}
    try:
        song_call("/health", timeout=2)
        songs = True
    except Exception:
        songs = False
    return {"available": bool(info.get("ok")), "device": info.get("device"),
            "gpu": info.get("gpu"), "vram_mb": info.get("vram_mb"),
            "songs": songs, "jobs": ai_active()}


class SongReq(BaseModel):
    title: str = ""
    style: str                 # genre, mood, instruments, voice
    lyrics: str = ""           # empty = instrumental
    duration: int = 120        # seconds
    bpm: int | None = None
    key: str = ""
    language: str = ""
    seed: int | None = None


def _song_fields(req) -> dict:
    out = {"style": req.style.strip()[:512], "lyrics": req.lyrics.strip()[:4096]}
    if getattr(req, "bpm", None):
        out["bpm"] = max(30, min(300, req.bpm))
    if getattr(req, "key", ""):
        out["key_scale"] = req.key.strip()[:20]
    if getattr(req, "language", ""):
        out["vocal_language"] = req.language.strip()[:12]
    if getattr(req, "seed", None):
        out["seed"] = req.seed
    return out


@app.post("/api/studio/song")
def studio_song(req: SongReq):
    """Make a new song from a style description and (optionally) lyrics."""
    if not req.style.strip():
        raise HTTPException(400, "Describe the style of the song first")
    label = (req.title.strip() or req.style.strip())[:80]
    return ai_queue({"kind": "song", "label": label,
                     "audio_duration": max(10, min(480, req.duration)),
                     **_song_fields(req)}, songs=True)


class CoverReq(BaseModel):
    track_id: int
    style: str
    lyrics: str = ""
    strength: float = 0.6      # 1 = stay close to the song, 0.2 = only its feel
    title: str = ""


class RepaintReq(BaseModel):
    track_id: int
    start: float
    end: float
    style: str
    lyrics: str = ""
    title: str = ""


def _studio_source(track_id: int):
    with db() as con:
        row = con.execute("SELECT title,artist FROM tracks WHERE id=? AND "
                          "status='ready'", (track_id,)).fetchone()
    if not row:
        raise HTTPException(404, "That song is not in the library")
    return row


@app.post("/api/studio/cover")
def studio_cover(req: CoverReq):
    """Re-make an existing song in another style."""
    row = _studio_source(req.track_id)
    if not req.style.strip():
        raise HTTPException(400, "Describe the new style first")
    return ai_queue({"kind": "cover", "track_id": req.track_id,
                     "label": (req.title.strip()
                               or f"{row['title']} (Cover)")[:120],
                     "artist": row["artist"],
                     "strength": max(0.1, min(1.0, req.strength)),
                     **_song_fields(req)}, songs=True)


@app.post("/api/studio/repaint")
def studio_repaint(req: RepaintReq):
    """Generate one part of a song again, keeping the rest."""
    row = _studio_source(req.track_id)
    if req.end <= req.start:
        raise HTTPException(400, "The end must be after the start")
    return ai_queue({"kind": "repaint", "track_id": req.track_id,
                     "label": (req.title.strip()
                               or f"{row['title']} (Edit)")[:120],
                     "artist": row["artist"], "start": max(0.0, req.start),
                     "end": req.end, **_song_fields(req)}, songs=True)


class SplitReq(BaseModel):
    track_id: int


class MashupReq(BaseModel):
    base_id: int            # the song whose music (instrumental) is kept
    vocal_ids: list[int]    # the songs whose vocals are laid over it
    name: str = ""


@app.post("/api/ai/mashup")
def ai_mashup(req: MashupReq):
    ids = [req.base_id, *req.vocal_ids]
    if len(ids) < 2 or len(ids) > 4 or len(set(ids)) != len(ids):
        raise HTTPException(400, "Pick two to four different songs")
    with db() as con:
        titles = {r["id"]: r["title"] for r in con.execute(
            "SELECT id,title FROM tracks WHERE status='ready'")}
    if any(i not in titles for i in ids):
        raise HTTPException(404, "One of the songs is not in the library")
    label = req.name.strip() or " × ".join(titles[i] for i in ids)
    return ai_queue({"kind": "mashup", "base_id": req.base_id,
                     "vocal_ids": req.vocal_ids, "label": label[:120]})


class GenerateReq(BaseModel):
    prompt: str
    seconds: int = 20
    name: str = ""


@app.post("/api/ai/split")
def ai_split(req: SplitReq):
    with db() as con:
        row = con.execute("SELECT title FROM tracks WHERE id=? AND "
                          "status='ready'", (req.track_id,)).fetchone()
    if not row:
        raise HTTPException(404, "That song is not in the library")
    return ai_queue({"kind": "split", "track_id": req.track_id,
                     "label": row["title"]})


@app.post("/api/ai/generate")
def ai_generate(req: GenerateReq):
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(400, "Describe the music first")
    return ai_queue({"kind": "generate", "prompt": prompt[:500],
                     "seconds": max(5, min(30, req.seconds)),
                     "label": (req.name.strip() or prompt)[:80]})


# ------------------------------------------------------------- artist info
def _deezer_artist(name: str) -> dict:
    j = json.loads(http("https://api.deezer.com/search/artist?limit=5&q="
                        + urllib.parse.quote(name)))
    for a in j.get("data") or []:
        if _norm(a.get("name")) == _norm(name):
            pic = a.get("picture_xl") or a.get("picture_big") or ""
            return {"picture": "" if "/artist//" in pic else pic,
                    "fans": a.get("nb_fan"), "albums": a.get("nb_album"),
                    "deezer": a.get("link")}
    return {}


def _musicbrainz_artist(name: str) -> dict:
    q = urllib.parse.quote(f'artist:"{name}"')
    j = json.loads(http(
        f"https://musicbrainz.org/ws/2/artist/?query={q}&fmt=json&limit=3",
        {"User-Agent": "Sonara/1.0 (self-hosted music player)"}))
    for a in j.get("artists") or []:
        if (a.get("score") or 0) >= 90 and _norm(a.get("name")) == _norm(name):
            tags = sorted(a.get("tags") or [],
                          key=lambda t: -(t.get("count") or 0))
            span = a.get("life-span") or {}
            return {"type": a.get("type"),
                    "country": (a.get("area") or {}).get("name"),
                    "since": (span.get("begin") or "")[:4] or None,
                    "ended": bool(span.get("ended")),
                    "about": a.get("disambiguation") or None,
                    "genres": [t["name"] for t in tags[:4] if t.get("name")]}
    return {}


def artist_data(name: str, full: bool) -> dict:
    """Facts about an artist from Deezer (picture, fans) and MusicBrainz
    (country, genres, years). Looked up once, then kept for a month."""
    key = name.strip().lower()
    with db() as con:
        row = con.execute("SELECT data,fetched FROM artists WHERE name=?",
                          (key,)).fetchone()
    data = json.loads(row["data"]) if row else None
    if data and time.time() - row["fetched"] < 30 * 86400 and (
            data.get("full") or not full):
        return data
    data = {"name": name.strip(), "full": full, **(data or {})}
    try:
        data.update(_deezer_artist(name))
    except Exception:
        pass
    if full:
        data["full"] = True
        try:
            data.update(_musicbrainz_artist(name))
        except Exception:
            data["full"] = False  # try again next time
    with db() as con:
        con.execute("INSERT OR REPLACE INTO artists VALUES(?,?,?)",
                    (key, json.dumps(data), time.time()))
    return data


@app.get("/api/artist")
def artist_info(name: str):
    if not name.strip():
        raise HTTPException(400, "Name is required")
    return artist_data(name, True)


@app.get("/api/artist/picture")
def artist_picture(name: str):
    pic = artist_data(name, False).get("picture") if name.strip() else None
    if not pic:
        raise HTTPException(404)
    return RedirectResponse(pic, headers={"Cache-Control": "max-age=86400"})


@app.post("/api/upgrade")
def upgrade():
    """Re-download songs that were saved before 'Best' quality was chosen."""
    if audio_setting() not in ("best", "opus"):
        raise HTTPException(400, "Set the audio format to Best first")
    jobs.put(("upgrade_scan", None))
    return {"ok": True}


@app.post("/api/clean-names")
def clean_all_names():
    """Tidy the title and artist of every song that came from YouTube."""
    n = 0
    with db() as con:
        for r in con.execute("SELECT id,title,artist,raw_title FROM tracks "
                             "WHERE source='youtube'").fetchall():
            title, artist = clean_names(r["title"], r["artist"])
            if (title, artist) == (r["title"], r["artist"] or ""):
                continue
            if r["raw_title"] is None:  # keep the original for "restore"
                con.execute("UPDATE tracks SET raw_title=title,"
                            "raw_artist=artist WHERE id=?", (r["id"],))
            con.execute("UPDATE tracks SET title=?,artist=?,lyrics_state=CASE "
                        "WHEN lyrics_state='none' THEN NULL ELSE lyrics_state "
                        "END WHERE id=?", (title, artist, r["id"]))
            n += 1
    return {"count": n}


@app.post("/api/restore-names")
def restore_names():
    """Put back the names the songs had when they were downloaded."""
    with db() as con:
        cur = con.execute(
            "UPDATE tracks SET title=raw_title,artist=raw_artist WHERE "
            "raw_title IS NOT NULL AND (title!=raw_title OR "
            "COALESCE(artist,'')!=COALESCE(raw_artist,''))")
        return {"count": cur.rowcount}


@app.get("/api/tracks")
def tracks(playlist: int | None = None, view: str = "", ids: str = ""):
    cols, src = track_cols(), tracks_from()
    if ids:  # these songs whoever owns them: another device sent them over
        want = [int(i) for i in ids.split(",") if i.strip().isdigit()][:300]
        with db() as con:
            return [dict(r) for r in con.execute(
                f"SELECT {cols} FROM tracks t LEFT JOIN profile_tracks pt ON "
                f"pt.track_id=t.id AND pt.profile_id={profile_id()} WHERE "
                f"t.id IN ({','.join('?' * len(want)) or 'NULL'})", want)]
    smart = {"liked": "WHERE pt.liked=1 ORDER BY t.id DESC",
             "recent": "WHERE pt.last_played IS NOT NULL "
                       "ORDER BY pt.last_played DESC LIMIT 100",
             "top": "WHERE pt.plays>0 ORDER BY pt.plays DESC, "
                    "pt.last_played DESC LIMIT 100"}
    with db() as con:
        if view in smart:
            rows = con.execute(f"SELECT {cols} FROM {src} {smart[view]}")
        elif playlist:
            rows = con.execute(
                f"SELECT {cols} FROM {src} JOIN playlist_tracks p ON "
                "p.track_id=t.id WHERE p.playlist_id=? ORDER BY p.position",
                (playlist,))
        else:
            rows = con.execute(f"SELECT {cols} FROM {src} ORDER BY t.id DESC")
        return [dict(r) for r in rows]


@app.patch("/api/tracks/{tid}")
def edit_track(tid: int, req: TrackEdit):
    with db() as con:
        if req.title is not None and req.title.strip():
            con.execute("UPDATE tracks SET title=? WHERE id=?",
                        (req.title.strip(), tid))
        if req.artist is not None:
            con.execute("UPDATE tracks SET artist=? WHERE id=?",
                        (req.artist.strip(), tid))
        # metadata changed: forget a previous failed lyrics lookup
        con.execute("UPDATE tracks SET lyrics_state=NULL WHERE id=? AND "
                    "lyrics_state='none'", (tid,))
    return {"ok": True}


@app.post("/api/tracks/{tid}/like")
def like(tid: int, req: LikeReq):
    with db() as con:
        con.execute(
            "INSERT INTO profile_tracks(profile_id,track_id,liked) VALUES(?,?,?) "
            "ON CONFLICT(profile_id,track_id) DO UPDATE SET liked=excluded.liked",
            (profile_id(), tid, 1 if req.liked else 0))
    return {"ok": True}


@app.post("/api/tracks/{tid}/played")
def played(tid: int):
    with db() as con:
        con.execute(
            "INSERT INTO profile_tracks(profile_id,track_id,plays,last_played) "
            "VALUES(?,?,1,?) ON CONFLICT(profile_id,track_id) DO UPDATE SET "
            "plays=plays+1,last_played=excluded.last_played",
            (profile_id(), tid, time.time()))
    return {"ok": True}


class ShareReq(BaseModel):
    profile: int


@app.post("/api/tracks/{tid}/share")
def share_track(tid: int, req: ShareReq):
    """Put a song into another profile's library too (no second download)."""
    if req.profile not in _profile_info:
        raise HTTPException(404, "No such profile")
    with db() as con:
        row = con.execute("SELECT title FROM tracks WHERE id=?",
                          (tid,)).fetchone()
        if not row:
            raise HTTPException(404)
        con.execute("INSERT OR IGNORE INTO library VALUES(?,?)",
                    (req.profile, tid))
    return {"ok": True}


@app.post("/api/tracks/{tid}/retry")
def retry(tid: int):
    with db() as con:
        con.execute("UPDATE tracks SET status='queued',error=NULL "
                    "WHERE id=? AND status='error'", (tid,))
    jobs.put(("track", tid))
    return {"ok": True}


@app.post("/api/retry-failed")
def retry_failed():
    with db() as con:
        ids = [r["id"] for r in con.execute(
            "SELECT id FROM tracks WHERE status='error'")]
        con.execute("UPDATE tracks SET status='queued',error=NULL "
                    "WHERE status='error'")
    for tid in ids:
        jobs.put(("track", tid))
    return {"count": len(ids)}


@app.delete("/api/tracks/{tid}")
def delete_track(tid: int, forever: bool = False):
    """A finished song goes to the recycle bin (its files stay on disk until
    the bin is emptied); an unfinished download is simply removed."""
    with db() as con:
        row = con.execute("SELECT * FROM tracks WHERE id=?", (tid,)).fetchone()
        if not row:
            raise HTTPException(404)
        me = profile_id()
        con.execute("DELETE FROM library WHERE profile_id=? AND track_id=?",
                    (me, tid))
        if con.execute("SELECT 1 FROM library WHERE track_id=?",
                       (tid,)).fetchone():
            # another profile still has this song: only leave this library
            con.execute("DELETE FROM playlist_tracks WHERE track_id=? AND "
                        "playlist_id IN (SELECT id FROM playlists WHERE "
                        "COALESCE(profile_id,1)=?)", (tid, me))
            con.execute("DELETE FROM profile_tracks WHERE track_id=? AND "
                        "profile_id=?", (tid, me))
            shared = True
        else:
            shared = False
    if shared:
        log_act("delete", f"Removed “{row['title']}” from the library")
        return {"ok": True, "trash": None}
    with db() as con:
        if row["status"] in ("queued", "downloading"):
            cancelled.add(tid)  # stops the download if it is running
        binned = row["status"] == "ready" and not forever
        trash_id = None
        if binned:
            data = {"row": dict(row), "owners": [me],
                    "folders": [[m["playlist_id"], m["position"]] for m in
                                con.execute("SELECT playlist_id,position FROM "
                                            "playlist_tracks WHERE track_id=?",
                                            (tid,))],
                    "profiles": [[p["profile_id"], p["liked"], p["plays"],
                                  p["last_played"]] for p in con.execute(
                        "SELECT * FROM profile_tracks WHERE track_id=?",
                        (tid,))]}
            trash_id = con.execute(
                "INSERT INTO trash(at,profile_id,kind,name,data) VALUES"
                "(?,?,?,?,?)", (time.time(), profile_id(), "song",
                                row["title"], json.dumps(data))).lastrowid
        con.execute("DELETE FROM tracks WHERE id=?", (tid,))
        con.execute("DELETE FROM playlist_tracks WHERE track_id=?", (tid,))
        con.execute("DELETE FROM profile_tracks WHERE track_id=?", (tid,))
        if not binned:
            drop_song_files([row["file"], row["video_file"]], con)
    cover = COVERS / f"{tid}.jpg"
    if binned and cover.exists():
        cover.replace(COVERS / f"trash_{trash_id}.jpg")
    else:
        cover.unlink(missing_ok=True)
    log_act("delete", f"Deleted “{row['title']}”")
    return {"ok": True, "trash": trash_id}


@app.get("/api/tracks/{tid}/lyrics")
def lyrics(tid: int, refresh: bool = False):
    with db() as con:
        row = con.execute("SELECT lyrics,lyrics_state,lyrics_offset FROM tracks "
                          "WHERE id=?", (tid,)).fetchone()
    if not row:
        raise HTTPException(404)
    if refresh or not row["lyrics_state"]:
        try:
            state, text = fetch_lyrics(tid)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(502, f"Lyrics lookup failed: {clean_err(e)}")
        return {"state": state, "lyrics": text,
                "offset": row["lyrics_offset"] or 0}
    return {"state": row["lyrics_state"], "lyrics": row["lyrics"],
            "offset": row["lyrics_offset"] or 0}


@app.put("/api/tracks/{tid}/lyrics")
def save_lyrics(tid: int, body: dict):
    """Store lyrics uploaded from the user's device and/or a sync offset."""
    out = {}
    with db() as con:
        if not con.execute("SELECT 1 FROM tracks WHERE id=?", (tid,)).fetchone():
            raise HTTPException(404)
        if "lyrics" in body:
            text = str(body["lyrics"] or "").replace("\r\n", "\n").strip()[:200_000]
            state = ("none" if not text else "synced"
                     if re.search(r"^\[\d+:\d+", text, re.M) else "plain")
            con.execute("UPDATE tracks SET lyrics=?,lyrics_state=?,"
                        "lyrics_offset=0 WHERE id=?", (text or None, state, tid))
            out = {"state": state, "lyrics": text or None, "offset": 0}
        if "offset" in body:
            off = max(-30.0, min(30.0, float(body["offset"] or 0)))
            con.execute("UPDATE tracks SET lyrics_offset=? WHERE id=?",
                        (off, tid))
            out["offset"] = off
    return out


@app.get("/api/lyrics/lookup")
def lyrics_lookup(title: str, artist: str = "", duration: int = 0):
    """Lyrics for a track that is only being streamed (nothing is stored)."""
    try:
        state, text = lookup_lyrics(title, artist, "youtube", duration)
    except Exception as e:
        raise HTTPException(502, f"Lyrics lookup failed: {clean_err(e)}")
    return {"state": state, "lyrics": text}


@app.get("/api/stream/{video_id}")
def stream(video_id: str, request: Request, kind: str = "audio"):
    """Proxy YouTube audio straight to the browser without saving it."""
    if not re.fullmatch(r"[\w-]{6,20}", video_id):
        raise HTTPException(400, "Bad video id")
    up = None
    for fresh in (False, True):
        try:
            with _stream_lock:  # parallel browser requests share one lookup
                url, hdrs, mime = resolve_stream(
                    video_id, "video" if kind == "video" else "audio", fresh)
        except Exception as e:
            raise HTTPException(502, clean_err(e))
        if request.headers.get("range"):
            hdrs = {**hdrs, "Range": request.headers["range"]}
        # A freshly issued link is refused (403) for its first few seconds,
        # so wait and retry before giving up and asking for a new link.
        for wait in (0, 1.5, 2, 2.5, 3):
            time.sleep(wait)
            try:
                up = urllib.request.urlopen(
                    urllib.request.Request(url, headers=hdrs), timeout=20)
                break
            except urllib.error.HTTPError as e:
                if e.code not in (403, 410):
                    raise HTTPException(502, f"Stream failed ({e.code})")
            except Exception as e:
                raise HTTPException(502, clean_err(e))
        if up:
            break
    if not up:
        raise HTTPException(502, "YouTube refused the stream")
    out = {"Accept-Ranges": "bytes", "Cache-Control": "no-store"}
    for h in ("Content-Length", "Content-Range"):
        if up.headers.get(h):
            out[h] = up.headers[h]

    def body():
        try:
            while chunk := up.read(64 * 1024):
                yield chunk
        finally:
            up.close()

    return StreamingResponse(body(), status_code=up.status, headers=out,
                             media_type=mime)


@app.post("/api/lyrics/all")
def lyrics_all():
    with db() as con:
        ids = [r["id"] for r in con.execute(
            "SELECT id FROM tracks WHERE status='ready' AND lyrics_state IS NULL")]
    for tid in ids:
        jobs.put(("lyrics", tid))
    return {"count": len(ids)}


@app.get("/api/cover/{tid}")
def cover(tid: int):
    path = COVERS / f"{tid}.jpg"
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type="image/jpeg")


# folders & playlists
@app.get("/api/playlists")
def playlists():
    with db() as con:
        return [dict(r) for r in con.execute(
            "SELECT p.id,p.name,p.source, (SELECT COUNT(*) FROM playlist_tracks "
            "WHERE playlist_id=p.id) AS count FROM playlists p "
            "WHERE COALESCE(p.profile_id,1)=? "
            "ORDER BY p.position IS NULL, p.position, p.name COLLATE NOCASE",
            (profile_id(),))]


@app.put("/api/playlists/order")
def playlists_order(body: dict):
    """Save the order the folders are shown in (ids, top to bottom)."""
    try:
        ids = [int(i) for i in body.get("ids") or []]
    except (TypeError, ValueError):
        raise HTTPException(400, "Bad folder list")
    with db() as con:
        for pos, pid in enumerate(ids):
            con.execute("UPDATE playlists SET position=? WHERE id=?", (pos, pid))
    return {"ok": True}


@app.post("/api/playlists")
def create_folder(req: NameReq):
    name = req.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    with db() as con:
        cur = con.execute(
            "INSERT INTO playlists(name,url,source,profile_id) VALUES(?,?,?,?)",
            (name, f"folder:{uuid.uuid4().hex}", "folder", profile_id()))
        log_act("folder", f"Made the folder “{name}”")
        return {"id": cur.lastrowid, "name": name}


@app.patch("/api/playlists/{pid}")
def rename_playlist(pid: int, req: NameReq):
    if not req.name.strip():
        raise HTTPException(400, "Name is required")
    with db() as con:
        con.execute("UPDATE playlists SET name=? WHERE id=?",
                    (req.name.strip(), pid))
    log_act("folder", f"Renamed a folder to “{req.name.strip()}”")
    return {"ok": True}


@app.delete("/api/playlists/{pid}")
def delete_playlist(pid: int):
    """Removes the folder/playlist only; its tracks stay in the library.
    The folder itself can be put back from the recycle bin."""
    with db() as con:
        row = con.execute("SELECT * FROM playlists WHERE id=?", (pid,)).fetchone()
        if not row:
            raise HTTPException(404)
        data = {"row": dict(row),
                "tracks": [[m["track_id"], m["position"]] for m in con.execute(
                    "SELECT track_id,position FROM playlist_tracks WHERE "
                    "playlist_id=?", (pid,))]}
        trash_id = con.execute(
            "INSERT INTO trash(at,profile_id,kind,name,data) VALUES(?,?,?,?,?)",
            (time.time(), profile_id(), "folder", row["name"],
             json.dumps(data))).lastrowid
        con.execute("DELETE FROM playlists WHERE id=?", (pid,))
        con.execute("DELETE FROM playlist_tracks WHERE playlist_id=?", (pid,))
    log_act("delete", f"Deleted the folder “{row['name']}”")
    return {"ok": True, "trash": trash_id}


@app.post("/api/playlists/{pid}/tracks")
def playlist_add(pid: int, req: TrackRef):
    with db() as con:
        if not con.execute("SELECT 1 FROM playlists WHERE id=?",
                           (pid,)).fetchone():
            raise HTTPException(404)
        playlist_append(con, pid, req.track_id)
    return {"ok": True}


@app.put("/api/playlists/{pid}/order")
def playlist_order(pid: int, body: dict):
    """Save a new order for the folder's tracks (ids, first to last)."""
    try:
        ids = [int(i) for i in body.get("track_ids") or []]
    except (TypeError, ValueError):
        raise HTTPException(400, "Bad track list")
    with db() as con:
        for pos, tid in enumerate(ids):
            con.execute("UPDATE playlist_tracks SET position=? WHERE "
                        "playlist_id=? AND track_id=?", (pos, pid, tid))
    return {"ok": True}


@app.delete("/api/playlists/{pid}/tracks/{tid}")
def playlist_remove(pid: int, tid: int):
    with db() as con:
        con.execute("DELETE FROM playlist_tracks WHERE playlist_id=? AND "
                    "track_id=?", (pid, tid))
    return {"ok": True}


# settings & status
@app.get("/api/settings")
def settings():
    with db() as con:
        s = con.execute(
            "SELECT COUNT(*) total, SUM(status='ready') ready, "
            "SUM(status='error') failed, "
            "SUM(lyrics_state IN ('synced','plain')) lyrics FROM tracks"
        ).fetchone()
        folders = con.execute("SELECT COUNT(*) c FROM playlists").fetchone()["c"]
    size = sum(f.stat().st_size for f in MUSIC.iterdir() if f.is_file())
    cid, secret = spotify_creds()
    return {"format": audio_setting(),
            "auto_lyrics": get_setting("auto_lyrics", "1") == "1",
            "clean_names": get_setting("clean_names", "1") == "1",
            "spotify_client_id": cid, "spotify_secret_set": bool(secret),
            "password_set": bool(_auth["hash"]),
            "import_dir": str(IMPORT_DIR) if IMPORT_DIR.is_dir() else None,
            "stats": {"tracks": s["total"], "ready": s["ready"] or 0,
                      "failed": s["failed"] or 0, "lyrics": s["lyrics"] or 0,
                      "folders": folders, "bytes": size}}


@app.put("/api/settings")
def update_settings(body: dict):
    if "format" in body:
        if body["format"] not in ("best", *FORMATS):
            raise HTTPException(400, "Unknown format")
        set_setting("format", body["format"])
    if "auto_lyrics" in body:
        set_setting("auto_lyrics", "1" if body["auto_lyrics"] else "0")
    if "clean_names" in body:
        set_setting("clean_names", "1" if body["clean_names"] else "0")
    for key in ("spotify_client_id", "spotify_client_secret"):
        if key in body:
            set_setting(key, str(body[key]).strip())
    return {"ok": True}


@app.get("/api/status")
def status():
    with db() as con:
        rows = con.execute(
            "SELECT id,title,artist,video_id,status,error FROM tracks WHERE "
            "status IN ('queued','downloading','error') AND id IN "
            "(SELECT track_id FROM library WHERE profile_id=?) "
            "ORDER BY status!='downloading', status='error', id",
            (profile_id(),)).fetchall()
    downloads = [{**dict(r), **progress.get(r["id"], {})} for r in rows]
    n = sum(1 for r in rows if r["status"] != "error")
    return {"pending": n or jobs.unfinished_tasks, "events": list(events),
            "downloads": downloads, "ai": ai_active()}


@app.get("/media/{tid}")
def media(tid: int, v: int = 0):
    """The song's audio file, or with ?v=1 its video file."""
    with db() as con:
        row = con.execute("SELECT file,video_file FROM tracks WHERE id=?",
                          (tid,)).fetchone()
    name = row and ((v and row["video_file"]) or row["file"])
    path = MUSIC / Path(name).name if name else None
    if not path or not path.exists():
        raise HTTPException(404)
    return FileResponse(
        path, media_type=mimetypes.guess_type(path.name)[0] or "audio/mpeg")


@app.get("/api/where/{video_id}")
def where(video_id: str):
    """Where a YouTube song lives in the library: its id and a folder, if any."""
    with db() as con:
        row = con.execute(
            "SELECT id FROM tracks WHERE video_id=? AND id IN (SELECT track_id "
            "FROM library WHERE profile_id=?) ORDER BY id LIMIT 1",
            (video_id, profile_id())).fetchone()
        if not row:
            raise HTTPException(404, "Not in the library")
        pl = con.execute(
            "SELECT p.id,p.name,p.source FROM playlists p JOIN playlist_tracks "
            "pt ON pt.playlist_id=p.id WHERE pt.track_id=? AND "
            "COALESCE(p.profile_id,1)=? ORDER BY p.id LIMIT 1",
            (row["id"], profile_id())).fetchone()
    return {"id": row["id"], "playlist": dict(pl) if pl else None}


# ------------------------------------------------------------ even loudness
# Every song gets a gain (in dB) that brings it to the same loudness, so a
# quiet song and a loud one play at the same level. The player applies it.
LOUD_TARGET = -14.0  # LUFS, the level streaming services play at


def measure_gain(path: Path) -> float:
    r = subprocess.run(
        ["ffmpeg", "-nostats", "-hide_banner", "-i", str(path), "-vn", "-af",
         "ebur128=peak=true:framelog=quiet", "-f", "null", "-"],
        capture_output=True, text=True, timeout=600)
    out = r.stderr[r.stderr.rfind("Summary:"):]
    loud = re.search(r"I:\s+(-?[\d.]+) LUFS", out)
    peak = re.search(r"Peak:\s+(-?[\d.]+) dBFS", out)
    if not loud or float(loud.group(1)) < -60:  # unreadable or silent
        return 0.0
    gain = LOUD_TARGET - float(loud.group(1))
    if peak and gain > 0:  # turning up: stop before the loudest moment clips
        gain = min(gain, max(0.0, -1.0 - float(peak.group(1))))
    return round(max(-14.0, min(gain, 9.0)), 2)


def loudness_worker():
    while True:
        try:
            with db() as con:
                rows = con.execute(
                    "SELECT id,file FROM tracks WHERE status='ready' AND file "
                    "IS NOT NULL AND gain IS NULL LIMIT 20").fetchall()
            if not rows:
                time.sleep(20)
                continue
            for r in rows:
                try:
                    gain = measure_gain(MUSIC / Path(r["file"]).name)
                except Exception:
                    gain = 0.0
                with db() as con:
                    con.execute("UPDATE tracks SET gain=? WHERE id=?",
                                (gain, r["id"]))
        except Exception:
            time.sleep(60)


# ----------------------------------------------------------------- profiles
# One library, several people: each profile has its own likes, history,
# play counts and folders. A profile can have a PIN, and can be a "listen
# only" profile for children. The first profile is the owner: it can manage
# the others.
PIN_RE = re.compile(r"\d{4,8}")


def unlocked(pid: int) -> bool:
    info = _profile_info.get(pid)
    return bool(info) and (not info["pin"]
                           or _profile_keys.get(_profile_key.get()) == pid)


def manage_check(target: int):
    """May the profile making this request change profile `target`?"""
    me = profile_id()
    if (_profile_info.get(me) or {}).get("kid"):
        raise HTTPException(403, "A listen-only profile cannot change profiles")
    if not unlocked(me):
        raise HTTPException(423, "This profile is locked with a PIN")
    t = _profile_info.get(target)
    if not t:
        raise HTTPException(404, "No such profile")
    if t["pin"] and me not in (target, 1):
        raise HTTPException(403, "Only that profile itself or the first "
                                 "profile can change it")


def new_profile_key(pid: int) -> str:
    key = secrets.token_urlsafe(24)
    with db() as con:
        con.execute("INSERT INTO profile_keys VALUES(?,?)", (key, pid))
    _profile_keys[key] = pid
    return key


@app.get("/api/profiles")
def profiles():
    with db() as con:
        rows = [{"id": r["id"], "name": r["name"], "kid": bool(r["kid"]),
                 "locked": bool(r["pin"])} for r in con.execute(
            "SELECT id,name,pin,kid FROM profiles ORDER BY id")]
    return {"current": profile_id(), "profiles": rows}


@app.post("/api/profiles")
def create_profile(req: NameReq):
    manage_check(profile_id())
    name = req.name.strip()[:30]
    if not name:
        raise HTTPException(400, "Name is required")
    with db() as con:
        if con.execute("SELECT COUNT(*) c FROM profiles").fetchone()["c"] >= 12:
            raise HTTPException(400, "That is the most profiles there can be")
        pid = con.execute("INSERT INTO profiles(name) VALUES(?)",
                          (name,)).lastrowid
    load_profiles()
    log_act("profile", f"Added the profile “{name}”")
    return {"id": pid, "name": name}


@app.patch("/api/profiles/{pid}")
def rename_profile(pid: int, req: NameReq):
    manage_check(pid)
    name = req.name.strip()[:30]
    if not name:
        raise HTTPException(400, "Name is required")
    with db() as con:
        con.execute("UPDATE profiles SET name=? WHERE id=?", (name, pid))
    return {"ok": True}


@app.delete("/api/profiles/{pid}")
def delete_profile(pid: int):
    """Removes the profile with its likes, history and folders. The songs
    themselves stay in the library."""
    if pid == 1:
        raise HTTPException(400, "The first profile cannot be deleted")
    manage_check(pid)
    with db() as con:
        name = con.execute("SELECT name FROM profiles WHERE id=?",
                           (pid,)).fetchone()["name"]
        con.execute("DELETE FROM playlist_tracks WHERE playlist_id IN "
                    "(SELECT id FROM playlists WHERE profile_id=?)", (pid,))
        con.execute("DELETE FROM playlists WHERE profile_id=?", (pid,))
        con.execute("DELETE FROM profile_tracks WHERE profile_id=?", (pid,))
        con.execute("DELETE FROM profile_keys WHERE profile_id=?", (pid,))
        con.execute("INSERT OR IGNORE INTO library SELECT 1,track_id FROM "
                    "library WHERE profile_id=? AND track_id NOT IN (SELECT "
                    "track_id FROM library WHERE profile_id!=?)", (pid, pid))
        con.execute("DELETE FROM library WHERE profile_id=?", (pid,))
        con.execute("DELETE FROM profiles WHERE id=?", (pid,))
    load_profiles()
    log_act("profile", f"Deleted the profile “{name}”")
    return {"ok": True}


class PinReq(BaseModel):
    pin: str = ""


@app.post("/api/profiles/{pid}/unlock")
def unlock_profile(pid: int, req: PinReq):
    info = _profile_info.get(pid)
    if not info:
        raise HTTPException(404, "No such profile")
    if info["pin"] and not check_pw(req.pin, info["pin"]):
        time.sleep(0.7)  # slows down guessing
        raise HTTPException(403, "Wrong PIN")
    return {"key": new_profile_key(pid) if info["pin"] else ""}


@app.put("/api/profiles/{pid}/pin")
def set_profile_pin(pid: int, req: PinReq):
    """Set a PIN (4 to 8 digits) or, with an empty one, remove it."""
    manage_check(pid)
    if req.pin and not PIN_RE.fullmatch(req.pin):
        raise HTTPException(400, "A PIN is 4 to 8 digits")
    with db() as con:
        con.execute("UPDATE profiles SET pin=? WHERE id=?",
                    (hash_pw(req.pin) if req.pin else None, pid))
        con.execute("DELETE FROM profile_keys WHERE profile_id=?", (pid,))
    load_profiles()
    # whoever set it stays signed in to that profile on this browser
    return {"key": new_profile_key(pid) if req.pin else ""}


class KidReq(BaseModel):
    kid: bool


@app.put("/api/profiles/{pid}/kid")
def set_profile_kid(pid: int, req: KidReq):
    if pid == 1:
        raise HTTPException(400, "The first profile always has full access")
    manage_check(pid)
    with db() as con:
        con.execute("UPDATE profiles SET kid=? WHERE id=?",
                    (1 if req.kid else 0, pid))
    load_profiles()
    return {"ok": True}


# ----------------------------------------- activity log and the recycle bin
# What was added, changed and deleted, and by which profile. Deleted songs
# and folders wait in the recycle bin for 30 days and can be put back.
TRASH_DAYS = 30


def log_act(action: str, text: str, profile: int | None = None):
    try:
        with db() as con:
            con.execute("INSERT INTO activity(at,profile_id,action,text) "
                        "VALUES(?,?,?,?)",
                        (time.time(), profile if profile is not None
                         else profile_id(), action, text[:300]))
            con.execute("DELETE FROM activity WHERE id <= "
                        "(SELECT MAX(id) FROM activity) - 3000")
    except Exception:
        pass  # the log must never break the action itself


def trash_files(con) -> set:
    """Names of the files that songs in the recycle bin still need."""
    names = set()
    for r in con.execute("SELECT data FROM trash WHERE kind='song'"):
        row = json.loads(r["data"])["row"]
        names.update(Path(n).name for n in (row.get("file"),
                                            row.get("video_file")) if n)
    return names


def drop_song_files(names, con):
    """Delete files unless a song or the recycle bin still uses them."""
    held = trash_files(con)
    for n in {Path(n).name for n in names if n}:
        used = con.execute("SELECT 1 FROM tracks WHERE file=? OR video_file=?",
                           (n, n)).fetchone()
        if not used and n not in held:
            (MUSIC / n).unlink(missing_ok=True)


def purge_trash(ids=None, older_than: float | None = None):
    with db() as con:
        if ids is not None:
            marks = ",".join("?" * len(ids)) or "NULL"
            items = con.execute(f"SELECT * FROM trash WHERE id IN ({marks})",
                                list(ids)).fetchall()
        elif older_than is not None:
            items = con.execute("SELECT * FROM trash WHERE at<?",
                                (older_than,)).fetchall()
        else:
            items = con.execute("SELECT * FROM trash").fetchall()
        for it in items:
            con.execute("DELETE FROM trash WHERE id=?", (it["id"],))
        for it in items:
            if it["kind"] == "song":
                row = json.loads(it["data"])["row"]
                drop_song_files([row.get("file"), row.get("video_file")], con)
                (COVERS / f"trash_{it['id']}.jpg").unlink(missing_ok=True)
    return len(items)


@app.get("/api/trash")
def trash_list():
    purge_trash(older_than=time.time() - TRASH_DAYS * 86400)
    out = []
    with db() as con:
        mine = profile_id()
        for r in con.execute("SELECT * FROM trash WHERE ?=1 OR profile_id=? "
                             "ORDER BY at DESC", (mine, mine)):
            data = json.loads(r["data"])
            row = data["row"]
            item = {"id": r["id"], "kind": r["kind"], "name": r["name"],
                    "at": r["at"], "profile_id": r["profile_id"],
                    "days_left": max(0, TRASH_DAYS - int(
                        (time.time() - r["at"]) / 86400))}
            if r["kind"] == "song":
                item.update(artist=row.get("artist") or "",
                            video_id=row.get("video_id"),
                            bytes=file_size(row.get("file"))
                            + file_size(row.get("video_file")))
            else:
                item["count"] = len(data.get("tracks") or [])
            out.append(item)
    return out


@app.post("/api/trash/{xid}/restore")
def trash_restore(xid: int):
    with db() as con:
        it = con.execute("SELECT * FROM trash WHERE id=?", (xid,)).fetchone()
        if not it:
            raise HTTPException(404, "That is no longer in the recycle bin")
        data = json.loads(it["data"])
        row = dict(data["row"])
        if it["kind"] == "song":
            if con.execute("SELECT 1 FROM tracks WHERE ext_id=?",
                           (row.get("ext_id"),)).fetchone():
                raise HTTPException(409, "This song is in the library again "
                                         "already")
            if con.execute("SELECT 1 FROM tracks WHERE id=?",
                           (row["id"],)).fetchone():
                row.pop("id")  # its old number was given to a newer song
            cols = {r["name"] for r in con.execute("PRAGMA table_info(tracks)")}
            keys = [k for k in row if k in cols]
            cur = con.execute(
                f"INSERT INTO tracks({','.join(keys)}) VALUES("
                f"{','.join('?' * len(keys))})", [row[k] for k in keys])
            tid = row.get("id") or cur.lastrowid
            for pid, pos in data.get("folders") or []:
                if con.execute("SELECT 1 FROM playlists WHERE id=?",
                               (pid,)).fetchone():
                    con.execute("INSERT OR IGNORE INTO playlist_tracks "
                                "VALUES(?,?,?)", (pid, tid, pos))
            for owner in data.get("owners") or []:
                if owner in _profile_info:
                    con.execute("INSERT OR IGNORE INTO library VALUES(?,?)",
                                (owner, tid))
            if data.get("owners") and profile_id() not in data["owners"]:
                con.execute("DELETE FROM library WHERE profile_id=? AND "
                            "track_id=?", (profile_id(), tid))
            for p in data.get("profiles") or []:
                if p[0] in _profile_info:
                    con.execute("INSERT OR REPLACE INTO profile_tracks "
                                "VALUES(?,?,?,?,?)", (p[0], tid, *p[1:]))
            cover = COVERS / f"trash_{xid}.jpg"
            if cover.exists():
                cover.replace(COVERS / f"{tid}.jpg")
            new_id = tid
        else:
            if con.execute("SELECT 1 FROM playlists WHERE url=?",
                           (row.get("url"),)).fetchone():
                row["url"] = f"folder:{uuid.uuid4().hex}"
            if con.execute("SELECT 1 FROM playlists WHERE id=?",
                           (row["id"],)).fetchone():
                row.pop("id")
            cols = {r["name"] for r in
                    con.execute("PRAGMA table_info(playlists)")}
            keys = [k for k in row if k in cols]
            cur = con.execute(
                f"INSERT INTO playlists({','.join(keys)}) VALUES("
                f"{','.join('?' * len(keys))})", [row[k] for k in keys])
            new_id = row.get("id") or cur.lastrowid
            for tid, pos in data.get("tracks") or []:
                if con.execute("SELECT 1 FROM tracks WHERE id=?",
                               (tid,)).fetchone():
                    con.execute("INSERT OR IGNORE INTO playlist_tracks "
                                "VALUES(?,?,?)", (new_id, tid, pos))
        con.execute("DELETE FROM trash WHERE id=?", (xid,))
    log_act("restore", f"Put back “{it['name']}”")
    return {"ok": True, "kind": it["kind"], "id": new_id}


@app.delete("/api/trash/{xid}")
def trash_delete(xid: int):
    return {"deleted": purge_trash(ids=[xid])}


@app.delete("/api/trash")
def trash_empty():
    n = purge_trash()
    if n:
        log_act("delete", f"Emptied the recycle bin ({n} item(s))")
    return {"deleted": n}


@app.get("/api/activity")
def activity():
    with db() as con:
        return [dict(r) for r in con.execute(
            "SELECT a.id,a.at,a.action,a.text,a.profile_id,p.name AS profile "
            "FROM activity a LEFT JOIN profiles p ON p.id=a.profile_id "
            "WHERE ?=1 OR a.profile_id=? ORDER BY a.id DESC LIMIT 300",
            (profile_id(), profile_id()))]


# -------------------------------------------------- lyrics from the sound (AI)
class TranscribeReq(BaseModel):
    language: str = ""   # "" = let the AI detect it


@app.post("/api/tracks/{tid}/lyrics/transcribe")
def lyrics_transcribe(tid: int, req: TranscribeReq):
    """Listen to the singing and write synced lyrics (AI add-on)."""
    with db() as con:
        row = con.execute("SELECT title FROM tracks WHERE id=? AND "
                          "status='ready'", (tid,)).fetchone()
    if not row:
        raise HTTPException(404, "That song is not in the library")
    return ai_queue({"kind": "lyrics", "track_id": tid, "label": row["title"],
                     "language": req.language.strip()[:12]})


def lrc_from_lines(lines: list) -> str:
    out = []
    for ln in lines:
        t = max(0.0, float(ln["start"] or 0))
        out.append(f"[{int(t // 60):02d}:{t % 60:05.2f}] {ln['text']}")
    return "\n".join(out)


def run_lyrics(job: dict):
    with db() as con:
        row = con.execute("SELECT * FROM tracks WHERE id=?",
                          (job["track_id"],)).fetchone()
    if not row or not row["file"]:
        raise RuntimeError("That song is no longer in the library")
    res = ai_call("/transcribe", {"src": str(MUSIC / Path(row["file"]).name),
                                  "language": job.get("language") or ""}, 3600)
    lines = res.get("lines") or []
    if not lines:
        raise RuntimeError(f"No singing was found in “{row['title']}”")
    with db() as con:
        con.execute("UPDATE tracks SET lyrics=?,lyrics_state='synced',"
                    "lyrics_offset=0 WHERE id=?",
                    (lrc_from_lines(lines), row["id"]))
    notify(f"Lyrics for “{row['title']}” are written ({len(lines)} lines)")


# ------------------------------------------------------------ extend a song
class ExtendReq(BaseModel):
    track_id: int
    where: str = "end"      # "end" = longer ending, "start" = new intro
    seconds: int = 30
    style: str = ""
    lyrics: str = ""
    title: str = ""


@app.post("/api/studio/extend")
def studio_extend(req: ExtendReq):
    """Make a song longer: new music is written after its end or before its
    start, in the song's own sound."""
    row = _studio_source(req.track_id)
    where = "start" if req.where == "start" else "end"
    fields = _song_fields(req)
    if not fields["style"]:
        fields["style"] = ("an intro that leads into the song, same style and "
                           "instruments" if where == "start" else
                           "the song continues in the same style and "
                           "instruments, then comes to a natural ending")
    return ai_queue({"kind": "extend", "track_id": req.track_id,
                     "label": (req.title.strip()
                               or f"{row['title']} (Extended)")[:120],
                     "artist": row["artist"], "where": where,
                     "seconds": max(10, min(60, req.seconds)), **fields},
                    songs=True)


# ----------------------------------------------------------------- clean-up
JUNK_WORDS = re.compile(
    r"\b(official|video|audio|lyrics?|lyric video|music video|hd|hq|4k|"
    r"remaster(ed)?|visuali[sz]er|mv|clip|full)\b", re.I)


def song_key(title: str, artist: str) -> str:
    """Two downloads of the same song should get the same key."""
    t = re.sub(r"[\(\[\{].*?[\)\]\}]", " ", (title or "").lower())
    t = JUNK_WORDS.sub(" ", t)
    a = re.split(r",|&| x | feat\.?| ft\.?", (artist or "").lower())[0]
    clean = lambda s: re.sub(r"[\W_]+", "", s)
    return f"{clean(a)}|{clean(t)}" if clean(t) else ""


def file_size(name) -> int:
    try:
        return (MUSIC / Path(name).name).stat().st_size if name else 0
    except OSError:
        return 0


def unused_files() -> list[Path]:
    """Files in the music folder that no song points to (left behind by an
    interrupted download or an old version). Fresh files are left alone."""
    with db() as con:
        used = {Path(n).name for r in con.execute(
            "SELECT file,video_file FROM tracks") for n in r if n}
        used |= trash_files(con)
    now = time.time()
    return [f for f in MUSIC.iterdir() if f.is_file() and f.name not in used
            and now - f.stat().st_mtime > 3600]


@app.get("/api/cleanup")
def cleanup():
    with db() as con:
        rows = [dict(r) for r in con.execute(
            "SELECT t.id,t.title,t.artist,t.duration,t.source,t.video_id,"
            "t.status,t.error,t.kind,t.file,t.video_file,"
            "(SELECT COALESCE(SUM(plays),0) FROM profile_tracks WHERE "
            "track_id=t.id) AS plays,"
            "(SELECT COALESCE(MAX(liked),0) FROM profile_tracks WHERE "
            "track_id=t.id) AS liked,"
            "(SELECT COUNT(*) FROM playlist_tracks WHERE track_id=t.id) "
            "AS folders FROM tracks t WHERE t.id IN (SELECT track_id FROM "
            "library WHERE profile_id=?)", (profile_id(),))]
        folders = [dict(r) for r in con.execute(
            "SELECT p.id,p.name,COUNT(pt.track_id) AS count FROM playlists p "
            "LEFT JOIN playlist_tracks pt ON pt.playlist_id=p.id WHERE "
            "COALESCE(p.profile_id,1)=? GROUP BY p.id", (profile_id(),))]
        members = con.execute("SELECT playlist_id,track_id FROM "
                              "playlist_tracks").fetchall()
    size = {}
    for r in rows:
        r["audio_bytes"] = file_size(r.pop("file"))
        video = r.pop("video_file")
        r["video_bytes"] = file_size(video) if video else 0
        r["vfile"] = bool(video)
        r["bytes"] = size[r["id"]] = r["audio_bytes"] + r["video_bytes"]
    ready = [r for r in rows if r["status"] == "ready"]
    groups: dict[str, list] = {}
    for r in ready:
        key = song_key(r["title"], r["artist"])
        if key:
            groups.setdefault(key, []).append(r)
    dupes = []
    for g in groups.values():
        # the same name with a very different length is another version
        g.sort(key=lambda r: r["duration"] or 0)
        run = [g[0]]
        for r in g[1:]:
            if abs((r["duration"] or 0) - (run[-1]["duration"] or 0)) <= 6:
                run.append(r)
            else:
                if len(run) > 1:
                    dupes.append(run)
                run = [r]
        if len(run) > 1:
            dupes.append(run)
    for g in dupes:  # the best copy first: with video, then biggest, then most played
        g.sort(key=lambda r: (-r["vfile"], -r["audio_bytes"], -r["plays"], r["id"]))
    dupes.sort(key=lambda g: -sum(r["bytes"] for r in g[1:]))
    per_folder = {f["id"]: 0 for f in folders}
    for m in members:
        if m["playlist_id"] in per_folder:
            per_folder[m["playlist_id"]] += size.get(m["track_id"], 0)
    for f in folders:
        f["bytes"] = per_folder[f["id"]]
    unused = unused_files()
    return {
        "duplicates": dupes,
        "failed": [r for r in rows if r["status"] == "error"],
        "big": sorted(ready, key=lambda r: -r["bytes"])[:15],
        "folders": sorted(folders, key=lambda f: -f["bytes"]),
        "usage": {"songs": len(ready),
                  "audio": sum(r["audio_bytes"] for r in rows),
                  "video": sum(r["video_bytes"] for r in rows),
                  "unused": sum(f.stat().st_size for f in unused),
                  "unused_files": len(unused)},
    }


class MergeReq(BaseModel):
    keep: int
    remove: list[int]


@app.post("/api/cleanup/merge")
def cleanup_merge(req: MergeReq):
    """Delete duplicate copies of a song. The copy that stays takes over
    their folders, likes and play counts, so nothing is lost."""
    gone = [i for i in req.remove if i != req.keep]
    with db() as con:
        if not con.execute("SELECT 1 FROM tracks WHERE id=?",
                           (req.keep,)).fetchone():
            raise HTTPException(404, "The song to keep is gone")
        for tid in gone:
            for m in con.execute("SELECT playlist_id,position FROM "
                                 "playlist_tracks WHERE track_id=?",
                                 (tid,)).fetchall():
                con.execute("INSERT OR IGNORE INTO playlist_tracks VALUES(?,?,?)",
                            (m["playlist_id"], req.keep, m["position"]))
            for p in con.execute("SELECT * FROM profile_tracks WHERE "
                                 "track_id=?", (tid,)).fetchall():
                con.execute(
                    "INSERT INTO profile_tracks VALUES(?,?,?,?,?) ON CONFLICT"
                    "(profile_id,track_id) DO UPDATE SET liked=MAX(liked,"
                    "excluded.liked),plays=plays+excluded.plays,last_played="
                    "MAX(COALESCE(last_played,0),COALESCE(excluded.last_played,0))",
                    (p["profile_id"], req.keep, p["liked"], p["plays"],
                     p["last_played"]))
    done = 0
    for tid in gone:
        try:
            delete_track(tid)
            done += 1
        except HTTPException:
            pass
    return {"deleted": done}


@app.post("/api/cleanup/unused")
def cleanup_unused():
    """Delete files in the music folder that no song uses any more."""
    if jobs.unfinished_tasks:
        raise HTTPException(409, "Wait until the downloads have finished")
    freed = n = 0
    for f in unused_files():
        try:
            freed += f.stat().st_size
            f.unlink()
            n += 1
        except OSError:
            pass
    return {"files": n, "bytes": freed}


# ----------------------------------------------------------- remote control
# Every open player keeps a small live connection to the server and says
# what it is playing. Any of them can then send a command (play, pause,
# next, volume...) to another one, like a remote control.
_devices: dict[str, dict] = {}


async def tell_devices():
    listing = {"type": "devices", "devices": [
        {"id": k, "name": d["name"], "state": d["state"]}
        for k, d in _devices.items()]}
    for d in list(_devices.values()):
        try:
            await d["ws"].send_json(listing)
        except Exception:
            pass


@app.websocket("/ws")
async def device_socket(sock: WebSocket):
    # same sign-in as the rest, and only from the player's own page
    origin = urllib.parse.urlparse(sock.headers.get("origin") or "").netloc
    if not is_authed(sock.scope) or (origin and origin != sock.headers.get("host")):
        return await sock.close(code=4401)
    await sock.accept()
    me = None
    try:
        while True:
            m = await sock.receive_json()
            kind = m.get("type")
            if kind == "hello" and m.get("id"):
                me = str(m["id"])[:40]
                _devices[me] = {"ws": sock, "name": str(m.get("name") or
                                                        "Device")[:60],
                                "state": None}
                await tell_devices()
            elif not me:
                continue
            elif kind == "name":
                _devices[me]["name"] = str(m.get("name") or "Device")[:60]
                await tell_devices()
            elif kind == "state":
                state = m.get("state")
                if state is None or len(json.dumps(state)) < 4000:
                    _devices[me]["state"] = state
                    await tell_devices()
            elif kind == "cmd":
                target = _devices.get(str(m.get("to")))
                if target:
                    await target["ws"].send_json({
                        "type": "cmd", "from": me, "cmd": m.get("cmd"),
                        "value": m.get("value")})
    except Exception:
        pass  # the page was closed or the connection dropped
    finally:
        if me and _devices.get(me, {}).get("ws") is sock:
            del _devices[me]
            await tell_devices()


STATIC = Path(__file__).parent / "static"


class FreshStatic(StaticFiles):
    """Make browsers check for a newer file every time instead of quietly
    running an old copy of the page after an update."""

    async def get_response(self, path, scope):
        resp = await super().get_response(path, scope)
        resp.headers["Cache-Control"] = "no-cache"
        return resp


@app.get("/")
def index():
    ver = int(max((STATIC / n).stat().st_mtime for n in ("app.js", "style.css")))
    html = (STATIC / "index.html").read_text("utf-8")
    html = html.replace('"style.css"', f'"style.css?v={ver}"').replace(
        '"app.js"', f'"app.js?v={ver}"')
    return HTMLResponse(html, headers={"Cache-Control": "no-cache"})


app.mount("/", FreshStatic(directory=STATIC, html=True), name="static")
