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
  log "Starting services ($COMPOSE_FILE - this may take a few minutes on first run)..."

  cd "$DEPLOY_DIR"

  # Use docker-compose (standalone) or docker compose (plugin)
  if docker-compose version &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
  else
    DOCKER_COMPOSE="docker compose"
  fi

  # Ensure docker is running (may need newgrp for group)
  if ! docker info &>/dev/null; then
    warn "Docker may require a new session. Run: sudo usermod -aG docker $USER && newgrp docker"
    warn "Then run: cd $DEPLOY_DIR && $DOCKER_COMPOSE -f $COMPOSE_FILE up -d --build"
    exit 1
  fi

  # Use legacy builder if buildx is too old (common on Amazon Linux)
  export DOCKER_BUILDKIT=0
  export COMPOSE_DOCKER_CLI_BUILD=0
  if ! $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d --build 2>/dev/null; then
    err "Build failed. Ensure Docker and Docker Compose are installed and try again."
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
