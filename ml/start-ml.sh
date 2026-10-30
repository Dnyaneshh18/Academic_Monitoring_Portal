#!/usr/bin/env bash
# ============================================================
#  ML Microservice - Local NLP Auto-Evaluation
#  Starts the Flask service on port 8000
# ============================================================
set -e

cd "$(dirname "$0")"

# --- Activate virtual environment if it exists ---
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

# --- Install dependencies if flask is missing ---
if ! python -c "import flask" 2>/dev/null; then
    echo "[ml] Installing dependencies..."
    python -m pip install -r requirements.txt
fi

echo ""
echo "============================================================"
echo "  ML Microservice starting on http://localhost:8000"
echo "  Health check: http://localhost:8000/health"
echo "  Keep this terminal open while using the portal."
echo "============================================================"
echo ""
exec python main.py
