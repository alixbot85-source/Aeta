# Aeta

Aeta is a browser-based **Web IDE + DeepSeek-powered AI coding agent**. It is designed as a real, extensible product foundation: workspaces are real directories, file operations hit the server filesystem, the terminal runs real commands inside the workspace boundary, Git commands call real Git, and AI requests go only through the backend to the DeepSeek API.

> **AI rule:** Aeta is intentionally **100% DeepSeek**. There are no OpenAI, Anthropic, Google/Gemini, Ollama, OpenRouter, or fallback providers in this codebase.

## Technology Stack

- **Monorepo:** npm workspaces
- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand, Monaco Editor
- **Backend:** Node.js 22, Express, TypeScript, REST + WebSocket
- **Database:** PostgreSQL 16 with checked-in SQL migrations and Prisma schema as the data model specification
- **Cache/Queue:** Redis service in Docker Compose, ready for background queue expansion
- **AI:** DeepSeek Chat Completions API via a first-party `DeepSeekClient` implemented with `fetch`
- **Terminal/Sandbox:** server-side command runner with workspace path confinement, timeout, CPU/memory `ulimit`, stdin/stdout/stderr streaming, and Docker sandbox service in compose
- **Git:** real `git` CLI integration
- **Tests:** Vitest

## Project Structure

```text
apps/
  web/                     Next.js browser IDE
  api/                     Express API, WebSocket terminal, DB migration runner

packages/
  shared/                  API errors, permissions, validation helpers, redaction
  filesystem/              safe path resolver, workspace FS, search, templates
  terminal/                command sandbox and streaming command sessions
  git/                     Git service built on the command sandbox
  ai/
    src/deepseek/          DeepSeek client, models, streaming parser, errors, types
    src/context/           context engine and relevant-file selection
  agent/                   DeepSeek agent runner, tools, diff/pending-change flow

infra/
  docker/                  API/Web Dockerfiles
  database/                database notes
  sandbox/                 isolated sandbox image

apps/api/prisma/           Prisma schema + SQL migrations
```

## Implemented Features

### Architecture + Database + Authentication

- Register/login/logout/me endpoints
- Password hashing with bcrypt; no plaintext password storage
- Email verification and password reset token tables/flows
- Session model and JWT-backed server session validation
- PostgreSQL schema/migration with these models: `User`, `Workspace`, `Project`, `File`, `Folder`, `Session`, `Conversation`, `Message`, `AgentTask`, `AgentToolCall`, `TerminalSession`, `GitRepository`, `ApiKey`, `Subscription`, `AuditLog`, plus `WorkspaceMember`, `PendingChange`, `ChangeHistory`, `AIUsageLog`
- Server-side permission checks by workspace role
- Standard error response:

```json
{
  "success": false,
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "The requested file does not exist."
  }
}
```

### Workspace + File System + Monaco Editor

- Real workspace directories under `WORKSPACES_ROOT`
- Create/list/update/delete workspaces
- Templates: Next.js, React, Vue, Vite, Node.js, Python, FastAPI, Express, HTML/CSS/JS
- File explorer with real create/read/write/delete/rename/move/copy/folder operations
- Drag-and-drop file move in explorer
- Monaco editor with tabs, syntax highlighting, minimap, folding, multi-cursor, find/replace, word wrap, format-on-type/paste, save shortcut, autosave
- Language mapping for JavaScript, TypeScript, JSX/TSX, HTML, CSS, JSON, Python, Java, C, C++, Go, Rust, PHP, SQL, Markdown, YAML, Shell
- Change history records for writes/deletes/replaces/agent changes

### Search + Replace

- Backend search uses `ripgrep` when available with a Node fallback
- Search in files, regex, case-sensitive, whole-word, include/exclude globs
- Replace all with dry-run support

### Terminal + Project Execution Foundation

- WebSocket terminal endpoint `/ws/terminal`
- Real command execution with stdin/stdout/stderr streaming and Ctrl+C signaling
- REST terminal command route
- Per-command timeout, output cap, CPU and memory `ulimit`
- Workspace path confinement
- Docker Compose includes an isolated `sandbox` service with `network_mode: none`, CPU and memory limits

### DeepSeek AI Chat

- Backend-only DeepSeek requests; API key never goes to the browser
- Central DeepSeek config:
  - `DEEPSEEK_API_KEY`
  - `DEEPSEEK_MODEL`
  - `DEEPSEEK_BASE_URL`
- Default model: `deepseek-flash`, based on the official DeepSeek API docs available on 2026-09-20
- Streaming parser for DeepSeek SSE responses
- AI usage logging fields: `request_id`, `user_id`, `workspace_id`, `model`, tokens, duration, status
- AI settings UI shows only DeepSeek provider/configuration

### Context Engine

The backend context engine selects only relevant context instead of sending the entire project:

