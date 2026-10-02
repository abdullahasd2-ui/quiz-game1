#!/usr/bin/env bash
# One-time setup for automatic deploys, run from your Mac at the repo root:
#   deploy/bootstrap.sh root            # SSH user on the server
# It prepares the server (folder, secrets, Nginx, SSL), creates a dedicated deploy key,
# and stores SSH_HOST / SSH_USER / SSH_PRIVATE_KEY as GitHub secrets. Then trigger a deploy.
set -euo pipefail
SSH_USER=${1:?usage: deploy/bootstrap.sh <ssh-user>}
HOST=178.128.242.220
REPO=abdullahasd2-ui/quiz-game1
cd "$(dirname "$0")"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
ssh-keygen -q -t ed25519 -N '' -C "github-actions@jawabbadel" -f "$tmp/key"

# Inline nginx.conf into the server script, then run it remotely.
python3 - "$tmp" <<'PY'
import sys, pathlib
t = pathlib.Path(sys.argv[1])
script = pathlib.Path('server-setup.sh').read_text().replace('__NGINX_CONF__', pathlib.Path('nginx.conf').read_text().rstrip())
(t / 'setup.sh').write_text(script)
PY
ssh "$SSH_USER@$HOST" "sudo -n true 2>/dev/null && SUDO=sudo || SUDO=; \$SUDO bash -s -- '$(cat "$tmp/key.pub")'" < "$tmp/setup.sh"

gh secret set SSH_HOST --repo "$REPO" --body "$HOST"
gh secret set SSH_USER --repo "$REPO" --body "$SSH_USER"
gh secret set SSH_PRIVATE_KEY --repo "$REPO" < "$tmp/key"
echo "Done. Deploy: merge into main, or: gh workflow run deploy.yml --repo $REPO --ref main"
