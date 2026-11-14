# Song engine for the Remix studio: ACE-Step 1.5 (full songs with vocals from
# a style and lyrics, covers, replacing a section). Needs an NVIDIA card.
# Started with the rest of the AI add-on:
#   docker compose --profile ai up -d --build
FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ffmpeg build-essential \
 && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /srv
RUN git clone --depth 1 https://github.com/ACE-Step/ACE-Step-1.5.git .
RUN uv sync

# Settings for a 6 GB card: the 2B "turbo" model alone (no language model),
# parked in normal memory between jobs. Models (about 10 GB) are downloaded
# on first start into /data/ai_models so they survive rebuilds.
ENV ACESTEP_API_HOST=0.0.0.0 ACESTEP_API_PORT=8001 \
    ACESTEP_CONFIG_PATH=acestep-v15-turbo ACESTEP_INIT_LLM=false \
    ACESTEP_OFFLOAD_TO_CPU=true \
    ACESTEP_CHECKPOINTS_DIR=/data/ai_models/acestep \
    HF_HOME=/data/ai_models/hf PYTHONUNBUFFERED=1

EXPOSE 8001
CMD ["sh", "-c", "uv run --no-sync acestep-download; exec uv run --no-sync acestep-api"]
