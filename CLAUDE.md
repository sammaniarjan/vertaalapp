# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Wat is dit?
Real-time spraakvertaalapplicatie voor de gezondheidszorg. Arts en patiënt praten in hun eigen taal — alles draait lokaal (geen cloud, geen data-opslag). Eigenaar: Manava (www.manava.nl).

## Tech stack
- **Frontend**: React 19 + TypeScript + Vite (neumorphic UI, geen component library)
- **Backend**: Python FastAPI + WebSocket (uvicorn op localhost:8001)
- **STT**: Whisper (mlx-whisper op Apple Silicon, fallback: faster-whisper, openai-whisper)
- **Vertaling**: Helsinki-NLP MarianMT (per talenpaar) + Facebook NLLB-200-distilled-600M (fallback)
- **Packaging**: Electron + PyInstaller → macOS .dmg (arm64 only)

## Development Commands

### Setup
```bash
make setup              # Maak venv, installeer Python + npm dependencies
scripts/setup.sh        # Handmatig: checkt Python3, Node, npm, ffmpeg, Apple Silicon
```

### Dagelijkse ontwikkeling
```bash
make dev                # Start backend + frontend tegelijk
make dev-backend        # Backend alleen → http://localhost:8001
make dev-frontend       # Frontend alleen → http://localhost:5173
python3 backend/run.py  # Backend met auto-reload
```

### Frontend
```bash
cd frontend
npm run dev             # Vite dev server met HMR
npm run build           # TypeScript check + productie build → frontend/dist/
npm run lint            # ESLint check
npm run preview         # Preview van gebouwde app
```

### Productie build (DMG)
```bash
scripts/build-mac.sh    # Volledige pipeline: frontend → PyInstaller → ffmpeg → Electron .dmg
```
**Vereisten:** `brew install ffmpeg dylibbundler`, backend venv met PyInstaller.

**Stappen (automatisch):**
1. Frontend bouwen (`npm run build` → `frontend/dist/`)
2. Backend bundelen (PyInstaller via `backend/vertaalapp.spec` → `backend/dist/backend`)
3. ffmpeg + 92 dylibs bundelen (dylibbundler fixt rpaths naar `@executable_path/libs/`)
4. Electron-builder → unsigned `.dmg` in `electron/dist/`

**Output:** `electron/dist/Vertaalapp-{versie}-arm64.dmg`

**Workflow:**
- Tijdens ontwikkeling: `make dev` (instant, hot reload)
- Release bouwen: `scripts/build-mac.sh` (paar minuten)
- Je hoeft de DMG alleen te bouwen als je een nieuwe versie wilt uitbrengen

### Tests & linters
- Nog geen testframework geconfigureerd (geen pytest, geen vitest).
- Frontend: `npm run lint` (ESLint). Backend: geen linter/formatter (ruff/black/mypy) geconfigureerd.

## Architectuur

### Drie processen
1. **Electron** (`electron/main.js`): spawnt backend, toont frontend, beheert lifecycle
2. **Backend** (FastAPI): ML-modellen, WebSocket audio pipeline, REST API
3. **Frontend** (React SPA): neumorphic UI, WebSocket client

### WebSocket audio pipeline
De kern van de app is de real-time vertaalloop via `ws://localhost:8001/ws/translate`:
1. Frontend stuurt audio chunks (PCM float32) via WebSocket
2. Backend accumuleert audio → Whisper STT → tekst
3. Tekst wordt vertaald (MarianMT of NLLB) → terug via WebSocket
4. Frontend toont transcriptie + vertaling in gespreksbubbles

### Vertaalstrategie
- **MarianMT** (via English pivot — source→EN→target, aparte modellen per richting): AR, TR, FR, DE, ES, PL, RU, UK, ZH, IT, PT ↔ NL. AR en TR gebruiken `tc-big` modellen voor betere kwaliteit.
- **NLLB-200-distilled-600M** (directe vertaling, geen pivot): FA, SO, TI ↔ NL.
- Modellen worden on-demand gedownload naar `~/Library/Caches/vertaalapp/` (via HF_HOME).
- `language_registry.py` definieert alle talen, hun modellen, en detecteert cached downloads.
- `translation_engine.py` kiest automatisch MarianMT of NLLB op basis van taalconfiguratie.

### STT Engine
`stt_engine.py` auto-detecteert de beste beschikbare Whisper-implementatie:
1. mlx-whisper (Apple Silicon geoptimaliseerd) — voorkeur
2. faster-whisper (GPU/CPU)
3. openai-whisper (fallback)

### Frontend state management
- Hooks-based (geen Redux): `useWebSocket`, `usePushToTalk`, `useAudioRecorder`
- `App.tsx` orkestreert alle state; componenten zijn presentational
- Sessie-gebaseerde message routing: correlatie tussen input/transcriptie/vertaling

### API endpoints (backend)
- `GET /health` — status + model states
- `GET /api/languages` — taallijst + installatiestatus
- `POST /api/languages/download` — model download starten (background)
- `POST /api/languages/set-pair` — taalpaar activeren + modellen laden
- `GET /api/languages/status` — download voortgang
- `GET /api/system` — systeeminfo (geheugen, schijf, modellen)
- `WebSocket /ws/translate` — real-time audio vertaling

### Vite dev proxy
In development proxied Vite `/ws` naar `ws://localhost:8001` en `/health` naar `http://localhost:8001`, zodat frontend en backend op verschillende poorten kunnen draaien.

### Electron integratie
- `main.js` spawnt backend als child process, pollt `/health` tot ready
- Sets `HF_HOME` en `FFMPEG_PATH` environment variabelen
- Verschil dev/prod paden: in dev draait `backend/run.py` (uvicorn met `reload=True`), in prod de PyInstaller executable die intern `backend/run_prod.py` aanroept (geen reload, `log_level=info`)
- Neumorphic loading screen terwijl backend start

## Belangrijke bestanden
- `backend/app/core/translation_engine.py` — dual-backend vertaling (MarianMT + NLLB)
- `backend/app/core/language_registry.py` — taalconfiguratie, download, cache-detectie
- `backend/app/core/stt_engine.py` — Whisper spraakherkenning
- `backend/app/core/model_manager.py` — model loading + progress callbacks
- `backend/app/api/websocket.py` — real-time audio→tekst→vertaling pipeline
- `backend/app/api/languages.py` — taal-management endpoints
- `frontend/src/App.tsx` — hoofdcomponent + state orchestratie
- `frontend/src/hooks/useWebSocket.ts` — WebSocket connectie + message routing
- `frontend/src/hooks/usePushToTalk.ts` — audio opname + chunk handling
- `electron/main.js` — Electron wrapper, spawnt backend
- `backend/run.py` — dev uvicorn launcher (reload aan)
- `backend/run_prod.py` — productie launcher, wordt door PyInstaller gebundeld
- `backend/vertaalapp.spec` — PyInstaller build-config

## Aanvullende docs
- `INSTALLATIE.md` — installatie-instructies voor eindgebruikers (nl)
- `BUILD-LOG.md` — notities over de DMG-build pipeline en gotchas

## Systeemvereisten
- Apple Silicon Mac (M1/M2/M3/M4) — vereist voor mlx-whisper
- Minimaal 8 GB RAM (16 GB aanbevolen)
- ~4 GB vrije schijfruimte (app + taalmodellen)
- macOS 13 Ventura of nieuwer

