#!/usr/bin/env bash
# install.sh — set up Simone Bridges Web Design outreach toolkit
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

info()    { printf "${BOLD}%s${RESET}\n" "$*"; }
success() { printf "${GREEN}✓ %s${RESET}\n" "$*"; }
warn()    { printf "${YELLOW}! %s${RESET}\n" "$*"; }
die()     { printf "${RED}✗ %s${RESET}\n" "$*" >&2; exit 1; }

# ── locate repo root (works whether invoked via curl or directly) ──────────────
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || pwd)"
AGENTS_DIR="$REPO_DIR/agents"

# If the script is piped through bash (curl | bash), BASH_SOURCE is empty.
# In that case, assume the caller's working directory is the repo root, OR
# clone the repo fresh.
if [[ ! -d "$AGENTS_DIR" ]]; then
  info "agents/ directory not found at $REPO_DIR."
  info "Cloning repository …"
  CLONE_DIR="$HOME/webdesign"
  git clone https://github.com/simonemargotbridges-lab/webdesign "$CLONE_DIR" \
    || die "git clone failed. Check your network connection and try again."
  REPO_DIR="$CLONE_DIR"
  AGENTS_DIR="$REPO_DIR/agents"
  success "Cloned to $REPO_DIR"
fi

# ── 1. check Node.js ──────────────────────────────────────────────────────────
info "Checking Node.js …"
if ! command -v node &>/dev/null; then
  die "Node.js is not installed. Install Node.js 18+ from https://nodejs.org and re-run this script."
fi

NODE_VER="$(node -e 'process.stdout.write(process.versions.node)')"
NODE_MAJOR="${NODE_VER%%.*}"
if (( NODE_MAJOR < 18 )); then
  die "Node.js $NODE_VER is too old. Version 18+ is required. Visit https://nodejs.org to upgrade."
fi
success "Node.js $NODE_VER"

# ── 2. install npm dependencies ───────────────────────────────────────────────
info "Installing npm dependencies …"
(cd "$AGENTS_DIR" && npm install --prefer-offline --no-fund --no-audit 2>&1) \
  || die "npm install failed. Check the error above and retry."
success "Dependencies installed"

# ── 3. copy .env.example → .env ──────────────────────────────────────────────
ENV_FILE="$AGENTS_DIR/.env"
ENV_EXAMPLE="$AGENTS_DIR/.env.example"

if [[ -f "$ENV_FILE" ]]; then
  warn ".env already exists — skipping copy. Edit it manually if needed."
else
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  success "Created agents/.env from .env.example"
fi

# ── 4. done ───────────────────────────────────────────────────────────────────
printf "\n${BOLD}Setup complete!${RESET}\n\n"
printf "Next steps:\n"
printf "  1. Open ${BOLD}agents/.env${RESET} and fill in your API keys and email address.\n"
printf "     Required:\n"
printf "       ANTHROPIC_API_KEY   — https://console.anthropic.com\n"
printf "       GOOGLE_PLACES_API_KEY — https://console.cloud.google.com\n"
printf "       GMAIL_USER / GMAIL_APP_PASSWORD — https://myaccount.google.com/apppasswords\n"
printf "\n"
printf "  2. Run the outreach pipeline:\n"
printf "       cd %s/agents\n" "$REPO_DIR"
printf "       npm run find    # discover prospects\n"
printf "       npm run draft   # draft emails with Claude\n"
printf "       npm run send    # review and send (asks before each)\n"
printf "\n"
printf "  Or run everything at once:\n"
printf "       npm run run\n"
printf "\n"
printf "  ${YELLOW}Tip:${RESET} DRY_RUN=true in .env means nothing is sent until you flip it to false.\n\n"
