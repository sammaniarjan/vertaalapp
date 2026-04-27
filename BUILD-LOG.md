# Vertaalapp — Build-log DMG-distributie

**Datum:** 25 maart 2026
**Versie:** 1.0.0
**Output:** `electron/dist/Vertaalapp-1.0.0-arm64.dmg` (328 MB)

---

## Wat is er gedaan

### 1. Opschonen en versie-uitlijning

- **`CLAUDE.md`** — Hele "Licentiesysteem — Plan" sectie verwijderd (regels 119-163). Licentiesysteem is nog niet gebouwd en hoort niet in de build-documentatie.
- **`frontend/package.json`** — Versie van `"0.0.0"` naar `"1.0.0"` gezet, consistent met electron en backend.
- **`electron/package.json`** — Beschrijving gewijzigd van "Real-time Dutch-Arabic speech translation app" naar "Real-time spraakvertaling tussen twee talen".
- **`backend/app/main.py`** — Zelfde beschrijvingswijziging op regel 55 (FastAPI title).

### 2. Beveiligingsfix — backend gebonden aan localhost

- **`backend/app/config.py`** — `HOST` van `"0.0.0.0"` naar `"127.0.0.1"`. Voorheen was de backend bereikbaar voor alle apparaten op het netwerk. Nu alleen lokaal.

### 3. App-icoon gegenereerd

- Python-script met Pillow gemaakt dat een 1024x1024 icoon genereert in de neumorphic stijl van de app: twee spraakbellen (paars `#6C63FF` en teal `#38B2AC`) met een bidirectionele vertaalpijl op `#E0E5EC` achtergrond.
- Via `iconutil` omgezet naar `.icns` met alle vereiste resoluties (16x16 t/m 1024x1024, inclusief @2x varianten).
- **Nieuwe bestanden:**
  - `electron/icons/icon.icns` (161 KB)
  - `electron/icons/icon.iconset/` (alle PNG-resoluties)
  - `frontend/public/favicon.png` (64x64)
- **`frontend/index.html`** — Favicon gewijzigd van `vite.svg` naar eigen `favicon.png`.

### 4. Google Fonts lokaal gebundeld

**Probleem:** `frontend/src/index.css` en `electron/main.js` laden fonts van `fonts.googleapis.com`. Dit is een privacyrisico (Google ontvangt IP-adressen van gebruikers) en werkt niet offline.

**Oplossing:**
- Drie font-families gedownload als `.woff2` van Google Fonts API:
  - Plus Jakarta Sans (500, 600, 700, 800) — 4 bestanden
  - DM Sans (400, 500, 700) — 3 bestanden
  - Noto Sans Arabic (400, 500, 700) — 3 bestanden
- Geplaatst in `frontend/public/fonts/` (10 bestanden totaal).
- **`frontend/src/index.css`** — `@import url('fonts.googleapis.com/...')` vervangen door 10 lokale `@font-face` declaraties met `unicode-range` voor Arabisch.
- **`electron/main.js`** — Loading- en error-HTML: Google Fonts link verwijderd, vervangen door systeemfonts (`-apple-system, BlinkMacSystemFont, 'Helvetica Neue'`).

### 5. PyInstaller spec verbeterd

**`backend/vertaalapp.spec`** — Ontbrekende hidden imports toegevoegd die PyInstaller niet automatisch detecteert:

| Categorie | Toegevoegde imports |
|-----------|-------------------|
| NLLB/M2M100 | `transformers.models.nllb`, `transformers.models.m2m_100` + submodules |
| HuggingFace Hub | `huggingface_hub`, `huggingface_hub.utils`, `filelock`, `tqdm`, `regex` |
| Safetensors | `safetensors`, `safetensors.torch` |
| FastAPI | `collect_submodules('fastapi')` — nodig omdat `fastapi.middleware.cors` anders niet gevonden wordt |
| MLX | `collect_submodules('mlx')`, `collect_submodules('mlx_whisper')` |

De `fastapi.middleware.cors` import was de oorzaak van een crash bij de eerste test — de backend startte wel maar kon de FastAPI app niet laden.

### 6. Electron-builder config geüpdatet

**`electron/package.json`** — build sectie:

| Veld | Oud | Nieuw |
|------|-----|-------|
| `appId` | `com.vertaalapp.app` | `com.manava.vertaalapp` |
| `category` | `public.app-category.productivity` | `public.app-category.medical` |
| `copyright` | *(ontbrak)* | `Copyright © 2026 Manava` |
| `arch` | *(niet gespecificeerd)* | `["arm64"]` |
| `identity` | *(ontbrak)* | `null` (voorkomt code signing poging) |
| `minimumSystemVersion` | *(ontbrak)* | `"13.0"` |
| `darkModeSupport` | *(ontbrak)* | `true` |
| `extraResources` | ffmpeg alleen | ffmpeg + `bin/libs/` directory toegevoegd |

