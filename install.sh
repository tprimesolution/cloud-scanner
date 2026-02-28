#!/bin/bash
# Nimbus Guard - Single-click install for Amazon Linux 2023
# Run as: curl -sSL <url> | bash   OR   ./install.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[*]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[x]${NC} $1"; exit 1; }

buildx_version_ge() {
  # Returns 0 if current buildx version >= required version.
  required="$1"
  current="$2"
  [ -z "$current" ] && return 1
  smallest="$(printf '%s\n%s\n' "$required" "$current" | sort -V | head -n1)"
  [ "$smallest" = "$required" ]
}

detect_buildx_version() {
  docker buildx version 2>/dev/null | awk '{
    for (i = 1; i <= NF; i++) {
      if ($i ~ /^v?[0-9]+\.[0-9]+\.[0-9]+$/) {
        gsub(/^v/, "", $i)
        print $i
        exit
      }
    }
  }'
}

install_or_upgrade_buildx() {
  REQUIRED_BUILDX_VERSION="0.17.0"
  TARGET_BUILDX_VERSION="0.17.1"
  CURRENT_BUILDX_VERSION="$(detect_buildx_version || true)"

  if buildx_version_ge "$REQUIRED_BUILDX_VERSION" "$CURRENT_BUILDX_VERSION"; then
    log "Docker buildx v$CURRENT_BUILDX_VERSION is compatible."
    return
  fi

  warn "Docker buildx v${REQUIRED_BUILDX_VERSION}+ is required (detected: ${CURRENT_BUILDX_VERSION:-none})."
  log "Installing Docker buildx v$TARGET_BUILDX_VERSION..."

  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64) BUILDX_ARCH="amd64" ;;
    aarch64|arm64) BUILDX_ARCH="arm64" ;;
    *)
      warn "Unsupported architecture for automatic buildx install: $ARCH"
      warn "Proceeding without buildx upgrade."
      return
      ;;
  esac

  BUILDX_URL="https://github.com/docker/buildx/releases/download/v${TARGET_BUILDX_VERSION}/buildx-v${TARGET_BUILDX_VERSION}.linux-${BUILDX_ARCH}"
  BUILDX_PLUGIN_DIR="/usr/libexec/docker/cli-plugins"
  BUILDX_PLUGIN_PATH="${BUILDX_PLUGIN_DIR}/docker-buildx"

  sudo mkdir -p "$BUILDX_PLUGIN_DIR"
  sudo curl -fsSL "$BUILDX_URL" -o "$BUILDX_PLUGIN_PATH"
  sudo chmod +x "$BUILDX_PLUGIN_PATH"
  sudo systemctl restart docker

  UPDATED_BUILDX_VERSION="$(detect_buildx_version || true)"
  if buildx_version_ge "$REQUIRED_BUILDX_VERSION" "$UPDATED_BUILDX_VERSION"; then
    log "Docker buildx upgraded to v$UPDATED_BUILDX_VERSION."
  else
    warn "buildx upgrade verification failed (detected: ${UPDATED_BUILDX_VERSION:-none})."
    warn "The installer will continue in classic compose mode."
  fi
}

FORCE_REBUILD=0
STATUS_ONLY=0

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --rebuild)
        FORCE_REBUILD=1
        ;;
      --status)
        STATUS_ONLY=1
        ;;
      -h|--help)
        echo "Usage: ./install.sh [--rebuild] [--status]"
        echo "  --rebuild   Force image rebuild even if inputs are unchanged."
        echo "  --status    Show whether a rebuild is needed, then exit."
        exit 0
        ;;
      *)
        err "Unknown argument: $1"
        ;;
    esac
    shift
  done
}

# Detect OS
detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "$ID"
  else
    err "Cannot detect OS. This script supports Amazon Linux 2023."
  fi
}

# Install Docker on Amazon Linux 2023
install_docker_al2023() {
  log "Installing Docker..."
  sudo dnf update -y
  sudo dnf install -y docker
  sudo systemctl start docker
  sudo systemctl enable docker
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  log "Docker installed."
}

# Install Docker Compose (standalone binary - works with older Docker)
install_docker_compose() {
  if docker-compose version &>/dev/null; then
    log "Docker Compose already installed."
    return
  fi
  if docker compose version &>/dev/null 2>&1; then
    log "Docker Compose (plugin) already installed."
    return
  fi
  log "Installing Docker Compose..."
  ARCH=$(uname -m)
  [ "$ARCH" = "x86_64" ] && ARCH="x86_64" || ARCH="aarch64"
  sudo curl -sSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${ARCH}" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  log "Docker Compose installed."
}

# Install Docker on Amazon Linux 2 (older)
install_docker_al2() {
  log "Installing Docker (Amazon Linux 2)..."
  sudo yum update -y
  sudo yum install -y docker
  sudo systemctl start docker
  sudo systemctl enable docker
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  log "Docker installed."
}

