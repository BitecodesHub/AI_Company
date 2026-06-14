#!/bin/bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
cd "$(dirname "$0")"
echo "Stopping Bitecodes..."
pkill -f "nest start" 2>/dev/null && echo "  ✅ API stopped" || true
pkill -f "next dev" 2>/dev/null && echo "  ✅ Web stopped" || true
docker compose down 2>/dev/null && echo "  ✅ Containers stopped" || true
echo "Done."
