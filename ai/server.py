"""Sonara - AI add-on.

A small service the player calls for the two jobs that need a graphics card:

  /separate  split a song into vocals and instrumental (Demucs)
  /generate  make a short piece of music from a text description (MusicGen)
  /transcribe  write down the sung words with their times (Whisper)

Only one model is kept in memory at a time, so it fits a 6 GB card. Files are
exchanged through the /data folder that both containers mount."""
import gc
import os
import subprocess
import threading
import wave

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Sonara AI")
DEV = "cuda" if torch.cuda.is_available() else "cpu"
MUSICGEN = os.environ.get("MUSICGEN_MODEL", "facebook/musicgen-small")
DATA = os.path.realpath(os.environ.get("DATA_DIR", "/data"))
_lock = threading.Lock()          # one job at a time
_loaded = {"name": None, "obj": None}


def use(name: str, loader):
    """Return the named model, unloading whichever other one was in memory."""
    if _loaded["name"] != name:
        _loaded.update(name=None, obj=None)
        gc.collect()
        if DEV == "cuda":
            torch.cuda.empty_cache()
        _loaded.update(name=name, obj=loader())
    return _loaded["obj"]


def inside_data(path: str) -> str:
    real = os.path.realpath(path)
    if not real.startswith(DATA + os.sep):
        raise HTTPException(400, "Path is outside the data folder")
    return real


def read_audio(path: str, rate: int, channels: int) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-vn", "-f", "f32le",
         "-ac", str(channels), "-ar", str(rate), "-"],
        capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, channels).T.copy()


def write_wav(path: str, audio: np.ndarray, rate: int):
    """audio: (channels, samples) floats in -1..1"""
    peak = float(np.abs(audio).max()) or 1.0
    if peak > 1:
        audio = audio / peak
    pcm = (audio.T * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(audio.shape[0])
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())


def vram_peak() -> int:
    return int(torch.cuda.max_memory_allocated() / 2**20) if DEV == "cuda" else 0


@app.get("/health")
def health():
    info = {"ok": True, "device": DEV, "model": MUSICGEN}
    if DEV == "cuda":
        info["gpu"] = torch.cuda.get_device_name(0)
        info["vram_mb"] = int(torch.cuda.get_device_properties(0).total_memory
                              / 2**20)
    return info


@app.post("/unload")
def unload():
    """Give the graphics memory back (the song engine needs it on a 6 GB card)."""
    with _lock:
        _loaded.update(name=None, obj=None)
        gc.collect()
        if DEV == "cuda":
            torch.cuda.empty_cache()
    return {"ok": True}


class SplitReq(BaseModel):
    src: str       # audio file inside /data
    out_dir: str   # folder inside /data for vocals.wav and instrumental.wav


def split_song(src: str):
    """Return (vocals, everything else, sample rate) as numpy (2, samples)."""
    from demucs.apply import apply_model
    from demucs.pretrained import get_model
    model = use("demucs", lambda: get_model("htdemucs").to(DEV).eval())
    wav = torch.from_numpy(read_audio(src, model.samplerate, 2))
    ref = wav.mean(0)
    mean, std = ref.mean(), ref.std() + 1e-8
    with torch.no_grad():
        # split=True works through the song in chunks, keeping memory low
        out = apply_model(model, ((wav - mean) / std)[None], device=DEV,
                          split=True, overlap=0.25, progress=False)[0]
    out = out * std + mean
    names = list(model.sources)
    vocals = out[names.index("vocals")]
    rest = sum(out[i] for i, n in enumerate(names) if n != "vocals")
    return vocals.numpy(), rest.numpy(), model.samplerate


@app.post("/separate")
def separate(req: SplitReq):
    src, out_dir = inside_data(req.src), inside_data(req.out_dir)
    os.makedirs(out_dir, exist_ok=True)
    with _lock:
        if DEV == "cuda":
            torch.cuda.reset_peak_memory_stats()
        vocals, rest, rate = split_song(src)
        paths = {"vocals": os.path.join(out_dir, "vocals.wav"),
                 "instrumental": os.path.join(out_dir, "instrumental.wav")}
        write_wav(paths["vocals"], vocals, rate)
        write_wav(paths["instrumental"], rest, rate)
        return {**paths, "peak_vram_mb": vram_peak()}


# ---------------------------------------------------------------- mashup
# The music of one song with the vocals of others on top. The vocals are
# stretched to the music's tempo, moved into its key and lined up on its beat.
_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66,
                   2.29, 2.88])