### 7. Electron main.js verbeterd

- **macOS About-panel** toegevoegd via `app.setAboutPanelOptions()` met app-naam, versie, copyright, website (manava.nl) en beschrijving.
- **Crash handlers** toegevoegd: `process.on('uncaughtException')` en `process.on('unhandledRejection')` zodat de app niet stil crasht.
- **Loading- en error-HTML**: Google Fonts CDN-links verwijderd, vervangen door macOS systeemfonts.

### 8. Build-script verbeterd

**`scripts/build-mac.sh`** — Volledig herschreven met:

- **Architecture check**: weigert te bouwen op niet-arm64 (Intel Macs).
- **Versienummer**: automatisch geëxtraheerd uit `electron/package.json`.
- **ffmpeg bundeling met dylibbundler**: kopieert Homebrew ffmpeg, gebruikt `dylibbundler` om alle 92 dynamische libraries mee te bundelen en rpaths te fixen naar `@executable_path/libs/`. Dit zorgt dat ffmpeg op elke Mac werkt, niet alleen op Macs met Homebrew.
- **Post-build validatie**: controleert of backend binary, ffmpeg, ffmpeg libs, en frontend dist aanwezig zijn in de `.app` bundle.
- **DMG-grootte**: rapporteert de grootte van de uiteindelijke DMG.
- **Installatie-instructies**: toont Gatekeeper bypass-instructies na succesvolle build.

### 9. INSTALLATIE.md geschreven

Nieuw bestand met Nederlandse installatie-instructies voor eindgebruikers:
- Systeemvereisten (Apple Silicon, macOS 13+, RAM, schijfruimte)
- Stap-voor-stap installatie
- Gatekeeper bypass (twee methoden: rechts-klik en Terminal)
- Eerste gebruik (model downloads uitleg)
- Privacyvermelding (alles lokaal, geen data naar internet)
- Problemen oplossen

### 10. FFmpeg bundeling

**Probleem:** De Homebrew ffmpeg binary (412 KB) hangt af van 57+ dynamische libraries in `/opt/homebrew/Cellar/`. Op een Mac zonder Homebrew crasht ffmpeg.

**Oplossing:** `dylibbundler` gebruikt om:
1. Alle 92 benodigde `.dylib` bestanden te kopiëren naar `electron/bin/libs/`
2. Alle rpaths in ffmpeg en de dylibs te herschrijven naar `@executable_path/libs/`
3. De binary opnieuw te code-signen (ad-hoc)

**Resultaat:** 75 MB ffmpeg bundle die op elke arm64 Mac werkt.

---

## Build-vereisten (voor ontwikkelaars)

Om de DMG te bouwen heb je nodig:

```bash
# Eenmalig
brew install ffmpeg dylibbundler
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cd frontend && npm install
cd electron && npm install

# Bouwen
scripts/build-mac.sh
```

---

## Bundel-inhoud

```
Vertaalapp.app/Contents/
├── Resources/
│   ├── backend              # PyInstaller executable (204 MB)
│   ├── bin/
│   │   ├── ffmpeg           # FFmpeg binary (412 KB)
│   │   └── libs/            # 92 dylibs (75 MB)
│   └── dist/
│       ├── index.html       # Frontend entry point
│       ├── assets/          # JS + CSS bundles
│       ├── fonts/           # 10 woff2 font-bestanden
│       └── favicon.png      # App favicon
└── MacOS/
    └── Vertaalapp           # Electron executable
```

---

## Bekende beperkingen

1. **Niet gesigneerd** — Gebruikers moeten Gatekeeper bypassen (rechts-klik → Open, of `xattr -cr`). Voor gesigneerde distributie is een Apple Developer account ($99/jaar) nodig.
2. **Geen notarization** — Zonder signing kan de app ook niet genotariseerd worden bij Apple.
3. **ffmpeg dylibs zijn Homebrew-specifiek** — De 92 gebundelde dylibs komen van de huidige Homebrew ffmpeg versie. Bij een Homebrew-update moeten ze opnieuw gebundeld worden.
4. **STT engine** — mlx-whisper geeft "error" status bij de PyInstaller build. De Whisper-modellen worden wel correct gedownload maar de mlx-whisper integratie in PyInstaller moet nog getest worden.
5. **Alleen arm64** — Geen Intel Mac ondersteuning (by design, mlx-whisper vereist Apple Silicon).