- current file
- selected code
- open files
- imports from relevant files
- project tree
- package/config files
- terminal output
- git diff
- error messages
- keyword-ranked related files
- token/character budget and truncation

If context is insufficient, the system prompt instructs DeepSeek to return `INFORMATION_REQUIRED` rather than inventing details.

### DeepSeek Agent + Tool System + Diff Review

- DeepSeek agent runner uses official DeepSeek tool-calling format through the central `DeepSeekClient`
- Tools implemented:
  - `list_files`
  - `read_file`
  - `search_files`
  - `create_file`
  - `edit_file`
  - `delete_file`
  - `create_directory`
  - `rename_file`
  - `move_file`
  - `run_command`
  - `install_package`
  - `get_terminal_output`
  - `git_status`
  - `git_diff`
  - `git_commit`
  - `start_server`
  - `stop_server`
- Tool schemas are sent to DeepSeek; server still validates and enforces permissions
- File-changing AI tools create pending diffs; they do **not** silently write files
- User review supports Accept, Reject, Accept All, Reject All

### Git

- Init repository
- Status
- Diff/staged diff
- Stage/unstage
- Commit
- Branch list
- Checkout
- Pull/push
- Log
- Clone support in service layer

### UI/Layout

- Dark-first responsive IDE layout
- Top bar
- resizable explorer/sidebar
- resizable AI panel
- resizable bottom panel
- collapsible Explorer, AI Panel, Terminal/Bottom panel
- Monaco code editor area
- Terminal / Problems / Output / Git tabs
- Settings drawer sections: General, Editor, Appearance, Keyboard Shortcuts, AI, Models, API Keys, Terminal, Git, Security, Account, Billing

## Environment Variables

Create `.env` from `.env.example` and set real values on the server only.

```env
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
NODE_ENV=development
API_PORT=4000
WEB_PORT=3000
PUBLIC_WEB_URL=http://localhost:3000
API_CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://aeta:aeta@localhost:5432/aeta?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-with-a-long-random-value
ENCRYPTION_KEY=replace-with-32-byte-base64-or-hex-key
WORKSPACES_ROOT=.workspaces
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

Security notes:

- `DEEPSEEK_API_KEY` must be set only in the backend/server runtime.
- It is never sent to the frontend.
- It is never printed in logs; redaction helpers remove tokens and key-like values.
- There is no fallback to another AI provider.

## Installation

```bash
npm install
cp .env.example .env
# edit .env with real DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, and DEEPSEEK_API_KEY
```

## Database Setup

Using Docker Compose is the easiest path:

```bash
docker compose up postgres redis -d
npm run prisma:migrate -w @aeta/api
```

The migration runner applies SQL files from `apps/api/prisma/migrations`. The Prisma schema is kept as the documented model source of truth, while the runtime uses a lightweight PostgreSQL mapper to avoid committing generated Prisma client artifacts.

## Docker Setup

```bash
cp .env.example .env
# set DEEPSEEK_API_KEY, JWT_SECRET, ENCRYPTION_KEY

docker compose up --build
```

Services:

- Web: <http://localhost:3000>
- API: <http://localhost:4000>
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- Sandbox: isolated helper container with workspace volume

## GitHub Pages Deployment

Aeta includes a GitHub Actions workflow template at `infra/github/pages-workflow.example.yml`. Copy it to `.github/workflows/github-pages.yml` from an account/token with GitHub `workflows` permission to publish the static web client to the repository GitHub Pages URL:

```text
https://alixbot85-source.github.io/Aeta/
```

Important: GitHub Pages can host only the static Next.js web client. It cannot run PostgreSQL, Redis, terminal sessions, workspace filesystem operations, WebSocket terminal streaming, or the DeepSeek-backed API. For a usable hosted IDE, deploy `apps/api` with Docker or another server runtime and configure these repository variables before the Pages workflow runs:

```text
NEXT_PUBLIC_API_URL=https://your-api-domain.example
NEXT_PUBLIC_WS_URL=wss://your-api-domain.example
```

The DeepSeek key still belongs only on the API server as `DEEPSEEK_API_KEY`; never configure it as a GitHub Pages or `NEXT_PUBLIC_*` variable.

## Development

```bash
npm run dev
```

Or separately:

```bash
npm run dev:api
npm run dev:web
```

Health check:

```bash
curl http://localhost:4000/health
```

## Production

Recommended minimum production steps:

1. Use managed PostgreSQL or a hardened PostgreSQL container.
2. Set strong `JWT_SECRET` and `ENCRYPTION_KEY`.
3. Set `DEEPSEEK_API_KEY` only in the API runtime environment.
4. Run migrations before API start.
5. Put the API behind TLS and a reverse proxy.
6. Run command execution in isolated containers/VMs with CPU/memory/network policies.
7. Configure CORS to the exact web origin.

## AI Provider Setup

Aeta supports only DeepSeek.

```env
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

All AI features route through:

