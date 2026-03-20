#!/bin/bash
set -euo pipefail

# Workived Production VPS Setup Script
# Run this on a fresh Ubuntu 22.04 VPS to configure it for production deployment

echo "==================================================================="
echo "  Workived Production VPS Setup"
echo "==================================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Usage: sudo bash setup-production-vps.sh"
    exit 1
fi

# Get non-root user to create
read -p "Enter username for deployment (default: workived): " DEPLOY_USER
DEPLOY_USER=${DEPLOY_USER:-workived}

echo -e "${GREEN}Step 1/10: Updating system packages${NC}"
apt update && apt upgrade -y

echo -e "${GREEN}Step 2/10: Installing essential packages${NC}"
apt install -y \
    curl \
    wget \
    git \
    ufw \
    fail2ban \
    unattended-upgrades \
    apt-transport-https \
    ca-certificates \
    software-properties-common \
    gnupg \
    lsb-release

echo -e "${GREEN}Step 3/10: Creating deployment user: $DEPLOY_USER${NC}"
if id "$DEPLOY_USER" &>/dev/null; then
    echo -e "${YELLOW}User $DEPLOY_USER already exists, skipping${NC}"
else
    adduser --disabled-password --gecos "" "$DEPLOY_USER"
    usermod -aG sudo "$DEPLOY_USER"
    echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$DEPLOY_USER
    
    # Copy SSH keys from root to deploy user
    mkdir -p /home/$DEPLOY_USER/.ssh
    if [ -f /root/.ssh/authorized_keys ]; then
        cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/
        chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
        chmod 700 /home/$DEPLOY_USER/.ssh
        chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
    fi
fi

echo -e "${GREEN}Step 4/10: Installing Docker${NC}"
if command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker already installed, skipping${NC}"
else
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    usermod -aG docker $DEPLOY_USER
    systemctl enable docker
    systemctl start docker
fi

echo -e "${GREEN}Step 5/10: Installing Docker Compose${NC}"
if command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}Docker Compose already installed, skipping${NC}"
else
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -Po '"tag_name": "\K.*?(?=")')
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

echo -e "${GREEN}Step 6/10: Installing golang-migrate${NC}"
MIGRATE_VERSION=$(curl -s https://api.github.com/repos/golang-migrate/migrate/releases/latest | grep -Po '"tag_name": "\K.*?(?=")')
curl -L "https://github.com/golang-migrate/migrate/releases/download/${MIGRATE_VERSION}/migrate.linux-amd64.tar.gz" | tar xvz
mv migrate /usr/local/bin/
chmod +x /usr/local/bin/migrate

echo -e "${GREEN}Step 7/10: Configuring firewall (UFW)${NC}"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

echo -e "${GREEN}Step 8/10: Configuring fail2ban${NC}"
systemctl enable fail2ban
systemctl start fail2ban

echo -e "${GREEN}Step 9/10: Enabling automatic security updates${NC}"
dpkg-reconfigure -plow unattended-upgrades

echo -e "${GREEN}Step 10/10: Creating app directory${NC}"
mkdir -p /home/$DEPLOY_USER/app
chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/app

echo ""
echo -e "${GREEN}==================================================================="
echo "  ✅ Production VPS Setup Complete!"
echo "===================================================================${NC}"
echo ""
echo "Next steps:"
echo "1. Logout and login as: $DEPLOY_USER"
echo "2. Clone the repository to /home/$DEPLOY_USER/app"
echo "3. Create .env.production file with production credentials"
echo "4. Run migrations: make migrate-up"
echo "5. Start services: docker-compose -f docker-compose.production.yml up -d"
echo ""
echo -e "${YELLOW}Important security notes:${NC}"
echo "- Change SSH port from 22 (edit /etc/ssh/sshd_config)"
echo "- Disable password authentication (use SSH keys only)"
echo "- Setup monitoring (Netdata, UptimeRobot)"
echo "- Configure backups"
echo ""
