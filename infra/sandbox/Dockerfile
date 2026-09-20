FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ripgrep python3 python3-pip curl ca-certificates build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /data/workspaces
RUN useradd -m sandbox
USER sandbox
