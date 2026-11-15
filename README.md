# Sonara

Self-hosted web music player for your LAN. Works on desktop and phones.

## Features

- **One library for everything**: YouTube, Spotify and your own files sit
  side by side, each with a small badge (YT, SP, LOCAL). Filter chips narrow
  Home and any list to one source or to videos only.
- **Colours from the cover**: the whole player takes its colours and a
  blurred backdrop from the song that is playing (switch off in Settings →
  Appearance).
- **One search**: the search box looks in your library, on YouTube and on
  Spotify at the same time. Searching Spotify needs the free API keys from
  Settings → Accounts; pasting a Spotify link works without them.
- **Watched folder**: music or video files copied into `./import` join the
  library within a minute. A sub-folder becomes a folder in the player. The
  files are linked or copied, never moved or deleted.
- **Remix**: change speed, bass, reverb and 8D live and save the result as a
  new song. With the AI add-on: split vocals from music, make a **mashup**
  (the music of one song with the vocals of up to three others, matched in
  tempo and key), or create a short instrumental from a description.
- **Live effects and louder volume**: the effects button on the player bar
  (and the row under the cover) switches Slowed, Sped up, Reverb, Bass and
  8D on the playing song at once. The volume slider goes up to 200%.
- **Phone**: bottom tabs, a floating mini player, swipe it up for the full
  player, sideways to change song, and swipe the full player down to close.

- **YouTube**: search, single videos, playlists, YouTube Music links.
- **Spotify**: track / album / playlist links. Spotify audio is DRM-protected
  and cannot be downloaded, so the app reads the track list from Spotify and
  fetches the best-matching audio from YouTube.
- **Listen before downloading**: tap any search result to stream it straight
  from YouTube without saving it. If you like it, press ⬇ (in the result row,
  the player bar or the Now Playing screen) to download it to your library.
- **Audio or video**: for YouTube the player asks whether you want audio only
  or video + audio (the default can be fixed in Settings). A video download
  saves both files under one library entry, and the Audio / Video switch above
  the cover changes between them without losing your place. Videos download at
  up to 720p. Streaming a video before downloading uses YouTube's single-file
  format, which is usually 360p. Uploaded video files (mp4, webm, mkv, mov)
  play as video too.
- **Your own lyrics**: press Upload in the lyrics panel to use a `.lrc` or
  `.txt` file from your device; the − / + buttons shift lyrics that run early
  or late, remembered per song.
- **Right-click** any track for its menu (play, queue, like, folder, delete…).
- **Visualizer**: audio tracks show a sound effect in Now Playing — bars, a
  ring around the cover, or a wave (pick in Settings).
- **Liked, Recently played, Most played**: heart any track; history is kept
  automatically.
- **Queue panel**: see what is coming up, drag to reorder, remove items.
- **Password lock**: set a password in Settings → Security (or with the
  `APP_PASSWORD` environment variable) so the library needs a login.
- **Graphic equaliser**: 10 bands with a draggable response curve and presets
  (Rock, Pop, Bass boost, Vocal boost…).
- **Upload from your device**: the Upload button (or drag and drop) adds your
  own audio files (mp3, m4a, flac, wav, ogg, opus…). Tags and embedded cover
  art are read automatically.
- **Folders**: create folders, add any track to them from the ⋯ menu, upload
  straight into a folder. Imported playlists show up here too. Drag a folder
  (in the sidebar or on the Folders page) to put the folders in any order.
  When several songs are downloaded at once (a playlist link, a Spotify
  album, or a selection of search results) the player asks whether they go
  into a new folder, one you already have, or no folder.
- **Lyrics**: fetched from LRCLIB, shown in the Now Playing screen. Synced
  lyrics highlight and scroll with the song; tap a line to jump to it. Lyrics
  can be saved as `.lrc`.
- **Settings**: theme, accent colour, animated background, compact rows,
  playback speed, 3-band equaliser, sleep timer, download
  format, automatic lyrics, Spotify credentials, library stats.

## Install

The player runs in Docker, so the steps are almost the same everywhere:
get the folder, then `docker compose up -d --build`.

While the repository is private, `git clone` asks you to sign in: enter your
GitHub user name and, as the password, a personal access token (GitHub →
Settings → Developer settings → Personal access tokens).

Your songs, covers and the library database live in `./data` next to
`docker-compose.yml`. That folder is never uploaded to GitHub; copy it
yourself if you move to another machine and want to keep your library.

### Ubuntu server

```bash
# 1. Docker (skip if already installed)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker

# 2. Get the project
git clone https://github.com/DevQasem/sonara.git sonara
cd sonara

# 3. Optional: set a password before the first start
cp .env.example .env && nano .env

# 4. Start it
docker compose up -d --build
```

