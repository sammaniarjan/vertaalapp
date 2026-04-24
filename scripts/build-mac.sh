#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${GREEN}=== Vertaalapp macOS Build ===${NC}"
echo "Project root: $PROJECT_ROOT"

# ──────────────────────────────────────────────
# Pre-flight checks
# ──────────────────────────────────────────────
ARCH=$(uname -m)
if [ "$ARCH" != "arm64" ]; then
    echo -e "${RED}Error: Deze build vereist Apple Silicon (arm64). Gevonden: $ARCH${NC}"
    exit 1
fi

# Extract version from electron/package.json
VERSION=$(python3 -c "import json; print(json.load(open('$PROJECT_ROOT/electron/package.json'))['version'])")
echo "Versie: $VERSION"
echo "Architectuur: $ARCH"
echo ""

# ──────────────────────────────────────────────
# Step 1: Build frontend
# ──────────────────────────────────────────────
echo -e "${YELLOW}[1/4] Building frontend...${NC}"
cd "$PROJECT_ROOT/frontend"

if [ ! -d "node_modules" ]; then
    echo "  Installing frontend dependencies..."
    npm install
fi

npm run build
echo -e "${GREEN}  Frontend built -> frontend/dist/${NC}"

# ──────────────────────────────────────────────
# Step 2: Build backend with PyInstaller
# ──────────────────────────────────────────────
echo -e "${YELLOW}[2/4] Building backend with PyInstaller...${NC}"
cd "$PROJECT_ROOT/backend"

if [ ! -d ".venv" ]; then
    echo -e "${RED}  Error: backend/.venv not found. Run 'make setup' first.${NC}"
    exit 1
fi

# Install pyinstaller if not present
if ! .venv/bin/python -c "import PyInstaller" 2>/dev/null; then
    echo "  Installing PyInstaller..."
    .venv/bin/pip install pyinstaller
fi

echo "  Running PyInstaller..."
.venv/bin/pyinstaller vertaalapp.spec --clean --noconfirm

if [ ! -f "dist/backend" ]; then
    echo -e "${RED}  Error: PyInstaller build failed - dist/backend not found${NC}"
    exit 1
fi

# Make executable
chmod +x dist/backend
echo -e "${GREEN}  Backend built -> backend/dist/backend${NC}"

# ──────────────────────────────────────────────
# Step 3: Ensure ffmpeg binary is available
# ──────────────────────────────────────────────
echo -e "${YELLOW}[3/4] Checking ffmpeg...${NC}"
cd "$PROJECT_ROOT"

FFMPEG_TARGET="$PROJECT_ROOT/electron/bin/ffmpeg"
FFMPEG_LIBS="$PROJECT_ROOT/electron/bin/libs"
mkdir -p "$(dirname "$FFMPEG_TARGET")"

# Always rebuild ffmpeg bundle to ensure dylibs are current
BREW_FFMPEG="$(which ffmpeg 2>/dev/null || true)"
if [ -z "$BREW_FFMPEG" ] || [ ! -f "$BREW_FFMPEG" ]; then
    echo -e "${RED}  Error: ffmpeg not found! Install met: brew install ffmpeg${NC}"
    exit 1
fi

# Check dylibbundler
if ! which dylibbundler >/dev/null 2>&1; then
    echo -e "${RED}  Error: dylibbundler not found! Install met: brew install dylibbundler${NC}"
    exit 1
fi

echo "  Bundling ffmpeg with dylibs..."
rm -rf "$FFMPEG_LIBS" "$FFMPEG_TARGET"
mkdir -p "$FFMPEG_LIBS"
cp "$BREW_FFMPEG" "$FFMPEG_TARGET"
chmod +wx "$FFMPEG_TARGET"

dylibbundler -od -b -x "$FFMPEG_TARGET" -d "$FFMPEG_LIBS/" -p @executable_path/libs/ >/dev/null 2>&1

DYLIB_COUNT=$(ls "$FFMPEG_LIBS" | wc -l | tr -d ' ')
echo -e "${GREEN}  ffmpeg bundled with $DYLIB_COUNT dylibs${NC}"

# Verify ffmpeg is arm64
FFMPEG_ARCH=$(file "$FFMPEG_TARGET" | grep -o 'arm64' || true)
if [ -z "$FFMPEG_ARCH" ]; then
    echo -e "${YELLOW}  Warning: ffmpeg binary may not be arm64${NC}"
else
    echo -e "${GREEN}  ffmpeg architecture: arm64${NC}"
fi

# ──────────────────────────────────────────────
# Step 4: Build Electron app (.dmg)
# ──────────────────────────────────────────────
echo -e "${YELLOW}[4/4] Building Electron app...${NC}"
cd "$PROJECT_ROOT/electron"

if [ ! -d "node_modules" ]; then
    echo "  Installing Electron dependencies..."
    npm install
fi

echo "  Packaging with electron-builder..."
npm run build

# ──────────────────────────────────────────────
# Post-build validation
# ──────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Validating build...${NC}"

APP_PATH=$(find "$PROJECT_ROOT/electron/dist" -name "Vertaalapp.app" -type d 2>/dev/null | head -1)
if [ -z "$APP_PATH" ]; then
    echo -e "${RED}  Error: Vertaalapp.app not found in electron/dist/${NC}"
    exit 1
fi

RESOURCES="$APP_PATH/Contents/Resources"

# Check backend
if [ -f "$RESOURCES/backend" ]; then
    echo -e "${GREEN}  Backend binary: OK${NC}"
else
    echo -e "${RED}  Backend binary: MISSING${NC}"
fi

# Check ffmpeg
if [ -f "$RESOURCES/bin/ffmpeg" ]; then
    echo -e "${GREEN}  ffmpeg binary: OK${NC}"
else
    echo -e "${RED}  ffmpeg binary: MISSING${NC}"
fi

# Check frontend
if [ -f "$RESOURCES/dist/index.html" ]; then
    echo -e "${GREEN}  Frontend dist: OK${NC}"
else
    echo -e "${RED}  Frontend dist: MISSING${NC}"
fi

echo ""
echo -e "${GREEN}=== Build Complete ===${NC}"
echo ""

# Find the DMG
DMG_FILE=$(find "$PROJECT_ROOT/electron/dist" -name "*.dmg" -type f 2>/dev/null | head -1)
if [ -n "$DMG_FILE" ]; then
    DMG_SIZE=$(du -h "$DMG_FILE" | cut -f1)
    echo -e "DMG: ${GREEN}$DMG_FILE${NC}"
    echo -e "Grootte: ${GREEN}$DMG_SIZE${NC}"
    echo ""
    echo "Installatie op een andere Mac:"
    echo "  1. Kopieer de .dmg naar de Mac"
    echo "  2. Open de .dmg en sleep Vertaalapp naar Applications"
    echo "  3. Rechts-klik op Vertaalapp → Open (Gatekeeper bypass)"
    echo "  4. Of voer uit: xattr -cr /Applications/Vertaalapp.app"
else
    echo "  Check electron/dist/ for the built application."
fi