```text
Browser -> Web IDE -> Backend API -> Context Engine / Agent / Tool System -> DeepSeek Client -> DeepSeek API
```

## Sandbox Setup

The command runner enforces:

- workspace-root path resolution
- command timeout
- output size cap
- process-group kill
- `ulimit` CPU cap
- `ulimit` memory cap
- secret redaction

Docker Compose adds a separate `sandbox` service with:

- `network_mode: none`
- `cpus: 1.0`
- `mem_limit: 1g`
- workspace volume mounted at `/data/workspaces`
- `no-new-privileges`

For multi-tenant production, run every workspace command in a per-user/per-task container or VM, not in the API process.

## GitHub OAuth Setup

GitHub OAuth routes are not enabled in this implementation. The schema includes encrypted `ApiKey` storage for future Git/GitHub integrations. To add GitHub OAuth safely, configure a server-only `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, add redirect/callback routes, encrypt tokens with `ENCRYPTION_KEY`, and never send raw tokens to the browser.

## Testing

```bash
npm test
npm run typecheck
npm run build
```

Current test coverage includes:

- authentication password hashing/verification
- filesystem path traversal prevention and real file operations
- workspace search
- command sandbox execution and timeout
- DeepSeek client configuration errors/default model
- agent pending diff behavior
- Git init/status

Latest local results:

```text
Test Files  6 passed (6)
Tests       10 passed (10)
Typecheck   passed for all workspaces
Build       Next.js web build passed
```

## API Architecture

Versioned APIs:

```text
/api/v1/auth
/api/v1/users
/api/v1/workspaces
/api/v1/projects
/api/v1/files
/api/v1/search
/api/v1/ai
/api/v1/agent
/api/v1/terminal
/api/v1/git
/api/v1/settings
```

Realtime:

```text
/ws/terminal
```

All protected routes use server-side authentication and permission checks.

## Security

Implemented security controls:

- password hashing with bcrypt
- server-side session validation
- server-side workspace permission checks
- safe workspace path resolver against traversal
- secret file blocking for `.env`, private key patterns
- command timeout/output cap/CPU/memory limits
- process group termination
- rate limiting
- Helmet headers
- CORS allowlist
- server-side DeepSeek API key only
- redacted logs
- encrypted API key storage for non-AI keys
- standard errors without stack traces for normal users

Known production hardening still required:

- per-command container/VM isolation instead of API-process execution
- robust network egress policy per workspace
- CSRF tokens for cookie-only browser flows if bearer tokens are not used
- full audit/event export pipeline
- SMTP/email provider for production email delivery
- billing provider integration

## Troubleshooting

### `DEEPSEEK_CONFIGURATION_ERROR`

Set `DEEPSEEK_API_KEY` in the API server environment. Do not set it in `NEXT_PUBLIC_*` variables.

### API cannot connect to database

Check `DATABASE_URL`, ensure PostgreSQL is running, then run:

```bash
npm run prisma:migrate -w @aeta/api
```

### Terminal commands fail

Confirm the workspace path exists and that the command dependencies are installed inside the runtime/sandbox image.

### Web cannot reach API

Check:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
API_CORS_ORIGIN=http://localhost:3000
```

## Known Limitations

- Email verification/password reset create real server-side tokens, but production email delivery requires adding an SMTP/email provider.
- The Docker sandbox service is included; the default API command runner also supports limits, but production multi-tenant deployments should execute commands in per-task isolated containers/VMs.
- Problems panel currently displays application-provided diagnostics and Monaco client diagnostics; full multi-language LSP servers are not bundled yet.
- Preview URL detection for arbitrary project servers is foundational through terminal/server tools; a full reverse-proxy preview manager can be added on top of running terminal sessions.
- GitHub OAuth is documented but not implemented because no GitHub OAuth credentials were provided.
- Billing UI/schema exists as a foundation; payment processor integration is not implemented.

## Features Requiring External Credentials

- DeepSeek AI chat/agent/streaming: `DEEPSEEK_API_KEY`
- Production email verification/reset delivery: SMTP or email API credentials (not included)
- GitHub OAuth/push over HTTPS with app tokens: GitHub OAuth app credentials or user-provided tokens (not included)
- Billing/subscriptions: payment provider credentials (not included)

## Assumptions

```text
ASSUMPTION:
The default DeepSeek model is deepseek-flash.
REASON:
The official DeepSeek API documentation available on 2026-09-20 lists deepseek-flash and deepseek-v4-pro, and documents deepseek-flash in the chat completion examples.
```

```text
ASSUMPTION:
Runtime database access uses a lightweight PostgreSQL mapper while the Prisma schema and SQL migrations remain checked in.
REASON:
The sandbox could not download Prisma engine binaries reliably during local generation, and generated Prisma artifacts should not be committed. The resulting runtime still uses a real PostgreSQL database and checked-in migrations.
```