_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69,
                   3.34, 3.17])


def analyse(path: str) -> dict:
    """Tempo, time of the first beat and key of a song."""
    import librosa
    y = read_audio(path, 22050, 1)[0]
    tempo, beats = librosa.beat.beat_track(y=y, sr=22050)
    times = librosa.frames_to_time(beats, sr=22050)
    chroma = librosa.feature.chroma_stft(y=y, sr=22050).mean(axis=1)
    _, tonic, minor = max(
        (float(np.corrcoef(np.roll(profile, k), chroma)[0, 1]), k, minor)
        for k in range(12) for minor, profile in ((False, _MAJOR),
                                                  (True, _MINOR)))
    return {"bpm": float(np.atleast_1d(tempo)[0]) or 120.0,
            "first": float(times[0]) if len(times) else 0.0,
            # a minor key is treated as its relative major: same notes
            "key": (tonic + 3) % 12 if minor else tonic}


def stretch(audio: np.ndarray, rate: int, tempo: float, semitones: int,
            tmp: str) -> np.ndarray:
    """Change speed and pitch independently (vocals keep their character)."""
    if abs(tempo - 1) < 0.005 and not semitones:
        return audio
    src = os.path.join(tmp, "stretch_in.wav")
    write_wav(src, audio, rate)
    pitch = 2 ** (semitones / 12)
    for af in (f"rubberband=tempo={tempo:.5f}:pitch={pitch:.5f}:"
               "formant=preserved",
               f"asetrate={rate * pitch:.0f},aresample={rate},"
               f"atempo={tempo / pitch:.5f}"):   # fallback without rubberband
        r = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-af", af,
                            "-f", "f32le", "-ac", "2", "-ar", str(rate), "-"],
                           capture_output=True)
        if r.returncode == 0 and r.stdout:
            return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2).T
    raise HTTPException(500, "Could not time-stretch the vocals")


class MashupReq(BaseModel):
    base: str            # its music is kept
    vocals: list[str]    # their vocals go on top, one after another
    out: str


@app.post("/mashup")
def mashup(req: MashupReq):
    base = inside_data(req.base)
    others = [inside_data(p) for p in req.vocals]
    out = inside_data(req.out)
    if not others:
        raise HTTPException(400, "Pick at least two songs")
    tmp = os.path.dirname(out)
    os.makedirs(tmp, exist_ok=True)
    with _lock:
        if DEV == "cuda":
            torch.cuda.reset_peak_memory_stats()
        _, music, rate = split_song(base)
        a0 = analyse(base)
        n = music.shape[1]
        voice = np.zeros((2, n), dtype=np.float32)
        fade = int(rate * 0.05)
        info = []
        for i, path in enumerate(others):
            v, _, _ = split_song(path)
            a = analyse(path)
            tempo = a0["bpm"] / a["bpm"]
            while tempo > 1.42:      # 70 vs 140 bpm is the same beat
                tempo /= 2
            while tempo < 0.71:
                tempo *= 2
            semis = (a0["key"] - a["key"] + 6) % 12 - 6
            v = stretch(v, rate, tempo, semis, tmp)
            # line the vocal's beat grid up with the music's
            delay = (a0["first"] - a["first"] / tempo) % (60 / a0["bpm"])
            v = np.pad(v, ((0, 0), (int(delay * rate), 0)))
            # each vocal gets its own stretch of the song
            start, end = n * i // len(others), n * (i + 1) // len(others)
            seg = v[:, start:end].copy()
            if seg.shape[1] > 2 * fade:
                ramp = np.linspace(0, 1, fade, dtype=np.float32)
                seg[:, :fade] *= ramp
                seg[:, -fade:] *= ramp[::-1]
            voice[:, start:start + seg.shape[1]] = seg
            info.append({"tempo": round(tempo, 3), "semitones": int(semis),
                         "bpm": round(a["bpm"], 1)})
        loud = np.abs(voice) > 1e-3
        v_rms = float(np.sqrt((voice[loud] ** 2).mean())) if loud.any() else 0
        m_rms = float(np.sqrt((music ** 2).mean())) or 1e-6
        gain = min(2.5, max(0.6, 1.1 * m_rms / v_rms)) if v_rms else 1.0
        write_wav(out, 0.85 * music + gain * voice, rate)
        return {"out": out, "base_bpm": round(a0["bpm"], 1), "vocals": info,
                "peak_vram_mb": vram_peak()}


