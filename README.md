# Quant Committee AI

An institutional-style quantitative risk and forecast workstation. The app downloads or synthesizes market history, runs independent quantitative models, and uses an AI committee layer to explain agreement, disagreement, and uncertainty without inventing financial metrics.

## Structure

- `frontend/` - Next.js, React, TypeScript, Tailwind, shadcn-style UI, Plotly charts.
- `backend/` - FastAPI quant pipeline, model adapters, AI committee, forecast persistence, PDF report export.

## Quick Start

Double-click `Run Quant Committee AI.bat` from the project root to install missing local dependencies, start the backend and frontend, and open the app.

Backend:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
.\.venv\Scripts\python -m uvicorn backend.app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. The frontend expects the backend at `http://localhost:8000`; override with `NEXT_PUBLIC_API_BASE_URL`.

## Notes

- Live market data uses `yfinance` when available. If a ticker cannot be fetched, the backend creates deterministic synthetic market history so the workstation remains demoable offline.
- AI providers are pluggable. Without a user API key, the committee uses a local deterministic moderator grounded in the quant outputs.
- Forecasts are persisted under `backend/data/forecasts.json` for later calibration and performance tracking.
