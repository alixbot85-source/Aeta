FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git ripgrep python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/filesystem/package.json packages/filesystem/package.json
COPY packages/terminal/package.json packages/terminal/package.json
COPY packages/git/package.json packages/git/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/agent/package.json packages/agent/package.json
RUN npm install
COPY . .
EXPOSE 4000
CMD ["sh", "-lc", "npm run prisma:migrate && npm run start -w @aeta/api"]
