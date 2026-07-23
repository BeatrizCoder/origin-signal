---
name: run-browser
description: Start MongoDB, backend (FastAPI/uvicorn) and frontend (Vite) so the user can test OriginSignal manually in their own browser. Use when the user asks to "run"/"start"/"ligar" the app, or test it in the browser.
---

# Run OriginSignal for manual browser testing

This only **launches and verifies** the three services. It does not click
through the UI or trigger `/api/analyze` — that endpoint calls real AI agents
via the project's own Anthropic API key and costs real money. Only drive the
UI (Playwright/chromium-cli) if the user explicitly asks for an automated
click-through test, not just "run it".

Always work from `~/projects/originsignal` (native ext4), never the OneDrive
path at `/mnt/c/Users/beatriz/OneDrive/Documents/projetos ai/originsignal` —
see memory `native_fs_migration`. If the shell cwd resets to the OneDrive
path mid-session (it does, WSL quirk), just use absolute paths.

## Start

```bash
# 1. MongoDB (Docker)
docker start originsignal_mongo 2>/dev/null || docker run -d --name originsignal_mongo -p 27017:27017 mongo:7

# 2. Backend
cd ~/projects/originsignal/backend
source .venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/originsignal-backend.log 2>&1 &
disown

# 3. Frontend
cd ~/projects/originsignal/frontend
nohup npm run dev > /tmp/originsignal-frontend.log 2>&1 &
disown
```

## Verify (poll, don't sleep)

```bash
timeout 30 bash -c 'until curl -sf http://localhost:8000/api/health >/dev/null; do sleep 1; done' && echo "backend UP"
timeout 30 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done' && echo "frontend UP"
docker ps | grep originsignal_mongo
curl -s http://localhost:8000/api/health   # → {"status":"ok"}
```

Tell the user the app is ready at `http://localhost:5173` (backend docs at
`http://localhost:8000/docs`) and let them drive it themselves. Check
`tail -n 30 /tmp/originsignal-backend.log` / `/tmp/originsignal-frontend.log`
if either health check fails — first backend boot loads ~103 model weights
and can take a few seconds.

## Stop

```bash
lsof -ti:8000 -sTCP:LISTEN | xargs -r kill
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
docker stop originsignal_mongo
```

## If asked to actually drive the browser (not just launch it)

There's no `chromium-cli` in this environment. Fall back to Playwright: it's
not installed as a project dependency, so `npm install playwright` in a
scratch directory (not the repo) and launch with
`chromium.launch({ args: ['--no-sandbox'] })`. Only navigate + screenshot the
landing page and read-only routes (e.g. `/api/global-risk/coffee`). **Do not
click "ANALYZE"** or hit `/api/analyze`, `/api/export/pdf`, `/api/audit-path`
without explicit user confirmation — each of those triggers real AI-agent
calls billed to the project's Anthropic API key.