# Main install
main() {
  parse_args "$@"

  log "Nimbus Guard - Single-click installer"
  log "Target: Amazon Linux (2023 or 2)"

  # Skip Docker install if SKIP_DEPS=1 (for testing when Docker already installed)
  if [ "${SKIP_DEPS:-0}" != "1" ]; then
  OS=$(detect_os)
  case "$OS" in
    amzn)
      if [ -f /etc/os-release ] && grep -q "2023" /etc/os-release 2>/dev/null; then
        install_docker_al2023
      else
        install_docker_al2
      fi
      ;;
    *)
      warn "OS '$OS' detected. Attempting Amazon Linux install steps..."
      install_docker_al2023
      ;;
  esac

  install_docker_compose
  install_or_upgrade_buildx
  fi

  # Resolve project root (directory containing install.sh)
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"
  DEPLOY_DIR="$PROJECT_ROOT/deploy"

  COMPOSE_FILE="docker-compose.yml"
  if [ ! -f "$DEPLOY_DIR/$COMPOSE_FILE" ]; then
    err "No docker-compose.yml found at $DEPLOY_DIR. Run this script from the project root."
  fi

  log "Project root: $PROJECT_ROOT"
  if [ "$STATUS_ONLY" != "1" ]; then
    log "Starting services ($COMPOSE_FILE - this may take a few minutes on first run)..."
  fi

  cd "$DEPLOY_DIR"

  # Use docker-compose (standalone) or docker compose (plugin)
  if docker-compose version &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
  else
    DOCKER_COMPOSE="docker compose"
  fi

  # Prefer BuildKit only when buildx is available and recent enough.
  USE_BUILDKIT=0
  BUILDX_VERSION="$(detect_buildx_version || true)"
  if buildx_version_ge "0.17.0" "$BUILDX_VERSION"; then
    USE_BUILDKIT=1
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    export BUILDKIT_PROGRESS=auto
    log "Using BuildKit/buildx v$BUILDX_VERSION (parallel build enabled)."
  else
    warn "Docker buildx v0.17.0+ not found (detected: ${BUILDX_VERSION:-none})."
    warn "Falling back to classic compose build mode (no parallel build)."
    unset DOCKER_BUILDKIT COMPOSE_DOCKER_CLI_BUILD BUILDKIT_PROGRESS
  fi

  STATE_FILE="$DEPLOY_DIR/.build-state.sha256"
  BUILD_INPUTS=(
    "deploy/docker-compose.yml"
    "appliance-backend/Dockerfile"
    "appliance-backend/package.json"
    "appliance-backend/package-lock.json"
    "appliance-backend/prisma"
    "appliance-backend/src"
    "appliance-backend/scanner-engine/shield-engine/Dockerfile"
    "appliance-backend/scanner-engine/shield-engine/requirements.txt"
    "appliance-backend/scanner-engine/shield-engine/prowler_engine"
    "frontend/Dockerfile"
    "frontend/package.json"
    "frontend/package-lock.json"
    "frontend/next.config.js"
    "frontend/app"
    "frontend/components"
    "frontend/services"
  )

  cd "$PROJECT_ROOT"
  if command -v sha256sum >/dev/null 2>&1; then
    CURRENT_HASH="$(tar -cf - "${BUILD_INPUTS[@]}" 2>/dev/null | sha256sum | awk '{print $1}')"
  else
    CURRENT_HASH="$(tar -cf - "${BUILD_INPUTS[@]}" 2>/dev/null | shasum -a 256 | awk '{print $1}')"
  fi
  PREVIOUS_HASH=""
  [ -f "$STATE_FILE" ] && PREVIOUS_HASH="$(cat "$STATE_FILE")"

  NEED_BUILD=0
  if [ "$FORCE_REBUILD" = "1" ]; then
    NEED_BUILD=1
    log "Forced rebuild requested."
  elif [ ! -f "$STATE_FILE" ] || [ "$CURRENT_HASH" != "$PREVIOUS_HASH" ]; then
    NEED_BUILD=1
    log "Build inputs changed. Rebuilding images."
  else
    log "Build inputs unchanged. Reusing existing images."
  fi

  if [ "$STATUS_ONLY" = "1" ]; then
    if [ "$NEED_BUILD" = "1" ]; then
      echo "status: rebuild_required"
    else
      echo "status: up_to_date"
    fi
    exit 0
  fi

  # Ensure docker is running (may need newgrp for group)
  if ! docker info &>/dev/null; then
    warn "Docker may require a new session. Run: sudo usermod -aG docker $USER && newgrp docker"
    warn "Then run: cd $DEPLOY_DIR && $DOCKER_COMPOSE -f $COMPOSE_FILE up -d --build"
    exit 1
  fi

  cd "$DEPLOY_DIR"
  if [ "$NEED_BUILD" = "1" ]; then
    if [ "$USE_BUILDKIT" = "1" ]; then
      if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" build --parallel; then
        warn "Parallel build failed. Retrying with classic compose build mode."
        USE_BUILDKIT=0
        unset DOCKER_BUILDKIT COMPOSE_DOCKER_CLI_BUILD BUILDKIT_PROGRESS
      fi
    fi

    if [ "$USE_BUILDKIT" = "0" ]; then
      if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" build; then
        err "Compose build failed in classic mode. Ensure Docker and Docker Compose are installed and try again."
      fi
    fi

    if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d; then
      err "Compose up failed after build. Ensure Docker and Docker Compose are installed and try again."
    fi
    echo "$CURRENT_HASH" > "$STATE_FILE"
  else
    if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d; then
      err "Compose up failed. Try rerunning with --rebuild."
    fi
  fi

  log "Done!"
  echo ""
  HOST=$(curl -s --connect-timeout 1 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || (hostname -I 2>/dev/null | awk '{print $1}') || hostname 2>/dev/null || echo 'localhost')
  [ -z "$HOST" ] && HOST="localhost"
  echo "  Nimbus Guard is running."
  echo "  Access the UI at:  http://${HOST}:80"
  echo ""
  echo "  Commands:"
  echo "    View logs:  cd $DEPLOY_DIR && $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
  echo "    Stop:      cd $DEPLOY_DIR && $DOCKER_COMPOSE -f $COMPOSE_FILE down"
  echo ""
}

main "$@"
