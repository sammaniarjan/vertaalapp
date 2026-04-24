#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Vertaalapp Setup ==="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 is not installed"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "ERROR: node is not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed"
    exit 1
fi

if ! command -v ffmpeg &> /dev/null; then
    echo "WARNING: ffmpeg is not installed. Audio processing will not work."
    echo "Install with: brew install ffmpeg"
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "Python version: $PYTHON_VERSION"
echo "Node version: $(node --version)"
echo ""

# Backend setup
echo "--- Setting up backend ---"
cd "$ROOT_DIR/backend"

if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

echo "Installing Python dependencies..."
.venv/bin/pip install --upgrade pip -q
.venv/bin/pip install -r requirements.txt -q

# Try to install mlx-whisper (Apple Silicon only)
if python3 -c "import platform; exit(0 if platform.machine() == 'arm64' else 1)" 2>/dev/null; then
    echo "Apple Silicon detected, installing mlx-whisper..."
    .venv/bin/pip install mlx-whisper -q 2>/dev/null || echo "mlx-whisper install failed, will use fallback"
else
    echo "Not Apple Silicon, trying faster-whisper..."
    .venv/bin/pip install faster-whisper -q 2>/dev/null || {
        echo "faster-whisper failed, installing openai-whisper..."
        .venv/bin/pip install openai-whisper -q
    }
fi

echo "Backend setup complete!"
echo ""

# Frontend setup
echo "--- Setting up frontend ---"
cd "$ROOT_DIR/frontend"

echo "Installing npm dependencies..."
npm install --silent

echo "Frontend setup complete!"
echo ""

echo "=== Setup complete! ==="
echo ""
echo "To start the app:"
echo "  make dev"
echo ""
echo "Or start individually:"
echo "  make dev-backend   (http://localhost:8000)"
echo "  make dev-frontend  (http://localhost:5173)"
echo ""
echo "Note: Models will be downloaded on first run (~1.7GB total)"
