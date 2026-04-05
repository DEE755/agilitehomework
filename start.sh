#!/bin/bash

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RESET='\033[0m'

echo -e "${CYAN}Starting Agilite...${RESET}"

# Start backend
echo -e "${YELLOW}[server]${RESET} Starting on http://localhost:3000"
cd "$ROOT/server" && npm run dev &
SERVER_PID=$!

# Start frontend
echo -e "${GREEN}[client]${RESET} Starting on http://localhost:5173"
cd "$ROOT/client" && npm run dev &
CLIENT_PID=$!

# Handle Ctrl+C — kill both
trap "echo ''; echo 'Stopping...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit 0" INT TERM

wait