Open `http://<server-ip>:8337` from any device on your network
(`hostname -I` shows the server's address). If the `ufw` firewall is on:
`sudo ufw allow 8337/tcp`.

Update later with `git pull && docker compose up -d --build`.
For the AI tools on an NVIDIA card see [AI add-on](#ai-add-on-optional).

### CasaOS

CasaOS runs on Docker, so the player is installed from the CasaOS terminal
and then shows up on the dashboard.

1. Open the terminal: the terminal icon at the top of the CasaOS dashboard
   (or SSH into the machine) and log in.
2. Run:

   ```bash
   sudo mkdir -p /DATA/AppData && cd /DATA/AppData
   sudo git clone https://github.com/DevQasem/sonara.git sonara
   cd sonara
   sudo docker compose up -d --build
   ```

3. Open `http://<casaos-ip>:8337`. The container `sonara` also
   appears among the apps on the dashboard; if it is marked as an app CasaOS
   did not install, use its menu to import it, then set the Web UI port to
   `8337` in its settings so the tile opens the player.

Your library is in `/DATA/AppData/sonara/data`, which is also visible
in the CasaOS Files app.

### Windows

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
   and [Git for Windows](https://git-scm.com/download/win), then start
   Docker Desktop and wait until it says it is running.
2. In PowerShell:

   ```powershell
   git clone https://github.com/DevQasem/sonara.git sonara
   cd sonara
   docker compose up -d --build
   ```

3. Open <http://localhost:8337>. Other devices on your network use
   `http://<this-pc-ip>:8337` (allow it when Windows Firewall asks).

The player starts again by itself whenever Docker Desktop starts.

## Security

- **Set a password.** Out of the box anyone on your network can open the
  library. Put `APP_PASSWORD=...` in `.env`, or set one in Settings →
  Accounts & security.
- **Do not forward port 8337 on your router.** The app talks plain HTTP and
  is meant for your home network. To use it away from home, connect through
  a VPN such as Tailscale or WireGuard, or put it behind a reverse proxy
  with HTTPS.
- **Secrets stay out of the repository.** `data/` (songs, database, saved
  password hash, Spotify keys) and `.env` are listed in `.gitignore` and are
  never committed. Nothing in the code contains a key or password.
- The AI add-on has no port open to the network; only the player container
  can reach it.

## Environment (`docker-compose.yml`)

| Variable | Purpose |
| --- | --- |
| `YTDLP_AUTO_UPDATE=1` | Upgrade yt-dlp on container start. If YouTube downloads start failing, `docker compose restart` usually fixes it. |
| `DOWNLOAD_WORKERS` | Parallel downloads (default 2). |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Optional, can also be set in the Settings page. Without them, Spotify playlists are limited to the first ~100 tracks. |

## Notes

- The password lock is a simple single-password gate over plain HTTP. It keeps
  other people on your network out, but it is not strong enough to expose the
  app to the internet; use a reverse proxy with HTTPS for that.
- Appearance and playback settings are stored per browser; download and
  Spotify settings are stored on the server.
- Deleting a track removes its audio file; deleting a folder keeps the tracks.
- For personal use with content you have the right to download.

## AI add-on (optional)

The Remix tab can also split a song into **vocals and instrumental** (Demucs)
and **create short instrumental music from a text description** (MusicGen).
Both run in a second container, `ai`, which needs an NVIDIA graphics card.
A 6 GB card (for example an RTX 2060) is enough: only one model is kept in
memory at a time. Without the add-on the player works as before and the
Remix tab says the AI tools are not running.

```bash
docker compose --profile ai up -d --build   # player + AI add-on
docker compose up -d --build                # player only
```

The first build downloads PyTorch (several GB). The models themselves
(about 1.5 GB) are downloaded the first time each tool is used and kept in
`./data/ai_models`.

### Ubuntu server with an NVIDIA card

1. Install the NVIDIA driver and reboot; `nvidia-smi` should list the card.

   ```bash
   sudo ubuntu-drivers install
   sudo reboot
   ```

2. Install Docker, then the NVIDIA Container Toolkit so containers can use
   the card:

   ```bash
   curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
     | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
   curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
     | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
     | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
   sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
   sudo nvidia-ctk runtime configure --runtime=docker
   sudo systemctl restart docker
   ```

3. Copy this whole folder to the server (include `data/` to keep your
   library) and start it:

   ```bash
   docker compose --profile ai up -d --build
   ```

`MUSICGEN_MODEL` in `docker-compose.yml` picks the music model. The default,
`facebook/musicgen-small`, fits 6 GB; `facebook/musicgen-medium` sounds
better but needs a larger card.

### Song engine (Remix → Create)

The same `--profile ai` command also starts a third container, `songs`,
running [ACE-Step 1.5](https://github.com/ACE-Step/ACE-Step-1.5). It makes
**full songs with singing** from a style description and your lyrics, **covers**
of songs in your library, and **re-makes one part** of a song. It is set up
for a 6 GB card (the 2B "turbo" model without the language model, parked in
normal memory between jobs).

The first build clones ACE-Step and installs its dependencies (several GB);
the first start downloads about 10 GB of models into `./data/ai_models`.
Without it, the rest of the studio (effects, split, mashup, quick beat)
still works and the Create tab says the song engine is not running.
