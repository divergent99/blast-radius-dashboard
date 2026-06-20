<div align="center">

# 💥 Blast Radius Dashboard

**Visualize merge request impact across your entire codebase**

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![ReactFlow](https://img.shields.io/badge/React_Flow-11-FF0072?style=flat-square)](https://reactflow.dev)
[![Claude](https://img.shields.io/badge/Claude-Sonnet_4.6-D97706?style=flat-square&logo=anthropic&logoColor=white)](https://anthropic.com)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.app)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

*Built for the [GitLab Transcend Hackathon 2026](https://gitlab-transcend.devpost.com)*

**[🚀 Live Demo](https://blast-radius-dashboard.vercel.app)** · [Backend Repo](https://github.com/divergent99/blast-radius-agent) · [GitLab Submission](https://gitlab.com/gitlab-ai-hackathon/transcend/35648667)

</div>

---

## Overview

Blast Radius Dashboard is a visual interface for understanding how code changes ripple through your GitLab project. Powered by **GitLab Orbit's knowledge graph**, it shows you the full dependency tree of your codebase and highlights exactly which files are at risk when an MR is opened.

### Key Features

- **Dependency Graph** — Interactive visualization of all file import relationships, color-coded by directory
- **MR Blast Radius** — Load any MR number to see changed files (blue) and files at risk (amber) highlighted on the graph
- **File Inspector** — Click any node to see its description, what it imports, and what imports it
- **Talk to your code** — AI-powered chat using Claude + Orbit graph context to answer questions about your codebase
- **Multi-MR analysis** — Analyze multiple MRs simultaneously
- **Claude-generated descriptions** — Every file gets a one-line description generated automatically

---

## Screenshots

### Full Dependency Graph
Color-coded nodes by directory: **auth** (purple), **api** (blue), **utils** (green), **agent** (orange), **test** (gray)

### MR Blast Radius Active
Blue = changed, Amber = at risk, animated edges show the impact path

### File Inspector + Chat
Click any node → inspect its imports/dependencies. Ask Claude anything about the codebase.

---

## File Structure

```
blast-radius-dashboard/
├── src/
│   ├── App.jsx          # Entire dashboard (single-file React app)
│   └── main.jsx         # Entry point
├── public/
├── index.html
├── vite.config.js
├── package.json
└── .env                 # VITE_BACKEND_URL
```

---

## How It Works

```
User loads project path
        │
        ▼
GET /graph  ←── Backend queries Orbit for all files + import edges
        │
        ▼
Dagre layout renders left-to-right dependency tree
        │
        ▼
User enters MR number → clicks →
        │
        ▼
GET /analyze ←── Backend gets MR diff + Orbit blast radius
        │
        ▼
Graph highlights changed (blue) + at-risk (amber) nodes
Animated edges show impact paths
        │
        ▼
Click node → File tab shows imports/importers/description
Ask question → Claude answers using full graph context
```

---

## Setup

### Prerequisites
- Node.js 18+
- [Blast Radius Agent](https://github.com/divergent99/blast-radius-agent) running (local or deployed)

### Local Development

```bash
git clone https://github.com/divergent99/blast-radius-dashboard
cd blast-radius-dashboard

npm install

# Create .env
echo "VITE_BACKEND_URL=http://localhost:8000" > .env

npm run dev
```

Open `http://localhost:5173`

### Environment Variables

```env
VITE_BACKEND_URL=https://your-backend-url.up.railway.app
```

### Production Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

vercel
# Follow prompts, add VITE_BACKEND_URL when asked
```

Or connect your GitHub repo to Vercel and it auto-deploys on push.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite |
| Graph visualization | React Flow + Dagre (auto-layout) |
| Styling | Inline styles (zero CSS dependencies) |
| AI chat | Claude Sonnet 4.6 via backend |
| Deployment | Vercel |

---

## Backend

This dashboard requires the **Blast Radius Agent** backend:

→ [blast-radius-agent](https://github.com/divergent99/blast-radius-agent)

The backend exposes `/graph`, `/analyze`, `/describe`, and `/chat` endpoints that this dashboard consumes.

---

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">

Built with 💥 for the GitLab Transcend Hackathon 2026

</div>