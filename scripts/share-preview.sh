#!/usr/bin/env bash
# Keep a public link to the local preview alive, through a Cloudflare quick tunnel.
#
#   bash scripts/share-preview.sh
#
# Free, no Cloudflare account needed. The address is random per run but the
# tunnel reconnects internally, so it does not change while this stays open.
# The address is printed in a box and written to .preview-url.txt. Ctrl+C to stop.

set -u
PORT="${PORT:-8087}"
HERE="$(cd "$(dirname "$0")" && pwd)"
URLFILE="${URLFILE:-$HERE/../.preview-url.txt}"
CF="${CF:-/c/Program Files (x86)/cloudflared/cloudflared.exe}"

[ -x "$CF" ] || CF="$(command -v cloudflared || true)"
[ -n "${CF:-}" ] || { echo "找不到 cloudflared。安装：winget install --id Cloudflare.cloudflared"; exit 1; }

if ! curl -s -o /dev/null --max-time 5 "http://localhost:${PORT}/"; then
  echo "本机预览服务没在 ${PORT} 端口运行。先在另一个窗口执行："
  echo "    python scripts/preview-server.py --port ${PORT}"
  exit 1
fi

echo "按 Ctrl+C 结束。"
echo

trap 'echo; echo "已停止。"; exit 0' INT TERM

"$CF" tunnel --url "http://localhost:${PORT}" --no-autoupdate 2>&1 | while IFS= read -r line; do
    url=$(printf '%s' "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1)
    if [ -n "$url" ]; then
      printf '%s
' "$url" > "$URLFILE"
      echo
      echo "  +--------------------------------------------------------------+"
      printf "  |  地址    %-52s|
" "$url"
      echo   "  |  用户名  phai                                                |"
      echo "  +--------------------------------------------------------------+"
      echo
    else
      printf '%s
' "$line" | grep -viE "originCertPath|cert\.pem|autoupdate" || true
    fi
  done