class GenReq(BaseModel):
    prompt: str
    seconds: int = 20
    out: str       # .wav path inside /data


@app.post("/generate")
def generate(req: GenReq):
    out = inside_data(req.out)
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(400, "Describe the music first")
    seconds = max(5, min(30, req.seconds))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with _lock:
        from transformers import AutoProcessor, MusicgenForConditionalGeneration
        if DEV == "cuda":
            torch.cuda.reset_peak_memory_stats()

        def load():
            return (AutoProcessor.from_pretrained(MUSICGEN),
                    MusicgenForConditionalGeneration.from_pretrained(MUSICGEN)
                    .to(DEV).eval())

        proc, model = use("musicgen", load)
        inputs = proc(text=[prompt], padding=True, return_tensors="pt").to(DEV)
        with torch.no_grad():
            audio = model.generate(**inputs, do_sample=True, guidance_scale=3.0,
                                   max_new_tokens=int(seconds * 50))
        rate = model.config.audio_encoder.sampling_rate
        write_wav(out, audio[0].float().cpu().numpy(), rate)
        return {"out": out, "seconds": seconds, "peak_vram_mb": vram_peak()}


# ------------------------------------------------------ lyrics from the sound
# The singing is separated from the music first, then a speech model writes
# down the words with the time each line starts.
WHISPER = os.environ.get("WHISPER_MODEL", "openai/whisper-large-v3-turbo")
JUNK_LINE = ("subtitles by", "subscribe", "thanks for watching", "amara.org",
             "ترجمة", "اشترك", "altyazı", "www.")


def load_whisper():
    from transformers import pipeline
    return pipeline("automatic-speech-recognition", model=WHISPER,
                    torch_dtype=torch.float16 if DEV == "cuda" else torch.float32,
                    device=0 if DEV == "cuda" else -1)


class LyricsReq(BaseModel):
    src: str             # audio file inside /data
    language: str = ""   # "" = detect


@app.post("/transcribe")
def transcribe(req: LyricsReq):
    import librosa
    src = inside_data(req.src)
    with _lock:
        if DEV == "cuda":
            torch.cuda.reset_peak_memory_stats()
        vocals, _, rate = split_song(src)
        voice = librosa.resample(vocals.mean(0), orig_sr=rate, target_sr=16000)
        pipe = use("whisper", load_whisper)
        opts = {"task": "transcribe"}
        if req.language:
            opts["language"] = req.language
        audio = {"raw": voice, "sampling_rate": 16000}
        try:    # a time for every word, so the lines can be cut where the singer pauses
            res = pipe(dict(audio), chunk_length_s=30, return_timestamps="word",
                       generate_kwargs=opts)
            segs = group_words(res.get("chunks") or [])
        except Exception:
            res = pipe(dict(audio), chunk_length_s=30, return_timestamps=True,
                       generate_kwargs=opts)
            segs = [((c.get("timestamp") or (None, None))[0],
                     (c.get("timestamp") or (None, None))[1],
                     (c.get("text") or "").strip())
                    for c in res.get("chunks") or []]
        lines, last, repeats = [], "", 0
        for start, end, text in segs:
            if not text or start is None:
                continue
            end = end if end is not None else start + 4
            part = voice[int(start * 16000):int(end * 16000)]
            # a speech model invents words over silence: skip quiet stretches,
            # its usual inventions, and a line said over and over
            if part.size == 0 or float(np.sqrt(np.mean(part ** 2))) < 0.012:
                continue
            low = text.lower()
            repeats = repeats + 1 if low == last else 0
            if any(j in low for j in JUNK_LINE) or repeats >= 2:
                continue
            last = low
            lines.append({"start": round(float(start), 2),
                          "end": round(float(end), 2), "text": text})
        return {"lines": lines, "peak_vram_mb": vram_peak()}


def group_words(words: list) -> list:
    """Words with their times -> lines: a new line after a pause, or when
    the line is getting long."""
    out, cur = [], []
    for w in words:
        text = (w.get("text") or "").strip()
        start, end = w.get("timestamp") or (None, None)
        if not text or start is None:
            continue
        end = end if end is not None else start + 0.4
        if cur and (start - cur[-1][1] > 0.65 or len(cur) >= 9
                    or end - cur[0][0] > 7):
            out.append((cur[0][0], cur[-1][1], " ".join(x[2] for x in cur)))
            cur = []
        cur.append((start, end, text))
    if cur:
        out.append((cur[0][0], cur[-1][1], " ".join(x[2] for x in cur)))
    return out

