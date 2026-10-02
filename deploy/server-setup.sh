#!/usr/bin/env bash
# Runs ON the server (as root), streamed by deploy/bootstrap.sh. Idempotent: safe to re-run.
# Usage: server-setup.sh '<deploy public key>'
set -euo pipefail
DOMAIN=jawabbadel.com
DIR=/opt/quiz
PUBKEY=${1:?deploy public key required}
# The SSH login GitHub Actions will use (this script may run through sudo).
DEPLOY_USER=${SUDO_USER:-$(id -un)}
DEPLOY_HOME=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)

command -v docker >/dev/null || { echo "Docker is not installed" >&2; exit 1; }
command -v nginx >/dev/null || { echo "Nginx is not installed" >&2; exit 1; }
if [ "$DEPLOY_USER" != root ] && ! id -nG "$DEPLOY_USER" | grep -qw docker; then
  usermod -aG docker "$DEPLOY_USER"
fi

# 1. App folder + secrets (generated once, never overwritten).
mkdir -p "$DIR"
if [ ! -f "$DIR/.env" ]; then
  umask 077
  cat > "$DIR/.env" <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 32)
APP_PORT=3100
ENV
  echo "created $DIR/.env"
fi
chown -R "$DEPLOY_USER" "$DIR"
if ss -ltn 'sport = :3100' | grep -q LISTEN && ! docker ps --format '{{.Names}}' | grep -q '^quiz-app'; then
  echo "port 3100 is taken by something else; set APP_PORT in $DIR/.env and deploy/nginx.conf" >&2; exit 1
fi

# 2. GitHub Actions deploy key (only allowed for this user's login).
AUTH="$DEPLOY_HOME/.ssh/authorized_keys"
mkdir -p "$DEPLOY_HOME/.ssh" && touch "$AUTH"
grep -qxF "$PUBKEY" "$AUTH" || echo "$PUBKEY" >> "$AUTH"
chown -R "$DEPLOY_USER" "$DEPLOY_HOME/.ssh" && chmod 700 "$DEPLOY_HOME/.ssh" && chmod 600 "$AUTH"

# 3. Nginx site + TLS. Written once: certbot edits it afterwards to add HTTPS.
if [ ! -f /etc/nginx/sites-available/jawabbadel ]; then
  cat > /etc/nginx/sites-available/jawabbadel <<'NGINX'
__NGINX_CONF__
NGINX
fi
ln -sf /etc/nginx/sites-available/jawabbadel /etc/nginx/sites-enabled/jawabbadel
nginx -t
systemctl reload nginx
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect --non-interactive --agree-tos \
    ${CERTBOT_EMAIL:+-m "$CERTBOT_EMAIL"} ${CERTBOT_EMAIL:---register-unsafely-without-email}
fi
echo "server ready: $DIR"
