#!/usr/bin/env bash
# ==============================================================================
# Obsidian Panel — Automated Production Installer
# Optimized for Ubuntu 20.04/22.04/24.04 LTS & Debian 11/12
#
# Features:
#   - Local Database Setup (PostgreSQL + Redis installed & configured on localhost)
#   - Crash Auto-Recovery & Daemon Watchdogs (Systemd Restart=always, Pterodactyl-style)
#   - Automatic Nginx Installation & Reverse Proxy Configuration
#   - Full SSL (Certbot / Let's Encrypt) and Non-SSL (Plain HTTP) support
#   - FQDN / Domain & IP configuration
#   - Automated Single-use Initial Administrator Bootstrap
# ==============================================================================

set -e

# Terminal Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

clear

echo -e "${CYAN}${BOLD}"
cat << "EOF"
  ____  _         _     _ _             ____                  _ 
 / __ \| |       (_)   | (_)           |  _ \                | |
| |  | | |__  ___ _  __| |_  __ _ _ __ | |_) | __ _ _ __   ___| |
| |  | | '_ \/ __| |/ _` | |/ _` | '_ \|  _ < / _` | '_ \ / _ \ |
| |__| | |_) \__ \ | (_| | | (_| | | | | |_) | (_| | | | |  __/ |
 \____/|_.__/|___/_|\__,_|_|\__,_|_| |_|____/ \__,_|_| |_|\___|_|

      Modern Game Server Management Panel for Pterodactyl Wings
EOF
echo -e "${NC}\n"

# ------------------------------------------------------------------------------
# 1. Root & OS Verification
# ------------------------------------------------------------------------------
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[ERROR] This installer must be run as root (use sudo).${NC}"
    exit 1
fi

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo -e "${RED}[ERROR] Cannot detect Linux distribution.${NC}"
    exit 1
fi

echo -e "${GREEN}[*] Detected operating system: $OS $VERSION${NC}"

if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
    echo -e "${YELLOW}[WARNING] This script is optimized for Ubuntu and Debian.${NC}"
    read -p "Do you want to continue anyway? [y/N]: " continue_anyway
    if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# ------------------------------------------------------------------------------
# 2. Collect Configuration Parameters
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}--- Configuration Setup ---${NC}"

# FQDN
while true; do
    read -p "Enter the FQDN or IP for your Obsidian Panel (e.g. panel.example.com or 192.168.1.50): " FQDN
    FQDN=$(echo "$FQDN" | tr -d ' ' | tr '[:upper:]' '[:lower:]')
    if [ -n "$FQDN" ]; then
        break
    fi
    echo -e "${RED}FQDN / Domain cannot be empty.${NC}"
done

# SSL or Non-SSL Selection
echo -e "\n${BOLD}Select Web Protocol:${NC}"
echo "  1) SSL / HTTPS (Recommended — Automatic Let's Encrypt certificate)"
echo "  2) Non-SSL / HTTP (Plain port 80 — For local networks, test labs, or upstream reverse proxies)"
read -p "Choice [1/2, default: 1]: " SSL_CHOICE
SSL_CHOICE=${SSL_CHOICE:-1}

USE_SSL=true
SCHEME="https"
CERT_EMAIL=""

if [ "$SSL_CHOICE" == "2" ]; then
    USE_SSL=false
    SCHEME="http"
    echo -e "${YELLOW}[!] Non-SSL mode selected. The Panel will be accessible over plain HTTP on port 80.${NC}"
else
    echo -e "${GREEN}[*] SSL mode selected. Automatic Let's Encrypt certificates will be configured.${NC}"
    while true; do
        read -p "Enter admin email address for Let's Encrypt certificate renewal notices: " CERT_EMAIL
        if [ -n "$CERT_EMAIL" ]; then
            break
        fi
        echo -e "${RED}Email cannot be empty for SSL certificate registration.${NC}"
    done
fi

APP_URL="${SCHEME}://${FQDN}"
echo -e "\n${GREEN}[*] Application URL configured to: ${BOLD}${APP_URL}${NC}"

# ------------------------------------------------------------------------------
# 3. Install System Packages & Node.js 20 LTS
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}--- Installing System Dependencies & Node.js 20 ---${NC}"

apt-get update -y
apt-get install -y curl wget git jq openssl ca-certificates gnupg lsb-release build-essential nginx

# Install Node.js 20 LTS if missing or outdated
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
    echo -e "${GREEN}[*] Installing Node.js 20 LTS from NodeSource...${NC}"
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
    apt-get update -y
    apt-get install -y nodejs
fi

# Enable corepack & pnpm
corepack enable
corepack prepare pnpm@9.12.3 --activate

if [ "$USE_SSL" = true ]; then
    echo -e "${GREEN}[*] Installing Certbot for Nginx...${NC}"
    apt-get install -y certbot python3-certbot-nginx
fi

# ------------------------------------------------------------------------------
# 4. Local Database Setup (PostgreSQL & Redis — Pterodactyl-Style)
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}--- Setting Up Local PostgreSQL & Redis ---${NC}"

apt-get install -y postgresql postgresql-contrib redis-server

systemctl enable --now postgresql
systemctl enable --now redis-server

DB_NAME="obsidian_panel"
DB_USER="obsidian"
DB_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 16)
SESSION_SECRET=$(openssl rand -hex 32)

echo -e "${GREEN}[*] Initializing local database '${DB_NAME}' and user '${DB_USER}'...${NC}"

# Configure local PostgreSQL user and database
sudo -u postgres psql -c "DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || \
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

# Ensure local PostgreSQL accepts localhost connections
PG_CONF_DIR=$(ls -d /etc/postgresql/*/*/ 2>/dev/null | head -n 1)
if [ -n "$PG_CONF_DIR" ] && [ -f "$PG_CONF_DIR/pg_hba.conf" ]; then
    grep -q "obsidian_panel" "$PG_CONF_DIR/pg_hba.conf" || \
    sed -i "1s|^|local   obsidian_panel  obsidian                                md5\nhost    obsidian_panel  obsidian        127.0.0.1/32            md5\n|" "$PG_CONF_DIR/pg_hba.conf"
    systemctl restart postgresql
fi

echo -e "${GREEN}[*] Local PostgreSQL successfully configured on 127.0.0.1:5432.${NC}"

# ------------------------------------------------------------------------------
# 5. SSL Certificate Request (if SSL selected)
# ------------------------------------------------------------------------------
if [ "$USE_SSL" = true ]; then
    echo -e "\n${BOLD}${CYAN}--- Requesting Let's Encrypt SSL Certificate ---${NC}"
    systemctl stop nginx || true

    certbot certonly --standalone -d "$FQDN" --non-interactive --agree-tos -m "$CERT_EMAIL" || {
        echo -e "${YELLOW}[WARNING] Standalone certbot failed. Trying webroot / nginx method...${NC}"
        systemctl start nginx
        certbot certonly --nginx -d "$FQDN" --non-interactive --agree-tos -m "$CERT_EMAIL" || {
            echo -e "${RED}[ERROR] Let's Encrypt certificate issuance failed.${NC}"
            echo -e "${RED}Please verify that ${FQDN} points to this server IP address.${NC}"
            read -p "Do you want to switch to Non-SSL mode and continue? [y/N]: " switch_non_ssl
            if [[ "$switch_non_ssl" =~ ^[Yy]$ ]]; then
                USE_SSL=false
                SCHEME="http"
                APP_URL="${SCHEME}://${FQDN}"
            else
                exit 1
            fi
        }
    }
fi

# ------------------------------------------------------------------------------
# 6. Automatic Nginx Reverse Proxy Setup
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}--- Configuring Nginx Reverse Proxy ---${NC}"

NGINX_CONF="/etc/nginx/sites-available/obsidian.conf"

if [ "$USE_SSL" = true ]; then
    cat << EOF > "$NGINX_CONF"
# Obsidian Panel — Production SSL Configuration
server {
    listen 80;
    listen [::]:80;
    server_name $FQDN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $FQDN;

    ssl_certificate /etc/letsencrypt/live/$FQDN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$FQDN/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    client_max_body_size 100M;

    # Backend API & Wings Remote callbacks
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Next.js Web Frontend & Real-Time Console WebSocket
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF
else
    cat << EOF > "$NGINX_CONF"
# Obsidian Panel — Non-SSL HTTP Configuration
server {
    listen 80;
    listen [::]:80;
    server_name $FQDN;

    client_max_body_size 100M;

    # Backend API & Wings Remote callbacks
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto http;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Next.js Web Frontend & WebSocket streaming
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto http;
    }
}
EOF
fi

rm -f /etc/nginx/sites-enabled/default
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/obsidian.conf

nginx -t
systemctl restart nginx
systemctl enable nginx

echo -e "${GREEN}[*] Nginx configured and running.${NC}"

# ------------------------------------------------------------------------------
# 7. Application Code Installation & Build
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}--- Building Application Components ---${NC}"

INSTALL_DIR="/var/www/obsidian"
mkdir -p "$INSTALL_DIR"

NODE_BIN=$(command -v node || echo "/usr/bin/node")
PNPM_BIN=$(command -v pnpm || echo "/usr/local/bin/pnpm")

# If running from a cloned source directory, copy files; otherwise clone repo
if [ -f "$PWD/package.json" ] && [ -d "$PWD/apps/api" ]; then
    echo -e "${GREEN}[*] Using local codebase from $PWD...${NC}"
    if [ "$PWD" != "$INSTALL_DIR" ]; then
        cp -rf "$PWD"/* "$INSTALL_DIR"/ 2>/dev/null || cp -r "$PWD"/* "$INSTALL_DIR"/
    fi
elif [ ! -f "$INSTALL_DIR/package.json" ]; then
    echo -e "${GREEN}[*] Downloading Obsidian Panel codebase via Git...${NC}"
    REPO_URL=${PANEL_REPO_URL:-""}
    if [ -z "$REPO_URL" ]; then
        read -p "Enter Obsidian Panel Git Repository URL [or press Enter for default]: " INPUT_REPO_URL
        REPO_URL=${INPUT_REPO_URL:-"https://github.com/obsidian-panel/panel.git"}
    fi
    echo -e "${GREEN}[*] Cloning from ${REPO_URL}...${NC}"
    git clone "$REPO_URL" "$INSTALL_DIR" || {
        echo -e "${RED}[ERROR] Failed to clone repository from $REPO_URL.${NC}"
        echo -e "${YELLOW}You can clone your repository manually to /var/www/obsidian and re-run this script.${NC}"
        exit 1
    }
fi

cd "$INSTALL_DIR"

# Write production .env file with local database connection
cat << EOF > "$INSTALL_DIR/.env"
NODE_ENV=production
PORT=3001
APP_URL=$APP_URL
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public
REDIS_URL=redis://127.0.0.1:6379
SESSION_SECRET=$SESSION_SECRET
COOKIE_SECURE=$( [ "$USE_SSL" = true ] && echo "true" || echo "false" )
EOF

cat << EOF > "$INSTALL_DIR/apps/api/.env"
NODE_ENV=production
PORT=3001
APP_URL=$APP_URL
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public
REDIS_URL=redis://127.0.0.1:6379
SESSION_SECRET=$SESSION_SECRET
COOKIE_SECURE=$( [ "$USE_SSL" = true ] && echo "true" || echo "false" )
EOF

cat << EOF > "$INSTALL_DIR/apps/web/.env"
NODE_ENV=production
PORT=3000
API_URL=http://127.0.0.1:3001
NEXT_PUBLIC_APP_URL=$APP_URL
EOF

# Install node dependencies and compile
echo -e "${GREEN}[*] Installing monorepo packages via pnpm...${NC}"
pnpm install

echo -e "${GREEN}[*] Building contracts, permissions, and wings adapter...${NC}"
pnpm --filter @obsidian/contracts build
pnpm --filter @obsidian/permissions build
pnpm --filter @obsidian/wings-adapter build

echo -e "${GREEN}[*] Generating Prisma database client and synchronizing schema...${NC}"
pnpm --filter @obsidian/api prisma:generate
if [ -d "$INSTALL_DIR/apps/api/prisma/migrations" ]; then
    pnpm --filter @obsidian/api prisma:migrate:deploy
else
    pnpm --filter @obsidian/api prisma db push --skip-generate
fi

echo -e "${GREEN}[*] Building Next.js Web Frontend & NestJS Backend...${NC}"
pnpm --filter @obsidian/api build
pnpm --filter @obsidian/web build

# Locate Next.js runner binary
if [ -f "$INSTALL_DIR/apps/web/node_modules/.bin/next" ]; then
    NEXT_BIN="$INSTALL_DIR/apps/web/node_modules/.bin/next"
elif [ -f "$INSTALL_DIR/node_modules/.bin/next" ]; then
    NEXT_BIN="$INSTALL_DIR/node_modules/.bin/next"
else
    NEXT_BIN=$(which next 2>/dev/null || echo "$INSTALL_DIR/node_modules/.bin/next")
fi

# Set permissions for web server user
chown -R www-data:www-data "$INSTALL_DIR"
chmod -R 755 "$INSTALL_DIR"

# ------------------------------------------------------------------------------
# 8. Crash Support & Systemd Watchdogs (Pterodactyl-Style Auto-Restart)
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}--- Configuring Crash Auto-Restart Services ---${NC}"

cat << EOF > /etc/systemd/system/obsidian-api.service
[Unit]
Description=Obsidian Panel API Daemon (Control Plane)
Documentation=https://github.com/obsidian-panel/panel
After=network.target postgresql.service redis.service
Requires=postgresql.service redis.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/obsidian
Environment=NODE_ENV=production
EnvironmentFile=/var/www/obsidian/.env
ExecStart=$NODE_BIN /var/www/obsidian/apps/api/dist/main.js

# Crash auto-recovery & restart policy (Pterodactyl-style)
Restart=always
RestartSec=3s
StartLimitInterval=180s
StartLimitBurst=30

LimitNOFILE=65535
StandardOutput=journal
StandardError=journal
SyslogIdentifier=obsidian-api

[Install]
WantedBy=multi-user.target
EOF

cat << EOF > /etc/systemd/system/obsidian-web.service
[Unit]
Description=Obsidian Panel Web Frontend (Next.js)
Documentation=https://github.com/obsidian-panel/panel
After=network.target obsidian-api.service
Requires=obsidian-api.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/obsidian/apps/web
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=API_URL=http://127.0.0.1:3001
ExecStart=$NODE_BIN $NEXT_BIN start -p 3000

# Crash auto-recovery & restart policy (Pterodactyl-style)
Restart=always
RestartSec=3s
StartLimitInterval=180s
StartLimitBurst=30

LimitNOFILE=65535
StandardOutput=journal
StandardError=journal
SyslogIdentifier=obsidian-web

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now obsidian-api
systemctl enable --now obsidian-web

echo -e "${GREEN}[*] Obsidian systemd services enabled with crash auto-restart.${NC}"

# ------------------------------------------------------------------------------
# 9. Initial Administrator Bootstrap
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}--- Initial Administrator Bootstrap ---${NC}"
echo -e "Create your master administrator account:"

read -p "Admin Username: " ADMIN_USERNAME
read -p "Admin Email: " ADMIN_EMAIL
while true; do
    read -s -p "Admin Password (min 8 chars): " ADMIN_PASSWORD
    echo ""
    if [ ${#ADMIN_PASSWORD} -ge 8 ]; then
        break
    fi
    echo -e "${RED}Password must be at least 8 characters long.${NC}"
done

echo -e "\n${GREEN}[*] Bootstrapping administrator account...${NC}"
pnpm --filter @obsidian/api run bootstrap -- --username "${ADMIN_USERNAME}" --email "${ADMIN_EMAIL}" --password "${ADMIN_PASSWORD}"

# ------------------------------------------------------------------------------
# 10. Installation Summary
# ------------------------------------------------------------------------------
echo -e "\n${GREEN}${BOLD}================================================================${NC}"
echo -e "${GREEN}${BOLD}       OBSIDIAN PANEL INSTALLATION COMPLETE!                   ${NC}"
echo -e "${GREEN}${BOLD}================================================================${NC}\n"

echo -e "Panel URL:       ${CYAN}${BOLD}${APP_URL}${NC}"
echo -e "Protocol:        ${BOLD}$( [ "$USE_SSL" = true ] && echo "HTTPS (SSL Active)" || echo "HTTP (Non-SSL)" )${NC}"
echo -e "Local Database:  ${BOLD}PostgreSQL on 127.0.0.1:5432 (Database: ${DB_NAME})${NC}"
echo -e "Nginx Config:    /etc/nginx/sites-available/obsidian.conf"
echo -e "Crash Recovery:  ${GREEN}Active (systemd: obsidian-api.service & obsidian-web.service)${NC}"
echo -e "Admin Account:   ${BOLD}${ADMIN_USERNAME}${NC} (${ADMIN_EMAIL})\n"

echo -e "${CYAN}Next Steps:${NC}"
echo -e "  1. Open your browser and navigate to: ${BOLD}${APP_URL}/login${NC}"
echo -e "  2. Sign in with username '${ADMIN_USERNAME}'."
echo -e "  3. Go to ${BOLD}Administration → Locations${NC} to create your first location."
echo -e "  4. Go to ${BOLD}Administration → Nodes${NC} to register your Pterodactyl Wings node."
echo -e "  5. Copy the generated ${BOLD}config.yml${NC} to ${BOLD}/etc/pterodactyl/config.yml${NC} on your node host."
echo -e "  6. Start Wings with: ${BOLD}systemctl start wings${NC}\n"
