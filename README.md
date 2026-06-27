# OriginSignal

Trade risk intelligence platform for Brazilian agricultural exports to the EU, focused on EUDR (EU Deforestation Regulation 2023/1115) compliance analysis.

## What it does

- Analyzes regulatory compliance risk for Brazilian commodities (coffee, fruits) destined for the EU
- Uses RAG (Retrieval-Augmented Generation) to search the EUDR regulatory text and generate grounded analysis via Claude Haiku
- Displays risk across 4 dimensions: Regulatory, Climate, Market, Logistics
- Interactive hex map of Brazilian producing regions with per-layer risk visualization

## Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI + Python 3.12 |
| LLM | Claude Haiku (`claude-haiku-4-5`) via Anthropic SDK |
| Vector DB | ChromaDB + SentenceTransformers (`all-MiniLM-L6-v2`) |
| PDF parsing | PyPDF2 |
| Frontend | React + TypeScript + Vite |
| Map | HTML5 Canvas (hex grid) |

## Project structure

```
originsignal/
├── backend/
│   ├── app/
│   │   ├── agents/
│   │   │   └── regulatory_agent.py   # RAG + Claude Haiku analysis
│   │   ├── api/
│   │   │   └── routes.py             # POST /api/analyze
│   │   ├── core/
│   │   │   └── config.py             # Settings (reads .env)
│   │   ├── rag/
│   │   │   ├── document_processor.py # PDF → chunks
│   │   │   ├── ingest.py             # CLI ingest pipeline
│   │   │   └── vector_store.py       # ChromaDB wrapper
│   │   └── main.py
│   ├── data/
│   │   ├── eudr_docs/                # Place EUDR PDF here
│   │   ├── antaq_docs/
│   │   ├── market_reports/
│   │   └── chroma_db/                # Auto-generated vector index
│   └── pyproject.toml
├── frontend/
│   └── src/
│       ├── App.tsx                   # Analysis tab + Map tab
│       ├── components/
│       │   └── HexMap.tsx            # Interactive hex map canvas
│       ├── services/api.ts
│       └── types/index.ts
└── docker-compose.yml
```

## Setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
```

Create `backend/.env`:
```
ANTHROPIC_API_KEY=your_key_here
```

### 2. Index EUDR documents

Place `EUDR_2023_1115.pdf` in `backend/data/eudr_docs/`, then:

```bash
cd backend
python3 -m app.rag.ingest
```

Run with `--force` to reindex.

### 3. Start backend

```bash
cd backend
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## API

### `POST /api/analyze`

```json
{
  "query": "What are the due diligence requirements for coffee exports?",
  "commodity": "coffee",
  "origin": "Brazil",
  "destination": "Germany"
}
```

Response:

```json
{
  "risk_score": 45,
  "risk_level": "Medium",
  "findings": ["..."],
  "articles_cited": ["Article 8 (Due diligence obligations)", "..."],
  "recommendations": ["..."],
  "query": "...",
  "commodity": "coffee",
  "origin": "Brazil",
  "destination": "Germany"
}
```

`risk_score` is an integer 0–100. `Export Readiness = 100 - risk_score`.

## Risk thresholds

| Score | Level | Color |
|-------|-------|-------|
| < 30 | Low | `#34D399` (green) |
| 30–60 | Medium | `#FBBF24` (amber) |
| > 60 | High | `#F87171` (red) |
