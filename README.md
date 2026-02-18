<div align="center">

# OpenClaw Dashboard

<h3>Mission control for your OpenClaw agent swarm.</h3>

<p>
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 16">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <a href="https://github.com/bokiko/openClaw-dashboard/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License">
  </a>
</p>

<p>
  <a href="https://openclaw.io">OpenClaw</a> · <a href="https://bokiko.io">bokiko.io</a> · <a href="https://twitter.com/bokiko">@bokiko</a>
</p>

</div>

---

<img src="public/screenshot.png" alt="OpenClaw Dashboard" width="100%">

---

## What Is This?

A real-time web dashboard for the [OpenClaw](https://openclaw.io) agent gateway. It connects to the gateway's WebSocket RPC protocol on the server side, translates responses into a rich UI, and gives you full operational visibility over your agents, sessions, cron jobs, and chat.

| Feature | What it does |
|---------|--------------|
| **Live Agent Strip** | See every agent's status at a glance — who's working, who's idle, model info |
| **Session Kanban** | Active sessions displayed as task cards across status lanes (In Progress, Review, Assigned, Inbox) |
| **Routine Manager** | Create, edit, enable/disable, and trigger cron jobs directly from the UI |
| **Agent Chat** | Send messages to any agent through the gateway — responses rendered with code block highlighting |
| **Activity Feed** | Cron run history as a live activity stream with severity indicators |
| **Metrics Panel** | Charts and stats — session throughput, status distribution, per-agent workload |
| **Notifications** | Notification panel with read/dismiss/clear actions |
| **Command Palette** | `Cmd+K` to quickly filter agents, toggle feed, create tasks |
| **Auth & Sessions** | Cookie-based operator login with HMAC-signed sessions |
| **Mobile Responsive** | Full mobile support — wrapping layouts, touch-friendly sizing |

---

## Architecture

The dashboard sits between the operator's browser and the OpenClaw gateway:

```
Browser (React)
  │
  │ HTTP fetch (polling)
  ▼
Next.js API Routes (/api/gateway/*)
  │
  │ WebSocket RPC (custom protocol)
  ▼
OpenClaw Gateway (ws://127.0.0.1:18789)
```

**Server-side gateway client** — A singleton WebSocket client (`gateway-client.ts`) connects to the gateway, handles the challenge/auth handshake, and exposes a typed `call<T>(method, params)` RPC interface. API routes call gateway methods in parallel and map responses through type-safe mappers.

**No direct browser-to-gateway WebSocket** — The browser uses HTTP polling against Next.js API routes. The WebSocket complexity is contained server-side.

---

## Quick Start

### Prerequisites

- Node.js 18+
- A running OpenClaw gateway (default: `ws://127.0.0.1:18789`)

### Setup

```bash
git clone https://github.com/bokiko/openClaw-dashboard.git
cd openClaw-dashboard
npm install
```

### Configure

Create `.env.local` with your gateway connection details:

```bash
# Gateway connection (OpenClaw gateway WS RPC)
GATEWAY_WS_URL=ws://127.0.0.1:18789
GATEWAY_TOKEN=your-gateway-token
GATEWAY_HEALTH_URL=http://127.0.0.1:18792

# Auth: Dashboard cookie signing secret (server-only)
DASHBOARD_SECRET=$(openssl rand -hex 32)

# Auth: Operator login password
OPERATOR_PASSWORD=your-strong-password
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your operator password.

---

## Gateway Protocol

The dashboard speaks the gateway's custom WebSocket RPC protocol:

1. Connect to `ws://host:18789`
2. Handle `connect.challenge` event (nonce)
3. Send `connect` request with auth token and operator role
4. Issue RPC calls: `sessions.list`, `cron.list`, `cron.runs`, `chat.send`, etc.
5. Responses are `{ ok, id, payload }` or `{ ok: false, id, error }`

The gateway client handles all of this internally — API routes just call `gw.call('method', params)`.

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/gateway/dashboard` | GET | Aggregated dashboard data (sessions, agents, cron runs, stats). 5s cache. |
| `/api/gateway/routines` | GET | List all cron jobs as routines |
| `/api/gateway/routines` | POST | Create a new cron job |
| `/api/gateway/routines/[id]` | PATCH | Update or toggle a cron job |
| `/api/gateway/routines/[id]` | DELETE | Remove a cron job |
| `/api/gateway/routines/[id]/trigger` | POST | Trigger a cron job immediately |
| `/api/gateway/chat` | POST | Send a message to an agent |
| `/api/gateway/health` | GET | Health check (HTTP + RPC) |
| `/api/auth/login` | POST | Operator login |
| `/api/auth/logout` | POST | Logout |

---

## Data Mapping

Gateway responses are mapped to the dashboard's existing component interfaces:

| Gateway Source | Dashboard Target | Mapping Logic |
|---|---|---|
| `sessions.list` | Tasks / Kanban cards | Session key as title, model as priority (opus=urgent, sonnet=high), recency as status |
| Agent IDs from sessions | Agent avatars | Derived from session data, model determines provider color |
| `cron.list` | Routine cards | Cron expression parsed to day/time schedule |
| `cron.runs` | Activity feed | Run status mapped to severity (failed=error, completed=success) |
| Derived counts | Stats panel | Sessions by lane, agents by activity |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/                    # Login/logout routes
│   │   ├── cluster/                 # Legacy cluster proxy + ws-token
│   │   └── gateway/                 # Gateway adapter routes
│   │       ├── dashboard/route.ts   # Aggregation endpoint
│   │       ├── routines/route.ts    # CRUD for cron jobs
│   │       ├── chat/route.ts        # Agent chat
│   │       └── health/route.ts      # Health check
│   ├── login/page.tsx               # Login page
│   └── page.tsx                     # Main dashboard
├── components/
│   ├── AgentChatPanel.tsx           # Sliding chat panel
│   ├── AgentStrip.tsx               # Agent status bar
│   ├── Header.tsx                   # Top bar with stats
│   ├── MissionQueue.tsx             # Kanban board
│   ├── RoutineManager.tsx           # Cron job management
│   ├── RoutineCard.tsx / Form.tsx   # Routine UI
│   ├── MetricsPanel.tsx             # Charts and statistics
│   ├── LiveFeed.tsx                 # Activity feed drawer
│   ├── NotificationPanel.tsx        # Notification drawer
│   ├── TaskCard.tsx                 # Kanban task card
│   ├── TaskEditModal.tsx            # Task detail modal
│   ├── CommandPalette.tsx           # Cmd+K palette
│   └── ErrorBoundary.tsx            # Error boundary wrapper
├── lib/
│   ├── gateway-client.ts            # WS RPC client (server-side singleton)
│   ├── gateway-mappers.ts           # Gateway → dashboard type mappers
│   ├── useClusterState.ts           # Primary data hook (HTTP + reducer)
│   ├── WebSocketProvider.tsx         # Browser WS context (polling mode)
│   ├── auth.ts                      # Cookie session management
│   └── utils.ts                     # Utility functions
└── types/
    └── index.ts                     # All TypeScript interfaces
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 3.4 |
| Gateway Client | ws (Node.js WebSocket) |
| Animations | Framer Motion |
| Charts | Recharts |
| Drag & Drop | dnd-kit |
| Command Palette | cmdk |
| Primitives | Radix UI (Dialog, Tooltip, Dropdown) |
| Notifications | Sonner |
| Icons | Lucide React |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `Enter` | Send chat message |
| `Shift + Enter` | Newline in chat |
| `Escape` | Close modals, panels, chat |

---

## Security

- **Cookie-based auth** — HMAC-signed session cookies with configurable secret
- **Middleware protection** — All routes except `/login` and `/api/auth` require valid session
- **Server-side gateway access** — Gateway token never exposed to the browser
- **Path traversal protection** — API proxy validates path segments
- **No direct browser WS** — Gateway protocol is server-contained

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
