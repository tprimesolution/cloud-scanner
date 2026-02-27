#!/bin/bash
# EC2 User Data - paste this into Launch Instance > Advanced > User Data
#
# 1. Replace REPO_URL with your git repo (public: https://github.com/your-org/cs.git)
# 2. For private repo: use https://TOKEN@github.com/org/repo.git
# 3. Open port 80 in EC2 Security Group (inbound)
# 4. Attach IAM role for AWS scanning (optional)

set -e
exec > >(tee /var/log/user-data.log) 2>&1

REPO_URL="https://github.com/YOUR_ORG/cs.git"   # <-- REPLACE with your repo URL
INSTALL_DIR="/opt/nimbus-guard"

echo "[*] Nimbus Guard - EC2 User Data install"

# Install git, Docker
echo "[*] Installing dependencies..."
dnf update -y
dnf install -y docker git

# Docker Compose (standalone - works with older Docker)
ARCH=$(uname -m)
[ "$ARCH" = "x86_64" ] || ARCH="aarch64"
curl -sSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${ARCH}" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Start Docker
systemctl start docker
systemctl enable docker

# Clone repo
echo "[*] Cloning repository..."
mkdir -p "$(dirname "$INSTALL_DIR")"
git clone "$REPO_URL" "$INSTALL_DIR" || { echo "[x] Clone failed. Check REPO_URL and network."; exit 1; }

# Deploy (appliance-backend + frontend + nginx)
echo "[*] Building and starting services..."
cd "$INSTALL_DIR/deploy"
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

if ! docker-compose -f docker-compose.yml up -d --build 2>/dev/null; then
  echo "[x] Compose build failed. Check Docker and try again."
  exit 1
fi

echo "[*] Done. UI at http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):80"
